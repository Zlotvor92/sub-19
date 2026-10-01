import { beforeAll, describe, expect, it } from 'vitest';
import { canonical } from '@/test/fingerprint';
import { firstDiff } from '@/test/firstDiff';
import { loadLegacyApp, type LegacyApp } from '@/test/legacyOracle';
import { addDays, type IsoDate } from '../../date';
import { adaptGeneratedPlan } from '../../plan/adapt';
import { resolvePlan, weekOf } from '../../plan/resolve';
import type { GenPlanState, T3kRecord, VdotRecord } from '../../state';
import { generatePlan } from '../generator/generatePlan';
import { recomputeVdotChain, sessionClassFor } from '../adaptation';
import { predictionSummary } from '../prediction/summary';
import { isT3kId } from '../vdot/limits';
import { addT3k, removeT3k, t3kRows, t3kSeries, t3kVdot } from './index';

/* parity: test/test-3km.test.mjs (39 testova) — poredi sa starim `t3kVdot`, `t3kNiz`, `t3kRedovi`,
   `zabeleziT3k`/`dodajT3k`/`obrisiT3k` i `predCalc`. */

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
const START = '2026-01-05' as IsoDate;
const j = <T>(x: unknown): T => JSON.parse(JSON.stringify(x)) as T;

let legacy: LegacyApp;
const plans: Array<{ dist: number; plan: GenPlanState }> = [];

beforeAll(async () => {
  legacy = await loadLegacyApp('2026-01-07T09:00:00Z');
  for (const dist of [5000, 10000, 21097.5, 42195]) {
    const g = generatePlan({
      startDate: START,
      raceDate: addDays(START, 18 * 7),
      raceDistM: dist,
      pb: {
        distM: dist,
        sec: ({ 5000: 1237, 10000: 2570, 21097.5: 5700, 42195: 13500 } as Record<number, number>)[
          dist
        ] as number
      },
      weeklyKm: 50,
      runDays: 5,
      quality: 2,
      intensity: 'std',
      trainedRecently: true
    });
    const a = adaptGeneratedPlan(g);
    if (!a) throw new Error('adapt');
    plans.push({ dist, plan: a });
  }
});

function load(plan: GenPlanState, over: Record<string, unknown>): void {
  const ctx = (legacy as unknown as { ctx: Record<string, unknown> }).ctx;
  ctx['__p'] = j(plan);
  ctx['__o'] = j(over);
  legacy.evalIn(
    'S.genPlan=__p; S.alts={}; S.moves={}; S.log={}; S.vdotLog=[]; S.pred={}; S.t3k=[]; Object.assign(S,__o); setActivePlan(); rebuildDateIndex(); preracunajVdotLog(); 0'
  );
}

describe('t3kVdot / t3kSeries naspram starog', () => {
  it('isti VDOT i isti izbor za sva vremena 300–2400 s', () => {
    for (let sec = 300; sec <= 2400; sec += 7) {
      expect(t3kVdot(sec), `${sec}`).toBe(legacy.call('t3kVdot', sec));
    }
    expect(t3kVdot(0)).toBeNull();
    expect(t3kVdot(Number.NaN)).toBeNull();
  });

  it('t3kSeries: odbacuje nemoguće i nevažeće datume, sortira po datumu', () => {
    const list: T3kRecord[] = [
      { id: 't3k-b', date: '2026-02-10', sec: 700 },
      { id: 't3k-a', date: '2026-01-10', sec: 720 },
      { id: 't3k-c', date: '2026-02-31', sec: 700 },
      { id: 't3k-d', date: '2026-03-01', sec: 100 }
    ];
    load(plans[0]?.plan as GenPlanState, { t3k: list });
    expect(t3kSeries(list)).toEqual(j(legacy.evalIn('t3kNiz()')));
  });
});

describe('dodavanje i brisanje testa naspram starog dodajT3k / obrisiT3k', () => {
  it('isti t3k i isti lanac (bez slučajnog sufiksa u ID-ju)', () => {
    const r = rng(11);
    for (let i = 0; i < 80; i++) {
      const { plan } = plans[Math.floor(r() * plans.length)] as { plan: GenPlanState };
      load(plan, {});
      let mine: { t3k: T3kRecord[]; vdotLog: VdotRecord[] } = { t3k: [], vdotLog: [] };
      const n = 1 + Math.floor(r() * 4);
      const ids: string[] = [];
      for (let k = 0; k < n; k++) {
        const date = addDays(START, k * 25 + Math.floor(r() * 20)); // različiti datumi: sufiks ID-ja je slučajan, pa bi izjednačenje po ID-ju poredilo šum
        const sec = Math.round(380 + r() * 600);
        const oldId = legacy.call('dodajT3k', date, sec) as string | null;
        const added = addT3k(mine, date, sec, `s${k}`);
        expect(added !== null, `${i}/${k} ${sec}`).toBe(oldId !== null);
        if (added && oldId) {
          mine = { t3k: [...added.t3k], vdotLog: [...added.vdotLog] };
          ids.push(oldId);
        }
      }
      const oldT3k = j<T3kRecord[]>(legacy.evalIn('S.t3k'));
      expect(oldT3k.map((t) => [t.date, t.sec])).toEqual(mine.t3k.map((t) => [t.date, t.sec]));
      // lanac iz izmerenog: isti redosled i vrednosti
      const pred = plan.pred as Array<{ id: string; l: string }>;
      const chain = recomputeVdotChain(
        mine.vdotLog,
        (plan.meta as unknown as { vdot0: number }).vdot0,
        (id) => sessionClassFor(isT3kId(id), pred.find((p) => p.id === id)?.l)
      );
      const oldChain = j<VdotRecord[]>(legacy.evalIn('S.vdotLog'));
      expect(chain.map((e) => [e.ts, e.measured, e.vdot, e.prev, e.delta])).toEqual(
        oldChain.map((e) => [e.ts, e.measured, e.vdot, e.prev, e.delta])
      );
      if (oldChain.length) {
        const rm = oldT3k[0] as T3kRecord;
        legacy.call('obrisiT3k', rm.id);
        const after = removeT3k(mine, mine.t3k[0]?.id as string);
        expect(after.t3k.length).toBe(oldT3k.length - 1);
        expect(j<unknown[]>(legacy.evalIn('S.vdotLog')).length).toBe(after.vdotLog.length);
      }
    }
  });
});

