import { beforeAll, describe, expect, it } from 'vitest';
import { loadLegacyApp, type LegacyApp } from '@/test/legacyOracle';
import { addDays, type IsoDate } from '../date';
import { adaptGeneratedPlan } from '../plan/adapt';
import { resolvePlan } from '../plan/resolve';
import type { AltRecord, GenPlanState, LogEntry } from '../state';
import { generatePlan } from '../training/generator/generatePlan';
import { planPhases, ringView, sessionCore, weekChart, weekPlanKm, weekRealKm } from './index';

/* parity: sessCore, planFaze, prstenSVG, chartWeeks (app.js) — Plan tab. */

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

let legacy: LegacyApp;
const PLANS: GenPlanState[] = [];
beforeAll(async () => {
  legacy = await loadLegacyApp('2026-01-07T09:00:00Z');
  for (const [dist, weeks] of [
    [5000, 12],
    [10000, 18],
    [21097.5, 24],
    [42195, 30]
  ] as const) {
    const a = adaptGeneratedPlan(
      generatePlan({
        startDate: START,
        raceDate: addDays(START, weeks * 7 + 3),
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
      })
    );
    if (!a) throw new Error('adapt');
    PLANS.push(a);
  }
});
const ctx = (): Record<string, unknown> =>
  (legacy as unknown as { ctx: Record<string, unknown> }).ctx;
function load(plan: GenPlanState, over: Record<string, unknown>): void {
  ctx()['__p'] = j(plan);
  ctx()['__o'] = j(over);
  legacy.evalIn(
    'S.genPlan=__p; S.alts={}; S.moves={}; S.log={}; Object.assign(S,__o); setActivePlan(); rebuildDateIndex(); 0'
  );
}

describe('Plan tab naspram starog koda', () => {
  it('sessionCore: svaki dan sva 4 plana, i sa ručno promenjenim opisom', () => {
    const r = rng(7);
    const descs = [
      'Tempo 3 km zagrevanje + 4 km @ 4:25/km (2 min hoda) + 2 km hlađenje · pazi na puls',
      '3 km WU + 2 km smirivanje',
      'Lagano 8 km (po osećaju)',
      '2 km zagrevanje + 5×1000 m @ 3:55/km (90 s) + 2 km smirivanje',
      '',
      'bez kilometara'
    ];
    let checked = 0;
    for (const plan of PLANS) {
      const alts: Record<string, AltRecord> = {};
      for (const w of plan.weeks)
        for (const d of w.days)
          if (d.km && r() < 0.2)
            alts[d.id as string] = {
              tag: 'tempo',
              km: 8,
              desc: descs[Math.floor(r() * descs.length)] as string,
              pace: null,
              rw: null,
              paceAuto: false
            };
      load(plan, { alts });
      const mine = resolvePlan(plan.weeks, { alts, moves: {} });
      for (const d of mine.dated) {
        expect(sessionCore(d), d.id).toBe(
          legacy.evalIn(`sessCore(BY_ID[${JSON.stringify(d.id)}])`)
        );
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(300);
  });

  it('planPhases: isto grupisanje nedelja kao planFaze', () => {
    for (const plan of PLANS) {
      load(plan, {});
      const mine = planPhases(resolvePlan(plan.weeks, { alts: {}, moves: {} })).map((g) => [
        g.name,
        g.weeks.map((w) => w.w)
      ]);
      const old = j<Array<[string, number[]]>>(
        legacy.evalIn('planFaze().map(g=>[g.ime,g.nedelje.map(w=>w.w)])')
      );
      expect(mine).toEqual(old);
      expect(mine.length).toBeGreaterThan(1);
    }
  });

  it('weekChart: isti kilometri po nedelji, ista skala', () => {
    const r = rng(8);
    for (const plan of PLANS) {
      const log: Record<string, LogEntry> = {};
      for (const w of plan.weeks)
        for (const d of w.days)
          if (r() < 0.6) log[d.id as string] = { status: 'done', km: Math.round(r() * 200) / 10 };
      load(plan, { log });
      const resolved = resolvePlan(plan.weeks, { alts: {}, moves: {} });
      const c = weekChart(resolved, log);
      c.bars.forEach((b) => {
        expect(b.planKm).toBeCloseTo(
          legacy.evalIn(`weekPlanKm(CUR_PLAN[${b.w - 1}])`) as number,
          9
        );
        expect(b.realKm).toBeCloseTo(
          legacy.evalIn(`weekRealKm(CUR_PLAN[${b.w - 1}])`) as number,
          9
        );
      });
      expect(resolved.weeks.map((w) => weekPlanKm(w))).toEqual(c.bars.map((b) => b.planKm));
      expect(resolved.weeks.map((w) => weekRealKm(w, log))).toEqual(c.bars.map((b) => b.realKm));
      const peak = Math.max(...c.bars.map((b) => Math.max(b.planKm, b.realKm)), 1);
      expect(c.max).toBe(Math.ceil(peak / 12) * 12);
      expect(c.ticks).toEqual(
        [0, c.max * 0.25, c.max * 0.5, c.max * 0.75, c.max].map((v) => Math.round(v))
      );
    }
  });

  it('ringView: isti dasharray/dashoffset kao prstenSVG, uključujući prekoračenje i nevažeći udeo', () => {
    for (const share of [0, 0.12, 0.5, 0.999, 1, 1.4, -0.3, 0.333333]) {
      const svg = String(legacy.evalIn(`prstenSVG(${share}, '', 58, 'red')`));
      const dash = /stroke-dasharray="([\d.]+)" stroke-dashoffset="([\d.]+)"/.exec(svg);
      const mine = ringView(share);
      expect([Number(dash?.[1]), Number(dash?.[2])], String(share)).toEqual([
        mine.circumference,
        mine.offset
      ]);
    }
    expect(ringView(Number.NaN).offset).toBe(ringView(0).offset);
  });
});
