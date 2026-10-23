/* Segment 05b (5k-v2.4.1): regresija kapaciteta. Odluka 1 — 3 dana: dugi ≤ 45%, lagan ≤ dugi više ne
   tera kvalitet na ≥ 20% nedelje; Odluka 2 — rupe u izvodljivim ciljevima ne spuštaju kapacitet
   (fitTargetKm), korak dugog 0,1 km za sve brojeve dana; Odluka 3 — vrh ≥ vrh na 7b4b574 (fixture,
   stari kod se ne pokreće). Testovi 1–2 padaju na 349fd64 na proveri (vrh 17,1 / 41,3). */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { addDays } from './dates.ts';
import { generateFiveKV2 } from './generate.ts';
import { pacesFromVdot } from './paces.ts';
import { FIVE_K_V2_POLICY as P } from './policy.ts';
import { inputOf, START } from './testInputs.ts';
import type { FiveKV2Plan, PlanDay, PlanWeek, Weekday } from './types.ts';
import { validatePlan } from './validate.ts';
import * as volume from './volume.ts';

const SETS: Record<3 | 4 | 5, Weekday[][]> = {
  3: [
    ['tue', 'thu', 'sun'],
    ['mon', 'wed', 'sat']
  ],
  4: [
    ['tue', 'thu', 'sat', 'sun'],
    ['mon', 'wed', 'fri', 'sat']
  ],
  5: [
    ['mon', 'tue', 'thu', 'sat', 'sun'],
    ['tue', 'wed', 'fri', 'sat', 'sun']
  ]
};
const KM: Record<3 | 4 | 5, number[]> = {
  3: [12, 15, 22, 28, 35],
  4: [15, 22, 30, 38, 45],
  5: [25, 35, 45, 55, 65]
};

function planOf(input: Record<string, unknown>): FiveKV2Plan {
  const r = generateFiveKV2(input);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons) + JSON.stringify(r.violations));
  return JSON.parse(JSON.stringify(r.plan)) as FiveKV2Plan;
}
const roleDay = (w: PlanWeek, role: PlanDay['role']): PlanDay | undefined =>
  w.days.find((d) => d.role === role);
const build = (w: PlanWeek): boolean =>
  w.phase === 'base' || w.phase === 'peak' || w.phase === 'sharpen';

/** Stalni uslovi na planu: 0 grešaka validatora, 0 „lagan > dugi", 0 PLANNED_BELOW_TARGET van trke. */
function checkPlan(plan: FiveKV2Plan): void {
  expect(validatePlan(plan).filter((v) => v.severity === 'error')).toEqual([]);
  expect(plan.warnings.filter((v) => v.rule === 'PLANNED_BELOW_TARGET')).toEqual([]);
  for (const w of plan.weeks) {
    if (w.phase !== 'race') {
      expect(w.easyCappedAtLong).toBe(false);
      expect(w.plannedKm).toBeCloseTo(w.targetKm, 2);
    }
    const long = roleDay(w, 'long');
    if (long)
      for (const d of w.days.filter((x) => x.role === 'easy'))
        expect(d.workout.km).toBeLessThanOrEqual(long.workout.km + 1e-9);
  }
}

describe('Odluka 1: 3 dana — dugi ≥ lagan, dugi ≤ 45% i ≤ 90 min, kvalitet ne mora ≥ 20%', () => {
  it('3 dana, 30 km, VDOT ~48, 12 ned: start 30, vrh ≥ 30 (2.4.0: 17,1)', () => {
    const plan = planOf(
      inputOf({ weeks: 12, km: 30, distanceM: 5000, timeSec: 1230, days: ['mon', 'wed', 'sat'] })
    );
    expect(plan.startKm).toBe(30);
    expect(plan.peakKm).toBeGreaterThanOrEqual(30);
    expect(plan.warnings.map((v) => v.rule)).not.toContain('START_ABOVE_CAPACITY');
    checkPlan(plan);
    for (const w of plan.weeks.filter((x) => x.phase !== 'race')) {
      const long = roleDay(w, 'long')!.workout;
      expect(long.km).toBeLessThanOrEqual(w.targetKm * 0.45 + 1e-9);
      expect(long.km * plan.paces.E.slow).toBeLessThanOrEqual(P.long.maxSec);
    }
  });

  it('kapacitet 3 dana raste sa VDOT-om i nije 17,1 km', () => {
    const c = [40, 50, 60].map((v) => volume.capacityKm(pacesFromVdot(v), 3));
    for (const x of c) expect(x).toBeGreaterThan(25);
    expect(c[0]!).toBeLessThanOrEqual(c[1]!);
    expect(c[1]!).toBeLessThanOrEqual(c[2]!);
  });

  it('tabela: 3 dana 45%; korak dugog 0,1 km za 3/4/5 dana', () => {
    expect(P.days[3].longMaxShare).toBe(0.45);
    expect(P.days[4].longMaxShare).toBe(0.35);
    expect(P.days[5].longMaxShare).toBe(0.3);
    for (const n of [3, 4, 5] as const) expect(P.days[n].longStepKm).toBe(0.1);
  });
});

