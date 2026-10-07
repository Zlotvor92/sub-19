import { beforeAll, describe, expect, it } from 'vitest';
import { loadLegacyApp, type LegacyApp } from '@/test/legacyOracle';
import { addDays, type IsoDate } from '../../domain/date';
import { resolvePlan } from '../../domain/plan';
import { adaptGeneratedPlan } from '../../domain/plan/adapt';
import type { GenPlanState, LogEntry, VdotRecord } from '../../domain/state';
import { generatePlan } from '@/test/legacyGenerator';
import type { Result } from '../http';
import { createStravaSync, type ImportState } from './stravaSync';
import type { StravaApi, StravaLink } from './stravaApi';

/* parity: stravaSync (app.js), izvršen u vm-u sa podmetnutim `stApi`; isti ulazi, isti izlazni `S`. Pokriva: uvoz sa zaključavanjem,
   spajanje dva trčanja, pomeranje plana, trčanja pre plana, prepoznavanje radnih deonica iz streamova, rezervu preko krugova,
   presek po km, tempo → lanac forme, otkaz pojedinačnog poziva. */

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const j = <T>(x: unknown): T => JSON.parse(JSON.stringify(x)) as T;
const START = '2026-01-05' as IsoDate;
const TODAY = '2026-02-20';

let legacy: LegacyApp;
let GP: GenPlanState;
beforeAll(async () => {
  legacy = await loadLegacyApp('2026-02-20T09:00:00Z');
  const a = adaptGeneratedPlan(
    generatePlan({
      startDate: START,
      raceDate: addDays(START, 12 * 7 + 3),
      raceDistM: 10000,
      pb: { distM: 10000, sec: 2570 },
      goalSec: 2450,
      weeklyKm: 50,
      runDays: 5,
      quality: 2,
      intensity: 'std',
      trainedRecently: true
    })
  );
  if (!a) throw new Error('adapt');
  GP = a;
});
const ctx = (): Record<string, unknown> =>
  (legacy as unknown as { ctx: Record<string, unknown> }).ctx;

interface Series {
  distance: { data: number[] };
  time: { data: number[] };
  heartrate: { data: number[] };
  moving: { data: boolean[] };
}
/** Sintetički stream 1 Hz: lista deonica {m, pace (s/km)}. */
function streams(parts: Array<{ m: number; pace: number }>): Series {
  const d: number[] = [0];
  const t: number[] = [0];
  const hr: number[] = [100];
  let dist = 0;
  let time = 0;
  for (const p of parts) {
    const v = 1000 / p.pace; // m/s
    const n = Math.round(p.m / v);
    for (let i = 0; i < n; i++) {
      dist += v;
      time += 1;
      d.push(Math.round(dist * 10) / 10);
      t.push(time);
      hr.push(Math.round(120 + (1000 / p.pace) * 10 + (i % 7)));
    }
  }
  return {
    distance: { data: d },
    time: { data: t },
    heartrate: { data: hr },
    moving: { data: d.map(() => true) }
  };
}
const structured = (reps: number, repM: number, pace: number): Series =>
  streams([
    { m: 1500, pace: 330 },
    ...Array.from({ length: reps }, () => [
      { m: repM, pace },
      { m: 250, pace: 420 }
    ]).flat(),
    { m: 1000, pace: 340 }
  ]);
const continuous = (km: number, pace: number): Series => streams([{ m: km * 1000, pace }]);

interface Scenario {
  acts: Array<Record<string, unknown>>;
  streams: Record<string, Series>;
  laps: Record<string, unknown>;
  failing: Set<string>;
  log: Record<string, LogEntry>;
  pred: Record<string, number>;
  predLock: Record<string, boolean>;
}

