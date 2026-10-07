/* VEZE SA SPOLJNIM SERVISIMA (Strava, intervals.icu): povezivanje, uvoz treninga, automatsko povlačenje. Sklapa servise sa store-ovima;
   `createApp` samo zove ovo. Komponente ne dodiruju servise direktno.

   REDOSLED IZVORA TRENINGA: intervals.icu ako je povezan i sme da čita treninge, inače Strava. Ne oba — isti trening iz dva izvora bi se
   prepisivao naizmenično, a `src` bi zavisio od toga ko je poslednji stigao. Kad icu otkaže (istekla dozvola, njihov server, mreža), pada
   se na Stravu ako postoji: bolje sinhronizovan trening iz slabijeg izvora nego nijedan. */

import { icuCanReadActivities, isAthleteId, type IcuLink } from '../domain/icu';
import { createIcuApi, type IcuApi } from '../services/api/icuApi';
import type { AppApi } from '../services/api/appApi';
import type { Fetcher } from '../services/http';
import { createIcuSync } from '../services/icu/icuSync';
import { createWeather, type GeoPort } from '../services/weather/weatherSync';
import type { ForecastCache } from '../domain/weather';
import { createWatchPush } from '../services/icu/icuPush';
import { planBaselineVdot, resolvePlan, type ResolvedPlan } from '../domain/plan';
import { currentVdot } from '../domain/training/adaptation';
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
}

const icuLinkStore = {
  get: (): IcuLink | null => useSettingsStore.getState().icu,
  set: (v: IcuLink | null): void => useSettingsStore.getState().setIcu(v)
};

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
  };
  const stravaSync = createStravaSync({
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
    vdot: () => {
      const t = useTrainingStore.getState();
      return currentVdot(t.vdotLog) || planBaselineVdot(activeGenPlan()?.meta);
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

  return {
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
    activities: { sync: syncActivities, message },
    consumeOAuthReturn,
    pullIfDue
  };
}
