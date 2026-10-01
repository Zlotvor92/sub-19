/* SASTAVLJANJE APLIKACIJE: skladište, sesija, API, motor sinhronizacije i store-ovi povezani u jednu celinu.

   Sve zavisnosti (skladište, mreža, sat) se prosleđuju, pa se ceo tok — od učitavanja stanja do upisa na server —
   testira bez pregledača i bez mreže. UI zove samo metode ovog objekta; komponente ne dodiruju `fetch` ni skladište. */

import { collectPersisted, hydratePersisted, onPersistRequest, type PersistMode } from '../stores';
import { useAuthStore } from '../stores/authStore';
import { useSyncStore } from '../stores/syncStore';
import { checkLoginReturn, parseAuthHash, jwtClaims } from '../lib/auth';
import { createUserStateApi, type UserStateApi } from '../services/api/userStateApi';
import { SB_LOGIN_WINDOW_MS, SB_NONCE_OK_KEY, SB_STATE_KEY } from '../services/storage/keys';
import { browserStore, type KeyValueStore } from '../services/storage/kv';
import { createStateSaver, loadState, type StateSaver } from '../services/storage/stateStorage';
import {
  createSessionManager,
  type SessionManager,
  type SessionState
} from '../services/supabase/session';
import { createSyncEngine, type SyncEngine } from '../services/sync/engine';
import { APP_VERSION, SUPABASE_ANON_KEY, SUPABASE_URL } from '../services/config';
import type { Fetcher } from '../services/http';

export interface AppDeps {
  kv?: KeyValueStore;
  fetcher?: Fetcher;
  now?: () => number;
  /** Danas kao `YYYY-MM-DD` (lokalni datum). */
  today: () => string;
  supabaseUrl?: string;
  anonKey?: string;
  appVersion?: string;
  /** Nasumičan niz za nonce prijave. */
  randomToken?: () => string;
  /** Adresa stranice (hash, upit) — za povratak sa prijave. */
  location?: { hash: string; search: string; origin: string; pathname: string };
  /** Zameni adresu bez ponovnog učitavanja (`history.replaceState`). */
  replaceUrl?: (path: string) => void;
  /** Otvori adresu (odlazak na Google prijavu). */
  navigate?: (url: string) => void;
  background?: { schedule(): void; cancel(): void };
  /** Pozadinski radnik treba da zna sesiju (IndexedDB kanal ka service workeru). */
  onSessionChanged?: (s: SessionState) => void;
  onPushed?: () => void;
  online?: () => boolean;
}

export interface App {
  kv: KeyValueStore;
  session: SessionManager;
  api: UserStateApi;
  sync: SyncEngine;
  saver: StateSaver;
  /** Pokretanje posle učitavanja: povratak sa prijave, provera sesije, sinhronizacija. */
  start(): Promise<void>;
  login(): void;
  logout(): void;
  /** `visibilitychange` → skrivena: upiši zakazano i pošalji. */
  onHidden(): void;
  /** `visibilitychange` → vidljiva: proveri sesiju. */
  onVisible(): Promise<void>;
  /** Odjava iz sync-a: usvoji stanje (npr. iz „Uzmi sa servera"). */
  adopt(): void;
}

const randomHex = (): string => {
  const a = new Uint8Array(20);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
};

