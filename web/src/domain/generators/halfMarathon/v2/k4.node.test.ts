/* K4 (hm-v2.14.0) — stavke A i B glavnog trenera, krug 3 (docs/generators-v2/perfection/coach/ROUND-03.md § 3).
   Nezavisno od funkcija konstruktora: brojevi pravila upisani ovde, plan se čita kao trkač (dani, segmenti). */

import { describe, expect, it } from 'vitest';
import { generateHmV2 } from './generate.ts';
import { feelInputs, grid02Inputs } from './testInputs.ts';
import type { HmV2Plan, PlanWeek } from './types.ts';

const gen = (input: unknown): HmV2Plan => {
  const r = generateHmV2(input);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
};
const longOf = (w: PlanWeek) => w.days.find((d) => d.role === 'long');
/** Km u trkačkom tempu na kraju dugog (blok). */
const blockKm = (w: PlanWeek): number =>
  (longOf(w)?.workout.segments ?? []).filter((s) => s.zone === 'RP').reduce((a, s) => a + s.km, 0);

/** P9 p08: srednji, VDOT 45, 3 dana, 45 km, 20 nedelja. */
const P08 = {
  startDate: '2026-11-02',
  raceDate: '2027-03-21',
  runDays: ['tue', 'thu', 'sun'],
  currentWeeklyKm: 45,
  goalTimeSec: null,
  longRunDay: 'sun',
  recentResult: { distanceM: 21097.5, timeSec: 6014, date: '2026-10-19' }
};

describe('K4-A1: 3 dana — blok RP u dugom, kvalitet usred nedelje lagan', () => {
  /** Nedelja sa blokom: specifična, ne-rasteretna, bez dana kvaliteta; blok 4/6/8 km na kraju dugog, ≤ 40 % dugog;
      blokovi ne opadaju. Plan ima bar jednu takvu nedelju. */
  const check = (p: HmV2Plan): string[] => {
    const bad: string[] = [];
    const bs: number[] = [];
    for (const w of p.weeks) {
      const b = blockKm(w);
      if (b === 0) continue;
      bs.push(b);
      if (w.phase !== 'specific' || w.deload) bad.push(`ned ${w.index}: blok van specifične`);
      if (w.days.some((d) => d.workout.kind === 'quality'))
        bad.push(`ned ${w.index}: kvalitet uz blok`);
      if (![4, 6, 8].includes(b)) bad.push(`ned ${w.index}: blok ${b}`);
      const seg = longOf(w)!.workout.segments;
      if (seg[seg.length - 1]!.zone !== 'RP') bad.push(`ned ${w.index}: blok nije na kraju`);
      if (b > 0.4 * longOf(w)!.workout.km + 1e-9) bad.push(`ned ${w.index}: blok > 40 %`);
    }
    if (bs.length === 0) bad.push('bez nedelje sa blokom');
    for (let k = 1; k < bs.length; k++) if (bs[k]! < bs[k - 1]!) bad.push('blok opada');
    return bad;
  };

  it('p08: dve nedelje sa blokom, bez kvaliteta usred nedelje', () => {
    const p = gen(P08);
    expect(check(p)).toEqual([]);
    expect(p.weeks.filter((w) => blockKm(w) > 0).length).toBe(2);
  });

  it('uzorak mreža 02 i 03, 3 dana (svaki 5.): svaki plan ima blok, 0 prekršaja', () => {
    const bad: string[] = [];
    const three = [...grid02Inputs(), ...feelInputs()].filter((c) => c.days === 3);
    for (const c of three.filter((_, i) => i % 5 === 0))
      for (const x of check(gen(c.input))) bad.push(`${c.id}: ${x}`);
    expect(bad).toEqual([]);
  });
});
