/* Segment 08i (5k-v2.10.0): pouka 37 u 5K — mešovita nedelja (deo dana zaštićen: ≤ asOf, zaključan): cilj važi za
   celu nedelju, preostali dani na ostatak = cilj − zaštićeni dani, SAMO NANIŽE (week.mixedRemainder, jedino mesto);
   kad ni minimum preostalih dana ne staje → planirano > cilj uz upozorenje (validator: week.mixedFloorKm, ista
   funkcija). e2e482e: tekuća nedelja rasterećenja posle umora 22/42 tokova sa planirano > cilj (mixed-deload.ts),
   npr. b-d3-8w-25km-v36-1 k3 cilj 15,9 → 18,28 (lagan 6,74 upisan + q1 4,44 + dugi 7,1). */

import { describe, expect, it } from 'vitest';
import { adaptFiveKV2 } from './adapt.ts';
import { checkFacts, factKmOf } from './assess.ts';
import { addDays } from './dates.ts';
import { generateFiveKV2 } from './generate.ts';
import {
  earlyFacts,
  earlyFlows,
  earlyGridBases,
  earlyGridInputs,
  type EarlyPlan
} from './testInputs.ts';
import type { AdaptResult, FiveKV2Plan, PlanDay, PlanWeek } from './types.ts';
import { validatePlan } from './validate.ts';
import { easyMinOf, MIXED_NOTE, mixedFloorKm, mixedRemainder, protectedKm } from './week.ts';
import { easyRun } from './workouts.ts';

