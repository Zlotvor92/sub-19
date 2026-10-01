import { beforeAll, describe, expect, it } from 'vitest';
import { loadLegacyApp, type LegacyApp } from '@/test/legacyOracle';
import { addDays, type IsoDate } from '../../domain/date';
import { resolvePlan } from '../../domain/plan';
import { adaptGeneratedPlan } from '../../domain/plan/adapt';
import type { GenPlanState, LogEntry, VdotRecord, WellnessRecord } from '../../domain/state';
import { generatePlan } from '../../domain/training/generator/generatePlan';
import type { Result } from '../http';
import type { IcuApi } from '../api/icuApi';
import type { ImportState } from '../strava/stravaSync';
import { createIcuSync } from './icuSync';

/* parity: icuSyncTreninzi, icuSync (wellness), icuZoneSync, icuAutoSync (app.js), izvršeni u vm-u sa podmetnutim `icuApi`/`fetchRok`. */

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
const NOW = Date.UTC(2026, 1, 20, 9);

let legacy: LegacyApp;
let GP: GenPlanState;
let GP_DENSE: GenPlanState;
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
  const b = adaptGeneratedPlan(
    generatePlan({
      startDate: START,
      raceDate: addDays(START, 12 * 7 + 3),
      raceDistM: 10000,
      pb: { distM: 10000, sec: 2570 },
      goalSec: 2450,
      weeklyKm: 70,
      runDays: 6,
      quality: 3,
      intensity: 'std',
      trainedRecently: true
    })
  );
  if (!b) throw new Error('adapt');
  GP_DENSE = b; // više kvalitetnih dana nego što staje u jedan krug povlačenja detalja (24)
});
const ctx = (): Record<string, unknown> =>
  (legacy as unknown as { ctx: Record<string, unknown> }).ctx;

function streamsOf(parts: Array<{ m: number; pace: number }>) {
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
    moving: { data: d.map(() => 1) }
  };
}

interface Scenario {
  list: Array<Record<string, unknown>>;
  details: Record<string, unknown>;
  streams: Record<string, unknown>;
  listFails: boolean;
  detailsFail: boolean;
  log: Record<string, LogEntry>;
  pred: Record<string, number>;
}