describe('predikcija kroz plan naspram starog predCalc', () => {
  it('300 nasumičnih stanja: isti redovi, vremena, „zadnja", „najbrža"', () => {
    const r = rng(77);
    let tested = 0;
    let withBest = 0;
    for (let i = 0; i < 300; i++) {
      const { plan, dist } = plans[Math.floor(r() * plans.length)] as {
        plan: GenPlanState;
        dist: number;
      };
      const pred = plan.pred as Array<{
        id: string;
        w: number;
        l: string;
        q: number;
        pt: number;
        nemeri?: true;
      }>;
      const curW = 1 + Math.floor(r() * plan.weeks.length);
      const paces: Record<string, number> = {};
      const vdotLog: Array<Record<string, unknown>> = [];
      const base = (plan.meta as unknown as { vdot0: number }).vdot0;
      for (const row of pred) {
        if (row.w > curW || r() < 0.3) continue;
        const pace = Math.round(row.pt + (r() - 0.5) * 50);
        paces[row.id] = pace;
        if (r() < 0.7)
          vdotLog.push({
            id: row.id,
            ts: addDays(START, (row.w - 1) * 7 + Math.floor(r() * 7)),
            measured: Math.round((base + (r() - 0.4) * 6) * 10) / 10
          });
      }
      const t3k: T3kRecord[] = [];
      const nt = Math.floor(r() * 3);
      for (let k = 0; k < nt; k++) {
        const date = addDays(START, Math.floor(r() * 140) - 5);
        const sec = Math.round(560 + r() * 300);
        t3k.push({ id: `t3k-${date}-x${k}`, date, sec });
        if (r() < 0.8)
          vdotLog.push({ id: `t3k-${date}-x${k}`, ts: date, measured: t3kVdot(sec) ?? 40 });
      }
      load(plan, { pred: paces, vdotLog, t3k });
      const old = j<{
        rows: Array<{ r: { id: string }; a: number | undefined; pred: number | null }>;
        testovi: Array<{ r: { id: string }; a: number; pred: number | null }>;
        entered: Array<{ r: { id: string } }>;
        last: { r: { id: string } } | null;
        best: { r: { id: string } } | null;
        lastRed: { r: { id: string } } | null;
      }>(legacy.evalIn('predCalc()'));

      const resolved = resolvePlan(plan.weeks, { alts: {}, moves: {} });
      const chain = recomputeVdotChain(
        vdotLog.map((e) => ({
          id: e['id'],
          ts: e['ts'] as string,
          vdot: null,
          prev: null,
          delta: null,
          measured: e['measured'] as number
        })),
        base,
        (id) => sessionClassFor(isT3kId(id), pred.find((p) => p.id === id)?.l)
      );
      const rows = t3kRows(
        t3k,
        (d) => weekOf(resolved, d)?.w ?? null,
        resolved.weeks[0]?.start ?? START,
        resolved.weeks.length
      );
      const s = predictionSummary({
        pred: pred as never,
        paces,
        chain,
        tests: rows,
        raceDistM: dist
      });
      expect(
        firstDiff(
          canonical(s.rows.map((x) => [x.r.id, x.a ?? null, x.pred])),
          canonical(old.rows.map((x) => [x.r.id, x.a ?? null, x.pred]))
        ),
        `rows ${i}`
      ).toBeNull();
      expect(s.tests.map((x) => [x.r.id, x.a, x.pred, x.r.w, x.r.l])).toEqual(
        old.testovi.map((x) => {
          const full = j<Array<{ id: string; w: number; l: string }>>(
            legacy.evalIn('t3kRedovi()')
          ).find((z) => z.id === x.r.id);
          return [x.r.id, x.a, x.pred, full?.w, full?.l];
        })
      );
      expect(s.entered.map((x) => x.r.id)).toEqual(old.entered.map((x) => x.r.id));
      expect(s.last?.r.id ?? null).toBe(old.last?.r.id ?? null);
      expect(s.best?.r.id ?? null).toBe(old.best ? old.best.r.id : null);
      expect(s.lastRow?.r.id ?? null).toBe(old.lastRed?.r.id ?? null);
      tested += s.entered.length;
      if (s.best) withBest++;
    }
    expect(tested).toBeGreaterThan(300);
    expect(withBest).toBeGreaterThan(100);
  });
});