const S = JSON.stringify;
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
  it('primer nalaza b-d3-8w-25km-v36-1 k3 (umor, asOf pon): ni bez kvaliteta ne staje → kvalitet ostaje + MIXED_OVER_TARGET', () => {
    const p = planOf('b-d3-8w-25km-v36-1');
    const r = fatigue(p, p.weeks[2]!.startDate);
    const w = r.plan.weeks[2]!;
    // 5k-v2.12.0 (T1): zaštićen lagan 6,4 (granica 0,8 × dugi 8 km u sastavljenoj nedelji).
    expect([w.deload, w.targetKm, w.plannedKm]).toEqual([true, 15.9, 17.94]);
    // Zaštićen lagan 6,4 (asOf); ostatak 9,5 < minimum preostalih bez kvaliteta: 3 + dugi 7,1 (ne skraćuje se) →
    // kvalitet ostaje (dopuna MAR-08), planirano > cilj uz upozorenje.
    expect(roles(w)).toBe('easy:6.4 q1:4.44 long:7.1');
    expect(w.notes.some((n) => n.includes(MIXED_NOTE))).toBe(true);
    expect(
      r.plan.warnings.filter((v) => v.rule === 'MIXED_OVER_TARGET').map((v) => v.week)
    ).toEqual([3]);
    expect(r.plan.warnings.find((v) => v.rule === 'MIXED_OVER_TARGET')!.message).toContain(
      'ostatak do cilja 9,5 km < najmanji preostali dani bez kvaliteta 10,1 km'
    );
  });

  it('r-d4-10w-40km-v52-1 k4 (umor, asOf pon): kvalitet ostaje, lagan skraćen, planirano = cilj', () => {
    const p = planOf('r-d4-10w-40km-v52-1');
    const r = fatigue(p, p.weeks[3]!.startDate);
    const w = r.plan.weeks[3]!;
    // 5k-v2.12.0 (T1/T4): veći obim izgradnje (bez rasterećenja pre ned 4), rasterećenje 0,8 × 46,6 km.
    expect([w.deload, w.targetKm, w.plannedKm]).toEqual([true, 37.3, 37.3]);
    expect(roles(w)).toBe('easy:12.67 q1:7.22 easy:4.41 long:13');
    expect(r.plan.warnings.some((v) => v.rule === 'MIXED_OVER_TARGET')).toBe(false);
  });

  it('mixedRemainder: zaštićeni dani kao sastavljeni ili kraći → bez izmene (manjak se ne nadoknađuje)', () => {
    const p = planOf('r-d4-10w-40km-v52-1');
    for (const w of p.weeks.filter((x) => x.phase !== 'race')) {
      const first = w.days[0]!;
      expect(mixedRemainder(w, [first], protectedKm([first]), p.paces)).toBeNull();
      const half = [scaled(first, 0.5)];
      expect(mixedRemainder(w, half, protectedKm(half), p.paces)).toBeNull();
    }
  });

  it('mixedRemainder: zaštićen dan duži → svaki preostali dan ≤ sastavljenog, zbir ≤ ostatak ili minimum + over', () => {
    const p = planOf('r-d4-10w-40km-v52-1');
    let over = 0;
    let fit = 0;
    for (const w of p.weeks.filter((x) => x.phase !== 'race'))
      for (const f of [1.3, 2, 4]) {
        const kept = [scaled(w.days[0]!, f)];
        const m = mixedRemainder(w, kept, protectedKm(kept), p.paces);
        expect(m).not.toBeNull();
        const free = m!.days.filter((d) => d.date !== kept[0]!.date);
        for (const d of free)
          expect(d.workout.km).toBeLessThanOrEqual(
            w.days.find((x) => x.date === d.date)!.workout.km
          );
        const floor = mixedFloorKm(w.days.slice(1), easyMinOf(w.phase, p.paces, w.deload));
        if (m!.over) {
          over++;
          expect(m!.remainderKm).toBeLessThan(floor);
          expect(km(free)).toBe(
            mixedFloorKm(w.days.slice(1), easyMinOf(w.phase, p.paces, w.deload), true)
          );
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
    const i = w.days.findIndex((d) => d.role === 'q1');
    const days = [...w.days];
    days[i] = { ...days[i]!, role: 'easy', hard: false, workout: easyRun(5, r.plan.paces, false) };
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

describe('08i-b (5k-v2.10.1): zbir zaštićenih dana po činjenicama; test se ne stavlja na zaključan dan', () => {
  const run = (id: string, s: 'pause10' | 'over120', at: string) => {
    const p = planOf(id);
    const r = adaptFiveKV2(p, earlyFacts(p as unknown as EarlyPlan, s, at), at);
    if (!r.ok) throw new Error(JSON.stringify(r.reasons));
    return r;
  };

  it('factKmOf: pauza 0, zapis = urađeni km (neurađen 0), poznat dan bez zapisa 0, inače planirano (null)', () => {
    const cf = checkFacts(
      {
        workouts: [
          { date: '2026-11-03', km: 5.5, durationSec: 1800, completed: true },
          { date: '2026-11-04', km: 0, durationSec: 0, completed: false, pain: 4 }
        ],
        breaks: [{ kind: 'break', from: '2026-11-01', to: '2026-11-02' }],
        coverage: { from: '2026-11-05', to: '2026-11-06', complete: true }
      },
      '2026-11-07',
      new Set<string>()
    );
    if (!cf.ok) throw new Error('facts');
    const f = factKmOf(cf.facts, '2026-11-07');
    const at = (date: string): number | null => f({ date } as PlanDay);
    expect(
      ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-07', '2026-11-08'].map(at)
    ).toEqual([0, 5.5, 0, 0, null, null]);
  });

  it('pauza 10 (r-d4-10w-15km-v38-1, asOf čet ned 4): neodrađeni zaštićeni dani = 0 → preostali dani kao sastavljeni, bez upozorenja', () => {
    const r = run('r-d4-10w-15km-v38-1', 'pause10', '2026-11-26');
    const w = r.plan.weeks[3]!;
    // 5k-v2.12.0 (T1): sastavljena nedelja ima lagan dan manje i staje u cilj i sa planiranim km zaštićenih — zbir po
    // činjenicama (0) nije potreban validatoru (generate.mixedOf).
    expect(w.protectedKm ?? 0).toBe(0);
    expect(roles(w)).toBe('easy:4.57 q1:4.13 long:4.7');
    expect(w.notes.some((n) => n.includes(MIXED_NOTE))).toBe(false);
    expect(r.plan.warnings.some((v) => v.rule === 'MIXED_OVER_TARGET')).toBe(false);
  });

  it('više od plana (r-d4-10w-15km-v38-1, asOf čet ned 1): urađeni km 8,16 ulaze u zbir → ni bez kvaliteta ne staje: kvalitet ostaje + upozorenje', () => {
    const r = run('r-d4-10w-15km-v38-1', 'over120', '2026-11-05');
    const w = r.plan.weeks[0]!;
    expect(w.protectedKm).toBe(8.16); // 5k-v2.12.0 (T1): lagan 6,8 km (granica 0,8 × dugi) × 120 %
    expect(roles(w)).toBe('easy:3.25 q1:3.55 q2:3.5 long:4.7');
    expect(
      r.plan.warnings.filter((v) => v.rule === 'MIXED_OVER_TARGET').map((v) => v.week)
    ).toEqual([1]);
  });

  it('f-d4-6w-30km-e420-0: umor u nedelji testa, zaključan Q1 nedelje 4 → test otpada uz napomenu (bez TEST_WEEK)', () => {
    const p = planOf('f-d4-6w-30km-e420-0');
    const rec = (date: string) => ({ date, km: 6, durationSec: 2400, completed: true, rpe: 8 });
    const sun = p.weeks[1]!.endDate;
    const lock = p.weeks[3]!.days.find((d) => d.workout.kind === 'quality')!;
    const r = adaptFiveKV2(
      p,
      { workouts: [rec(addDays(sun, -2)), rec(sun)], lockedDayIds: [lock.date] },
      p.weeks[2]!.startDate
    );
    if (!r.ok) throw new Error(JSON.stringify(r.violations));
    expect(r.plan.weeks.some((w) => w.test)).toBe(false);
    expect(
      r.plan.weeks.flatMap((w) => w.days).some((d) => d.workout.qualityType === 'TEST_3K')
    ).toBe(false);
    expect(r.plan.weeks[3]!.notes.some((n) => n.includes('kontrolno trčanje otpada'))).toBe(true);
    expect(S(r.plan.weeks[3]!.days.find((d) => d.date === lock.date))).toBe(S(lock));
  });
});

describe('08i-b: lanac — upisana nedelja bez drugog kvaliteta (pouka 37 ranije adaptacije) nosi dozu prvog', () => {
  it('r-d4-13w-15km-v58-0 umor sreda ned 5, isti zapisi ponovo asOf + 6 / + 7 → 0 odbijanja (DOSE_PROGRESSION)', () => {
    const b = earlyGridBases().find((x) => x.id === 'r-d4-13w-15km-v58-0')!;
    const flows = earlyFlows(b.id, b.input).filter((f) =>
      ['r-d4-13w-15km-v58-0/w5wed/fatigue/+6', 'r-d4-13w-15km-v58-0/w5wed/fatigue/+7'].includes(
        f.key
      )
    );
    expect(flows.length).toBe(2);
    expect(flows.map((f) => f.res.ok)).toEqual([true, true]);
  });
});
