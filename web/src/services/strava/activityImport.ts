/* F9 KORAK 4 · UVOZ AKTIVNOSTI ZA V4 (INTEGRACIJA.md § 4, odluka vlasnika 2) — IZA ZASTAVICE, podrazumevano UGAŠEN.
   - Sva trčanja, bez vezanosti za plan; prvi put CELA istorija (unazad, stranu po stranu), posle samo nova.
   - Podela po km samo za poslednjih 8 nedelja i trčanja ≥ 25 min (F8 § 9.3).
   - Limit Strave važi za CELU aplikaciju: posle svakog odgovora čitaju se zaglavlja; kad do limita prozora (ili dana)
     ostane `reserve` zahteva, uvoz staje (rezerva za redovnu sinhronizaciju); na 429 staje. Nastavlja se kasnije
     tačno odakle je stao (napredak se čuva posle svake strane). Upis je „ubaci ili zameni" po id-ju: ponovljena
     strana ne pravi duplikat.
   - Odredište je sučelje `ActivityStore` (tabela `aktivnost` još ne postoji, F9 § 3); u testu skladište u memoriji.
   Uvoz nikad ne baca i nikad ne dira `user_state` (`log`, `vanPlana`, plan). */
import type { KmSplit, Run } from '../../domain/v4/engine';
import { isRun, type StravaActivity } from '../../domain/activities/stravaImport';
import { perKmDetail } from '../../domain/activities';
import { parseStreams } from '../streams';
import type { Result } from '../http';
import type { RateLimits, StravaApi } from './stravaApi';
import { parseActivities, STREAM_KEYS_EASY } from './stravaSync';

export interface ImportProgress {
  v: 1;
  /** Najstariji početak (epoha, s) do kog je istorija preuzeta; sledeća strana ide `before` njega. */
  oldest: number | null;
  /** Cela istorija je preuzeta (poslednja strana nepuna). */
  historyDone: boolean;
  /** Najnoviji početak (epoha, s) koji je viđen; nova trčanja se traže `after` njega. */
  newest: number | null;
  /** Strava id-jevi trčanja kojima treba podela po km. */
  details: string[];
  /** Do kada uvoz miruje (ms epohe), posle 429 ili kad je potrošen limit do rezerve. */
  pausedUntil: number | null;
}

export interface ActivityStore {
  load(): Promise<ImportProgress | null>;
  save(p: ImportProgress): Promise<void>;
  /** „Ubaci ili zameni" po `Run.id`. */
  upsert(runs: readonly Run[]): Promise<void>;
  get(id: string): Promise<Run | undefined>;
}

export function memoryActivityStore(): ActivityStore & {
  all(): Run[];
  progress(): ImportProgress | null;
} {
  const runs = new Map<string, Run>();
  let progress: ImportProgress | null = null;
  const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
  return {
    load: () => Promise.resolve(progress === null ? null : clone(progress)),
    save: (p) => {
      progress = clone(p);
      return Promise.resolve();
    },
    upsert: (rs) => {
      for (const r of rs) runs.set(r.id, clone(r));
      return Promise.resolve();
    },
    get: (id) => Promise.resolve(runs.has(id) ? clone(runs.get(id) as Run) : undefined),
    all: () =>
      [...runs.values()].sort((a, b) =>
        a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1
      ),
    progress: () => progress
  };
}

export type ImportStatus = 'gotovo' | 'pauza' | 'greska' | 'iskljuceno';
export interface ImportRun {
  status: ImportStatus;
  requests: number;
  /** Trčanja upisana u ovom pozivu (i ponovo upisana). */
  stored: number;
  error?: string;
}

export interface ActivityImportDeps {
  api: Pick<StravaApi, 'getWithLimits'>;
  store: ActivityStore;
  now: () => number;
  /** Zahteva koji ostaju redovnoj sinhronizaciji u svakom prozoru i danu (odluka: 20). */
  reserve?: number;
  /** Najviše zahteva po jednom pozivu `run` kad zaglavlja limita nisu poznata. */
  maxRequestsBlind?: number;
  perPage?: number;
}

