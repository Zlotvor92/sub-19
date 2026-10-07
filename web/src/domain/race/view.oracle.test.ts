import { beforeAll, describe, expect, it } from 'vitest';
import { loadLegacyApp, type LegacyApp } from '@/test/legacyOracle';
import { addDays, type IsoDate } from '../date';
import { adaptGeneratedPlan } from '../plan/adapt';
import { resolvePlan } from '../plan/resolve';
import type { GenPlanState, LogEntry, T3kRecord, VdotRecord } from '../state';
import type { StoredPredRow } from '../training/adaptation';
import { generatePlan } from '@/test/legacyGenerator';
import { t3kRows } from '../training/test3k';
import { predictionSummary } from '../training/prediction/summary';
import {
  completedRuns,
  goalShare,
  heroRing,
  paceChartModel,
  predictionChartModel,
  raceRefs,
  vdotTrendModel
} from './index';

/* parity: baselineVdot/goalVdotActive/goalSecActive/raceDistActive, trkaUdeo/trkaPrsten, chartVdotTrend, chartPred, chartTempo (app.js). */

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
  legacy = await loadLegacyApp('2026-03-01T09:00:00Z');
  for (const [dist, sec, goal] of [
    [5000, 1237, 1170],
    [10000, 2570, 2450],
    [21097.5, 5700, 5400],
    [42195, 13500, 12900]
  ] as const) {
    const a = adaptGeneratedPlan(
      generatePlan({
        startDate: START,
        raceDate: addDays(START, 20 * 7 + 3),
        raceDistM: dist,
        pb: { distM: dist, sec },
        goalSec: goal,
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
const fx = (p: { x: number; y: number }): string => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;

function scenario(plan: GenPlanState, r: () => number) {
  const pred: Record<string, number> = {};
  const vdotLog: VdotRecord[] = [];
  const rows = plan.pred.filter((x): x is StoredPredRow => typeof x.id === 'string');
  rows.forEach((row, i) => {
    if (r() < 0.45) {
      pred[row.id] = Math.round(row.pt + (r() - 0.5) * 30);
      if (r() < 0.8 && !row.nemeri)
        vdotLog.push({
          id: row.id,
          ts: new Date(Date.UTC(2026, 0, 6 + i * 3)).toISOString().slice(0, 10),
          vdot: null,
          prev: null,
          delta: null,
          measured: 44 + Math.round(r() * 80) / 10
        });
    }
  });
  const t3k: T3kRecord[] = [];
  if (r() < 0.6)
    t3k.push({
      id: 't3k-2026-02-10-ab',
      date: '2026-02-10',
      sec: 700 + Math.round(r() * 60)
    });
  return { pred, vdotLog, t3k, rows };
}

describe('Trka naspram starog koda', () => {
  it('referentne vrednosti i prstenovi heroja', () => {
    const r = rng(31);
    for (const plan of PLANS) {
      ctx()['__p'] = j(plan);
      legacy.evalIn('S.genPlan=__p; S.alts={}; S.moves={}; setActivePlan(); rebuildDateIndex(); 0');
      const refs = raceRefs(plan.meta);
      expect(refs.baselineVdot).toBe(legacy.evalIn('baselineVdot()'));
      expect(refs.goalVdot).toBe(legacy.evalIn('goalVdotActive()'));
      expect(refs.goalSec).toBe(legacy.evalIn('goalSecActive()'));
      expect(refs.raceDistM).toBe(legacy.evalIn('raceDistActive()'));
      for (let i = 0; i < 20; i++) {
        const sec = i === 0 ? null : Math.round((refs.goalSec ?? 1200) * (0.8 + r() * 0.5));
        const old = String(
          legacy.evalIn(
            `trkaPrsten(${JSON.stringify(sec == null ? null : { pred: sec })}, 'zadnja')`
          )
        );
        const ring = heroRing(sec, refs);
        expect(goalShare(sec, refs)).toBe(legacy.evalIn(`trkaUdeo(${JSON.stringify(sec)})`));
        const sub = />([^<]*)<\/span><\/div>$/.exec(old)?.[1];
        expect(ring.sub, `${i} ${String(sec)}`).toBe(sub);
        const stroke = /class="pr-val"[^>]*stroke="([^"]*)"/.exec(old)?.[1];
        expect(stroke).toBe(
          ring.tone === 'none'
            ? 'rgba(238,240,255,.22)'
            : ring.tone === 'good'
              ? 'var(--green)'
              : 'var(--pink)'
        );
      }
    }
  });

  it('VDOT trend, predikcija kroz plan i prosečan tempo: iste tačke na 40 nasumičnih stanja', () => {
    const r = rng(32);
    let trend = 0;
    let pcs = 0;
    let paces = 0;
    for (let n = 0; n < 40; n++) {
      const plan = PLANS[n % PLANS.length] as GenPlanState;
      const sc = scenario(plan, r);
      const log: Record<string, LogEntry> = {};
      for (const w of plan.weeks)
        for (const d of w.days)
          if (d.km && r() < 0.5)
            log[d.id as string] = {
              status: 'done',
              km: Math.round(d.km * 10) / 10,
              sec: Math.round(d.km * (280 + r() * 60)),
              ts: addDays(START, w.w * 7 - 7 + ((d as { dow: number }).dow ?? 1) - 1)
            };
      ctx()['__p'] = j(plan);
      ctx()['__s'] = j({ ...sc, rows: undefined, log });
      legacy.evalIn(
        'S.genPlan=__p; S.alts={}; S.moves={}; setActivePlan(); rebuildDateIndex(); Object.assign(S,{pred:__s.pred,vdotLog:__s.vdotLog,t3k:__s.t3k,log:__s.log,predLock:{}}); preracunajVdotLog(); CHART_SEL.vdot=null; CHART_SEL.pred=null; CHART_SEL.tempo=null; 0'
      );
      const chain = j<VdotRecord[]>(legacy.evalIn('S.vdotLog'));
      const refs = raceRefs(plan.meta);
      const resolved = resolvePlan(plan.weeks, { alts: {}, moves: {} });
      const week = (d: string): number | null =>
        resolved.weeks.find((w) => d >= w.start && d <= addDays(w.start, 6))?.w ?? null;

      /* VDOT trend */
      const svgT = String(legacy.evalIn('chartVdotTrend()'));
      const tm = vdotTrendModel(chain, refs.baselineVdot as number, refs.goalVdot as number);
      if (!tm) expect(svgT).toContain('bar 2 zabeležene');
      else {
        trend++;
        expect(tm.items.map(fx)).toEqual(
          [
            ...svgT.matchAll(
              /<circle cx="([\d.]+)" cy="([\d.]+)" r="[\d.]+" fill="[^"]*" stroke="[^"]*" stroke-width="[\d]"/g
            )
          ].map((x) => `${x[1]},${x[2]}`)
        );
      }

      /* predikcija kroz plan */
      const summary = predictionSummary({
        pred: sc.rows,
        paces: sc.pred,
        chain,
        tests: t3kRows(sc.t3k, week, resolved.weeks[0]?.start as string, resolved.weeks.length),
        raceDistM: refs.raceDistM
      });
      const svgP = String(legacy.evalIn('chartPred(predCalc())'));
      const pm = predictionChartModel(sc.rows, summary, refs.goalSec);
      expect(pm).not.toBeNull();
      if (pm) {
        pcs++;
        const plan0 =
          /<polyline fill="none" stroke="rgba\(255,255,255,\.25\)"[^>]*points="([^"]*)"/.exec(
            svgP
          )?.[1];
        expect(pm.planLine.map(fx).join(' ')).toBe(plan0);
        const lineMatch = /<polyline fill="none" stroke="var\(--pink\)"[^>]*points="([^"]*)"/.exec(
          svgP
        )?.[1];
        if (pm.entries.length > 1) expect(pm.entries.map(fx).join(' ')).toBe(lineMatch);
        else expect(lineMatch).toBeUndefined();
        const ticks = [
          ...svgP.matchAll(/<text class="ax" x="[\d.]+" y="([\d.]+)" text-anchor="end">/g)
        ].map((x) => x[1]);
        expect(pm.ticks.map((t) => (t.y + 3).toFixed(1))).toEqual(ticks.slice(0, 5));
        const dias = [...svgP.matchAll(/<path d="M([\d.]+),([\d.]+) L/g)].map((x) => [
          Number(x[1]),
          Number(x[2])
        ]);
        expect(
          pm.tests.map((t) => [Number(t.x.toFixed(1)), Number((t.y - 4.6).toFixed(1))])
        ).toEqual(dias);
      }

      /* prosečan tempo */
      const svgR = String(legacy.evalIn('chartTempo()'));
      const runs = completedRuns(resolved, log, {});
      const cm = paceChartModel(runs);
      if (!cm) expect(svgR).toContain('Unesi distancu');
      else {
        paces++;
        expect(cm.items.map(fx)).toEqual(
          [
            ...svgR.matchAll(
              /<circle cx="([\d.]+)" cy="([\d.]+)" r="[\d.]+" fill="[^"]*" stroke="[^"]*" stroke-width="[\d]"/g
            )
          ].map((x) => `${x[1]},${x[2]}`)
        );
        expect(cm.items.map((i) => i.run.kind)).toEqual(
          j<string[]>(
            legacy.evalIn(
              `(function(){var o=[];CUR_PLAN.forEach(w=>w.days.forEach(d=>{var l=S.log[d.id];if(l&&l.status==='done'&&l.km>0&&l.sec>0)o.push({date:l.ts||d.date||'',k:sessKind(d)});}));o.sort((a,b)=>a.date<b.date?-1:1);return o.map(x=>x.k);})()`
            )
          )
        );
      }
    }
    expect(trend).toBeGreaterThan(15);
    expect(pcs).toBe(40);
    expect(paces).toBeGreaterThan(30);
  });
});
