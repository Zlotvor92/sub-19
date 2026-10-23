/* SINTETIČKI UVOZ (Strava i intervals.icu) za testove segmenta 08c: lažni API-ji sa zadatim aktivnostima, tokovima,
   detaljima i otkazima; snimak posle sinhronizacije = svako upisano stanje (`ports.commit`) + svaki upis veze. Koristi
   samo postojeći ugovor servisa, pa isti scenario radi i na kodu pre izmene (snimak v1 je napravljen na f09a50a). */

import { addDays } from '@/domain/date';
import type { IcuActivity } from '@/domain/activities';
import { resolvePlan } from '@/domain/plan';
import type { GenPlanState } from '@/domain/state';
import type { Result } from '@/services/http';
import type { IcuApi, IcuDetail } from '@/services/api/icuApi';
import { createIcuSync } from '@/services/icu/icuSync';
import { createStravaSync, type ImportState } from '@/services/strava/stravaSync';
import type { StravaApi } from '@/services/strava/stravaApi';

export const j = <T>(x: unknown): T => JSON.parse(JSON.stringify(x)) as T;

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sintetički tokovi 1 Hz (Stravin oblik): deonice {m, pace s/km}. */
export function streamsOf(parts: ReadonlyArray<{ m: number; pace: number }>) {
  const d: number[] = [0];
  const t: number[] = [0];
  const hr: number[] = [100];
  let dist = 0;
  let time = 0;
  for (const p of parts) {
    const v = 1000 / p.pace;
    const n = Math.round(p.m / v);
    for (let i = 0; i < n; i++) {
      dist += v;
      time += 1;
      d.push(Math.round(dist * 10) / 10);
      t.push(time);
      hr.push(Math.round(120 + v * 10 + (i % 7)));
    }
  }
  return {
    distance: { data: d },
    time: { data: t },
    heartrate: { data: hr },
    moving: { data: d.map(() => true) }
  };
}
export const intervals = (reps: number, repM: number, pace: number) =>
  streamsOf([
    { m: 1500, pace: 330 },
    ...Array.from({ length: reps }, () => [
      { m: repM, pace },
      { m: 250, pace: 420 }
    ]).flat(),
    { m: 1000, pace: 340 }
  ]);
export const steady = (km: number, pace: number) => streamsOf([{ m: km * 1000, pace }]);

/* ------------------------------------------------------------------ Strava */

export interface StravaWorld {
  /** Sirove stavke spiska (i neispravne). */
  acts: unknown[];
  streams: Record<string, unknown>;
  laps: Record<string, unknown>;
  /** Putanje koje vraćaju grešku (`/activities/ID/streams`, `/activities/ID/laps`, `/athlete/activities`). */
  failing: Set<string>;
}

export function fakeStravaApi(w: StravaWorld): StravaApi {
  const fail = (error: string, status = 500): Promise<Result<unknown>> =>
    Promise.resolve({ ok: false, kind: 'http', status, error });
  return {
    get(path): Promise<Result<unknown>> {
      if (path.startsWith('/athlete/zones')) return fail('zones 404', 404);
      if (path.startsWith('/athlete/activities')) {
        if (w.failing.has('/athlete/activities')) return fail('Strava 500');
        const page = Number(/&page=(\d+)/.exec(path)?.[1] ?? 1);
        return Promise.resolve({
          ok: true,
          status: 200,
          data: j(w.acts.slice((page - 1) * 100, page * 100))
        });
      }
      const m = /^\/activities\/([^/]+)\/(streams|laps)/.exec(path);
      if (m) {
        if (w.failing.has(`/activities/${m[1]}/${m[2]}`)) return fail('Strava 500');
        const src = m[2] === 'streams' ? w.streams : w.laps;
        const v = src[m[1] as string];
        if (v === undefined) return fail('Strava 404', 404); // aktivnost bez tokova (ručno uneta)
        return Promise.resolve({ ok: true, status: 200, data: j(v) });
      }
      return fail(`nepoznata putanja ${path}`);
    },
    exchange: () => Promise.resolve({ ok: false, error: 'n/a' })
  };
}

/* ------------------------------------------------------------------ intervals.icu */

