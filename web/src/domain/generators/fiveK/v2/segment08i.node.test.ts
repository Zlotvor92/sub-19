/* Segment 08i (5k-v2.10.0): pouka 37 u 5K — mešovita nedelja (deo dana zaštićen: ≤ asOf, zaključan): cilj važi za
   celu nedelju, preostali dani na ostatak = cilj − zaštićeni dani, SAMO NANIŽE (week.mixedRemainder, jedino mesto);
   kad ni minimum preostalih dana ne staje → planirano > cilj uz upozorenje (validator: week.mixedFloorKm, ista
   funkcija). e2e482e: tekuća nedelja rasterećenja posle umora 22/42 tokova sa planirano > cilj (mixed-deload.ts),
   npr. b-d3-8w-25km-v36-1 k3 cilj 15,9 → 18,28 (lagan 6,74 upisan + q1 4,44 + dugi 7,1). */

import { describe, expect, it } from 'vitest';
import { adaptFiveKV2 } from './adapt.ts';
import { generateFiveKV2 } from './generate.ts';
import { earlyFacts, earlyGridInputs, type EarlyPlan } from './testInputs.ts';
import type { AdaptResult, FiveKV2Plan, PlanDay, PlanWeek } from './types.ts';
import { validatePlan } from './validate.ts';
import { MIXED_NOTE, mixedFloorKm, mixedRemainder } from './week.ts';
import { easyRun } from './workouts.ts';

const planOf = (id: string): FiveKV2Plan => {
  const g = generateFiveKV2(earlyGridInputs().find((x) => x.id === id)!.input);
  if (!g.ok) throw new Error(id);
  return g.plan as FiveKV2Plan;
};
const fatigue = (p: FiveKV2Plan, at: string): Extract<AdaptResult, { ok: true }> => {
  const r = adaptFiveKV2(p, earlyFacts(p as unknown as EarlyPlan, 'fatigue', at), at);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r;
};
const km = (ds: readonly PlanDay[]): number =>
  Math.round(ds.reduce((a, d) => a + (d.countsToWeek ? d.workout.km : 0), 0) * 100) / 100;
const roles = (w: PlanWeek): string => w.days.map((d) => `${d.role}:${d.workout.km}`).join(' ');
const scaled = (d: PlanDay, f: number): PlanDay => ({
  ...d,
  workout: { ...d.workout, km: Math.round(d.workout.km * f * 100) / 100 }
});

describe('08i pouka 37 — mešovita nedelja: ostatak do cilja, samo naniže', () => {
  it('primer nalaza b-d3-8w-25km-v36-1 k3 (umor, asOf pon): ni minimum ne staje → minimum + MIXED_OVER_TARGET', () => {
    const p = planOf('b-d3-8w-25km-v36-1');
    const r = fatigue(p, p.weeks[2]!.startDate);
    const w = r.plan.weeks[2]!;
    expect([w.deload, w.targetKm, w.plannedKm]).toEqual([true, 15.9, 16.84]);
    // Zaštićen lagan 6,74 (asOf); ostatak 9,16 < minimum preostalih: lagan 3 + dugi 7,1 (ne skraćuje se); q1 otpada.
    expect(roles(w)).toBe('easy:6.74 easy:3 long:7.1');
    expect(w.notes.some((n) => n.includes(MIXED_NOTE))).toBe(true);
    expect(
      r.plan.warnings.filter((v) => v.rule === 'MIXED_OVER_TARGET').map((v) => v.week)
    ).toEqual([3]);
    expect(r.plan.warnings.find((v) => v.rule === 'MIXED_OVER_TARGET')!.message).toContain(
      'ostatak do cilja 9.16 km < najmanji preostali dani 10.1 km'
    );
  });

  it('r-d4-10w-40km-v52-1 k4 (umor, asOf pon): kvalitet ostaje, lagan skraćen, planirano = cilj', () => {
    const p = planOf('r-d4-10w-40km-v52-1');
    const r = fatigue(p, p.weeks[3]!.startDate);
    const w = r.plan.weeks[3]!;
    expect([w.deload, w.targetKm, w.plannedKm]).toEqual([true, 34.6, 34.6]);
    expect(roles(w)).toBe('easy:12.12 q1:6.72 easy:3.66 long:12.1');
    expect(r.plan.warnings.some((v) => v.rule === 'MIXED_OVER_TARGET')).toBe(false);
  });

  it('mixedRemainder: zaštićeni dani kao sastavljeni ili kraći → bez izmene (manjak se ne nadoknađuje)', () => {
    const p = planOf('r-d4-10w-40km-v52-1');
    for (const w of p.weeks.filter((x) => x.phase !== 'race')) {
      const first = w.days[0]!;
      expect(mixedRemainder(w, [first], p.paces)).toBeNull();
      expect(mixedRemainder(w, [scaled(first, 0.5)], p.paces)).toBeNull();
    }
  });

  it('mixedRemainder: zaštićen dan duži → svaki preostali dan ≤ sastavljenog, zbir ≤ ostatak ili minimum + over', () => {
    const p = planOf('r-d4-10w-40km-v52-1');
    let over = 0;
    let fit = 0;
    for (const w of p.weeks.filter((x) => x.phase !== 'race'))
      for (const f of [1.3, 2, 4]) {
        const kept = [scaled(w.days[0]!, f)];
        const m = mixedRemainder(w, kept, p.paces);
        expect(m).not.toBeNull();
        const free = m!.days.filter((d) => d.date !== kept[0]!.date);
        for (const d of free)
          expect(d.workout.km).toBeLessThanOrEqual(
            w.days.find((x) => x.date === d.date)!.workout.km
          );
        const floor = mixedFloorKm(w.days.slice(1), w.phase === 'taper' ? 2 : 3);
        if (m!.over) {
          over++;
          expect(km(free)).toBe(floor);
          expect(free.some((d) => d.workout.kind === 'quality')).toBe(false);
        } else {
          fit++;
          expect(km(free)).toBeLessThanOrEqual(m!.remainderKm + 1e-9);
        }
      }
    expect(over).toBeGreaterThan(0);
    expect(fit).toBeGreaterThan(0);
  });

  it('validator: mešovita nedelja iznad cilja čiji preostali dani nisu na minimumu → MIXED_REMAINDER', () => {
    const p = planOf('b-d3-8w-25km-v36-1');
    const r = fatigue(p, p.weeks[2]!.startDate);
    expect(validatePlan(r.plan).filter((v) => v.severity === 'error')).toEqual([]);
    const w = r.plan.weeks[2]!;
    const i = w.days.findIndex((d) => d.role === 'easy' && d.date > r.plan.adaptation!.asOf);
    const days = [...w.days];
    days[i] = { ...days[i]!, workout: easyRun(4, r.plan.paces, false) };
    const bad: FiveKV2Plan = {
      ...r.plan,
      weeks: r.plan.weeks.map((x) => (x === w ? { ...w, days, plannedKm: km(days) } : x))
    };
    expect(
      validatePlan(bad)
        .filter((v) => v.severity === 'error')
        .map((v) => v.rule)
    ).toEqual(['MIXED_REMAINDER']);
  });
});