export const PER_PAGE = 100;
export const RESERVE = 20;
export const DETAIL_WEEKS = 8;
export const DETAIL_MIN_SEC = 25 * 60;
const QUARTER_MS = 15 * 60_000;
const DAY_MS = 864e5;

const nextQuarter = (ms: number): number => (Math.floor(ms / QUARTER_MS) + 1) * QUARTER_MS;
const nextUtcMidnight = (ms: number): number => (Math.floor(ms / DAY_MS) + 1) * DAY_MS;

const epochOf = (a: StravaActivity): number | null => {
  const raw = (a as unknown as Record<string, unknown>)['start_date'] ?? a.start_date_local;
  if (typeof raw !== 'string') return null;
  const t = Date.parse(/Z|[+-]\d\d:?\d\d$/.test(raw) ? raw : `${raw}Z`);
  return Number.isNaN(t) ? null : Math.floor(t / 1000);
};

/** Strava aktivnost → `Run` (sažetak). `null`: nije trčanje ili nema dužinu/trajanje. */
export function runFromActivity(a: StravaActivity): Run | null {
  if (!isRun(a)) return null;
  const date = typeof a.start_date_local === 'string' ? a.start_date_local.slice(0, 10) : '';
  const distanceM = a.distance ?? 0;
  const durationSec = a.moving_time ?? 0;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !(distanceM > 0) || !(durationSec > 0)) return null;
  const run: Run = { id: `strava:${String(a.id)}`, date, distanceM, durationSec, source: 'strava' };
  if (typeof a.average_heartrate === 'number' && a.average_heartrate > 0)
    run.avgHr = a.average_heartrate;
  if (typeof a.average_temp === 'number') run.tempC = a.average_temp;
  return run;
}

const nothingThere = (r: Result<unknown>): boolean =>
  r.ok ? Array.isArray(r.data) && r.data.length === 0 : r.status === 404;