export interface IcuWorld {
  activities: IcuActivity[];
  /** ID → detalji; `null` = server vratio `greska` za taj trening; nedostaje = nema ga u odgovoru. */
  details: Record<string, IcuDetail | null>;
  /** ID → tokovi; `{greska: true}` = server nije uspeo za taj trening. */
  streams: Record<string, unknown>;
  failList?: boolean;
  failDetails?: boolean;
  failStreams?: boolean;
}

export function fakeIcuApi(w: IcuWorld): IcuApi {
  const fail = <T>(error: string): Promise<Result<T>> =>
    Promise.resolve({ ok: false, kind: 'http', status: 503, error });
  return {
    activities: () =>
      w.failList
        ? fail('icu 503')
        : Promise.resolve({ ok: true, status: 200, data: { activities: j(w.activities) } }),
    details: (_l, ids) =>
      w.failDetails
        ? fail('icu detalji 503')
        : Promise.resolve({
            ok: true,
            status: 200,
            data: {
              details: Object.fromEntries(
                ids.filter((id) => id in w.details).map((id) => [id, j(w.details[id])])
              )
            }
          }),
    streams: (_l, ids) =>
      w.failStreams
        ? fail('icu tokovi 503')
        : Promise.resolve({
            ok: true,
            status: 200,
            data: {
              streams: Object.fromEntries(
                ids.filter((id) => id in w.streams).map((id) => [id, j(w.streams[id])])
              )
            }
          })
  } as Partial<IcuApi> as IcuApi;
}

/* ------------------------------------------------------------------ pokretanje i snimak */

export interface SyncSnapshot {
  result: unknown;
  /** Svako stanje predato `ports.commit` (JSON). */
  commits: unknown[];
  /** Svaka vrednost upisana u vezu (JSON). */
  links: unknown[];
}

export interface RunOptions {
  now: number;
  today: string;
}

export async function runStrava(
  state: ImportState,
  world: StravaWorld,
  link0: Record<string, unknown>,
  o: RunOptions
): Promise<SyncSnapshot & { state: ImportState; link: Record<string, unknown> }> {
  let st = j<ImportState>(state);
  let link: Record<string, unknown> | null = j(link0);
  const commits: unknown[] = [];
  const links: unknown[] = [];
  const svc = createStravaSync({
    api: fakeStravaApi(world),
    link: {
      get: () => link,
      set: (v) => {
        link = v;
        links.push(j(v));
      }
    },
    ports: {
      read: () => st,
      commit: (s) => {
        st = j(s);
        commits.push(j(s));
      }
    },
    now: () => o.now,
    today: () => o.today
  });
  const result = j(await svc.run());
  return { result, commits, links, state: st, link: link ?? {} };
}

export async function runIcu(
  state: ImportState,
  world: IcuWorld,
  link0: Record<string, unknown>,
  o: RunOptions & { daysBack?: number; manual?: boolean }
): Promise<SyncSnapshot & { state: ImportState; link: Record<string, unknown> }> {
  let st = j<ImportState>(state);
  let link: Record<string, unknown> | null = j(link0);
  const commits: unknown[] = [];
  const links: unknown[] = [];
  const svc = createIcuSync({
    api: fakeIcuApi(world),
    link: {
      get: () => link,
      set: (v) => {
        link = v;
        links.push(j(v));
      }
    },
    ports: {
      read: () => st,
      commit: (s) => {
        st = j(s);
        commits.push(j(s));
      }
    },
    wellness: { read: () => ({}), write: () => undefined },
    now: () => o.now,
    today: () => o.today
  });
  const result = j(await svc.syncActivities(o.daysBack ?? 45, o.manual ?? false));
  return { result, commits, links, state: st, link: link ?? {} };
}

export const emptyImportState = (genPlan: GenPlanState): ImportState => ({
  genPlan: j(genPlan),
  log: {},
  pred: {},
  predLock: {},
  vdotLog: [],
  alts: {},
  moves: {},
  vanPlana: {},
  knee: [],
  kg: []
});

/* ------------------------------------------------------------------ mešovit scenario (oba izvora) */

export interface MixedScenario {
  strava: StravaWorld;
  icu: IcuWorld;
}

/**
 * Isti trkač, oba izvora: trčanja na dane plana (deo propušten, deo dva puta dnevno), trčanja NA DANE ODMORA, trčanja pre
 * plana, aktivnost koja nije trčanje, aktivnost bez tipa, trčanje bez km i trajanja, neispravna stavka spiska; tokovi
 * (struktura, kontinuirano) i otkazi pojedinačnih poziva.
 */
