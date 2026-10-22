/* 10K v2 06i (10k-v2.8.0, pouka 37): mešovita nedelja — cilj važi za celu nedelju, preostali dani na ostatak = cilj −
   zbir zaštićenih dana po činjenicama, samo naniže (week.mixedRemainder; validator: week.mixedFloorKm). Primer nalaza
   (organizator, mixed-deload.ts): d3-8w-20km-v30-A-sat, umor u nedelji 2, asOf prvi dan nedelje 3 — cilj 17,0, dugi
   10,1 (dan 1, upisan) + lagan 4,7 + lagan 4,7 = 19,5 na 46e72eb. Trajna mreža: mixedGrid.harness.node.test.ts
   (brz: uzorak u delu 1; pun: mixedGrid.<k>.full.node.test.ts). */

import { describe, expect, it } from 'vitest';
import { adaptTenKV2 } from './adapt.ts';
import { adaptInvariants } from './adaptInvariants.ts';
import { addDays } from './dates.ts';
import { generateTenKV2 } from './generate.ts';
import { describeMixedGrid } from './mixedGrid.harness.node.test.ts';
import { earlyGridBases, factsOf, grid02Inputs } from './testInputs.ts';
import type { AdaptResult, PlanWeek, TenKV2Facts, TenKV2Plan } from './types.ts';
import { validatePlan } from './validate.ts';
import { MIXED_NOTE } from './week.ts';

describeMixedGrid(
  'mreža pouke 37: mešovita nedelja (umor svaki dan nedelje, zaključan/urađen dan)',
  1
);

const plan = (id: string): TenKV2Plan => {
  const b = ([3, 4, 5, 6] as const).flatMap((d) => grid02Inputs(d)).find((x) => x.id === id)!;
  const r = generateTenKV2(b.input);
  if (!r.ok) throw new Error(id);
  return r.plan;
};
const ok = (r: AdaptResult) => {
  if (!r.ok) throw new Error(JSON.stringify(r).slice(0, 1500));
  return r;
};
const kmOf = (w: PlanWeek, from: string): number =>
  Math.round(w.days.filter((d) => d.date > from).reduce((a, d) => a + d.workout.km, 0) * 100) / 100;

describe('pouka 37: primer nalaza d3-8w-20km-v30-A-sat (umor, asOf prvi dan nedelje 3)', () => {
  const p0 = plan('d3-8w-20km-v30-A-sat');
  const at = p0.weeks[2]!.startDate;
  const fat = factsOf(p0, 'fatigue', at) as { workouts: Record<string, unknown>[] };
  const run = (facts: Record<string, unknown>) => {
    const r = ok(adaptTenKV2(p0, facts, at));
    expect(adaptInvariants(p0, r.plan, at, facts as unknown as TenKV2Facts)).toEqual([]);
    return r.plan.weeks[2]!;
  };

  it('cilj 17,0 za celu nedelju: dugi 10,1 (upisan) + lagani 3,5 + 3,4 = 17,0 (bilo 19,5), napomena, bez upozorenja', () => {
    const r = ok(adaptTenKV2(p0, fat, at));
    const w = r.plan.weeks[2]!;
    expect([w.deload, w.targetKm, w.plannedKm, w.keptKm]).toEqual([true, 17, 17, 10.1]);
    expect(w.days.map((d) => `${d.role} ${d.workout.km}`)).toEqual([
      'long 10.1',
      'easy 3.5',
      'easy 3.4'
    ]);
    expect(w.notes.some((n) => n.startsWith(MIXED_NOTE))).toBe(true);
    expect(r.plan.warnings.filter((v) => v.week === 3)).toEqual([]);
  });

  it('po činjenicama: neurađen dan 1 (zapis 0 km) i dan u pauzi = 0 — ostatak 17,0, preostali dani ostaju kakvi su sastavljeni (samo naniže)', () => {
    const built = run(fat);
    const missed = run({
      ...fat,
      workouts: [...fat.workouts, { date: at, dayId: at, km: 0, durationSec: 0, completed: false }]
    });
    expect(missed.keptKm).toBeUndefined();
    expect(kmOf(missed, at)).toBe(9.4);
    expect(kmOf(missed, at)).toBeGreaterThan(kmOf(built, at));
    const brk = run({ ...fat, breaks: [{ kind: 'break', from: at, to: at }] });
    expect(brk.keptKm).toBeUndefined();
    expect(kmOf(brk, at)).toBe(9.4);
  });

  it('pokrivenost: dan 1 poznat iz potpune pokrivenosti bez zapisa = 0 — preostali dani ostaju kakvi su sastavljeni', () => {
    const w = run({ ...fat, coverage: { from: addDays(at, -7), to: at, complete: true } });
    expect(w.keptKm).toBeUndefined();
    expect(kmOf(w, at)).toBe(9.4);
    // Nepotpuna pokrivenost: dan nije poznat → planirani km (kao bez zapisa).
    const u = run({ ...fat, coverage: { from: addDays(at, -7), to: at, complete: false } });
    expect([u.keptKm, kmOf(u, at)]).toEqual([10.1, 6.9]);
  });

  it('upisani km: dan 1 urađen 5 km → ostatak 12,0 ≥ sastavljeno 9,4 — bez dopune (manjak se ne nadoknađuje)', () => {
    const w = run({
      ...fat,
      workouts: [
        ...fat.workouts,
        { date: at, dayId: at, km: 5, durationSec: 1800, completed: true }
      ]
    });
    expect(w.keptKm).toBeUndefined();
    expect(kmOf(w, at)).toBe(9.4);
  });

  it('upisani km: dan 1 urađen 12,5 km → ostatak 4,5 < najmanji preostali 6,0 — lagani 3,0 + 3,0, MIXED_OVER_TARGET', () => {
    const facts = {
      ...fat,
      workouts: [
        ...fat.workouts,
        { date: at, dayId: at, km: 12.5, durationSec: 4500, completed: true }
      ]
    };
    const r = ok(adaptTenKV2(p0, facts, at));
    const w = r.plan.weeks[2]!;
    expect([w.keptKm, kmOf(w, at)]).toEqual([12.5, 6]);
    const v = r.plan.warnings.filter((x) => x.week === 3).map((x) => x.rule);
    expect(v).toEqual(['MIXED_OVER_TARGET']);
  });

  it('validator čita istu funkciju: preostali dan duži od ostatka → MIXED_REMAINDER; skraćen ispod minimuma ostatka bez greške', () => {
    const r = ok(adaptTenKV2(p0, fat, at));
    const bump = (dk: number): TenKV2Plan => {
      const weeks = r.plan.weeks.map((w, i) =>
        i !== 2
          ? w
          : {
              ...w,
              plannedKm: Math.round((w.plannedKm + dk) * 100) / 100,
              days: w.days.map((d, j) =>
                j !== 1
                  ? d
                  : {
                      ...d,
                      workout: {
                        ...d.workout,
                        km: Math.round((d.workout.km + dk) * 100) / 100,
                        segments: d.workout.segments.map((s) => ({
                          ...s,
                          km: Math.round((s.km + dk) * 100) / 100
                        }))
                      }
                    }
              )
            }
      );
      return { ...r.plan, weeks };
    };
    const rules = (p: TenKV2Plan) =>
      validatePlan(p)
        .filter((v) => v.week === 3 && v.rule.startsWith('MIXED'))
        .map((v) => `${v.severity} ${v.rule}`);
    expect(rules(r.plan)).toEqual([]);
    expect(rules(bump(1))).toEqual(['error MIXED_REMAINDER']);
  });
});

