/* SASTAVLJANJE APLIKACIJE: skladište, sesija, API, motor sinhronizacije i store-ovi povezani u jednu celinu.

   Sve zavisnosti (skladište, mreža, sat) se prosleđuju, pa se ceo tok — od učitavanja stanja do upisa na server —
   testira bez pregledača i bez mreže. UI zove samo metode ovog objekta; komponente ne dodiruju `fetch` ni skladište. */

import {
  collectPersisted,
  hydratePersisted,
  onPersistRequest,
  withoutPersist,
  type PersistMode
} from '../stores';
import { recomputeChain } from '../domain/day';
import { removeForeignSeed } from '../domain/personal';
import { useRecoveryStore } from '../stores/recoveryStore';
import { isOwnerNow } from '../stores/owner';
import { workPaceContext } from '../stores/dayActions';
import { useAuthStore } from '../stores/authStore';
import { useSyncStore } from '../stores/syncStore';
import { useSettingsStore } from '../stores/settingsStore';
import { createIntegrations, type Integrations } from './integrations';
import { createAdminApi, type AdminApi } from '../services/api/adminApi';
import { createCommunity, type Community } from './community';
import { createCommunityApi } from '../services/community/communityApi';
import { createBackground, type Background, type SyncRegistration } from '../pwa/background';
import type { Idb } from '../pwa/idb';
import {
  createPush,
  type Push,
  type PushBrowser,
  type PushRegistration
} from '../services/push/push';
import { createPushApi } from '../services/push/pushApi';
import { weekAnnouncements } from '../domain/push';
import { toServerPayload } from '../domain/sync';
import { currentPlan, useTrainingStore } from '../stores/trainingStore';
import { createAiJobs, createTrendAi, type AiJobs } from '../services/ai/aiJobs';
import { aiLogPort } from '../stores/aiActions';
import { ADMIN_UID } from '../services/config';
import type { GeoPort } from '../services/weather/weatherSync';
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
import {
  APP_VERSION,
  COMMUNITY_ENABLED,
  SUPABASE_ANON_KEY,
  SUPABASE_URL
} from '../services/config';
import type { Fetcher } from '../services/http';

