/* SASTAVLJANJE APLIKACIJE: skladište, sesija, API, motor sinhronizacije i store-ovi povezani u jednu celinu.

   Sve zavisnosti (skladište, mreža, sat) se prosleđuju, pa se ceo tok — od učitavanja stanja do upisa na server —
   testira bez pregledača i bez mreže. UI zove samo metode ovog objekta; komponente ne dodiruju `fetch` ni skladište. */

import { collectPersisted, hydratePersisted, onPersistRequest, type PersistMode } from '../stores';
import { useAuthStore } from '../stores/authStore';
import { useSyncStore } from '../stores/syncStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useTrainingStore } from '../stores/trainingStore';
import { useRecoveryStore } from '../stores/recoveryStore';
import {
  ICU_REJECTED_MESSAGE,
  STRAVA_REJECTED_MESSAGE,
  classifyOAuthReturn,
  makeOAuthState,
  stravaAuthorizeUrl
} from '../services/oauth';
import { syncMessage } from '../services/strava/messages';
import { createStravaApi, type StravaApi, type StravaLink } from '../services/strava/stravaApi';
import {
  createStravaSync,
  type ImportState,
  type StravaSyncResult
} from '../services/strava/stravaSync';
import { checkLoginReturn, parseAuthHash, jwtClaims } from '../lib/auth';
import { createUserStateApi, type UserStateApi } from '../services/api/userStateApi';
import { createAppApi, type AppApi } from '../services/api/appApi';
import { createAccountApi, type AccountApi } from '../services/api/accountApi';
import {
  buildBackup,
  importBackup,
  type ImportFailure,
  type ImportSuccess
} from '../domain/state/backup';
import { migrateState, seedState, type PersistedState } from '../domain/state';
import { adoptServerState } from '../domain/sync/payload';
import {
  ALL_LOCAL_KEYS,
  SB_LOGIN_WINDOW_MS,
  SB_NONCE_OK_KEY,
  SB_STATE_KEY
} from '../services/storage/keys';
import { browserStore, type KeyValueStore } from '../services/storage/kv';
import { createStateSaver, loadState, type StateSaver } from '../services/storage/stateStorage';
import {
  createSessionManager,
  type SessionManager,
  type SessionState
} from '../services/supabase/session';
import { createSyncEngine, type SyncEngine } from '../services/sync/engine';
import { APP_VERSION, STRAVA_CLIENT_ID, SUPABASE_ANON_KEY, SUPABASE_URL } from '../services/config';
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
  /** Poruka korisniku (u pregledaču `alert`) — posle povratka sa povezivanja, uvoza… */
  notify?: (message: string) => void;
}

export interface App {
  kv: KeyValueStore;
  session: SessionManager;
  api: UserStateApi;
  /** Naši /api endpointi sa prijavom. */
  appApi: AppApi;
  account: AccountApi;
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
  /** Tekst backup fajla (bez veza/tokena); beleži datum backupa i gasi podsetnik. */
  exportBackup(): string;
  /** Provera uvoza — NE menja ništa. Pozivalac pokaže potvrdu, pa pozove `commitImport`. */
  prepareImport(raw: unknown): ImportFailure | ImportSuccess;
  /** Zamena stanja uvezenim; pri grešci vraća prethodno. */
  commitImport(state: PersistedState): { ok: true } | { ok: false; error: string };
  /** Vraćanje na raniju verziju sa servera; zatečeno stanje čuva baza (okidač), pa se i ovo može poništiti. */
  restoreVersion(id: string | number): Promise<{ ok: true } | { ok: false; error: string }>;
  /** Uklanja SVE tragove naloga sa ovog uređaja (tek posle potvrđenog brisanja na serveru). */
  forgetEverything(): void;
  /** Strava: povezivanje, otkačivanje, uvoz trčanja. */
  strava: {
    api: StravaApi;
    connect(): void;
    disconnect(): void;
    /** Uvoz trčanja; ne baca. Dva uvoza se ne preklapaju (drugi vraća `busy`). */
    sync(): Promise<StravaSyncResult | { ok: false; error: string; busy: true }>;
  };
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
  const appApi = createAppApi({ fetcher, session });
  const account = createAccountApi(appApi);

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

  /* Strava */
  const stravaLink = {
    get: (): StravaLink | null => useSettingsStore.getState().strava,
    set: (v: StravaLink | null): void => useSettingsStore.getState().setStrava(v)
  };
  const stravaApi = createStravaApi({ fetcher, appApi, link: stravaLink, now });
  let stravaBusy = false;
  const stravaSync = createStravaSync({
    api: stravaApi,
    link: stravaLink,
    now,
    today: deps.today,
    ports: {
      read: (): ImportState => {
        const t = useTrainingStore.getState();
        const r = useRecoveryStore.getState();
        return {
          genPlan: t.genPlan,
          log: t.log,
          pred: t.pred,
          predLock: t.predLock,
          vdotLog: t.vdotLog,
          alts: t.alts,
          moves: t.moves,
          vanPlana: r.vanPlana,
          knee: r.knee,
          kg: r.kg
        };
      },
      commit: (n: ImportState): void => {
        const t = useTrainingStore.getState();
        const r = useRecoveryStore.getState();
        r.setPain(n.knee, 'soon');
        r.setWeight(n.kg, 'soon');
        r.setOutOfPlan(n.vanPlana);
        t.patch({
          log: n.log,
          pred: n.pred,
          predLock: n.predLock,
          vdotLog: n.vdotLog,
          moves: n.moves
        });
      }
    }
  });
  const notify = deps.notify ?? ((): void => undefined);