export function mixedScenario(plan: GenPlanState, seed: number, today: string): MixedScenario {
  const r = rng(seed);
  const view = resolvePlan(plan.weeks, { alts: {}, moves: {} });
  const start = view.dated[0]?.date ?? view.weeks[0]?.start;
  if (!start) throw new Error('plan bez datuma');
  const strava: StravaWorld = { acts: [], streams: {}, laps: {}, failing: new Set() };
  const icu: IcuWorld = { activities: [], details: {}, streams: {} };
  let id = 5000;
  const add = (date: string, km: number, tag: string | undefined, extra = 0): void => {
    const aid = id++;
    const sec = Math.round(km * (300 + r() * 80));
    strava.acts.push({
      id: aid,
      name: `Trčanje ${aid}`,
      type: 'Run',
      sport_type: 'Run',
      start_date_local: `${date}T${String(6 + extra).padStart(2, '0')}:30:00Z`,
      distance: Math.round(km * 1000),
      moving_time: sec,
      average_heartrate: Math.round(140 + r() * 25)
    });
    icu.activities.push({
      id: `i${aid}`,
      datum: date,
      sat: 6 + extra,
      tip: 'Run',
      naziv: `Trčanje ${aid}`,
      km: Math.round(km * 100) / 100,
      sec,
      hr: Math.round(140 + r() * 25)
    });
    const q = tag === 'int' || tag === 'tempo';
    const roll = r();
    if (q) {
      if (roll < 0.2) strava.failing.add(`/activities/${aid}/streams`);
      else strava.streams[String(aid)] = roll < 0.6 ? intervals(5, 800, 230) : steady(km, 280);
      strava.laps[String(aid)] = [{ distance: 1000, moving_time: 240 }];
      icu.details[`i${aid}`] =
        roll < 0.15
          ? null
          : {
              rounds: [
                { tip: 'rad', sec: 186, paceSec: 232, distM: 800, hr: 172 },
                { tip: 'oporavak', sec: 90, paceSec: 420, distM: 215 },
                { tip: 'rad', sec: 185, paceSec: 231, distM: 800, hr: 174 }
              ],
              groups: []
            };
    } else {
      if (roll < 0.15) {
        strava.failing.add(`/activities/${aid}/streams`);
        icu.streams[`i${aid}`] = { greska: true };
      } else {
        strava.streams[String(aid)] = steady(Math.max(1, Math.round(km)), 320);
        icu.streams[`i${aid}`] = steady(Math.max(1, Math.round(km)), 320);
      }
    }
  };
  for (const d of view.dated) {
    if (d.date > today) break;
    if (d.rest) {
      if (r() < 0.35) add(d.date, 5 + Math.round(r() * 30) / 10, undefined);
      continue;
    }
    if (d.km == null || r() < 0.2) continue;
    add(d.date, Math.max(2, d.km * (0.8 + r() * 0.25)), d.tag);
    if (r() < 0.1) add(d.date, 3 + Math.round(r() * 20) / 10, 'lako', 10);
  }
  for (let k = 3; k < 25; k += 4) add(addDays(start, -k), 6 + Math.round(r() * 30) / 10, 'lako');
  const mid = addDays(start, 10);
  strava.acts.push(
    {
      id: 9001,
      type: 'Ride',
      sport_type: 'Ride',
      start_date_local: `${mid}T17:00:00Z`,
      distance: 30000,
      moving_time: 4000
    },
    {
      id: 9002,
      type: null,
      sport_type: null,
      start_date_local: `${mid}T18:00:00Z`,
      distance: 5000,
      moving_time: 1700
    },
    {
      id: 9003,
      type: 'Run',
      sport_type: 'Run',
      start_date_local: `${mid}T19:00:00Z`,
      distance: null,
      moving_time: null
    },
    { name: 'bez ID-ja', type: 'Run' },
    null
  );
  icu.activities.push(
    { id: 'i9003', datum: mid, tip: 'Run', km: 0, sec: 0 },
    { id: 'i9004', datum: mid, tip: 'Run', km: null, sec: 1500 }
  );
  return { strava, icu };
}
