/* REKALIBRACIJA PLANA (`planRecalibrated`) — ENGINE_CHANGES R1. Stari kod ima `recalibratedPlan`, ali ga nijedan ekran nije zvao; ovo je
   pravila povezana sa perzistiranim planom. Poređenje sa starim kodom za samu generaciju je u `replan.oracle.test.ts`; ovde su svojstva
   koja stari kod nije imao: istorija se ne dira, putanja prolazi kroz formu, idempotencija, stabilan tempo trke, polazna forma lanca. */

import { describe, expect, it } from 'vitest';
import { addDays, parseIsoDate, type IsoDate } from '../date';
import type { GenPlanState } from '../state';
import { generatePlan } from '../training/generator/generatePlan';
import { planVdotForWeek } from '../training/prediction';
import type { PlanGenerationInput, PlanMeta, Session } from '../training/types';
import { adaptGeneratedPlan } from './adapt';
import { planBaselineVdot } from './baseline';
import {
  planRecalibrated,
  planWithNewGoal,
  RECALIBRATION_MIN_WEEKS_LEFT,
  type RecalibratedStoredPlan
} from './replan';

const START = parseIsoDate('2026-10-05') as IsoDate;
const WEEKS = 24;
const PB: Record<number, number> = { 5000: 1237, 10000: 2600, 21097.5: 5400, 42195: 12600 };

const input = (raceDistM = 5000, over: Partial<PlanGenerationInput> = {}): PlanGenerationInput => ({
  startDate: START,
  raceDate: addDays(START, (WEEKS - 1) * 7 + 6),
  raceDistM,
  pb: { distM: raceDistM, sec: PB[raceDistM] as number },
  weeklyKm: 40,
  runDays: 5,
  quality: 2,
  intensity: 'std',
  trainedRecently: true,
  ...over
});

const stored = (inp: PlanGenerationInput): GenPlanState => {
  const a = adaptGeneratedPlan(generatePlan(inp));
  if (!a) throw new Error('adapt');
  return { ...a, ulaz: inp };
};
const meta = (p: GenPlanState): PlanMeta & Record<string, unknown> =>
  p.meta as PlanMeta & Record<string, unknown>;
const ok = (r: RecalibratedStoredPlan | { error: string }): RecalibratedStoredPlan => {
  if ('error' in r) throw new Error(r.error);
  return r;
};
const asPlan = (r: RecalibratedStoredPlan): GenPlanState => ({
  weeks: r.weeks,
  pred: r.pred,
  qs: r.qs,
  meta: r.meta,
  ulaz: r.ulaz
});
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** Dan unutar nedelje `w` (sreda). */
const dayIn = (w: number): IsoDate => addDays(START, (w - 1) * 7 + 2);
const IDX = 8;

describe('planRecalibrated: odbijanja (bez izmene plana)', () => {
  const plan = stored(input());
  it('nema plana / nema ulaza / nemoguća forma', () => {
    expect(planRecalibrated(null, 50, dayIn(IDX))).toHaveProperty('error');
    const { ulaz: _u, ...noInput } = plan;
    void _u;
    expect(planRecalibrated(noInput, 50, dayIn(IDX))).toHaveProperty('error');
    for (const bad of [Number.NaN, Infinity, 5, 19.9, 85.1, -1])
      expect(planRecalibrated(plan, bad, dayIn(IDX)), String(bad)).toHaveProperty('error');
  });
  it('plan je završen; manje od 4 nedelje do trke', () => {
    expect(planRecalibrated(plan, 50, dayIn(WEEKS + 3))).toHaveProperty('error');
    const lastOk = WEEKS - RECALIBRATION_MIN_WEEKS_LEFT + 1;
    expect(planRecalibrated(plan, 50, dayIn(lastOk))).not.toHaveProperty('error');
    expect(planRecalibrated(plan, 50, dayIn(lastOk + 1))).toHaveProperty('error');
  });
  it('ulaz se ne menja (čista funkcija)', () => {
    const before = JSON.stringify(plan);
    ok(planRecalibrated(plan, 55, dayIn(IDX)));
    expect(JSON.stringify(plan)).toBe(before);
  });
});

