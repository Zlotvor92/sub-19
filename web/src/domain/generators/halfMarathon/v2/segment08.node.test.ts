/* HM v2 Segment HM-08 (hm-v2.6.0): pouka 37 — mešovita nedelja (deo dana zaštićen: ≤ asOf, urađen, zaključan): cilj
   važi za celu nedelju; preostali dani se sastavljaju na ostatak = cilj − zaštićeni, samo naniže (week.remainderWeek;
   opcija A: lagani do 4 km, pa kvalitet otpada, dugi i test ostaju). Ne staje → planirano > cilj + MIXED_WEEK_OVER.
   Trajna mreža: rana mreža (earlyGridBases) × nedelje k ∈ 2 … N − 3; umor (2 zapisa RPE 8, pretposlednji i poslednji
   dan nedelje k − 1) sa asOf = svaki dan nedelje k; uz to (asOf prvi i četvrti dan) zaključan prvi dan kvaliteta
   nedelje k + 1 (obrazac locked-result) i urađen prvi dan nedelje k + 1 (dayId posle asOf) → 0 odbijanja,
   adaptInvariants prazno, svaka mešovita nedelja (bez trkačke) sa danima posle asOf: planirano ≤ cilj ili
   MIXED_WEEK_OVER. Izmereno na e2e482e (mixed-deload.ts HM): planirano > cilj 291/449 tokova tekućeg rasterećenja.
   Brz nivo: svaki 60. plan, k ∈ {2, 4}, asOf prvi i četvrti dan; pun: svaki 8. plan, deo 1/6 ovde, delovi 2–6 u
   segment08.{2…6}.full (mreža: segment08.harness). */

import { describe, expect, it } from 'vitest';
import { adaptHmV2 } from './adapt.ts';
import { adaptInvariants } from './adaptInvariants.ts';
import { adaptBases, factsOf } from './adaptInputs.ts';
import { addDays, weekdayOf } from './dates.ts';
import { generateHmV2 } from './generate.ts';
import { HM_V2_POLICY as P } from './policy.ts';
import { grid02Inputs } from './testInputs.ts';
import { codes, describeSegment08Net, fatigue } from './segment08.harness.node.test.ts';
import type { HmV2Facts, HmV2Plan } from './types.ts';
import { validatePlan } from './validate.ts';
import { MIXED_NOTE } from './week.ts';

describe('HM-08 primer iz nalaza (pouka 37)', () => {
  it('d3-10w-25km-v30-A-sat, umor, asOf prvi dan ned 3: dugi 12,6 upisan + preostali na ostatak 8,6 → planirano 21,2 = cilj (pre 24,32)', () => {
    const b = grid02Inputs().find((x) => x.id === 'd3-10w-25km-v30-A-sat')!;
    const g = generateHmV2(b.input);
    if (!g.ok) throw new Error('generator');
    const p = g.plan;
    const at = p.weeks[2]!.startDate;
    const facts: HmV2Facts = {
      workouts: [
        { date: addDays(at, -1), km: 6, durationSec: 2400, completed: true, rpe: 8 },
        { date: addDays(at, -3), km: 6, durationSec: 2400, completed: true, rpe: 7 }
      ]
    };
    const r = adaptHmV2(p, facts, at);
    if (!r.ok) throw new Error(codes(r));
    expect(validatePlan(r.plan).filter((v) => v.severity === 'error')).toEqual([]);
    expect(adaptInvariants(p, r.plan, at, facts)).toEqual([]);
    const w = r.plan.weeks[2]!;
    expect(w.deload).toBe(true);
    expect(w.days.find((d) => d.date === at)).toEqual(p.weeks[2]!.days.find((d) => d.date === at));
    expect(w.plannedKm).toBeLessThanOrEqual(w.targetKm + P.tolerance.plannedKm);
    expect(w.notes.some((t) => t.includes(MIXED_NOTE))).toBe(true);
  });
});

const planOf = (id: string): HmV2Plan => {
  const g = generateHmV2(grid02Inputs().find((x) => x.id === id)!.input);
  if (!g.ok) throw new Error(id);
  return g.plan;
};

