/* MAR-08 (marathon-v2.5.0; pouka 37): mešovita nedelja — cilj važi za celu nedelju; preostali dani se sastavljaju na
   ostatak = cilj − zaštićeni dani, samo naniže (mixed.ts, jedno mesto; validator MIXED_WEEK_OVER / MIXED_OVER_TARGET
   čita istu funkciju). Primer organizatora (mixed-deload.ts): d3-12w-30km-v30-A-sat, umor, asOf = prvi dan ned 3 —
   cilj 25,4 = dugi 16,8 (upisan) + lagan 7,6 + T 5,12 = 29,52 km (prethodna nedelja 31,8). Na 46dff18
   (marathon-v2.4.2) prvi test pada. */

import { describe, expect, it } from 'vitest';
import { adaptMarathonV2 } from './adapt.ts';
import { adaptInvariants } from './adaptInvariants.ts';
import { generateMarathonV2 } from './generate.ts';
import { mixedRemainder100, mixedRest } from './mixed.ts';
import { factsOf, gridInputs } from './testInputs.ts';
import type { AdaptResult, MarathonV2Facts, MarathonV2Plan, PlanDay, PlanWeek } from './types.ts';
import { validatePlan } from './validate.ts';
import { easyWorkout } from './workouts.ts';

const planOf = (id: string): MarathonV2Plan => {
  const r = generateMarathonV2(gridInputs().find((x) => x.id === id)!.input);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
};
const ok = (r: AdaptResult): Extract<AdaptResult, { ok: true }> => {
  if (!r.ok) throw new Error(JSON.stringify(r).slice(0, 1500));
  return r;
};
/** Umor sa asOf = prvi dan nedelje k (prinudno rasterećenje tekuće nedelje, dan 1 zaštićen). */
const fatigueAt = (p: MarathonV2Plan, k: number) => {
  const at = p.weeks[k - 1]!.startDate;
  const f = factsOf(p, 'fatigue', at) as MarathonV2Facts;
  return { at, f, r: ok(adaptMarathonV2(p, f, at)) };
};
const sum100 = (ds: readonly PlanDay[]): number =>
  ds.reduce((a, d) => a + (d.countsToWeek ? Math.round(d.workout.km * 100) : 0), 0);
const kept = (w: PlanWeek, at: string): PlanDay[] => w.days.filter((d) => d.date <= at);
const rest = (w: PlanWeek, at: string): PlanDay[] => w.days.filter((d) => d.date > at);
const errors = (p: MarathonV2Plan): string[] =>
  validatePlan(p)
    .filter((v) => v.severity === 'error')
    .map((v) => v.rule);
/** Plan sa preostalim danima nedelje k zamenjenim danima `days` (planirano iz dana). */
const withRest = (p: MarathonV2Plan, k: number, at: string, days: PlanDay[]): MarathonV2Plan => {
  const w = p.weeks[k - 1]!;
  const all = [...kept(w, at), ...days].sort((a, b) => a.date.localeCompare(b.date));
  return {
    ...p,
    weeks: p.weeks.map((x) =>
      x.index === k ? { ...x, days: all, plannedKm: sum100(all) / 100 } : x
    )
  };
};

/** Mešovita nedelja u kojoj ostatak staje (dugi 17,8 upisan; Q1 6,36 i lagan ostaju u ostatku 16,6 km). */
const FITS = 'd3-12w-50km-v30-B-sat';