function scenario(
  r: () => number,
  resolved: ReturnType<typeof resolvePlan>,
  presence = 0.3
): Scenario {
  const list: Array<Record<string, unknown>> = [];
  const details: Record<string, unknown> = {};
  const streams: Record<string, unknown> = {};
  const log: Record<string, LogEntry> = {};
  const pred: Record<string, number> = {};
  let id = 5000;
  for (const d of resolved.dated.filter((x) => !x.rest && x.km != null && x.date <= TODAY)) {
    if (r() < presence) continue;
    const roll = r();
    const date = roll < 0.12 ? addDays(d.date, r() < 0.5 ? -1 : 1) : d.date;
    const runs = roll > 0.85 ? 2 : 1;
    for (let k = 0; k < runs; k++) {
      const km = Math.round(Math.max(3, (d.km ?? 8) * (0.75 + r() * 0.3)) * 10) / 10;
      const aid = String(id++);
      list.push({
        id: aid,
        datum: date,
        sat: r() < 0.9 ? Math.floor(r() * 24) : null,
        tip: r() < 0.06 ? 'Ride' : r() < 0.5 ? 'Run' : null,
        naziv: r() < 0.5 ? `Naziv ${aid}` : null,
        opis: r() < 0.3 ? 'opis' : null,
        km,
        sec: r() < 0.95 ? Math.round(km * (300 + r() * 80)) : null,
        hr: r() < 0.8 ? Math.round(140 + r() * 30) : null,
        maxHr: r() < 0.6 ? Math.round(165 + r() * 20) : null,
        kadenca: r() < 0.6 ? 80 + Math.round(r() * 16) / 2 : null,
        uspon: r() < 0.7 ? Math.round(r() * 200) : null,
        temp: r() < 0.4 ? Math.round(5 + r() * 20) : null,
        osecaSe: r() < 0.3 ? 20 : null,
        gapSec: r() < 0.5 ? 300 : null,
        razdvajanje: r() < 0.4 ? Math.round(r() * 100) / 10 : null,
        efikasnost: r() < 0.5 ? 1.5 : null,
        opterecenje: r() < 0.5 ? 60 : null,
        intenzitet: null,
        trimp: null,
        korak: null,
        zonePuls: r() < 0.5 ? [100, 200, 300, 0, 0] : null,
        zoneTempo: null,
        zoneGranice: r() < 0.5 ? [122, 141, 153, 165, 190] : null
      });
      if (d.tag === 'int' || d.tag === 'tempo') {
        const q = r();
        if (q < 0.5) {
          const reps = 4 + Math.floor(r() * 4);
          const pace = 225 + Math.round(r() * 60);
          const rounds: Array<Record<string, unknown>> = [
            { tip: 'rad', distM: 1500, sec: 495, paceSec: 330, hr: 140 } // zagrevanje
          ];
          for (let i = 0; i < reps; i++) {
            rounds.push({
              tip: 'rad',
              distM: 1000,
              sec: pace,
              paceSec: pace + (i % 3),
              hr: 170,
              kadenca: 90,
              maxHr: 178,
              razdvajanje: 1.5,
              oznaka: `Rep ${i + 1}`
            });
            rounds.push({ tip: 'oporavak', distM: 250, sec: 110, paceSec: 440 });
          }
          rounds.push({ tip: 'rad', distM: 2500, sec: 850, paceSec: 340 }); // hlađenje
          details[aid] = { krugovi: rounds, grupe: r() < 0.5 ? [{ oznaka: 'g1', n: reps }] : [] };
        } else if (q < 0.8) details[aid] = { krugovi: [], grupe: [] };
        else details[aid] = { greska: true };
      } else if (d.tag === 'lako' || d.tag === 'lr') {
        if (r() < 0.8)
          streams[aid] = streamsOf([
            { m: Math.round(km) * 1000, pace: 300 + Math.round(r() * 40) }
          ]);
        else streams[aid] = { greska: true };
      }
    }
    const pre = r();
    if (pre < 0.1) log[d.id] = { status: 'done', km: 1, lock: true, ts: d.date };
    else if (pre < 0.25) log[d.id] = { status: 'pending', knee: 2, kg: 79.9 };
    else if (pre < 0.4 && (d.tag === 'lako' || d.tag === 'lr'))
      log[d.id] = {
        status: 'done',
        aiCount: 2,
        perKm: [{ km: 1, v: 0, paceSec: 300, hr: 140 }]
      };
    else if (pre < 0.5 && (d.tag === 'int' || d.tag === 'tempo'))
      log[d.id] = {
        status: 'done',
        laps: [{ distM: 1000, paceSec: 240, avgHr: 170, cadence: null, watts: null }],
        lapsIzvor: pre < 0.45 ? 'icu' : 'strava',
        lapsVer: pre < 0.45 ? 2 : 1
      };
  }
  for (let k = 1; k < 15; k += 3)
    if (r() < 0.7)
      list.push({
        id: String(id++),
        datum: addDays(START, -k),
        km: Math.round((4 + r() * 6) * 10) / 10,
        sec: 2000,
        tip: 'Run'
      });
  return { list, details, streams, listFails: r() < 0.04, detailsFail: r() < 0.08, log, pred };
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

describe('sinhronizacija sa intervals.icu naspram starog koda', () => {
  it('trenizni: 60 nasumičnih scenarija (krugovi, bez strukture, presek po km, greške, zaključani, stariji krugovi)', async () => {
    const r = rng(51);
    let n = 0;
    let withIcuLaps = 0;
    let noStruct = 0;
    let perKms = 0;
    let moves = 0;
    let failedList = 0;
    for (let i = 0; i < 60; i++) {
      const dense = i % 4 === 0;
      const plan = dense ? GP_DENSE : GP;
      const resolved = resolvePlan(plan.weeks, { alts: {}, moves: {} });
      const sc = scenario(r, resolved, dense ? 0.02 : 0.3);
      const calls: unknown[] = [];

      const handler = (telo: Record<string, unknown>): Record<string, unknown> => {
        calls.push(j(telo));
        if (telo['oldest'])
          return sc.listFails
            ? { ok: false, error: 'greška servera' }
            : { ok: true, treninzi: j(sc.list) };
        if (telo['detalji']) {
          if (sc.detailsFail) return { ok: false, error: 'detalji pali' };
          const out: Record<string, unknown> = {};
          for (const id of telo['detalji'] as string[])
            if (sc.details[id]) out[id] = sc.details[id];
          return { ok: true, detalji: out };
        }
        if (telo['tokovi']) {
          const out: Record<string, unknown> = {};
          for (const id of telo['tokovi'] as string[]) if (sc.streams[id]) out[id] = sc.streams[id];
          return { ok: true, tokovi: out };
        }
        return { ok: false, error: 'nepoznato' };
      };

      /* ---- stari kod ---- */
      ctx()['__p'] = j(plan);
      ctx()['__s'] = j({ log: sc.log, pred: sc.pred });
      ctx()['__h'] = (t: unknown): unknown => j(handler(t as Record<string, unknown>));
      legacy.evalIn(
        `S.genPlan=__p; S.alts={}; S.moves={}; S.vanPlana={}; S.knee=[]; S.kg=[]; S.vdotLog=[]; S.log=__s.log; S.pred=__s.pred; S.predLock={};
         S.icu={athleteId:'i1',token:'abcdefgh1234',lastSync:0};
         setActivePlan(); rebuildDateIndex(); preracunajVdotLog();
         icuApi=async function(telo){ return __h(telo); }; 0`
      );
      const manual = r() < 0.5;
      const oldRes = j<Record<string, unknown>>(
        await legacy.evalIn(`icuSyncTreninzi(45, ${manual})`)
      );
      calls.length = 0;
      const old = {
        log: j<Record<string, LogEntry>>(legacy.evalIn('S.log')),
        pred: j<Record<string, number>>(legacy.evalIn('S.pred')),
        predLock: j<Record<string, boolean>>(legacy.evalIn('S.predLock')),
        vdotLog: j<VdotRecord[]>(legacy.evalIn('S.vdotLog')),
        moves: j<Record<string, unknown>>(legacy.evalIn('S.moves')),
        vanPlana: j<Record<string, number>>(legacy.evalIn('S.vanPlana')),
        knee: j<unknown[]>(legacy.evalIn('S.knee')),
        kg: j<unknown[]>(legacy.evalIn('S.kg')),
        trSync: legacy.evalIn('S.icu.trSync') as number | undefined
      };
      /* legacy mutira u hodu i pri ranom izlasku (manual + greška detalja) ne čuva — poredi se ono što je ostalo u memoriji, kao i ovde */

      /* ---- novi kod ---- */
      let state: ImportState = {
        genPlan: j(plan),
        log: j(sc.log),
        pred: j(sc.pred),
        predLock: {},
        vdotLog: [],
        alts: {},
        moves: {},
        vanPlana: {},
        knee: [],
        kg: []
      };
      let link: Record<string, unknown> | null = {
        athleteId: 'i1',
        token: 'abcdefgh1234',
        lastSync: 0
      };
      const asResult = <T>(
        o: Record<string, unknown>,
        pick: (o: Record<string, unknown>) => T
      ): Result<T> =>
        o['ok']
          ? { ok: true, data: pick(o), status: 200 }
          : { ok: false, kind: 'http', status: 500, error: String(o['error']) };
      const api = {
        activities: (_l: unknown, oldest: string, newest: string) => {
          const o = handler({ oldest, newest });
          return Promise.resolve(asResult(o, (x) => ({ activities: x['treninzi'] as never })));
        },
        details: (_l: unknown, ids: readonly string[]) => {
          const o = handler({ detalji: ids });
          return Promise.resolve(
            asResult(o, (x) => ({
              details: Object.fromEntries(
                Object.entries(x['detalji'] as Record<string, Record<string, unknown>>).map(
                  ([id, v]) => [
                    id,
                    'greska' in v
                      ? null
                      : { rounds: v['krugovi'] as never, groups: v['grupe'] as never }
                  ]
                )
              )
            }))
          );
        },
        streams: (_l: unknown, ids: readonly string[]) => {
          const o = handler({ tokovi: ids });
          return Promise.resolve(
            asResult(o, (x) => ({ streams: x['tokovi'] as Record<string, unknown> }))
          );
        }
      } as unknown as IcuApi;
      const svc = createIcuSync({
        api,
        link: { get: () => link, set: (v) => (link = v) },
        ports: { read: () => state, commit: (s) => (state = s) },
        wellness: { read: () => ({}), write: () => undefined },
        now: () => NOW,
        today: () => TODAY
      });
      const res = await svc.syncActivities(45, manual);

      expect(res.ok, `ishod ${i}`).toBe(oldRes['ok']);
      if (!res.ok) {
        failedList++;
        if (!sc.detailsFail) expect(res.error).toBe(oldRes['error']);
      } else {
        expect(res.n).toBe(oldRes['n']);
        expect(res.details).toBe(oldRes['detalja']);
        expect(res.streams).toBe(oldRes['presek'] ?? 0);
        n += res.n;
      }
      /* Kad lista padne, legacy vraća pre ikakve izmene (stanje ostaje početno) — isto i ovde (ništa se ne upisuje). */
      const mine = res.ok || (!sc.listFails && manual) ? state : { ...state };
      if (res.ok || !sc.listFails) {
        expect(j(mine.log), `log ${i}`).toEqual(old.log);
        expect(mine.pred, `pred ${i}`).toEqual(old.pred);
        expect(mine.predLock, `lock ${i}`).toEqual(old.predLock);
        expect(projChain(mine.vdotLog), `lanac ${i}`).toEqual(projChain(old.vdotLog));
        expect(mine.moves, `moves ${i}`).toEqual(old.moves);
        expect(mine.vanPlana, `vanPlana ${i}`).toEqual(old.vanPlana);
        expect(j(mine.knee), `bol ${i}`).toEqual(old.knee);
        expect(j(mine.kg), `masa ${i}`).toEqual(old.kg);
      } else {
        expect(j(state.log)).toEqual(j(sc.log));
      }
      if (res.ok)
        expect((link as Record<string, unknown> | null)?.['trSync'], `trSync ${i}`).toBe(
          old.trSync === undefined ? undefined : NOW
        );
      withIcuLaps += Object.values(state.log).filter((e) => e['lapsIzvor'] === 'icu').length;
      noStruct += Object.values(state.log).filter(
        (e) => e['lapsIzvor'] === 'icu-bez-strukture'
      ).length;
      perKms += Object.values(state.log).filter(
        (e) => Array.isArray(e['perKm']) && (e['perKm'] as Array<{ v?: number }>)[0]?.v === 2
      ).length;
      moves += Object.keys(state.moves).length;
    }
    expect(n).toBeGreaterThan(300);
    expect(withIcuLaps).toBeGreaterThan(30);
    expect(noStruct).toBeGreaterThan(10);
    expect(perKms).toBeGreaterThan(30);
    expect(moves).toBeGreaterThan(5);
    expect(failedList).toBeGreaterThan(0);
  });

  it('jutarnja merenja: isti zapisi (očišćeni), datum poslednjeg povlačenja; zone: isto stanje i ista poruka greške', async () => {
    const r = rng(52);
    for (let i = 0; i < 40; i++) {
      const dani: Array<Record<string, unknown>> = [];
      for (let k = 0; k < 1 + Math.floor(r() * 14); k++)
        dani.push({
          datum: addDays(TODAY as IsoDate, -k),
          hrv: r() < 0.2 ? null : Math.round(40 + r() * 40),
          pulsUMiru: r() < 0.2 ? null : Math.round(44 + r() * 14),
          sanH: Math.round((5 + r() * 4) * 10) / 10,
          sanOcena: r() < 0.5 ? Math.round(60 + r() * 30) : null,
          tezina: null,
          ctl: r() < 0.5 ? 30.5 : null,
          atl: r() < 0.5 ? 40.25 : null
        });
      ctx()['__d'] = j(dani);
      legacy.evalIn(
        `S.wellness={'2026-01-01':{datum:'2026-01-01',hrv:50,pulsUMiru:46,sanH:7,sanOcena:null,tezina:null,ctl:null,atl:null,svezina:null}};
         S.icu={athleteId:'i1',token:'abcdefgh1234',lastSync:0};
         sbToken=async function(){ return 'JWT'; };
         fetchRok=async function(){ return { ok:true, status:200, json:async function(){ return { dani:__d }; } }; }; 0`
      );
      const oldRes = j<Record<string, unknown>>(await legacy.evalIn('icuSync(30)'));
      const oldW = j<Record<string, WellnessRecord>>(legacy.evalIn('cistWellness(S.wellness)'));

      let wellness: Record<string, WellnessRecord> = {
        '2026-01-01': {
          datum: '2026-01-01',
          hrv: 50,
          pulsUMiru: 46,
          sanH: 7,
          sanOcena: null,
          tezina: null,
          ctl: null,
          atl: null,
          svezina: null
        }
      };
      let link: Record<string, unknown> | null = {
        athleteId: 'i1',
        token: 'abcdefgh1234',
        lastSync: 0
      };
      const api = {
        wellness: () =>
          Promise.resolve({
            ok: true,
            status: 200,
            data: {
              days: Object.fromEntries(
                dani.map((z) => [
                  z['datum'] as string,
                  {
                    ...z,
                    svezina:
                      z['ctl'] != null && z['atl'] != null
                        ? (z['ctl'] as number) - (z['atl'] as number)
                        : null
                  } as unknown as WellnessRecord
                ])
              )
            }
          })
      } as unknown as IcuApi;
      const svc = createIcuSync({
        api,
        link: { get: () => link, set: (v) => (link = v) },
        ports: { read: () => ({}) as ImportState, commit: () => undefined },
        wellness: { read: () => wellness, write: (w) => (wellness = w) },
        now: () => NOW,
        today: () => TODAY
      });
      const res = await svc.syncWellness(30);
      expect(res.ok).toBe(true);
      expect(res.ok && res.n).toBe(oldRes['n']);
      expect(Object.keys(wellness).sort()).toEqual(Object.keys(oldW).sort());
      for (const k of Object.keys(oldW)) {
        const a = wellness[k] as WellnessRecord;
        const b = oldW[k] as WellnessRecord;
        for (const f of ['hrv', 'pulsUMiru', 'sanH', 'sanOcena', 'tezina', 'ctl', 'atl'] as const)
          expect(a[f] ?? null, `${i} ${k} ${f}`).toBe(b[f] ?? null);
      }
      expect(link).toMatchObject({ lastSync: NOW });
    }
  });
});