function scenario(r: () => number, resolved: ReturnType<typeof resolvePlan>): Scenario {
  const acts: Array<Record<string, unknown>> = [];
  const st: Record<string, Series> = {};
  const laps: Record<string, unknown> = {};
  const failing = new Set<string>();
  const log: Record<string, LogEntry> = {};
  const pred: Record<string, number> = {};
  const predLock: Record<string, boolean> = {};
  let id = 1000;
  const days = resolved.dated.filter((d) => !d.rest && d.km != null && d.date <= TODAY);
  for (const d of days) {
    if (r() < 0.35) continue;
    const roll = r();
    const date = roll < 0.12 ? addDays(d.date, r() < 0.5 ? -1 : 1) : d.date; // pomeren dan → realign
    const runs = roll > 0.85 ? 2 : 1;
    for (let k = 0; k < runs; k++) {
      const km = Math.max(3, (d.km ?? 8) * (0.75 + r() * 0.3));
      const aid = id++;
      acts.push({
        id: aid,
        name: r() < 0.5 ? `Trening ${aid}` : '',
        description: r() < 0.3 ? 'opis '.repeat(2) : null,
        type: r() < 0.05 ? 'Ride' : 'Run',
        sport_type: 'Run',
        start_date_local: `${date}T${String(6 + Math.floor(r() * 14)).padStart(2, '0')}:30:00Z`,
        distance: Math.round(km * 1000),
        moving_time: Math.round(km * (300 + r() * 80)),
        average_heartrate: r() < 0.8 ? Math.round(140 + r() * 30) : null,
        max_heartrate: r() < 0.7 ? Math.round(165 + r() * 20) : null,
        total_elevation_gain: r() < 0.7 ? Math.round(r() * 200) : null,
        suffer_score: r() < 0.5 ? Math.round(r() * 120) : null,
        average_cadence: r() < 0.6 ? 80 + r() * 8 : null,
        average_temp: r() < 0.4 ? 5 + r() * 20 : null
      });
      if (d.tag === 'int' || d.tag === 'tempo') {
        const kind = r();
        if (kind < 0.45)
          st[String(aid)] = structured(
            4 + Math.floor(r() * 4),
            800 + Math.floor(r() * 4) * 200,
            225 + Math.round(r() * 60)
          );
        else if (kind < 0.8)
          st[String(aid)] = continuous(Math.round(km), 270 + Math.round(r() * 40));
        else failing.add(`/activities/${aid}/streams`);
        laps[String(aid)] = Array.from({ length: 6 }, (_, i) => ({
          distance: i % 2 ? 250 : 1000,
          moving_time: i % 2 ? 110 : 235 + Math.round(r() * 20)
        }));
      } else if (d.tag === 'lako' || d.tag === 'lr') {
        if (r() < 0.85) st[String(aid)] = continuous(Math.round(km), 300 + Math.round(r() * 40));
        else failing.add(`/activities/${aid}/streams`);
      }
    }
    const pre = r();
    if (pre < 0.1)
      log[d.id] = { status: 'done', km: 1, lock: true, ts: d.date }; // ručna korekcija
    else if (pre < 0.25) log[d.id] = { status: 'pending', knee: 3, kg: 80.5, note: 'x' };
    else if (pre < 0.4 && (d.tag === 'lako' || d.tag === 'lr'))
      log[d.id] = {
        status: 'done',
        aiCount: 2,
        perKm: [{ km: 1, v: 0, paceSec: 300, hr: 140, cadence: 82 }]
      }; // presek računat starijom verzijom
    if (r() < 0.12 && (d.tag === 'int' || d.tag === 'tempo')) {
      const ps = Object.keys(
        Object.fromEntries(GP.pred.filter((p) => p.w === d.w).map((p) => [p.id as string, 1]))
      );
      if (ps[0]) {
        if (r() < 0.5) {
          pred[ps[0]] = 250;
          if (r() < 0.5) predLock[ps[0]] = true;
        } else predLock[ps[0]] = true; // zaključavanje bez tempa (stanje sa servera / starog backupa)
      }
    }
  }
  // trčanja PRE plana (vanPlana)
  for (let k = 1; k < 20; k += 3)
    if (r() < 0.7)
      acts.push({
        id: id++,
        type: 'Run',
        start_date_local: `${addDays(START, -k)}T07:00:00Z`,
        distance: Math.round((4 + r() * 6) * 1000),
        moving_time: 2000
      });
  return { acts, streams: st, laps, failing, log, pred, predLock };
}

function handler(sc: Scenario) {
  return (path: string): unknown => {
    if (path.startsWith('/athlete/zones'))
      return {
        heart_rate: {
          zones: [
            { min: 0, max: 120 },
            { min: 120, max: 150 },
            { min: 150, max: -1 }
          ]
        }
      };
    if (path.startsWith('/athlete/activities')) {
      const page = Number(/&page=(\d+)/.exec(path)?.[1] ?? 1);
      return sc.acts.slice((page - 1) * 100, page * 100);
    }
    const m = /^\/activities\/(\d+)\/(streams|laps)/.exec(path);
    if (m) {
      if (sc.failing.has(`/activities/${m[1]}/${m[2]}`)) throw new Error('Strava 500');
      if (m[2] === 'streams') {
        const s = sc.streams[m[1] as string];
        if (!s) throw new Error('Strava 404');
        return s;
      }
      return sc.laps[m[1] as string] ?? [];
    }
    throw new Error(`nepoznata putanja ${path}`);
  };
}

const projChain = (l: VdotRecord[]) =>
  l.map((e) => ({
    id: e.id,
    ts: e.ts,
    vdot: e.vdot ?? null,
    prev: e.prev ?? null,
    delta: e.delta ?? null,
    measured: e.measured ?? null
  }));
const volatile = (log: Record<string, LogEntry>) => j<Record<string, LogEntry>>(log);