export function createActivityImport(deps: ActivityImportDeps): { run(): Promise<ImportRun> } {
  const reserve = deps.reserve ?? RESERVE;
  const perPage = deps.perPage ?? PER_PAGE;
  const blind = deps.maxRequestsBlind ?? 50;

  async function run(): Promise<ImportRun> {
    const getWithLimits = deps.api.getWithLimits;
    if (getWithLimits === undefined) return { status: 'iskljuceno', requests: 0, stored: 0 };
    const p: ImportProgress = (await deps.store.load()) ?? {
      v: 1,
      oldest: null,
      historyDone: false,
      newest: null,
      details: [],
      pausedUntil: null
    };
    let requests = 0;
    let stored = 0;
    let limits: RateLimits | null = null;
    const done = (status: ImportStatus, error?: string): ImportRun => ({
      status,
      requests,
      stored,
      ...(error !== undefined ? { error } : {})
    });
    const pause = async (until: number): Promise<ImportRun> => {
      p.pausedUntil = until;
      await deps.store.save(p);
      return done('pauza');
    };

    if (p.pausedUntil !== null && deps.now() < p.pausedUntil) return done('pauza');
    p.pausedUntil = null;

    /** Sme li još jedan zahtev: rezerva u prozoru i danu; bez zaglavlja najviše `blind` po pozivu. */
    const budget = (): number | 'ok' => {
      if (limits === null) return requests < blind ? 'ok' : nextQuarter(deps.now());
      if (limits.dayLimit - limits.dayUsage <= reserve) return nextUtcMidnight(deps.now());
      if (limits.windowLimit - limits.windowUsage <= reserve) return nextQuarter(deps.now());
      return 'ok';
    };
    const call = async (path: string): Promise<Result<unknown> | { paused: number }> => {
      const b = budget();
      if (b !== 'ok') return { paused: b };
      const r = await getWithLimits(path);
      requests += 1;
      if (r.limits !== null) limits = r.limits;
      if (!r.result.ok && r.result.status === 429) {
        const day = limits !== null && limits.dayUsage >= limits.dayLimit;
        return { paused: day ? nextUtcMidnight(deps.now()) : nextQuarter(deps.now()) };
      }
      return r.result;
    };

    const detailFrom = deps.now() / 1000 - DETAIL_WEEKS * 7 * 86400;
    const take = async (list: StravaActivity[]): Promise<void> => {
      const runs: Run[] = [];
      for (const a of list) {
        const r = runFromActivity(a);
        const at = epochOf(a);
        if (at !== null) {
          p.newest = p.newest === null ? at : Math.max(p.newest, at);
          p.oldest = p.oldest === null ? at : Math.min(p.oldest, at);
        }
        if (r === null) continue;
        const prev = await deps.store.get(r.id);
        /* podela po km, ako je već preuzeta, ostaje */
        runs.push(prev?.splits !== undefined ? { ...r, splits: prev.splits } : r);
        const sid = String(a.id);
        if (
          at !== null &&
          at >= detailFrom &&
          r.durationSec >= DETAIL_MIN_SEC &&
          prev?.splits === undefined &&
          !p.details.includes(sid)
        )
          p.details.push(sid);
      }
      await deps.store.upsert(runs);
      stored += runs.length;
    };

    /* 1. Nova trčanja (posle najnovijeg viđenog). */
    if (p.newest !== null) {
      const since = p.newest;
      for (let page = 1; ; page++) {
        const r = await call(`/athlete/activities?after=${since}&per_page=${perPage}&page=${page}`);
        if ('paused' in r) return pause(r.paused);
        if (!r.ok) return done('greska', r.error);
        const list = parseActivities(r.data);
        if (list === null) return done('greska', 'Strava je vratila neočekivan odgovor.');
        await take(list);
        await deps.store.save(p);
        if ((Array.isArray(r.data) ? r.data.length : 0) < perPage) break;
      }
    }

    /* 2. Istorija unazad, dok poslednja strana nije nepuna. */
    while (!p.historyDone) {
      const before = p.oldest === null ? '' : `before=${p.oldest + 1}&`;
      const r = await call(`/athlete/activities?${before}per_page=${perPage}`);
      if ('paused' in r) return pause(r.paused);
      if (!r.ok) return done('greska', r.error);
      const list = parseActivities(r.data);
      if (list === null) return done('greska', 'Strava je vratila neočekivan odgovor.');
      const prevOldest = p.oldest;
      await take(list);
      const raw = Array.isArray(r.data) ? r.data.length : 0;
      /* nepuna strana, ili strana koja ne pomera granicu (sve iz iste sekunde) = kraj istorije */
      if (raw < perPage || p.oldest === prevOldest) p.historyDone = true;
      await deps.store.save(p);
    }

    /* 3. Podela po km (najnovija prvo). */
    while (p.details.length > 0) {
      const sid = p.details[0] as string;
      const r = await call(`/activities/${sid}/streams?keys=${STREAM_KEYS_EASY}&key_by_type=true`);
      if ('paused' in r) return pause(r.paused);
      if (!r.ok && !nothingThere(r)) return done('greska', r.error);
      const st = r.ok ? parseStreams(r.data) : null;
      const splits: KmSplit[] = (st ? perKmDetail(st) : []).flatMap((row) =>
        row.paceSec === null
          ? []
          : [row.hr === null ? { paceSec: row.paceSec } : { paceSec: row.paceSec, hr: row.hr }]
      );
      const prev = await deps.store.get(`strava:${sid}`);
      if (prev !== undefined && splits.length > 0) {
        await deps.store.upsert([{ ...prev, splits }]);
        stored += 1;
      }
      p.details = p.details.slice(1);
      await deps.store.save(p);
    }
    await deps.store.save(p);
    return done('gotovo');
  }

  return { run };
}