/** Koliko se čeka provera naloga pre nego što se ekran prikaže iz lokalnih podataka. */
export const VERIFY_PATIENCE_MS = 1500;

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
  /** Pregledač iza priključaka (service worker, IndexedDB, obaveštenja); bez njega pozadina i obaveštenja nisu dostupni. */
  pwa?: {
    idb: Idb;
    registration(timeoutMs: number): Promise<(PushRegistration & SyncRegistration) | null>;
    periodicPermission(): Promise<string | null>;
    push: PushBrowser;
  };
  /** Poruka korisniku (u pregledaču `alert`) — posle povratka sa povezivanja, uvoza… */
  notify?: (message: string) => void;
  /** Lokacija uređaja (u pregledaču `navigator.geolocation`). */
  geo?: GeoPort;
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
  /** Strava i intervals.icu: povezivanje, otkačivanje. */
  strava: Integrations['strava'];
  icu: Integrations['icu'];
  /** Uvoz treninga iz primarnog izvora (intervals.icu, inače Strava). */
  activities: Integrations['activities'];
  /** Prognoza i lokacija (Open-Meteo, direktno). */
  weather: Integrations['weather'];
  /** AI analiza treninga: pokretanje, čekanje, pokupljanje rezultata. */
  ai: AiJobs & { trend: ReturnType<typeof createTrendAi> };
  /** Vlasničke radnje (`/api/broadcast`): mejl svima, spisak naloga, izazov nedelje. */
  admin: AdminApi;
  /** Obaveštenja (Web Push) i pozadinski rad (Background/Periodic Sync). */
  push: Push;
  background: Background;
  /** Zajednica: javni profil i rang-liste. */
  community: Community;
  /** Prijavljen je vlasnik (bez limita analiza; server proverava isto). */
  isOwner(): boolean;
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
  const late: { background?: Background } = {};
  const session = createSessionManager({
    kv,
    fetcher,
    supabaseUrl,
    anonKey,
    now,
    onDead: (message) => {
      auth.set({ gate: message ?? '', hasSession: false, userId: null });
      /* Sesija ne važi: pozadina ne sme da gura u tuđe ime. */
      void late.background?.forgetAll();
    },
    onChanged: (s) => {
      mirror(s);
      /* Kopija naloga za service worker se piše pri prijavi i pri svakom osvežavanju tokena — tačno kad se ono što pozadina zna promeni. */
      void late.background?.writeAccount();
      deps.onSessionChanged?.(s);
    }
  });
  auth.set({ configured: session.isConfigured() });
  mirror(session.state);

  const api = createUserStateApi({ fetcher, session, supabaseUrl, anonKey });
  const appApi = createAppApi({ fetcher, session });
  const pwa = deps.pwa;
  const noIdb: Idb = {
    read: () => Promise.resolve(null),
    write: () => Promise.resolve(null),
    remove: () => Promise.resolve(null)
  };
  const background = createBackground({
    idb: pwa?.idb ?? noIdb,
    registration: (ms) => (pwa ? pwa.registration(ms) : Promise.resolve(null)),
    session: () => session.state,
    payload: () => toServerPayload(collectPersisted()),
    loadFailed: () => !!loaded.loadFailure,
    isAuthed: () => session.isAuthed(),
    supabaseUrl,
    anonKey,
    now,
    periodicPermission: () => (pwa ? pwa.periodicPermission() : Promise.resolve(null))
  });
  late.background = background;
  const unsupportedBrowser: PushBrowser = {
    supported: () => false,
    isIos: () => false,
    permission: () => 'unsupported',
    requestPermission: () => Promise.resolve('unsupported'),
    registration: () => Promise.resolve(null)
  };
  const push = createPush({
    api: createPushApi({ api: appApi, fetcher }),
    browser: pwa?.push ?? unsupportedBrowser,
    background,
    idb: pwa?.idb ?? noIdb,
    isAuthed: () => session.isAuthed(),
    deviceId: () => session.state.deviceId,
    online: () => (deps.online ? deps.online() : true),
    today: deps.today,
    announcements: () => {
      const plan = currentPlan();
      return plan
        ? weekAnnouncements(plan, deps.today(), (id) => !!useTrainingStore.getState().alts[id])
        : {};
    },
    flags: {
      get: () => {
        const ui = useSettingsStore.getState().ui;
        return {
          push: ui['push'] === true,
          najaveDan: typeof ui['najaveDan'] === 'string' ? ui['najaveDan'] : null
        };
      },
      set: (p) => useSettingsStore.getState().patchUi(p)
    }
  });
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

  /** ČIJI SU PODACI NA OVOM UREĐAJU: ko nije vlasnik ne sme da zadrži vlasnikov zatečeni seed. Vlasniku se ništa ne ubacuje iz koda (podaci stižu sa servera ili iz backup-a). */
  function reconcileOwnerData(): boolean {
    if (isOwnerNow()) return false;
    const t = useTrainingStore.getState();
    const r = useRecoveryStore.getState();
    const res = removeForeignSeed({
      log: t.log,
      knee: r.knee,
      kg: r.kg,
      pred: t.pred,
      predLock: t.predLock,
      vdotLog: t.vdotLog
    });
    if (!res.changed) return false;
    withoutPersist(() => {
      useTrainingStore.setState({
        log: res.next.log,
        pred: res.next.pred,
        predLock: res.next.predLock
      });
      useRecoveryStore.setState({ knee: res.next.knee, kg: res.next.kg });
      useTrainingStore.setState({
        vdotLog: recomputeChain(res.next.vdotLog, workPaceContext({ id: '' }))
      });
    });
    saver.save(collectPersisted());
    return true;
  }
  const engine = createSyncEngine({
    session,
    api,
    getState: collectPersisted,
    adopt: (state) => {
      hydratePersisted(state);
      /* Stanje sa servera može da nosi tuđ seed iz starih verzija — čisti se i ovde, ne samo pri pokretanju. */
      if (reconcileOwnerData()) return;
      saver.save(state);
    },
    appVersion,
    loadFailed: !!loaded.loadFailure,
    background: deps.background ?? {
      schedule: () => void background.schedule(),
      cancel: () => void background.cancel()
    },
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

  const isOwner = (): boolean => session.isAuthed() && session.state.userId === ADMIN_UID;
  const ai = createAiJobs({
    api: appApi,
    log: aiLogPort,
    now,
    online: () => (deps.online ? deps.online() : true),
    isAuthed: () => session.isAuthed(),
    isOwner,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  });
  const community = createCommunity({
    api: createCommunityApi({ fetcher, session, supabaseUrl, anonKey }),
    session,
    now,
    today: deps.today,
    online: () => (deps.online ? deps.online() : true),
    enabled: () => COMMUNITY_ENABLED
  });
  const notify = deps.notify ?? ((): void => undefined);
  const integrations = createIntegrations({
    kv,
    fetcher,
    appApi,
    session,
    now,
    today: deps.today,
    origin: loc.origin,
    randomToken: deps.randomToken ?? randomHex,
    ...(deps.navigate ? { navigate: deps.navigate } : {}),
    online: () => (deps.online ? deps.online() : true),
    notify,
    ...(deps.geo ? { geo: deps.geo } : {})
  });

  return {
    kv,
    session,
    api,
    appApi,
    account,
    sync: engine,
    saver,
    async start() {
      void integrations.weather.refresh();
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
      /* Nalog je možda obrisan ili zabranjen dok je aplikacija bila zatvorena: pita se PRE nego što se ekran prikaže. Ali ne zauvek — veza koja
         „visi" (mreža jeste tu, odgovora nema) ne sme da drži praznu stranicu do isteka roka od 12 s, a aplikacija radi i bez servera. Posle
         `VERIFY_PATIENCE_MS` ekran se prikazuje iz lokalnih podataka, a provera se završava u pozadini (kapija se spušta ako nalog ne važi). */
      const verifying = session.verify(deps.online ? deps.online() : true);
      let alive: boolean | null = await Promise.race([
        verifying,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), VERIFY_PATIENCE_MS))
      ]);
      if (alive === null) {
        auth.set({ gate: null, ready: true });
        alive = await verifying;
      }
      if (!alive) {
        auth.set({ ready: true });
        return;
      }
      auth.set({ gate: null, ready: true });
      reconcileOwnerData(); // sesija je potvrđena: sada se pouzdano zna čiji je nalog
      await engine.start().catch(() => 'offline');
      await integrations.consumeOAuthReturn(loc.search, deps.replaceUrl, loc.pathname);
      integrations.pullIfDue(60 * 60000);
      void ai.collectAll();
      community.publishOnStart();
      void community.withdrawIfDisabled();
      void push.refreshOnStart();
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
      /* Odjava mora da očisti i POZADINU: bez ovoga bi service worker zadržao kopiju tokena i neposlato stanje pa ih gurnuo posle odjave — na tuđem
         telefonu bi to bio tuđ nalog. Obaveštenja se gase iz istog razloga; token se prosleđuje jer se sesija briše u istom potezu. */
      const token = session.state.access ?? undefined;
      void push
        .disable(token)
        .catch(() => undefined)
        .finally(() => void background.forgetAll());
      session.logout();
      auth.set({ gate: '', hasSession: false });
    },
    onHidden() {
      saver.flush(collectPersisted);
      if (session.isAuthed()) void engine.pushNow();
    },
    async onVisible() {
      void integrations.weather.refresh();
      if (!session.isAuthed()) return;
      await session.verify(deps.online ? deps.online() : true);
      integrations.pullIfDue(15 * 60000);
      void ai.collectAll();
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
    strava: integrations.strava,
    icu: integrations.icu,
    activities: integrations.activities,
    weather: integrations.weather,
    ai: { ...ai, trend: createTrendAi(appApi) },
    community,
    admin: createAdminApi(appApi),
    push,
    background,
    isOwner,
    forgetEverything() {
      /* Pretplata se gasi BEZ poziva servera: red u bazi je već obrisan, a token više ne važi (naloga nema). */
      void push
        .forget()
        .catch(() => undefined)
        .finally(() => void background.forgetAll());
      session.logout(); // pre brisanja ključeva: odjava upisuje praznu sesiju
      for (const k of ALL_LOCAL_KEYS) kv.remove(k);
      hydratePersisted(seedState(deps.today()));
    }
  };
}
