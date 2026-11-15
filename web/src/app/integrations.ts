/* VEZE SA SPOLJNIM SERVISIMA (Strava, intervals.icu): povezivanje, uvoz treninga, automatsko povlačenje. Sklapa servise sa store-ovima;
   `createApp` samo zove ovo. Komponente ne dodiruju servise direktno.

   REDOSLED IZVORA TRENINGA: intervals.icu ako je povezan i sme da čita treninge, inače Strava. Ne oba — isti trening iz dva izvora bi se
   prepisivao naizmenično, a `src` bi zavisio od toga ko je poslednji stigao. Kad icu otkaže (istekla dozvola, njihov server, mreža), pada
   se na Stravu ako postoji: bolje sinhronizovan trening iz slabijeg izvora nego nijedan. */

import { createRaceSync } from '../services/race/raceSync';
import { icuCanReadActivities, isAthleteId, type IcuLink } from '../domain/icu';
import { createIcuApi, type IcuApi } from '../services/api/icuApi';
import type { AppApi } from '../services/api/appApi';
import type { Fetcher } from '../services/http';
import { createIcuSync } from '../services/icu/icuSync';
import { createWeather, type GeoPort } from '../services/weather/weatherSync';
import type { ForecastCache } from '../domain/weather';
import { createWatchPush } from '../services/icu/icuPush';
import { generatorForPlan } from '../domain/generators/select';
import { planBaselineVdot, resolvePlan, type ResolvedPlan } from '../domain/plan';
import {
  ICU_REJECTED_MESSAGE,
  STRAVA_REJECTED_MESSAGE,
  classifyOAuthReturn,
  makeOAuthState,
  stravaAuthorizeUrl
} from '../services/oauth';
import { STRAVA_CLIENT_ID } from '../services/config';
import type { KeyValueStore } from '../services/storage/kv';
import { syncMessage } from '../services/strava/messages';
import { createStravaApi, type StravaApi, type StravaLink } from '../services/strava/stravaApi';
import {
  createStravaSync,
  type ImportState,
  type StravaSyncResult
} from '../services/strava/stravaSync';
import type { SessionManager } from '../services/supabase/session';
import { useRecoveryStore } from '../stores/recoveryStore';
import { useSettingsStore } from '../stores/settingsStore';
import { activeGenPlan, useTrainingStore } from '../stores/trainingStore';
import { useV4Store } from '../stores/v4Store';
import type { Change, PlanEvent } from '../domain/v4/engine';
import { liveState, otisakOf, refreshPlan } from '../integrations/v4';
import { loadRuns } from '../services/v4/activities';
import { personalProtected } from '../stores/v4Store';
import { createActivityImport } from '../services/strava/activityImport';
import { v4ActivityKey, v4PlanKey } from '../services/storage/keys';
import {
  commitAction,
  createSupabaseActivityStore,
  createEventsApi,
  createPlanApi,
  createV4Rest,
  readAccess,
  type EventsApi,
  type LoadResult,
  type PlanAction,
  type PlanApi,
  type PlanRow
} from '../services/v4';

export type Busy = { ok: false; error: string; busy: true };

/** Ishod uvoza treninga, sa izvorom (za poruku). */
export type ActivitySyncResult =
  | { ok: true; source: 'icu'; n: number; details: number; streams: number }
  | ({ source: 'strava' } & StravaSyncResult)
  | { ok: false; source: 'icu'; error: string }
  | Busy;

export interface IntegrationDeps {
  accountKey?: () => string;
  kv: KeyValueStore;
  fetcher: Fetcher;
  appApi: AppApi;
  session: SessionManager;
  now: () => number;
  today: () => string;
  origin: string;
  randomToken: () => string;
  navigate?: (url: string) => void;
  online: () => boolean;
  notify: (message: string) => void;
  /** Lokacija uređaja; bez nje se vreme ne može uključiti. */
  geo?: GeoPort;
  /** F9 korak 7: Supabase za V4 tabele (`supabase/v4.sql`). Bez njih je V4 isključen. */
  supabaseUrl?: string;
  anonKey?: string;
}

/** Današnji dan po beogradskom vremenu (`YYYY-MM-DD`), nezavisno od vremenske zone uređaja. */
export function belgradeDate(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Belgrade',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(ms));
}