describe('sinhronizacija sa Strave naspram starog koda', () => {
  it('60 nasumičnih scenarija: isti log, tempo, zaključavanje, lanac, pomeranja, trčanja pre plana i bol/težina', async () => {
    const r = rng(41);
    let imported = 0;
    let paces = 0;
    let moved = 0;
    let withLaps = 0;
    let withPerKm = 0;
    let failedDays = 0;
    let aiReset = 0;
    let presets = 0;
    for (let n = 0; n < 60; n++) {
      const resolved = resolvePlan(GP.weeks, { alts: {}, moves: {} });
      const sc = scenario(r, resolved);
      const h = handler(sc);

      /* ---- stari kod ---- */
      ctx()['__p'] = j(GP);
      ctx()['__s'] = j({ log: sc.log, pred: sc.pred, predLock: sc.predLock });
      ctx()['__h'] = (p: string): unknown => j(h(p));
      legacy.evalIn(
        `S.genPlan=__p; S.alts={}; S.moves={}; S.vanPlana={}; S.knee=[]; S.kg=[]; S.vdotLog=[]; S.log=__s.log; S.pred=__s.pred; S.predLock=__s.predLock;
         S.strava={access:'a',refresh:'r',expiresAt:99999999999,lastSync:0};
         setActivePlan(); rebuildDateIndex(); preracunajVdotLog();
         stApi=async function(path){ return __h(path); }; 0`
      );
      await (legacy.evalIn('stravaSync(false)') as Promise<void>);
      const old = {
        log: j<Record<string, LogEntry>>(legacy.evalIn('S.log')),
        pred: j<Record<string, number>>(legacy.evalIn('S.pred')),
        predLock: j<Record<string, boolean>>(legacy.evalIn('S.predLock')),
        vdotLog: j<VdotRecord[]>(legacy.evalIn('S.vdotLog')),
        moves: j<Record<string, unknown>>(legacy.evalIn('S.moves')),
        vanPlana: j<Record<string, number>>(legacy.evalIn('S.vanPlana')),
        knee: j<unknown[]>(legacy.evalIn('S.knee')),
        kg: j<unknown[]>(legacy.evalIn('S.kg')),
        zones: j<unknown>(legacy.evalIn('S.strava.hrZones'))
      };

      /* ---- novi kod ---- */
      let state: ImportState = {
        genPlan: j(GP),
        log: j(sc.log),
        pred: j(sc.pred),
        predLock: j(sc.predLock),
        vdotLog: [],
        alts: {},
        moves: {},
        vanPlana: {},
        knee: [],
        kg: []
      };
      let link: StravaLink | null = {
        access: 'a',
        refresh: 'r',
        expiresAt: 99999999999,
        lastSync: 0
      };
      const api: StravaApi = {
        get(path): Promise<Result<unknown>> {
          try {
            return Promise.resolve({ ok: true, data: j(h(path)), status: 200 });
          } catch (e) {
            return Promise.resolve({
              ok: false,
              kind: 'http',
              status: 500,
              error: (e as Error).message
            });
          }
        },
        exchange: () => Promise.resolve({ ok: false, error: 'n/a' })
      };
      const svc = createStravaSync({
        api,
        link: { get: () => link, set: (v) => (link = v) },
        ports: { read: () => state, commit: (s) => (state = s) },
        now: () => Date.UTC(2026, 1, 20, 9),
        today: () => TODAY
      });
      const res = await svc.run();
      expect(res.ok, `${n}`).toBe(true);

      expect(volatile(state.log), `log ${n}`).toEqual(old.log);
      expect(state.pred, `pred ${n}`).toEqual(old.pred);
      expect(state.predLock, `lock ${n}`).toEqual(old.predLock);
      expect(projChain(state.vdotLog), `lanac ${n}`).toEqual(projChain(old.vdotLog));
      expect(state.moves, `moves ${n}`).toEqual(old.moves);
      expect(state.vanPlana, `vanPlana ${n}`).toEqual(old.vanPlana);
      expect(j(state.knee), `bol ${n}`).toEqual(old.knee);
      expect(j(state.kg), `masa ${n}`).toEqual(old.kg);
      expect((link as StravaLink | null)?.['hrZones'], `zone ${n}`).toEqual(old.zones);

      if (res.ok) {
        imported += res.imported;
        paces += res.paces;
        moved += res.moved;
      }
      withLaps += Object.values(state.log).filter((e) => Array.isArray(e['laps'])).length;
      withPerKm += Object.values(state.log).filter((e) => Array.isArray(e['perKm'])).length;
      failedDays += sc.failing.size;
      presets += Object.values(sc.log).filter((e) => e['aiCount']).length;
      aiReset += Object.entries(sc.log).filter(
        ([id, e]) => e['aiCount'] && !state.log[id]?.['aiCount']
      ).length;
    }
    expect(imported).toBeGreaterThan(300);
    expect(paces).toBeGreaterThan(20);
    expect(moved).toBeGreaterThan(5);
    expect(withLaps).toBeGreaterThan(20);
    expect(withPerKm).toBeGreaterThan(40);
    expect(failedDays).toBeGreaterThan(10);
    expect(presets).toBeGreaterThan(5);
    expect(aiReset, 'brojač AI analize se resetuje kad se zameni star presek').toBeGreaterThan(3);
  });
});