  /* Povratak sa Strave / intervals.icu (`?code=`): proverava se `state`, razmenjuje kod, odmah se povlače trčanja. */
  async function consumeOAuthReturn(): Promise<void> {
    const ret = classifyOAuthReturn(loc.search, kv, now());
    if (ret.kind === 'none') return;
    deps.replaceUrl?.(loc.pathname);
    if (ret.kind === 'rejected') {
      notify(ret.service === 'icu' ? ICU_REJECTED_MESSAGE : STRAVA_REJECTED_MESSAGE);
      return;
    }
    if (ret.service === 'strava') {
      if (!session.isAuthed()) {
        notify('Moraš biti prijavljen da bi povezao Stravu.');
        return;
      }
      const r = await stravaApi.exchange(ret.code, ret.scope);
      if (!r.ok) {
        notify(`Povezivanje nije uspelo: ${r.error}`);
        return;
      }
      notify(`Strava povezana${r.athlete ? ` — ${r.athlete}` : ''}.`);
      const s = await runStravaSync();
      notify(syncMessage(s));
    }
  }

  async function runStravaSync(): Promise<
    StravaSyncResult | { ok: false; error: string; busy: true }
  > {
    if (stravaBusy) return { ok: false, error: 'Uvoz je već u toku.', busy: true };
    stravaBusy = true;
    try {
      return await stravaSync.run();
    } finally {
      stravaBusy = false;
    }
  }

  /* Tihi uvoz pri otvaranju i povratku u aplikaciju: instalirana PWA se ne učitava iznova nego se budi iz pozadine, pa bi bez ovoga
     završeno trčanje stajalo kao „Predstoji" dok se ručno ne pritisne dugme. Prag je kraći pri povratku (15 min) nego pri učitavanju (60). */
  function pullActivitiesIfDue(thresholdMs: number): void {
    if (stravaBusy || !(deps.online ? deps.online() : true)) return;
    const link = useSettingsStore.getState().strava;
    if (!link) return;
    const last = typeof link['lastSync'] === 'number' ? link['lastSync'] : 0;
    if (now() - last < thresholdMs) return;
    void runStravaSync();
  }

  return {
    kv,
    session,
    api,
    appApi,
    account,
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
      await consumeOAuthReturn();
      pullActivitiesIfDue(60 * 60000);
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
      pullActivitiesIfDue(15 * 60000);
    },
    adopt() {
      saver.save(collectPersisted());
    },
    exportBackup() {
      const today = deps.today();
      const text = JSON.stringify(
        buildBackup(collectPersisted(), new Date(now()).toISOString()),
        null,
        1
      );
      useSettingsStore.getState().patchUi({ lastBackup: today, snooze: null });
      return text;
    },
    prepareImport(raw) {
      return importBackup(raw, collectPersisted());
    },
    commitImport(state) {
      const before = collectPersisted();
      try {
        hydratePersisted(state);
        saver.save(collectPersisted());
        return { ok: true };
      } catch (e) {
        hydratePersisted(before);
        return { ok: false, error: e instanceof Error ? e.message : 'nepoznata greška' };
      }
    },
    async restoreVersion(id) {
      if (!session.isAuthed()) return { ok: false, error: 'Nisi prijavljen.' };
      if (!(await session.ensure())) return { ok: false, error: 'Nema veze sa internetom.' };
      const r = await api.historyData(id);
      if (!r.ok) return { ok: false, error: r.error };
      const migrated = migrateState(JSON.parse(JSON.stringify(r.data)) as unknown);
      if (!migrated)
        return {
          ok: false,
          error:
            'Ta verzija je iz novije šeme nego što je ova aplikacija. Ažuriraj aplikaciju pa probaj ponovo.'
        };
      /* ISTI put kao „Uzmi sa servera": veze sa Stravom i intervals.icu-om i koordinate ostaju (na serveru su bez tokena). */
      const before = collectPersisted();
      try {
        const next = adoptServerState(migrated, before);
        hydratePersisted(next);
        saver.save(next);
      } catch (e) {
        hydratePersisted(before);
        return {
          ok: false,
          error: `Vraćanje nije uspelo (${e instanceof Error ? e.message : 'nepoznata greška'}). Zatečeno stanje je netaknuto.`
        };
      }
      /* Odmah gore, ne za četiri sekunde: čovek je svesno vratio stanje i ne sme da zatvori aplikaciju pre nego što stigne. */
      void engine.pushNow();
      return { ok: true };
    },
    strava: {
      api: stravaApi,
      connect() {
        const st = makeOAuthState(kv, 'strava', deps.randomToken ?? randomHex, now());
        deps.navigate?.(stravaAuthorizeUrl(STRAVA_CLIENT_ID, loc.origin, st));
      },
      disconnect() {
        useSettingsStore.getState().setStrava(null);
      },
      sync: runStravaSync
    },
    forgetEverything() {
      session.logout(); // pre brisanja ključeva: odjava upisuje praznu sesiju
      for (const k of ALL_LOCAL_KEYS) kv.remove(k);
      hydratePersisted(seedState(deps.today()));
    }
  };
}
