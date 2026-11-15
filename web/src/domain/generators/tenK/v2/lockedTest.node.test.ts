/* 10K v2 06i (10k-v2.8.0, A13b, organizator K1): zaključan dan testa se ne premešta i nijedan okvir ne dobija drugi
   test (steps.protectedTest). Primer: f-d3-8w-25km-e510-B-sat, pauza 20 / bol 8, asOf 2026-10-31, zaključan
   2026-11-11 (dan testa) — na 46e72eb PLAN_VIOLATES_POLICY TEST (dva testa). Mreža: lockedTest.harness.node.test.ts. */

import { describe, expect, it } from 'vitest';
import { adaptTenKV2 } from './adapt.ts';
import { generateTenKV2 } from './generate.ts';
import { describeLockedTest } from './lockedTest.harness.node.test.ts';
import { addDays } from './dates.ts';
import { factsOf, feelGridInputs } from './testInputs.ts';
import type { PlanWeek } from './types.ts';

describeLockedTest(
  'mreža A13b: zaključan dan testa (pauza 10/20, umor, bol 5/8, asOf test − 14 … − 1)',
  1
);

// P8 G7 (D46): test ne pre nedelje 4 — planovi od 8 i 11 nedelja (primeri K1 i two-step) više nemaju test; isti primeri na
// planovima od 15 nedelja (test u nedelji 5), datumi iz plana: asOf = dan testa − 11, zaključan dan testa.
const testDate = (p: { weeks: readonly PlanWeek[] }): string | undefined =>
  p.weeks.flatMap((w) => w.days).find((d) => d.role === 'test')?.date;

describe('A13b: primer K1', () => {
  it('P8 G7: plan po osećaju od 8 nedelja nema test', () => {
    const g8 = generateTenKV2(
      feelGridInputs(3).find((x) => x.id === 'f-d3-8w-25km-e510-B-sat')!.input
    );
    if (!g8.ok) throw new Error('f-d3-8w-25km-e510-B-sat');
    expect(testDate(g8.plan)).toBeUndefined();
  });
  const g = generateTenKV2(
    feelGridInputs(3).find((x) => x.id === 'f-d3-15w-25km-e510-B-sat')!.input
  );
  if (!g.ok) throw new Error('f-d3-15w-25km-e510-B-sat');
  const p0 = g.plan;
  it.each(['pause20', 'pain8'] as const)(
    '%s: test ostaje na zaključanom danu, jedini u planu',
    (s) => {
      const td = testDate(p0)!;
      expect(td).toBeDefined();
      const asOf = addDays(td, -11);
      const r = adaptTenKV2(p0, { ...factsOf(p0, s, asOf), lockedDayIds: [td] }, asOf);
      if (!r.ok) throw new Error(JSON.stringify(r.reasons));
      const tests = r.plan.weeks.flatMap((w) =>
        w.days.filter((d) => d.role === 'test').map((d) => d.date)
      );
      expect(tests).toEqual([td]);
    }
  );
});

describe('A13b: zaključan test pa nov rezultat (organizator, two-step cum)', () => {
  it.each(['faster', 'slower', 'test5k'] as const)(
    'f-d5-15w-50km-e315-C-sun: zaključan dan testa, +3 dana %s → test ostaje na zaključanom danu (validator ne sudi zaštićenom testu)',
    (s) => {
      const g = generateTenKV2(
        feelGridInputs(5).find((x) => x.id === 'f-d5-15w-50km-e315-C-sun')!.input
      );
      if (!g.ok) throw new Error('plan');
      const td = testDate(g.plan)!;
      // asOf: dan pre prethodnog dana trčanja pred test — zaključana 3 naredna dana plana obuhvataju dan testa.
      const before = g.plan.weeks
        .flatMap((w) => w.days)
        .filter((d) => d.date < td)
        .map((d) => d.date);
      const at1 = addDays(before[before.length - 2]!, -1);
      const f1 = factsOf(g.plan, 'locked', at1) as { workouts?: unknown[]; lockedDayIds: string[] };
      expect(f1.lockedDayIds).toContain(td);
      const r1 = adaptTenKV2(g.plan, f1, at1);
      if (!r1.ok) throw new Error('korak 1');
      const at2 = addDays(at1, 3) < td ? addDays(at1, 3) : addDays(td, -1);
      const f2 = factsOf(r1.plan, s, at2) as { workouts?: unknown[] };
      const r2 = adaptTenKV2(
        r1.plan,
        {
          ...f1,
          ...f2,
          workouts: [...(f1.workouts ?? []), ...(f2.workouts ?? [])],
          lockedDayIds: f1.lockedDayIds
        },
        at2
      );
      if (!r2.ok) throw new Error(JSON.stringify(r2.reasons));
      expect(
        r2.plan.weeks.flatMap((w) => w.days.filter((d) => d.role === 'test').map((d) => d.date))
      ).toEqual([td]);
    }
  );
});
