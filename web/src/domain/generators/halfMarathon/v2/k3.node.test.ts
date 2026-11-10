/* K3 (hm-v2.13.0) — izmene po sudu glavnog trenera, krug 2 (docs/generators-v2/perfection/coach/ROUND-02.md § 4).
   Nezavisno od funkcija konstruktora: brojevi pravila upisani ovde, plan se čita kao trkač (dani, segmenti). */

import { describe, expect, it } from 'vitest';
import { generateHmV2 } from './generate.ts';
import { beginnerInputs, feelInputs, grid02Inputs } from './testInputs.ts';
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

const workSec = (w: PlanWeek, zone: string): number =>
  Math.max(
    0,
    ...w.days
      .filter((d) => d.role === 'q1' || d.role === 'q2')
      .map((d) =>
        d.workout.segments
          .filter((x) => (x.kind === 'rep' || x.kind === 'continuous') && x.zone === zone)
          .reduce((a, x) => a + x.km * 1000, 0)
      )
  );

describe('K3-B: taper RP ≤ 60 % poslednje doze', () => {
  const check = (p: HmV2Plan): string[] => {
    const taper = p.weeks.find((w) => w.phase === 'taper')!;
    const rp = workSec(taper, 'RP');
    const last = p.weeks
      .filter((w) => w.index < taper.index && !w.deload && isBuild(w))
      .map((w) => workSec(w, 'RP'))
      .filter((m) => m > 0)
      .pop();
    if (rp === 0 || last === undefined) return [];
    return rp > 0.6 * last + 1 ? [`taper RP ${rp} m > 0,6 × ${last} m`] : [];
  };

  it('uzorak mreža (redovan, po osećaju, početnik): 0 tapera iznad 60 %; ima kraćih struktura', () => {
    const bad: string[] = [];
    let short = 0;
    for (const c of [
      ...grid02Inputs().filter((_, i) => i % 41 === 0),
      ...feelInputs().filter((_, i) => i % 23 === 0),
      ...beginnerInputs().filter((_, i) => i % 11 === 0)
    ]) {
      const p = gen(c.input);
      for (const x of check(p)) bad.push(`${c.id}: ${x}`);
      const t = p.weeks.find((w) => w.phase === 'taper')!;
      if (t.days.some((d) => d.workout.dose?.zone === 'RP' && d.workout.dose.doseM < 4000)) short++;
    }
    expect(bad).toEqual([]);
    expect(short).toBeGreaterThan(0);
  });

  it('P9 p11: taper RP 2 × 1200 m (≤ 60 % od 2 × 2000 m), trkačka nedelja zadržava oštrenje', () => {
    const p = gen(P11);
    const t = p.weeks.find((w) => w.phase === 'taper')!;
    const d = t.days.find((x) => x.workout.dose?.zone === 'RP')!.workout.dose!;
    expect(d.structure).toEqual({ form: 'reps', reps: 2, repM: 1200 });
    expect(p.weeks.at(-1)!.days.some((x) => x.role === 'sharpener')).toBe(true);
  });
});

describe('K3-E: brz trkač — RP blok u dugom 4 → 6 → 8 km', () => {
  const blocks = (p: HmV2Plan): { km: number; target: number; longKm: number }[] =>
    p.weeks.flatMap((w) => {
      const l = w.days.find((d) => d.role === 'long');
      const rp = l
        ? l.workout.segments.filter((s) => s.zone === 'RP').reduce((a, s) => a + s.km, 0)
        : 0;
      return rp > 0
        ? [{ km: Math.round(rp * 10) / 10, target: w.targetKm, longKm: l!.workout.km }]
        : [];
    });

  it('mreža 02 5–6 dana (svaki 5.): brzi (VDOT ≥ 50, cilj ≥ 80 km) dva nivoa po nedelji B, ostali jedan', () => {
    let fast = 0;
    let fastTop = 0;
    const bad: string[] = [];
    for (const c of grid02Inputs().filter((x, i) => x.days >= 5 && i % 5 === 0)) {
      const p = gen(c.input);
      const b = blocks(p);
      if (b.length === 0) continue;
      const isFast = p.vdot >= 50 && b[0]!.target >= 80;
      for (const x of b)
        if (x.km > 8 || x.km > 0.4 * x.longKm + 1e-9) bad.push(`${c.id}: blok ${x.km}`);
      if (isFast) {
        fast++;
        if (b[0]!.km < 6) bad.push(`${c.id}: prvi blok brzog ${b[0]!.km} < 6`);
        if (Math.max(...b.map((x) => x.km)) === 8) fastTop++;
      } else if (b[0]!.km !== 4 && b[0]!.target < 80)
        bad.push(`${c.id}: prvi blok ${b[0]!.km} ≠ 4`);
    }
    expect(bad).toEqual([]);
    expect(fast).toBeGreaterThan(0);
    expect(fastTop).toBeGreaterThan(0);
  });
});
