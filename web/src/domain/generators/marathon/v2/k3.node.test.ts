/* K3 (marathon-v2.13.0; glavni trener krug 2, coach/ROUND-02.md § 4): pravila K3-A … K3-G na profilima P9 (12 profila,
   docs/generators-v2/perfection/P9/inputs.json — ulazi prepisani ovde). Mere se čitaju iz plana (dani, segmenti),
   nezavisno od funkcija konstruktora; mreža: nezavisne invarijante u grid.harness.node.test.ts. */
import { describe, expect, it } from 'vitest';
import { generateMarathonV2 } from './generate.ts';
import { gridInputs } from './testInputs.ts';
import type { MarathonV2Input, MarathonV2Plan, PlanWeek } from './types.ts';
import { validatePlan } from './validate.ts';

const R = (distanceM: number, timeSec: number) => ({ distanceM, timeSec, date: '2026-10-19' });
const base = { startDate: '2026-11-02', longRunDay: 'sun', goalTimeSec: null } as const;
const D4 = ['tue', 'thu', 'sat', 'sun'];
const D5 = ['mon', 'tue', 'thu', 'sat', 'sun'];
/** Profili P9 (MAR). */
export const PROFILES: Record<string, MarathonV2Input> = {
  p01: {
    ...base,
    raceDate: '2027-02-21',
    runDays: D4,
    currentWeeklyKm: 40,
    goalTimeSec: 12450,
    recentResult: R(10000, 2760),
    recentLongRunKm: 14
  },
  p02: {
    ...base,
    raceDate: '2027-03-07',
    runDays: D4,
    currentWeeklyKm: 40,
    recentResult: R(5000, 1225),
    recentLongRunKm: 14
  },
  p03: {
    ...base,
    raceDate: '2027-03-07',
    runDays: ['tue', 'thu', 'sun'],
    currentWeeklyKm: 30,
    recentResult: R(21097.5, 7831)
  },
  p05: {
    ...base,
    raceDate: '2027-03-07',
    runDays: ['mon', 'tue', 'wed', 'thu', 'sat', 'sun'],
    currentWeeklyKm: 110,
    recentResult: R(21097.5, 4689)
  },
  p06: {
    ...base,
    raceDate: '2027-01-24',
    runDays: D5,
    currentWeeklyKm: 40,
    recentResult: R(21097.5, 4828)
  },
  p08: {
    ...base,
    raceDate: '2027-04-18',
    runDays: ['tue', 'thu', 'sun'],
    currentWeeklyKm: 50,
    recentResult: R(21097.5, 6014)
  },
  p09: {
    ...base,
    raceDate: '2027-03-07',
    runDays: D4,
    currentWeeklyKm: 50,
    recentResult: null,
    easyPaceSecPerKm: 360
  },
  p10: {
    ...base,
    raceDate: '2027-04-18',
    runDays: ['tue', 'thu', 'sun'],
    currentWeeklyKm: 30,
    recentResult: null,
    easyPaceSecPerKm: 450
  },
  p11: {
    ...base,
    raceDate: '2027-04-18',
    runDays: D4,
    currentWeeklyKm: 25,
    recentResult: R(21097.5, 7453),
    experience: 'beginner'
  },
  p12: {
    ...base,
    raceDate: '2027-03-07',
    runDays: D5,
    currentWeeklyKm: 50,
    recentResult: null,
    easyPaceSecPerKm: 420,
    experience: 'beginner'
  }
} as unknown as Record<string, MarathonV2Input>;

const cache = new Map<string, MarathonV2Plan>();
export function prof(id: string): MarathonV2Plan {
  const hit = cache.get(id);
  if (hit) return hit;
  const r = generateMarathonV2(PROFILES[id]!);
  if (!r.ok) throw new Error(`${id}: ${JSON.stringify(r.reasons)}`);
  expect(validatePlan(r.plan).filter((v) => v.severity === 'error')).toEqual([]);
  cache.set(id, r.plan);
  return r.plan;
}
const longKm = (w: PlanWeek): number => w.days.find((d) => d.role === 'long')?.workout.km ?? 0;
const longest = (p: MarathonV2Plan): number => Math.max(...p.weeks.map(longKm));