describe('MAR-08: mešovita nedelja, ostatak do cilja (pouka 37)', () => {
  const p = planOf('d3-12w-30km-v30-A-sat');

  it('primer organizatora: dugi 16,8 upisan, lagan na minimumu, T ostaje (bez T ne staje), planirano 26,92 < 29,52 i < prethodne; upozorenje', () => {
    const { at, f, r } = fatigueAt(p, 3);
    const w = r.plan.weeks[2]!;
    expect(w.deload).toBe(true);
    expect(w.targetKm).toBe(25.4);
    expect(kept(w, at).map((d) => [d.role, d.workout.km])).toEqual([['long', 16.8]]);
    // Ostatak 8,6 km ne prima ni dva laganog minimuma (2 × 5 km): kvalitet bez dobitka ne otpada (odluka
    // organizatora), lagan na minimumu.
    expect(rest(w, at).map((d) => [d.role, d.workout.km])).toEqual([
      ['easy', 5],
      ['q1', 5.12]
    ]);
    expect(w.plannedKm).toBe(26.92);
    expect(w.plannedKm).toBeLessThan(r.plan.weeks[1]!.plannedKm);
    expect(w.notes.some((n) => n.startsWith('Mešovita nedelja (pouka 37)'))).toBe(true);
    expect(r.plan.warnings.filter((x) => x.rule === 'MIXED_WEEK_OVER').map((x) => x.week)).toEqual([
      3
    ]);
    expect(adaptInvariants(p, r.plan, at, f)).toEqual([]);
  });

  it('ostatak staje: lagani skraćeni (samo naniže), dugi i kvalitet ostaju, planirano ≤ cilj, bez upozorenja', () => {
    const q = planOf(FITS);
    const { at, f, r } = fatigueAt(q, 3);
    const w = r.plan.weeks[2]!;
    expect(w.notes.some((n) => n.startsWith('Mešovita nedelja (pouka 37)'))).toBe(true);
    expect(w.plannedKm).toBeLessThanOrEqual(w.targetKm + 0.1);
    expect(rest(w, at).some((d) => d.role === 'q1' || d.role === 'q2')).toBe(true);
    expect(r.plan.warnings.some((x) => x.rule.startsWith('MIXED'))).toBe(false);
    expect(adaptInvariants(q, r.plan, at, f)).toEqual([]);
  });

  it('mixedRest: samo naniže — svaki preostali dan ≤ sastavljen; manjak se ne nadoknađuje (dani isti)', () => {
    const { at, r } = fatigueAt(planOf(FITS), 3);
    const w = r.plan.weeks[2]!;
    const pr = r.plan.paces;
    // Sastavljen ostatak (kao bez zaštićenih) — lagani dani duži nego u planu; zaštićen dan isti.
    const built = rest(w, at).map((d) =>
      d.role === 'easy' ? { ...d, workout: easyWorkout(d.workout.km + 3, pr) } : d
    );
    const m = mixedRest(kept(w, at), built, Math.round(w.targetKm * 10), pr);
    expect(m.cut).toBe(true);
    expect(m.over).toBe(false);
    // Dugi i kvalitet ostaju (organizator, dopuna pouke 37: dugi se ne skraćuje).
    for (const d of m.days.filter((x) => x.role !== 'easy'))
      expect(d).toEqual(built.find((x) => x.date === d.date));
    for (const d of m.days)
      expect(d.workout.km).toBeLessThanOrEqual(built.find((x) => x.date === d.date)!.workout.km);
    expect(sum100(m.days)).toBeLessThanOrEqual(
      mixedRemainder100(Math.round(w.targetKm * 10), kept(w, at))
    );
    // Manjak: zaštićeni dani kraći od sastavljenih → preostali dani bez promene.
    const short = kept(w, at).map((d) => ({ ...d, workout: easyWorkout(5, pr) }));
    const n = mixedRest(short, rest(w, at), Math.round(w.targetKm * 10), pr);
    expect(n.cut).toBe(false);
    expect(n.days).toEqual(rest(w, at));
  });

  it('validator čita istu funkciju: preostali dani iznad ostatka → MIXED_OVER_TARGET; najmanji oblik → upozorenje', () => {
    const { at, r } = fatigueAt(p, 3);
    expect(errors(r.plan)).toEqual([]);
    const w = r.plan.weeks[2]!;
    const pr = r.plan.paces;
    const longer = rest(w, at).map((d) => ({ ...d, workout: easyWorkout(d.workout.km + 1, pr) }));
    expect(errors(withRest(r.plan, 3, at, longer))).toContain('MIXED_OVER_TARGET');
    const b = fatigueAt(planOf(FITS), 3);
    expect(errors(b.r.plan)).toEqual([]);
    const wb = b.r.plan.weeks[2]!;
    const uncut = rest(wb, b.at).map((d) =>
      d.role === 'easy' ? { ...d, workout: easyWorkout(d.workout.km + 3, pr) } : d
    );
    expect(errors(withRest(b.r.plan, 3, b.at, uncut))).toContain('MIXED_OVER_TARGET');
  });

  it('zbir zaštićenih dana po činjenicama: neodrađen dan (completed false) i dan u pauzi = 0 — ostatak nije stisnut', () => {
    const at = p.weeks[2]!.startDate;
    const f0 = factsOf(p, 'fatigue', at) as MarathonV2Facts;
    // Dugi dana 1 (16,8 km po planu) nije odrađen → zbir zaštićenih 0, preostali dani ostaju sastavljeni (T ostaje).
    const f = {
      ...f0,
      workouts: [...f0.workouts!, { date: at, dayId: at, km: 0, durationSec: 0, completed: false }]
    };
    const r = ok(adaptMarathonV2(p, f, at));
    const w = r.plan.weeks[2]!;
    expect(r.plan.adaptation!.factKm).toEqual({ [at]: 0 });
    expect(w.notes.some((n) => n.startsWith('Mešovita nedelja (pouka 37)'))).toBe(false);
    expect(rest(w, at).some((d) => d.role === 'q1' || d.role === 'q2')).toBe(true);
    expect(r.plan.warnings.some((x) => x.rule.startsWith('MIXED'))).toBe(false);
    expect(adaptInvariants(p, r.plan, at, f)).toEqual([]);
    // Isti dan u prijavljenoj pauzi (1 dan, ispod praga pauze A3) — isto.
    const b = { ...f0, breaks: [{ kind: 'break' as const, from: at, to: at }] };
    const rb = ok(adaptMarathonV2(p, b, at));
    expect(rb.plan.adaptation!.factKm).toEqual({ [at]: 0 });
    expect(rb.plan.weeks[2]!.days).toEqual(w.days);
  });

  it('generator bez zaštićenih dana: nijedna napomena pouke 37', () => {
    expect(p.weeks.some((w) => w.notes.some((n) => n.includes('pouka 37')))).toBe(false);
  });
});