export interface Integrations {
  strava: {
    api: StravaApi;
    connect(): void;
    disconnect(): void;
  };
  icu: {
    api: IcuApi;
    /** Odlazak na odobravanje kod intervals.icu (OAuth). */
    connect(): Promise<{ ok: true } | { ok: false; error: string }>;
    /** Stari način: ID sportiste + API ključ. Proverava se jednim povlačenjem (14 dana); neuspeh vraća stanje kakvo je bilo. */
    connectWithKey(
      athleteId: string,
      apiKey: string
    ): Promise<{ ok: true; n: number } | { ok: false; error: string }>;
    disconnect(): void;
    /** „Povuci sve": merenja + zone + treninzi. */
    syncAll(manual: boolean): ReturnType<ReturnType<typeof createIcuSync>['syncAll']>;
    sync: ReturnType<typeof createIcuSync>;
    /** Slanje planiranih treninga na sat (pregled + slanje). */
    watch: ReturnType<typeof createWatchPush>;
  };
  activities: {
    raceDetails: ReturnType<typeof createRaceSync>['refresh'];
    /** Uvoz treninga iz primarnog izvora; ne baca. Dva uvoza se ne preklapaju. */
    sync(manual: boolean): Promise<ActivitySyncResult>;
    message(r: ActivitySyncResult): string;
  };
  weather: ReturnType<typeof createWeather> & {
    /** Tihi osvežen na startu i povratku: samo online, samo uz uključenu lokaciju. */
    refresh(): Promise<void>;
  };
  /** Povratak sa povezivanja (`?code=`). */
  consumeOAuthReturn(
    search: string,
    replaceUrl: ((path: string) => void) | undefined,
    pathname: string
  ): Promise<void>;
  /** Tihi uvoz kad je prošlo više od `thresholdMs`; i jednom dnevno jutarnja merenja. */
  pullIfDue(thresholdMs: number): void;
  /** F9 korak 7: V4 iza zastavice `v4_pristup`. `null` kad Supabase nije podešen (tada je V4 uvek isključen). */
  v4: {
    /** Pri pokretanju: zastavica + red `plan_v4` → `useV4Store` (bez mreže: poslednje učitano stanje naloga). */
    load(): Promise<void>;
    /** Sinhrono, pre mreže: poslednje učitano V4 stanje naloga iz lokalnog keša. */
    hydrateCached(): void;
    plan: PlanApi;
    events: EventsApi;
    deviceId(): string;
    /** Radnja nad planom (`commitAction`) → `useV4Store.row`; uz upisan plan dopisuje i događaje (`manual-edit`…).
     *  `false` = nije sačuvano (mreža, odjava, sukob posle ponovljenih pokušaja). */
    /** Korak 8: izvedene promene se primenjuju same (v. `refresh` u kodu). */
    refresh(): Promise<void>;
    commit(
      action: PlanAction,
      events?: readonly PlanEvent[] | (() => readonly PlanEvent[])
    ): Promise<boolean>;
  } | null;
}

const icuLinkStore = {
  get: (): IcuLink | null => useSettingsStore.getState().icu,
  set: (v: IcuLink | null): void => useSettingsStore.getState().setIcu(v)
};

/** Odluka učitavača V4 (čista, bez store-a): zastavica + red `plan_v4` → stanje `useV4Store`, ili `null` kad se
 *  nalog promenio usred učitavanja (tada se ništa ne upisuje). Puštanje svima (15. 11. 2026): nema reda u
 *  `v4_pristup` = uključen (`WITHOUT_ROW`). Izričito isključen (red `ukljuceno = false`) → isključeno i keš se briše.
 *  Bez mreže ili sa greškom mreže/servera: poslednje učitano V4 stanje ovog naloga (`cached`, samo za prikaz), a bez
 *  njega isključeno — korisnik koji ima samo `plan_v4` tako ne ostaje bez plana van mreže. */
export type V4StartupResult = {
  enabled: boolean;
  row: PlanRow | null;
  today: string;
  /** Šta uraditi sa lokalnim kešom. */
  cache: 'upisi' | 'obrisi' | 'zadrzi';
};