describe('pouka 37: vlasnik nedelje pauze je pravilo pauze; trkačka nedelja izuzeta', () => {
  it('pauza 20 dana do srede nedelje 3: nedelja pauze bez ostatka pouke 37 (cilj ostatka nedelje = pravilo pauze)', () => {
    const p0 = plan('d4-12w-25km-v35-A-sat');
    const at = addDays(p0.weeks[2]!.startDate, 3);
    const r = ok(adaptTenKV2(p0, factsOf(p0, 'pause20', at), at));
    expect(r.plan.weeks[2]!.keptKm).toBeUndefined();
  });

  it('trkačka nedelja: nikad keptKm (pouka 30)', () => {
    const p0 = plan('d3-8w-20km-v30-A-sat');
    const at = p0.weeks[7]!.startDate;
    const r = ok(adaptTenKV2(p0, factsOf(p0, 'over120', at), at));
    expect(r.plan.weeks[7]!.keptKm).toBeUndefined();
  });
});

describe('pouka 37, dopuna (organizator, MAR-08): kvalitet otpada samo kad time ostatak staje', () => {
  it('b-d4-16w-18km-e510-A-sat, umor asOf četvrtak ned 4: ni bez kvaliteta ne staje → Q1 ostaje, lagani na 3,0, MIXED_OVER_TARGET', () => {
    const b = earlyGridBases().find((x) => x.id === 'b-d4-16w-18km-e510-A-sat')!;
    const g = generateTenKV2(b.input);
    if (!g.ok) throw new Error(b.id);
    const at = addDays(g.plan.weeks[3]!.startDate, 3);
    const facts = factsOf(g.plan, 'fatigue', at);
    const r = ok(adaptTenKV2(g.plan, facts, at));
    const w = r.plan.weeks[3]!;
    const free = w.days.filter((d) => d.date > at);
    expect(free.some((d) => d.workout.kind === 'quality')).toBe(true);
    expect(free.filter((d) => d.role === 'easy').every((d) => d.workout.km === 3)).toBe(true);
    expect(r.plan.warnings.filter((v) => v.week === 4).map((v) => v.rule)).toContain(
      'MIXED_OVER_TARGET'
    );
    expect(adaptInvariants(g.plan, r.plan, at, facts as unknown as TenKV2Facts)).toEqual([]);
  });
});