describe('planRecalibrated: istorija i struktura', () => {
  const plan = stored(input());
  const r = ok(planRecalibrated(plan, 53, dayIn(IDX)));

  it('nedelje ispod tekuće, njihovi PRED redovi i qs ostaju netaknuti', () => {
    expect(r.weeks.slice(0, IDX - 1)).toEqual(plan.weeks.slice(0, IDX - 1));
    expect(r.pred.filter((p) => p.w < IDX)).toEqual(plan.pred.filter((p) => p.w < IDX));
    for (const [k, v] of Object.entries(plan.qs ?? {})) {
      const w = +(/^g(\d+)d/.exec(k)?.[1] ?? 0);
      if (w < IDX) expect(r.qs[k], k).toEqual(v);
    }
  });
  it('isti kalendar i isti ID-jevi dana; menja se samo ono što je u budućnosti', () => {
    expect(r.weeks.map((w) => [w.w, w.start])).toEqual(plan.weeks.map((w) => [w.w, w.start]));
    expect(r.weeks.map((w) => w.days.map((d) => d.id))).toEqual(
      plan.weeks.map((w) => w.days.map((d) => d.id))
    );
    expect(r.recalibration.changedWeeks).toBe(WEEKS - IDX + 1);
    expect(r.recalibration.week).toBe(IDX);
  });
  it('PRED redovi: isti broj kao pre, ID-jevi jedinstveni i redom', () => {
    expect(r.pred).toHaveLength(plan.pred.length);
    expect(new Set(r.pred.map((p) => p.id)).size).toBe(r.pred.length);
  });
  it('taper zastavica i dalje stoji na istim nedeljama', () => {
    expect(r.weeks.map((w) => w.taper === true)).toEqual(plan.weeks.map((w) => w.taper === true));
  });
});

describe('planRecalibrated: putanja prolazi kroz izmerenu formu', () => {
  for (const dist of [5000, 10000, 21097.5, 42195]) {
    for (const idx of [2, 6, 12]) {
      it(`${dist} m, od N${idx}: planska forma na tekućoj nedelji = izmerena (±0,15)`, () => {
        const inp = input(dist, { raceDate: addDays(START, (30 - 1) * 7 + 6) });
        const plan = stored(inp);
        const before = planVdotForWeek(meta(plan), idx) as number;
        for (const form of [before - 3, before, before + 2.5]) {
          const r = ok(planRecalibrated(plan, form, dayIn(idx)));
          const after = planVdotForWeek(r.meta, idx) as number;
          expect(Math.abs(after - form), `${dist} N${idx} forma ${form.toFixed(1)}`).toBeLessThan(
            0.16
          );
        }
      });
    }
  }

  it('forma tačno NA planskoj putanji je no-op za tempo (≤ 2 s/km po sesiji)', () => {
    const plan = stored(input());
    const onPath = planVdotForWeek(meta(plan), IDX) as number;
    const r = ok(planRecalibrated(plan, onPath, dayIn(IDX)));
    let compared = 0;
    for (let i = IDX - 1; i < plan.weeks.length; i++)
      plan.weeks[i]?.days.forEach((d, j) => {
        const n = r.weeks[i]?.days[j];
        if (!d.session || !n?.session) return;
        expect(Math.abs(n.session.paceSec - d.session.paceSec), `${d.id}`).toBeLessThanOrEqual(2);
        compared++;
      });
    expect(compared).toBeGreaterThan(20);
  });

  it('bolja forma → brži tempi preostalih sesija i bolje projektovano vreme; slabija → obrnuto', () => {
    const plan = stored(input());
    const onPath = planVdotForWeek(meta(plan), IDX) as number;
    const mean = (p: RecalibratedStoredPlan): number => {
      const xs: number[] = [];
      for (const w of p.weeks.slice(IDX - 1))
        for (const d of w.days) if (d.session) xs.push(d.session.paceSec);
      return xs.reduce((a, b) => a + b, 0) / xs.length;
    };
    const fast = ok(planRecalibrated(plan, onPath + 3, dayIn(IDX)));
    const slow = ok(planRecalibrated(plan, onPath - 3, dayIn(IDX)));
    expect(mean(fast)).toBeLessThan(mean(slow));
    expect(fast.recalibration.predictedAfter).toBeLessThan(slow.recalibration.predictedAfter);
  });

  it('bolja forma ne pomera obim više od ~jedne nedelje trčanja (D1 sprega ostaje mala)', () => {
    const plan = stored(input());
    const onPath = planVdotForWeek(meta(plan), IDX) as number;
    const r = ok(planRecalibrated(plan, onPath + 4, dayIn(IDX)));
    const km = (w: GenPlanState['weeks'][number]): number =>
      w.days.reduce((s, d) => s + (d.km ?? 0), 0);
    plan.weeks.forEach((w, i) => {
      if (i < IDX - 1) return;
      expect(Math.abs(km(r.weeks[i] as never) - km(w)), `N${w.w}`).toBeLessThan(5);
    });
  });
});

describe('planRecalibrated: ručna izmena i odrađeno', () => {
  it('ručno zaključan tempo sesije stiže na ISTI dan i ostaje zaključan', () => {
    const base = stored(input());
    const plan = clone(base);
    let locked = 0;
    const lockedAt: Array<[number, number, number]> = [];
    plan.weeks.forEach((w, wi) => {
      if (w.w < IDX) return;
      w.days.forEach((d, di) => {
        const s = d.session as (Session & Record<string, unknown>) | undefined;
        if (!s || locked >= 4) return;
        s['paceSec'] = s.paceSec + 11;
        s.overrides = { ...s.overrides, paceSec: true };
        lockedAt.push([wi, di, s.paceSec]);
        locked++;
      });
    });
    expect(locked).toBe(4);
    const r = ok(planRecalibrated(plan, 56, dayIn(IDX)));
    for (const [wi, di, pace] of lockedAt) {
      const s = r.weeks[wi]?.days[di]?.session;
      expect(s?.paceSec, `N${wi + 1} dan ${di}`).toBe(pace);
      expect(s?.overrides['paceSec']).toBe(true);
    }
  });
});

