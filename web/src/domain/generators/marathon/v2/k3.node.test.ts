/* K3 (marathon-v2.13.0; glavni trener krug 2, coach/ROUND-02.md § 4): pravila K3-A … K3-G na profilima P9 (12 profila,
   docs/generators-v2/perfection/P9/inputs.json — ulazi prepisani ovde). Mere se čitaju iz plana (dani, segmenti),
   nezavisno od funkcija konstruktora; mreža: nezavisne invarijante u grid.harness.node.test.ts. */
import { describe, expect, it } from 'vitest';
import { generateMarathonV2 } from './generate.ts';
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
