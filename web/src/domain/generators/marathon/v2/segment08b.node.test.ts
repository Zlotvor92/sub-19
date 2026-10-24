/* MAR-08b (marathon-v2.5.1): nalazi ranog prolaza završne provere. K1 (pouka 38) — zaključan dan testa + pauza/umor →
   test se ne premešta, ostaje jedini; K3 — lanac pre starta (bol 8 na start − 1) → u ned 1 bol 8 (nedelja bez treninga:
   WEEK_ALL_REST, ne EMPTY_WEEK) i umor (rasterećenje ned 2 bez prethodnog dugog: referenca nedelje 1 generatora,
   pouka 34); K4 — cilj na minimumu nedelje: lagani se zaokružuju naviše (19,98 < 20); pouka 37 — dan poznat iz potpune
   pokrivenosti bez zapisa = 0 u zbiru zaštićenih dana. Na d73b83a (marathon-v2.5.0) prvi testovi K1, K3 i K4 padaju. */

import { describe, expect, it } from 'vitest';
import { easyRestDates } from './week.ts';
import { adaptMarathonV2 } from './adapt.ts';
import { adaptInvariants } from './adaptInvariants.ts';
import { addDays } from './dates.ts';
import { generateMarathonV2 } from './generate.ts';
import { factKmOf } from './mixed.ts';
import { beginnerInputs, earlyFacts, factsOf, feelInputs, gridInputs } from './testInputs.ts';
import type { AdaptResult, MarathonV2Facts, MarathonV2Plan } from './types.ts';

const all = () => [...gridInputs(), ...feelInputs(), ...beginnerInputs()];
const planOf = (id: string): MarathonV2Plan => {
  const r = generateMarathonV2(all().find((x) => x.id === id)!.input);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
};
const ok = (r: AdaptResult): Extract<AdaptResult, { ok: true }> => {
  if (!r.ok) throw new Error(JSON.stringify(r).slice(0, 1500));
  return r;
};
const tests = (p: MarathonV2Plan): string[] =>
  p.weeks.flatMap((w) => w.days.filter((d) => d.role === 'test').map((d) => d.date));
/** Kumulativne činjenice dva koraka (kao dnevnik aplikacije). */
const merge = (a: MarathonV2Facts, b: MarathonV2Facts): MarathonV2Facts => ({
  ...a,
  ...b,
  workouts: [
    ...(a.workouts ?? []).filter((x) => !(b.workouts ?? []).some((y) => y.date === x.date)),
    ...(b.workouts ?? [])
  ]
});

describe('MAR-08b K1 (pouka 38): zaključan dan testa se ne premešta', () => {
  for (const [id, s, at, lock] of [
    ['feel-d4-14w-55km-e360-A', 'pause10', '2026-11-22', '2026-11-26'],
    ['feel-d3-12w-50km-e405-B', 'pause20', '2026-11-04', '2026-11-18']
  ] as const)
    it(`${id} ${s} asOf ${at}, zaključan test ${lock} → jedan test, na zaključanom danu`, () => {
      const p = planOf(id);
      expect(tests(p)).toEqual([lock]);
      const f = { ...earlyFacts(p, s, at), lockedDayIds: [lock] } as MarathonV2Facts;
      const r = ok(adaptMarathonV2(p, f, at));
      expect(tests(r.plan)).toEqual([lock]);
      expect(adaptInvariants(p, r.plan, at, f)).toEqual([]);
    });

  it('umor: rasterećenje na nedelji zaključanog testa ne pravi drugi test (T slot)', () => {
    const p = planOf('feel-d4-12w-55km-e360-A');
    const t = tests(p)[0]!;
    const at = addDays(t, -10);
    const f = { ...factsOf(p, 'fatigue', at), lockedDayIds: [t] } as MarathonV2Facts;
    const r = ok(adaptMarathonV2(p, f, at));
    expect(tests(r.plan)).toEqual([t]);
  });

  it('kontrola: bez zaključavanja pauza i dalje premešta test (A13)', () => {
    const p = planOf('feel-d3-12w-50km-e405-B');
    const r = ok(adaptMarathonV2(p, earlyFacts(p, 'pause20', '2026-11-04'), '2026-11-04'));
    expect(tests(r.plan)).not.toEqual(['2026-11-18']);
  });
});