export async function v4Startup(p: {
  online: boolean;
  today: string;
  access: () => Promise<{ enabled: boolean; state?: string }>;
  load: () => Promise<LoadResult>;
  same: () => boolean;
  /** Poslednje uspešno učitano stanje ovog naloga (uključen, red plana), ili `null`. */
  cached?: { row: PlanRow | null } | null;
}): Promise<V4StartupResult | null> {
  const fallback = (): V4StartupResult =>
    p.cached
      ? { enabled: true, row: p.cached.row, today: p.today, cache: 'zadrzi' }
      : { enabled: false, row: null, today: p.today, cache: 'zadrzi' };
  if (!p.online) return fallback();
  const access = await p
    .access()
    .catch((): { enabled: boolean; state?: string } => ({ enabled: false, state: 'nepoznato' }));
  if (!p.same()) return null;
  if (access.state === 'nepoznato') return fallback();
  if (!access.enabled) return { enabled: false, row: null, today: p.today, cache: 'obrisi' };
  const r = await p
    .load()
    .catch((): LoadResult => ({ ok: false, reason: 'network', retryable: true }));
  if (!p.same()) return null;
  if (!r.ok) return fallback();
  return { enabled: true, row: r.row, today: p.today, cache: 'upisi' };
}

/** Lokalni keš poslednjeg V4 stanja (samo prikaz van mreže); neispravan zapis = nema keša. */
export function readV4Cache(kv: KeyValueStore, uid: string): { row: PlanRow | null } | null {
  try {
    const raw = kv.get(v4PlanKey(uid));
    if (!raw) return null;
    const v = JSON.parse(raw) as { v?: unknown; row?: unknown };
    if (v.v !== 1) return null;
    const row = v.row as PlanRow | null;
    if (row !== null && (typeof row !== 'object' || typeof row.rev !== 'number' || !row.doc))
      return null;
    return { row };
  } catch {
    return null;
  }
}