describe('HM-08 samo naniže i validator (pouka 37)', () => {
  it('urađen dugi nedelje k + 1 kraći od sastavljenog: preostali dani isti kao bez zaštite (manjak se ne nadoknađuje)', () => {
    const p = planOf('d3-10w-25km-v30-A-sat');
    const prev = p.weeks[2]!;
    const next = p.weeks[4]!;
    const at = p.weeks[3]!.startDate;
    const f0 = fatigue(addDays(prev.endDate, -1), prev.endDate);
    const long = next.days.find((d) => d.role === 'long')!;
    const done: HmV2Facts = {
      workouts: [
        ...f0.workouts!,
        {
          date: at,
          dayId: long.date,
          km: long.workout.km,
          durationSec: long.workout.sec,
          completed: true
        }
      ]
    };
    const a = adaptHmV2(p, f0, at);
    const b = adaptHmV2(p, done, at);
    if (!a.ok || !b.ok) throw new Error('adapt');
    const wa = a.plan.weeks[4]!;
    const wb = b.plan.weeks[4]!;
    expect(b.plan.adaptation!.doneDayIds).toEqual([long.date]);
    expect(wb.days.find((d) => d.date === long.date)).toEqual(long);
    // Zaštićen dugi je kraći od sastavljenog → ostali dani nedelje ostaju kao bez zaštite; planirano < cilj.
    const rest = (w: typeof wa) => w.days.filter((d) => d.date !== long.date);
    expect(rest(wb)).toEqual(rest(wa));
    expect(wb.plannedKm).toBeLessThan(wb.targetKm);
  });

  it('ni minimum preostalih dana ne staje → planirano > cilj + MIXED_WEEK_OVER (ne odbijanje); višak u preostalim danima → MIXED_OVER_TARGET', () => {
    const p = planOf('d3-11w-30km-v30-B-sun');
    const at = p.weeks[2]!.startDate;
    const r = adaptHmV2(p, fatigue(addDays(at, -3), addDays(at, -1)), at);
    if (!r.ok) throw new Error(codes(r));
    const w = r.plan.weeks[2]!;
    expect(w.plannedKm).toBeGreaterThan(w.targetKm + P.tolerance.plannedKm);
    expect(r.plan.warnings.some((v) => v.rule === 'MIXED_WEEK_OVER' && v.week === 3)).toBe(true);
    expect(adaptInvariants(p, r.plan, at, {})).toEqual([]);
    // Primer iz nalaza (preostali dani staju u ostatak): +5 km u preostali lagan → MIXED_OVER_TARGET (greška).
    const q = planOf('d3-10w-25km-v30-A-sat');
    const at3 = q.weeks[2]!.startDate;
    const f = adaptHmV2(q, fatigue(addDays(at3, -3), addDays(at3, -1)), at3);
    if (!f.ok) throw new Error(codes(f));
    const w3 = f.plan.weeks[2]!;
    const e = w3.days.find((d) => d.role === 'easy' && d.date > at3)!;
    const bad: HmV2Plan = {
      ...f.plan,
      weeks: f.plan.weeks.map((x) =>
        x !== w3
          ? x
          : {
              ...x,
              plannedKm: Math.round((x.plannedKm + 5) * 100) / 100,
              days: x.days.map((d) =>
                d !== e ? d : { ...d, workout: { ...d.workout, km: d.workout.km + 5 } }
              )
            }
      )
    };
    const rules = validatePlan(bad).map((v) => v.rule);
    expect(rules).toContain('MIXED_OVER_TARGET');
    expect(rules).not.toContain('MIXED_WEEK_OVER');
  });
});

describe('HM-08 zbir zaštićenih dana po činjenicama (dopuna pouke 37)', () => {
  it('pauza 20 do srede ned 4: prvi dan nedelje (u pauzi) = 0 km → preostali dani nisu stisnuti (planirano po činjenicama ≤ cilj)', () => {
    const b = adaptBases().find((x) => x.id === 'd3-r-10w')!;
    const g = generateHmV2(b.input);
    if (!g.ok) throw new Error('generator');
    const p = g.plan;
    let at = p.weeks[3]!.startDate;
    while (weekdayOf(at) !== 'wed') at = addDays(at, 1);
    const facts = factsOf(p, 'pause20', at) as HmV2Facts;
    const r = adaptHmV2(p, facts, at);
    if (!r.ok) throw new Error(codes(r));
    const w = r.plan.weeks[3]!;
    const mon = w.days[0]!;
    expect(r.plan.adaptation!.factKm?.[mon.date]).toBe(0);
    expect(w.notes.some((t) => t.includes(MIXED_NOTE))).toBe(false);
    expect(validatePlan(r.plan).filter((v) => v.severity === 'error')).toEqual([]);
    expect(adaptInvariants(p, r.plan, at, facts)).toEqual([]);
  });
});

describeSegment08Net(1, 6);