export function createApp(deps: AppDeps): App {
  const kv = deps.kv ?? browserStore();
  const now = deps.now ?? Date.now;
  const fetcher: Fetcher = deps.fetcher ?? ((input, init) => fetch(input, init));
  const supabaseUrl = deps.supabaseUrl ?? SUPABASE_URL;
  const anonKey = deps.anonKey ?? SUPABASE_ANON_KEY;
  const appVersion = deps.appVersion ?? APP_VERSION;
  const loc = deps.location ?? { hash: '', search: '', origin: '', pathname: '/' };
  const auth = useAuthStore.getState();
  const sync = useSyncStore.getState();

  /* 1. Stanje: učitaj, raspodeli po store-ovima. Nečitljiv zapis NE sme da pregazi server (v. stateStorage). */
  const loaded = loadState(kv, deps.today());
  hydratePersisted(loaded.state);
  if (loaded.loadFailure) sync.set({ loadFailure: loaded.loadFailure });

  /* 2. Sesija: ogledalo u `authStore`. */
  const mirror = (s: SessionState): void => {
    auth.set({
      hasSession: !!s.userId && !!s.refresh,
      userId: s.userId,
      email: s.email,
      name: s.ime,
      picture: s.slika
    });
  };
  const session = createSessionManager({
    kv,
    fetcher,
    supabaseUrl,
    anonKey,
    now,
    onDead: (message) => auth.set({ gate: message ?? '', hasSession: false, userId: null }),
    onChanged: (s) => {
      mirror(s);
      deps.onSessionChanged?.(s);
    }
  });
  auth.set({ configured: session.isConfigured() });
  mirror(session.state);

  const api = createUserStateApi({ fetcher, session, supabaseUrl, anonKey });

  /* 3. Čuvanje: svaki upis na uređaj okida odloženo slanje na server. */
  const ref: { engine?: SyncEngine } = {};
  const saver = createStateSaver({
    kv,
    onWriteFailed: (name) => sync.set({ writeFailed: name }),
    onSaved: () => ref.engine?.schedulePush()
  });
  onPersistRequest((mode: PersistMode) => {
    if (mode === 'soon') saver.saveSoon(collectPersisted);
    else saver.save(collectPersisted());
  });

  const engine = createSyncEngine({
    session,
    api,
    getState: collectPersisted,
    adopt: (state) => {
      hydratePersisted(state);
      saver.save(state);
    },
    appVersion,
    loadFailed: !!loaded.loadFailure,
    ...(deps.background ? { background: deps.background } : {}),
    ...(deps.onPushed ? { onPushed: deps.onPushed } : {})
  });
  ref.engine = engine;
  engine.subscribe((s) => sync.set({ busy: s.busy, conflict: s.conflict }));

  /* Povratak sa Google prijave: hash sa tokenima se prihvata SAMO ako je OVAJ pregledač nedavno krenuo u prijavu i ako
     se vraćeni `sbn` poklapa; tuđ nalog preko prijavljenog se odbija (inače bi se lični podaci gurali u napadačev red). */
  function consumeLoginReturn(): { adopted: boolean; error: string } {
    let tokens = parseAuthHash(loc.hash, now());
    let nonce: string | null = null;
    try {
      nonce = new URLSearchParams(loc.search || '').get('sbn');
    } catch {
      nonce = null;
    }
    let error = '';
    if (tokens) {
      let saved: { st?: string; exp?: number } | null = null;
      try {
        saved = JSON.parse(kv.get(SB_STATE_KEY) || 'null') as typeof saved;
      } catch {
        saved = null;
      }
      kv.remove(SB_STATE_KEY); // jednokratno
      const verdict = checkLoginReturn(saved, nonce, kv.get(SB_NONCE_OK_KEY) === '1', now());
      if (verdict.rememberNonceWorks) kv.set(SB_NONCE_OK_KEY, '1');
      if (!verdict.accept) {
        tokens = null;
        deps.replaceUrl?.(loc.pathname);
      }
    }
    if (tokens) {
      const claims = jwtClaims(tokens.access);
      if (session.state.userId && claims.userId && claims.userId !== session.state.userId) {
        deps.replaceUrl?.(loc.pathname);
        return {
          adopted: false,
          error:
            'Prijava je odbijena: prijavio si se nalogom koji nije onaj sa kojim je aplikacija već povezana. Ako želiš da promeniš nalog, prvo se odjavi u Podešavanjima, pa se prijavi ponovo.'
        };
      }
      session.adopt(tokens);
      deps.replaceUrl?.(loc.pathname);
      return { adopted: true, error: '' };
    }
    /* greška sa Google strane (odbio, zatvorio prozor…) */
    if ((loc.hash || '').indexOf('error') >= 0) {
      const m = /error_description=([^&]*)/.exec(loc.hash);
      try {
        error = decodeURIComponent((m?.[1] ?? '').replace(/\+/g, ' '));
      } catch {
        error = '';
      }
      deps.replaceUrl?.(loc.pathname);
    }
    return { adopted: false, error };
  }

  return {
    kv,
    session,
    api,
    sync: engine,
    saver,
    async start() {
      if (!session.isConfigured()) {
        auth.set({ gate: null, ready: true }); // nije podešeno — radi bez naloga
        return;
      }
      const r = consumeLoginReturn();
      if (r.adopted) {
        /* Token se PROVERAVA kod Supabase-a pre nego što mu se poveruje. */
        const ok = await session.ensure().catch(() => false);
        if (!ok) session.patch({ access: null, refresh: null, userId: null });
      }
      if (!session.hasSession()) {
        auth.set({ gate: r.error, ready: true });
        return;
      }
      /* Nalog je možda obrisan ili zabranjen dok je aplikacija bila zatvorena: pita se PRE nego što se kapija skloni. */
      const alive = await session.verify(deps.online ? deps.online() : true);
      if (!alive) {
        auth.set({ ready: true });
        return;
      }
      auth.set({ gate: null, ready: true });
      await engine.start().catch(() => 'offline');
    },
    login() {
      if (!session.isConfigured()) return;
      const nonce = (deps.randomToken ?? randomHex)();
      kv.set(SB_STATE_KEY, JSON.stringify({ st: nonce, exp: now() + SB_LOGIN_WINDOW_MS }));
      /* NAMERNO se ne prosleđuje `&state=`: Supabase GoTrue taj naziv koristi interno za svoju CSRF zaštitu prema Google-u
         i prijava bi završila sa `bad_oauth_state`. Nonce putuje kao `sbn` u samoj povratnoj adresi. */
      deps.navigate?.(
        `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(`${loc.origin}/?sbn=${nonce}`)}`
      );
    },
    logout() {
      session.logout();
      auth.set({ gate: '', hasSession: false });
    },
    onHidden() {
      saver.flush(collectPersisted);
      if (session.isAuthed()) void engine.pushNow();
    },
    async onVisible() {
      if (!session.isAuthed()) return;
      await session.verify(deps.online ? deps.online() : true);
    },
    adopt() {
      saver.save(collectPersisted());
    }
  };
}