export function createIntegrations(deps: IntegrationDeps): Integrations {
  const { now } = deps;

  /* ---------------------------------------------------------------- Strava */
  const stravaLink = {
    get: (): StravaLink | null => useSettingsStore.getState().strava,
    set: (v: StravaLink | null): void => useSettingsStore.getState().setStrava(v)
  };
  const stravaApi = createStravaApi({
    accountKey: deps.accountKey,
    fetcher: deps.fetcher,
    appApi: deps.appApi,
    link: stravaLink,
    now
  });

  const ports = {
    read: (): ImportState => {
      const t = useTrainingStore.getState();
      const r = useRecoveryStore.getState();
      return {
        genPlan: activeGenPlan(), // ugrađeni plan se čita isto kao generisani; `commit` ga nikad ne upisuje
        log: t.log,
        pred: t.pred,
        predLock: t.predLock,
        vdotLog: t.vdotLog,
        alts: t.alts,
        moves: t.moves,
        vanPlana: r.vanPlana,
        ...(r.vanPlanaV2 ? { vanPlanaV2: r.vanPlanaV2 } : {}),
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
      /* 08c: puni ga samo uvoz za plan 5K v2. */
      if (n.vanPlanaV2 && n.vanPlanaV2 !== r.vanPlanaV2) r.setOffPlanRuns(n.vanPlanaV2);
      t.patch({
        log: n.log,
        pred: n.pred,
        predLock: n.predLock,
        vdotLog: n.vdotLog,
        moves: n.moves
      });
    }
  };
  const v4Rest =
    deps.supabaseUrl && deps.anonKey
      ? createV4Rest({
          fetcher: deps.fetcher,
          session: deps.session,
          supabaseUrl: deps.supabaseUrl,
          anonKey: deps.anonKey
        })
      : null;
  /* F9 korak 7 (6): uvoz aktivnosti za V4 (`aktivnost`) posle redovne sinhronizacije — SAMO dok je V4 uključen. */
  const v4Activities =
    v4Rest === null
      ? undefined
      : {
          enabled: (): boolean => useV4Store.getState().enabled,
          run: () =>
            createActivityImport({
              api: stravaApi,
              store: createSupabaseActivityStore({
                rest: v4Rest,
                kv: deps.kv,
                deviceId: deps.session.state.deviceId ?? 'uredjaj',
                progressKey: v4ActivityKey
              }),
              now
            }).run()
        };
  const stravaSync = createStravaSync({
    ...(v4Activities !== undefined ? { activities: v4Activities } : {}),
    accountKey: deps.accountKey,
    api: stravaApi,
    link: stravaLink,
    ports,
    now,
    today: deps.today
  });

  /* ---------------------------------------------------------------- intervals.icu */
  const icuApi = createIcuApi(deps.appApi);
  const icuSync = createIcuSync({
    accountKey: deps.accountKey,
    api: icuApi,
    link: icuLinkStore,
    ports,
    wellness: {
      read: () => useRecoveryStore.getState().wellness,
      write: (w) => useRecoveryStore.getState().setWellness(w)
    },
    now,
    today: deps.today
  });

  const raceSync = createRaceSync({
    accountKey: deps.accountKey,
    strava: stravaApi,
    icu: icuApi,
    stravaConnected: () => !!stravaLink.get(),
    icuLink: () => icuLinkStore.get(),
    get: (id) => useTrainingStore.getState().log[id],
    set: (id, entry) => {
      const t = useTrainingStore.getState();
      t.patch({ log: { ...t.log, [id]: entry } }, 'now');
    }
  });

  const watch = createWatchPush({
    api: icuApi,
    link: icuLinkStore,
    plan: (): ResolvedPlan | null => {
      const t = useTrainingStore.getState();
      const plan = activeGenPlan();
      if (!plan) return null;
      try {
        return resolvePlan(plan.weeks, { alts: t.alts, moves: t.moves });
      } catch {
        return null;
      }
    },
    generator: () => generatorForPlan(activeGenPlan()),
    vdot: () => {
      const t = useTrainingStore.getState();
      const plan = activeGenPlan();
      // Trenutna forma iz lanca je politika generatora aktivnog plana (A1).
      return generatorForPlan(plan)?.currentVdot(t.vdotLog) || planBaselineVdot(plan?.meta);
    },
    now,
    today: deps.today
  });

  /* ---------------------------------------------------------------- uvoz treninga */
  let busy = false;
  async function syncActivities(manual: boolean): Promise<ActivitySyncResult> {
    if (busy) return { ok: false, error: 'Uvoz je već u toku.', busy: true };
    busy = true;
    try {
      const hasStrava = !!useSettingsStore.getState().strava;
      if (icuCanReadActivities(icuLinkStore.get())) {
        const r = await icuSync.syncActivities(45, manual);
        if (r.ok)
          return { ok: true, source: 'icu', n: r.n, details: r.details, streams: r.streams };
        if (!hasStrava) return { ok: false, source: 'icu', error: r.error };
        if (manual)
          deps.notify(`intervals.icu nije odgovorio (${r.error}).\nPokušavam preko Strave…`);
      }
      const s = await stravaSync.run();
      return { source: 'strava', ...s };
    } finally {
      busy = false;
    }
  }

  function message(r: ActivitySyncResult): string {
    if ('busy' in r) return r.error;
    if (r.source === 'icu')
      return r.ok
        ? `Sinhronizacija sa intervals.icu gotova.\nAžurirano trčanja: ${r.n}\nTreninga sa krugovima: ${r.details}\nSa presekom po kilometru: ${r.streams}`
        : `intervals.icu: ${r.error}`;
    return syncMessage(r);
  }

  /** Poslednja sinhronizacija izvora koji se trenutno koristi. */
  function lastSync(): number {
    const icu = icuLinkStore.get();
    if (icuCanReadActivities(icu)) return typeof icu?.['trSync'] === 'number' ? icu['trSync'] : 0;
    const s = useSettingsStore.getState().strava;
    return typeof s?.['lastSync'] === 'number' ? s['lastSync'] : 0;
  }

  /* Tihi uvoz pri otvaranju i povratku u aplikaciju: instalirana PWA se ne učitava iznova nego se budi iz pozadine, pa bi bez ovoga
     završeno trčanje stajalo kao „Predstoji" dok se ručno ne pritisne dugme. Prag je kraći pri povratku (15 min) nego pri učitavanju (60). */
  function pullIfDue(thresholdMs: number): void {
    if (!deps.online()) return;
    const hasIcu = icuCanReadActivities(icuLinkStore.get());
    const hasStrava = !!useSettingsStore.getState().strava;
    if (hasIcu || hasStrava) {
      if (!busy && now() - lastSync() >= thresholdMs) void syncActivities(false);
    }
    void icuSync.autoSync(deps.online());
  }

  async function consumeOAuthReturn(
    search: string,
    replaceUrl: ((path: string) => void) | undefined,
    pathname: string
  ): Promise<void> {
    const owner = deps.accountKey?.();
    const ret = classifyOAuthReturn(search, deps.kv, now());
    if (ret.kind === 'none') return;
    replaceUrl?.(pathname);
    if (ret.kind === 'rejected') {
      deps.notify(ret.service === 'icu' ? ICU_REJECTED_MESSAGE : STRAVA_REJECTED_MESSAGE);
      return;
    }
    if (!deps.session.isAuthed()) {
      deps.notify(
        ret.service === 'icu'
          ? 'Moraš biti prijavljen da bi povezao intervals.icu.'
          : 'Moraš biti prijavljen da bi povezao Stravu.'
      );
      return;
    }
    if (ret.service === 'strava') {
      const r = await stravaApi.exchange(ret.code, ret.scope);
      if (!r.ok) {
        deps.notify(`Povezivanje nije uspelo: ${r.error}`);
        return;
      }
      deps.notify(`Strava povezana${r.athlete ? ` — ${r.athlete}` : ''}.`);
      deps.notify(message(await syncActivities(true)));
      return;
    }
    const x = await icuApi.exchange(ret.code);
    if (deps.accountKey?.() !== owner) return;
    if (!x.ok) {
      deps.notify(x.error || 'Povezivanje nije uspelo.');
      return;
    }
    icuLinkStore.set({
      athleteId: x.data.athleteId,
      token: x.data.token,
      scope: x.data.scope,
      lastSync: null
    });
    /* Odmah povuci istoriju, da kartice ne budu prazne. */
    const s = await icuSync.syncWellness(120);
    deps.notify(
      s.ok ? `intervals.icu povezan. Povučeno zapisa: ${s.n}.` : 'intervals.icu povezan.'
    );
  }

  const noGeo: GeoPort = {
    available: () => false,
    denied: () => Promise.resolve(false),
    position: () => Promise.reject(new Error('geo')),
    inApp: () => false
  };
  const weatherCore = createWeather({
    fetcher: deps.fetcher,
    geo: deps.geo ?? noGeo,
    cache: {
      get: () => {
        const v = useSettingsStore.getState().vreme;
        return v && typeof v['at'] === 'number' && v['sati'] && typeof v['sati'] === 'object'
          ? (v as unknown as ForecastCache)
          : null;
      },
      set: (v) => useSettingsStore.getState().setForecastCache(v as never)
    },
    location: {
      get: () => {
        const g = useSettingsStore.getState().ui.geo as { lat?: unknown; lon?: unknown } | null;
        return g && typeof g.lat === 'number' && typeof g.lon === 'number'
          ? { lat: g.lat, lon: g.lon }
          : null;
      },
      set: (v) => useSettingsStore.getState().patchUi({ geo: v })
    },
    now,
    today: deps.today,
    hour: () => new Date(now()).getHours()
  });
  const weather = {
    ...weatherCore,
    async refresh(): Promise<void> {
      if (!deps.online() || !useSettingsStore.getState().ui.geo) return;
      await weatherCore.pull(false);
    }
  };

  /* ---------------------------------------------------------------- V4 (F9 korak 7) */
  const v4Plan = v4Rest === null ? null : createPlanApi(v4Rest);
  const v4Events = v4Rest === null ? null : createEventsApi(v4Rest);
  const v4 =
    v4Rest === null || v4Plan === null || v4Events === null
      ? null
      : {
          plan: v4Plan,
          events: v4Events,
          deviceId: (): string => deps.session.state.deviceId ?? 'uredjaj',
          async commit(
            action: PlanAction,
            eventsOf: readonly PlanEvent[] | (() => readonly PlanEvent[]) = []
          ): Promise<boolean> {
            const owner = deps.accountKey?.();
            const device = deps.session.state.deviceId ?? 'uredjaj';
            const r = await commitAction(v4Plan, action, device).catch(() => null);
            if (r === null || !r.ok || deps.accountKey?.() !== owner) return false;
            useV4Store.getState().set({ row: r.row });
            const events = typeof eventsOf === 'function' ? eventsOf() : eventsOf;
            if (r.wrote && events.length > 0)
              await v4Events
                .append(
                  events.map((event) => ({
                    event,
                    vrsta: event.kind,
                    revPlana: r.row?.rev ?? null
                  })),
                  device
                )
                .catch(() => undefined);
            return true;
          },
          /** Keš ovog naloga u store PRE mreže (nema treptaja čarobnjaka kod korisnika koji ima samo `plan_v4`). */
          hydrateCached(): void {
            const uid = deps.session.state.userId;
            if (!uid) return;
            const c = readV4Cache(deps.kv, uid);
            if (c !== null)
              useV4Store.getState().set({ enabled: true, row: c.row, today: belgradeDate(now()) });
          },
          async load(): Promise<void> {
            const owner = deps.accountKey?.();
            const uid = deps.session.state.userId;
            const next = await v4Startup({
              online: deps.online(),
              today: belgradeDate(now()),
              access: () => readAccess(v4Rest),
              load: () => v4Plan.load(),
              same: () => deps.accountKey?.() === owner,
              cached: uid ? readV4Cache(deps.kv, uid) : null
            });
            if (next === null) return;
            const { cache, ...state } = next;
            useV4Store.getState().set(state);
            if (uid) {
              try {
                if (cache === 'upisi')
                  deps.kv.set(v4PlanKey(uid), JSON.stringify({ v: 1, row: next.row }));
                else if (cache === 'obrisi') deps.kv.remove(v4PlanKey(uid));
              } catch {
                /* pun ili zabranjen lokalni prostor: radi i bez keša */
              }
            }
            if (!next.enabled) return;
            /* korak 8: trčanja (forma iz trčanja) i odbijeni prijavljeni događaji; pa izvedene promene same */
            const [runs, ev] = await Promise.all([
              loadRuns(v4Rest),
              v4Events.list().catch(() => null)
            ]);
            if (deps.accountKey?.() !== owner) return;
            useV4Store.getState().set({
              runs: runs ?? [],
              rejected:
                ev !== null && ev.ok
                  ? ev.records.filter((r) => r.vrsta === 'odbijeno').map((r) => r.event.id)
                  : []
            });
            await v4Self.refresh();
          },
          /** Izvedene promene (forma iz trčanja, propušten trening, pauza iz rupe) se primenjuju SAME (odluka vlasnika
           *  1) — samo nad planom iz `plan_v4` i ne nad zaštićenim ličnim planom. Promene idu u traku. */
          async refresh(): Promise<void> {
            const st = useV4Store.getState();
            const today = st.today;
            if (!st.enabled || st.row === null || today === null) return;
            if (personalProtected(activeGenPlan(), today)) return;
            const log = useTrainingStore.getState().log;
            const knee = useRecoveryStore.getState().knee;
            let changes: Change[] = [];
            await v4Self.commit((cur) => {
              if (cur === null) return null;
              const live = liveState({ doc: cur, today, runs: st.runs, log, knee });
              if (live === null) return null;
              const res = refreshPlan(cur, live, { rejected: st.rejected });
              if (res.changes.length === 0) return null;
              changes = res.changes;
              return { doc: res.doc, otisak: otisakOf(res.doc, today) };
            });
            if (changes.length > 0) useV4Store.getState().set({ changes });
          }
        };
  const v4Self = v4 as NonNullable<typeof v4>;

  return {
    v4,
    weather,
    strava: {
      api: stravaApi,
      connect() {
        const st = makeOAuthState(deps.kv, 'strava', deps.randomToken, now());
        deps.navigate?.(stravaAuthorizeUrl(STRAVA_CLIENT_ID, deps.origin, st));
      },
      disconnect() {
        useSettingsStore.getState().setStrava(null);
      }
    },
    icu: {
      api: icuApi,
      async connect() {
        if (!deps.session.isAuthed())
          return { ok: false, error: 'Moraš biti prijavljen da bi povezao intervals.icu.' };
        const st = makeOAuthState(deps.kv, 'icu', deps.randomToken, now());
        const r = await icuApi.authUrl(st);
        if (!r.ok) return { ok: false, error: r.error || 'Povezivanje trenutno nije moguće.' };
        deps.navigate?.(r.data.url);
        return { ok: true };
      },
      async connectWithKey(athleteId, apiKey) {
        const owner = deps.accountKey?.();
        const id = athleteId.trim();
        const key = apiKey.trim();
        if (!isAthleteId(id))
          return { ok: false, error: 'ID sportiste izgleda kao broj, npr. i123456.' };
        if (key.length < 8) return { ok: false, error: 'API ključ deluje prekratak.' };
        const before = icuLinkStore.get();
        icuLinkStore.set({ athleteId: id, apiKey: key, lastSync: null });
        const r = await icuSync.syncWellness(14);
        if (deps.accountKey?.() !== owner) return { ok: false, error: 'Nalog je promenjen.' };
        if (r.ok) return { ok: true, n: r.n };
        icuLinkStore.set(before);
        return { ok: false, error: r.error || 'Nije uspelo.' };
      },
      disconnect() {
        useSettingsStore.getState().setIcu(null);
      },
      syncAll: (manual) => icuSync.syncAll(120, manual),
      sync: icuSync,
      watch
    },
    activities: { sync: syncActivities, message, raceDetails: raceSync.refresh },
    consumeOAuthReturn,
    pullIfDue
  };
}