describe('K3-A: najduži dugi', () => {
  it('p01/p02 (4 dana, 40 km): 22,4 → ≥ 25 km, u poslednje 3 nedelje izgradnje; p06 (5 dana): 17,6 → ≥ 20 km', () => {
    for (const [id, min] of [
      ['p01', 25],
      ['p02', 25],
      ['p06', 20]
    ] as const) {
      const p = prof(id);
      expect(longest(p), id).toBeGreaterThanOrEqual(min);
      const taper = p.weeks.find((w) => w.phase === 'taper')!.index;
      const top = p.weeks.find((w) => longKm(w) === longest(p))!;
      expect(top.index, id).toBeGreaterThanOrEqual(taper - 3);
      // Udeo dugog nikad preko 45 % cilja nedelje (4+ dana).
      for (const w of p.weeks)
        expect(longKm(w), `${id} ned ${w.index}`).toBeLessThanOrEqual(0.45 * w.targetKm + 1e-9);
    }
  });

  it('kad ni tako ne staje: upozorenje kaže koliko km nedeljno treba i preporučuje polumaraton ili dužu pripremu', () => {
    const w = prof('p03').warnings.find((x) => x.rule === 'MARATHON_LONG_SHORT')!;
    expect(w.message).toMatch(
      /Za maraton treba oko 52 km nedeljno u vrhu pripreme; preporuka: polumaraton ili duža priprema\./
    );
  });
});

describe('K3-B: vrh obima početnika', () => {
  it('p12 (50 km, 5 dana): vrh ≤ 1,30 × start (65 km) i ≤ 7,5 h; p11 (dno tabele, 25 km): vrh M17 ostaje 37,5 km', () => {
    const p = prof('p12');
    const build = p.weeks.filter(
      (w) => !w.deload && ['base', 'development', 'specific'].includes(w.phase)
    );
    const peak = Math.max(...build.map((w) => w.targetKm));
    expect(peak).toBeLessThanOrEqual(65);
    expect(peak).toBeGreaterThan(60);
    for (const w of p.weeks.filter((x) => x.phase !== 'race'))
      expect(
        w.days.filter((d) => d.countsToWeek).reduce((a, d) => a + d.workout.sec, 0)
      ).toBeLessThanOrEqual(7.5 * 3600 + 60);
    expect(Math.max(...prof('p11').weeks.map((w) => w.targetKm))).toBe(37.5);
  });

  it('početnik 40 km, lagan 5:30 (7,5 h ne veže): vrh ≤ 1,30 × 40 = 52 km', () => {
    const r = generateMarathonV2({
      ...PROFILES['p12']!,
      runDays: D4,
      currentWeeklyKm: 40,
      easyPaceSecPerKm: 330
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Math.max(...r.plan.weeks.map((w) => w.targetKm))).toBeLessThanOrEqual(52);
  });
});

describe('K3-C: 3 dana', () => {
  it('redovan plan sa 3 dana: svaki lagan nedelje izgradnje ≤ 0,70 × dugi iste nedelje (p03, p08, p10)', () => {
    for (const id of ['p03', 'p08', 'p10']) {
      const p = prof(id);
      for (const w of p.weeks.filter(
        (x) => !x.deload && ['base', 'development', 'specific'].includes(x.phase)
      )) {
        const L = longKm(w);
        for (const d of w.days.filter((x) => x.role === 'easy'))
          expect(d.workout.km, `${id} ned ${w.index}`).toBeLessThanOrEqual(0.7 * L + 1e-9);
      }
    }
    // Mreža 02 d3-12w-45km-v30-A-sat: pre K3-C lagan 0,80 × dugi.
    const r = generateMarathonV2(gridInputs().find((x) => x.id === 'd3-12w-45km-v30-A-sat')!.input);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const w of r.plan.weeks.filter(
      (x) => !x.deload && ['base', 'development', 'specific'].includes(x.phase)
    ))
      for (const d of w.days.filter((x) => x.role === 'easy'))
        expect(d.workout.km, `ned ${w.index}`).toBeLessThanOrEqual(0.7 * longKm(w) + 1e-9);
  });
});

describe('K3-E: brz trkač — MP u dugom', () => {
  it('p05 (VDOT 60, 110 km, 6 dana): blok MP u dugom 14 → 16 km, MP deo ≤ 75 min', () => {
    const p = prof('p05');
    const blocks = p.weeks.map(
      (w) => w.days.find((d) => d.role === 'long')?.workout.workKm.MP ?? 0
    );
    expect(Math.max(...blocks)).toBe(16);
    expect(Math.max(...blocks) * p.paces.MP).toBeLessThanOrEqual(4500);
  });
});
