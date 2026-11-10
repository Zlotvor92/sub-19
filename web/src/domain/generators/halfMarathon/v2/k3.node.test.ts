/* K3 (hm-v2.13.0) — izmene po sudu glavnog trenera, krug 2 (docs/generators-v2/perfection/coach/ROUND-02.md § 4).
   Nezavisno od funkcija konstruktora: brojevi pravila upisani ovde, plan se čita kao trkač (dani, segmenti). */

import { describe, expect, it } from 'vitest';
import { generateHmV2 } from './generate.ts';
import { beginnerInputs } from './testInputs.ts';
import type { HmV2Plan, PlanWeek } from './types.ts';

const gen = (input: unknown): HmV2Plan => {
  const r = generateHmV2(input);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
};
const longKm = (w: PlanWeek): number => w.days.find((d) => d.role === 'long')?.workout.km ?? 0;
const isBuild = (w: PlanWeek): boolean => ['base', 'development', 'specific'].includes(w.phase);

/** P9 p11: početnik sa rezultatom (VDOT 35), 4 dana, 20 km, 20 nedelja. */
const P11 = {
  startDate: '2026-11-02',
  raceDate: '2027-03-21',
  runDays: ['tue', 'thu', 'sat', 'sun'],
  currentWeeklyKm: 20,
  goalTimeSec: null,
  longRunDay: 'sun',
  recentResult: { distanceM: 21097.5, timeSec: 7453, date: '2026-10-19' },
  experience: 'beginner'
};

describe('K3-A: dugi početnika na pravom mestu', () => {
  const check = (p: HmV2Plan): string[] => {
    const bad: string[] = [];
    const build = p.weeks.filter((w) => isBuild(w) && !w.deload);
    const longest = Math.max(...p.weeks.map(longKm));
    // Najduži dugi u poslednje 3 ne-rasteretne nedelje pred taper.
    if (!build.slice(-3).some((w) => longKm(w) >= longest - 1e-9))
      bad.push('najduži van poslednje 3');
    // U specifičnoj fazi dugi nikad ispod najdužeg dugog izgradnje pre te nedelje.
    for (const w of build.filter((x) => x.phase === 'specific')) {
      const before = build.filter((x) => x.index < w.index).map(longKm);
      if (longKm(w) < Math.max(...before) - 1e-9)
        bad.push(`ned ${w.index}: ${longKm(w)} < ${Math.max(...before)}`);
    }
    // Cilj ≤ 1,1 × granica izgradnje.
    for (const w of build)
      if (w.targetKm > Math.floor(11 * p.peakCapKm + 1e-9) / 10 + 1e-9)
        bad.push(`ned ${w.index} cilj ${w.targetKm}`);
    return bad;
  };

  it('p11: 13,2 km u razvoju više ne pada na 11,4 km u specifičnoj fazi', () => {
    const p = gen(P11);
    expect(check(p)).toEqual([]);
    const spec = p.weeks.filter((w) => w.phase === 'specific' && !w.deload).map(longKm);
    expect(Math.min(...spec)).toBeGreaterThanOrEqual(13.2);
  });

  it('uzorak mreže početnika (svaki 7.): 0 prekršaja', () => {
    const bad: string[] = [];
    for (const c of beginnerInputs().filter((_, i) => i % 7 === 0))
      for (const x of check(gen(c.input))) bad.push(`${c.id}: ${x}`);
    expect(bad).toEqual([]);
  });
});