describe('MAR-08b K3: lanac pre starta → ned 1', () => {
  const p = planOf('d3-12w-30km-v30-A-sat');
  const at1 = addDays(p.input.startDate, -1);
  const f1 = factsOf(p, 'pain8', at1) as MarathonV2Facts;
  const r1 = ok(adaptMarathonV2(p, f1, at1));

  it('bol 8 → umor (sreda ned 1): rasterećenje ned 2 iz reference nedelje 1 generatora (pouka 34)', () => {
    const f = merge(f1, factsOf(r1.plan, 'fatigue', '2026-11-04'));
    const r = ok(adaptMarathonV2(r1.plan, f, '2026-11-04'));
    const w2 = r.plan.weeks[1]!;
    expect(w2.deload).toBe(true);
    expect(w2.days.some((d) => d.role === 'long')).toBe(true);
    expect(r.plan.adaptation!.steps.at(-1)!.deloadRef).toBeDefined();
    expect(adaptInvariants(r1.plan, r.plan, '2026-11-04', f)).toEqual([]);
  });

  it('bol 8 → bol 8 (sreda ned 1): nedelja 1 bez treninga = WEEK_ALL_REST (upozorenje), ne EMPTY_WEEK', () => {
    const f = merge(f1, factsOf(r1.plan, 'pain8', '2026-11-04'));
    const r = ok(adaptMarathonV2(r1.plan, f, '2026-11-04'));
    expect(r.plan.weeks[0]!.days.filter((d) => d.countsToWeek)).toEqual([]);
    expect(r.plan.warnings.some((x) => x.rule === 'WEEK_ALL_REST' && x.week === 1)).toBe(true);
  });
});

describe('MAR-08b K4: cilj na minimumu nedelje — planirano ≥ minimum (zaokruživanje laganih naviše)', () => {
  it('beg-d4-16w-25km-v30-C, ned 2: rezultat pon + bol 5 čet, asOf čet → prihvaćeno, svaka nedelja ≥ 20 km', () => {
    const p = planOf('beg-d4-16w-25km-v30-C');
    const mon = p.weeks[1]!.startDate;
    const at = addDays(mon, 3);
    const f = merge(factsOf(p, 'faster', mon), factsOf(p, 'pain5', at));
    const r = ok(adaptMarathonV2(p, f, at));
    // MAR-11 (T1): nedelja sa laganim danom odmora (napomena) sme ispod — lagani ≤ 0,8 × dugi.
    for (const w of r.plan.weeks.filter(
      (x) => x.phase !== 'race' && !x.limits?.rest && easyRestDates(x).length === 0
    ))
      expect(w.plannedKm, `ned ${w.index}`).toBeGreaterThanOrEqual(20);
  });
});

describe('MAR-08b pouka 37: dan poznat iz potpune pokrivenosti bez zapisa = 0', () => {
  it('factKmOf: pauza 0, zapis = km (neodrađen 0), poznat bez zapisa 0, nepoznat = null (plan)', () => {
    const facts = {
      workouts: [
        { date: '2026-11-02', km: 7, completed: true },
        { date: '2026-11-03', km: 9, completed: false }
      ],
      breaks: [{ from: '2026-11-06', to: '2026-11-06' }],
      coverage: { from: '2026-11-01', to: '2026-11-05', complete: true }
    };
    expect(factKmOf('2026-11-02', facts)).toBe(7);
    expect(factKmOf('2026-11-03', facts)).toBe(0);
    expect(factKmOf('2026-11-04', facts)).toBe(0);
    expect(factKmOf('2026-11-06', facts)).toBe(0);
    expect(factKmOf('2026-11-07', facts)).toBeNull();
    expect(
      factKmOf('2026-11-04', { ...facts, coverage: { ...facts.coverage, complete: false } })
    ).toBeNull();
  });
});