describe('planRecalibrated: idempotencija i stabilnost', () => {
  it('ista forma, ista nedelja, primenjeno dvaput = isti plan', () => {
    const plan = stored(input());
    const a = ok(planRecalibrated(plan, 54, dayIn(IDX)));
    const b = ok(planRecalibrated(asPlan(a), 54, dayIn(IDX)));
    expect(b.weeks).toEqual(a.weeks);
    expect(b.pred).toEqual(a.pred);
    expect(b.meta).toEqual(a.meta);
    expect(b.ulaz).toEqual(a.ulaz);
  });

  it('tempo trke se ne menja, ni sa ni bez cilja; cilj koji korisnik nije zadao ne postaje cilj', () => {
    for (const over of [{}, { goalSec: 1170 }] as Array<Partial<PlanGenerationInput>>) {
      const plan = stored(input(5000, over));
      for (const form of [46, 50, 58]) {
        const r = ok(planRecalibrated(plan, form, dayIn(IDX)));
        expect(r.meta.racePace, JSON.stringify(over)).toBe(meta(plan).racePace);
        expect(r.meta.goalSec).toBe(meta(plan).goalSec);
        expect(r.meta.goalVdot).toBe(meta(plan).goalVdot);
        if (over.goalSec) {
          /* Cilj ostaje isti, ali se NJEGOVA REALNOST preračunava prema novoj projekciji (slabija forma → cilj van dohvata). */
          expect(r.meta.realno).toBe((r.meta.goalVdot as number) <= r.meta.vdotGoal + 0.3);
        } else {
          expect(r.meta.realno).toBe(meta(plan).realno);
        }
      }
    }
  });

  it('tempo trke ostaje isti i posle VIŠE uzastopnih rekalibracija sa različitom formom', () => {
    let plan = stored(input());
    const pace = meta(plan).racePace;
    for (const [form, idx] of [
      [50, 6],
      [47, 9],
      [55, 12]
    ] as const) {
      plan = asPlan(ok(planRecalibrated(plan, form, dayIn(idx))));
      expect(meta(plan).racePace, `N${idx}`).toBe(pace);
    }
  });
});

describe('polazna forma lanca (`vdotBase`)', () => {
  it('stvarna polazna forma se čuva; `vdot0` je virtuelna polazna tačka putanje', () => {
    const plan = stored(input());
    const real = meta(plan).vdot0;
    expect(planBaselineVdot(meta(plan))).toBe(real);
    const r = ok(planRecalibrated(plan, 56, dayIn(IDX)));
    expect(r.meta.vdotBase).toBe(real);
    expect(planBaselineVdot(r.meta)).toBe(real);
    expect(r.meta.vdot0).not.toBe(real);
    // sledeća rekalibracija ne gazi stvarnu polaznu formu
    const r2 = ok(planRecalibrated(asPlan(r), 49, dayIn(IDX + 3)));
    expect(r2.meta.vdotBase).toBe(real);
    expect(r2.meta.recalWeek).toBe(IDX + 3);
    expect(r2.meta.vdotAtRecal).toBe(49);
  });

  it('planBaselineVdot: vdotBase ima prednost, inače vdot0, inače null', () => {
    expect(planBaselineVdot({ vdot0: 48, vdotBase: 47 })).toBe(47);
    expect(planBaselineVdot({ vdot0: 48 })).toBe(48);
    expect(planBaselineVdot({ vdot0: 'x' })).toBeNull();
    expect(planBaselineVdot(null)).toBeNull();
    expect(planBaselineVdot({ vdotBase: Number.NaN, vdot0: 48 })).toBe(48);
  });
});

describe('promena cilja POSLE rekalibracije čuva putanju i polaznu formu', () => {
  it('ista putanja za buduće nedelje, `vdotBase` preživljava', () => {
    const plan = stored(input());
    const rec = ok(planRecalibrated(plan, 56, dayIn(IDX)));
    const recPlan = asPlan(rec);
    const g = planWithNewGoal(recPlan, 1180, dayIn(IDX + 2));
    if ('error' in g) throw new Error(g.error);
    expect(g.meta['vdotBase']).toBe(meta(plan).vdot0);
    for (const w of [IDX + 2, IDX + 6, WEEKS - 3]) {
      const a = planVdotForWeek(rec.meta, w) as number;
      const b = planVdotForWeek(g.meta, w) as number;
      expect(Math.abs(a - b), `N${w}`).toBeLessThan(0.2);
    }
  });
});