describe('Odluka 2: rupe izvodljivih ciljeva ne spuštaju kapacitet', () => {
  it('4 dana, 45 km, VDOT ~50, 12 ned: vrh ≥ 45 (2.4.0: 41,3)', () => {
    const plan = planOf(
      inputOf({ weeks: 12, km: 45, distanceM: 5000, timeSec: 1197, days: SETS[4][0]! })
    );
    expect(plan.peakKm).toBeGreaterThanOrEqual(45);
    expect(plan.capacityKm).toBeGreaterThanOrEqual(45);
    checkPlan(plan);
  });

  it('fitTargetKm: izvodljiv cilj ostaje; cilj u rupi → najveći izvodljiv ≤ želje; kapacitet je izvodljiv', () => {
    let holes = 0;
    for (const n of [3, 4, 5] as const)
      for (const v of [40, 45, 48, 50, 55, 60]) {
        const p = pacesFromVdot(v);
        const cap = volume.capacityKm(p, n);
        expect(volume.fitTargetKm(cap, p, n)).toBe(cap);
        for (let k = P.days[n].minWeekKm * 10; k <= cap * 10; k++) {
          const t = k / 10;
          const f = volume.fitTargetKm(t, p, n);
          expect(f).toBeLessThanOrEqual(t);
          expect(volume.fitTargetKm(f, p, n)).toBe(f);
          if (f < t) {
            holes++;
            // najveći: ništa između f i t nije izvodljivo
            for (let j = Math.round(f * 10) + 1; j <= k; j++)
              expect(volume.fitTargetKm(j / 10, p, n)).toBeLessThan(j / 10);
          }
        }
      }
    // Rupe i dalje postoje (npr. 4 dana VDOT 48); bitno je da ne spuštaju kapacitet.
    expect(holes).toBeGreaterThan(0);
  });
});

interface Peak {
  days: 3 | 4 | 5;
  km: number;
  weeks: number;
  timeSec: number;
  set: 0 | 1;
  peak: number | null;
  exempt: boolean;
}
const FIXTURE = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'segment05b.peaks-7b4b574.json'),
    'utf8'
  )
) as { plans: Peak[] };

describe('Odluka 3 + mreža regular sa rezultatom: vrh(2.4.1) ≥ vrh(7b4b574)', () => {
  it('840 ulaza: 0 regresija vrha van izuzetaka; svaki plan prolazi stalne uslove; cilj nije u rupi', () => {
    expect(FIXTURE.plans).toHaveLength(840);
    const lower: string[] = [];
    let plans = 0;
    for (const x of FIXTURE.plans) {
      const r = generateFiveKV2(
        inputOf({
          weeks: x.weeks,
          km: x.km,
          distanceM: 5000,
          timeSec: x.timeSec,
          days: SETS[x.days][x.set]!
        })
      );
      if (!r.ok) {
        // Odbijanje samo gde je i 7b4b574 odbijao.
        expect(x.peak, JSON.stringify(x)).toBeNull();
        continue;
      }
      plans++;
      if (r.plan.planType === 'runWalk') throw new Error('očekivan kontinuirani plan');
      checkPlan(r.plan);
      for (const w of r.plan.weeks.filter(build))
        expect(volume.fitTargetKm(w.targetKm, r.plan.paces, x.days)).toBe(w.targetKm);
      if (x.peak !== null && r.plan.peakKm + 1e-9 < x.peak) {
        if (!x.exempt) lower.push(`${JSON.stringify(x)} → ${r.plan.peakKm}`);
      }
    }
    expect(lower).toEqual([]);
    // 5k-v2.11.0 (F2): 12 ulaza 3 dana / 12 km koje je 7b4b574 odbijao (QUALITY_INFEASIBLE) sada daju plan sa smanjenom
    // dozom kvaliteta (quality.weekQuality, reducedQuality).
    expect(plans).toBe(840);
  });
});

describe('mreža ostalih grana (bez rezultata, početnik): stalni uslovi', () => {
  const raw = (
    km: number,
    weeks: number,
    d: Weekday[],
    o: Record<string, unknown>
  ): Record<string, unknown> => ({
    startDate: START,
    raceDate: addDays(START, weeks * 7 - 1),
    runDays: d,
    currentWeeklyKm: km,
    ...o
  });
  const VARIANTS: Record<string, Record<string, unknown>[]> = {
    feel: [300, 390, 480].map((e) => ({ typicalEasyPaceSecPerKm: e })),
    beginnerFeel: [330, 420, 480].map((e) => ({
      typicalEasyPaceSecPerKm: e,
      experience: 'beginner',
      canRun30Min: true
    })),
    beginnerResult: [1500, 1650, 1800].map((t) => ({
      experience: 'beginner',
      canRun30Min: true,
      recentResult: { distanceM: 5000, timeSec: t, date: addDays(START, -14) }
    }))
  };
  for (const b of Object.keys(VARIANTS))
    it.each([3, 4, 5] as const)(`${b}: %i dana`, (n) => {
      let plans = 0;
      for (const km of KM[n])
        for (const weeks of [6, 7, 10, 16])
          for (const v of VARIANTS[b]!)
            for (const d of SETS[n]) {
              const r = generateFiveKV2(raw(km, weeks, d, v));
              if (!r.ok) {
                // Početnik ≤ 4 dana; ništa drugo se ne odbija.
                expect(r.reasons.map((x) => x.code)).toEqual(['RUN_DAYS_COUNT']);
                continue;
              }
              plans++;
              if (r.plan.planType === 'runWalk') throw new Error('očekivan kontinuirani plan');
              checkPlan(r.plan);
            }
      expect(plans).toBe(b !== 'feel' && n === 5 ? 0 : 120);
    });
});
