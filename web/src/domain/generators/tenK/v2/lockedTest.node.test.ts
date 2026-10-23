/* 10K v2 06i (10k-v2.8.0, A13b, organizator K1): zaključan dan testa se ne premešta i nijedan okvir ne dobija drugi
   test (steps.protectedTest). Primer: f-d3-8w-25km-e510-B-sat, pauza 20 / bol 8, asOf 2026-10-31, zaključan
   2026-11-11 (dan testa) — na 46e72eb PLAN_VIOLATES_POLICY TEST (dva testa). Mreža: lockedTest.harness.node.test.ts. */

import { describe, expect, it } from 'vitest';
import { adaptTenKV2 } from './adapt.ts';
import { generateTenKV2 } from './generate.ts';
import { describeLockedTest } from './lockedTest.harness.node.test.ts';
import { factsOf, feelGridInputs } from './testInputs.ts';

describeLockedTest(
  'mreža A13b: zaključan dan testa (pauza 10/20, umor, bol 5/8, asOf test − 14 … − 1)',
  1
);

describe('A13b: primer K1', () => {
  const g = generateTenKV2(
    feelGridInputs(3).find((x) => x.id === 'f-d3-8w-25km-e510-B-sat')!.input
  );
  if (!g.ok) throw new Error('f-d3-8w-25km-e510-B-sat');
  const p0 = g.plan;
  it.each(['pause20', 'pain8'] as const)(
    '%s: test ostaje na zaključanom danu 2026-11-11, jedini u planu',
    (s) => {
      expect(p0.weeks.flatMap((w) => w.days).find((d) => d.role === 'test')?.date).toBe(
        '2026-11-11'
      );
      const r = adaptTenKV2(
        p0,
        { ...factsOf(p0, s, '2026-10-31'), lockedDayIds: ['2026-11-11'] },
        '2026-10-31'
      );
      if (!r.ok) throw new Error(JSON.stringify(r.reasons));
      const tests = r.plan.weeks.flatMap((w) =>
        w.days.filter((d) => d.role === 'test').map((d) => d.date)
      );
      expect(tests).toEqual(['2026-11-11']);
    }
  );
});

describe('A13b: zaključan test pa nov rezultat (organizator, two-step cum)', () => {
  it.each(['faster', 'slower', 'test5k'] as const)(
    'f-d5-11w-50km-e315-C-sun: zaključan 2026-11-16 (test), +3 dana %s → test ostaje na zaključanom danu (validator ne sudi zaštićenom testu)',
    (s) => {
      const g = generateTenKV2(
        feelGridInputs(5).find((x) => x.id === 'f-d5-11w-50km-e315-C-sun')!.input
      );
      if (!g.ok) throw new Error('plan');
      const at1 = '2026-11-11';
      const f1 = factsOf(g.plan, 'locked', at1) as { workouts?: unknown[]; lockedDayIds: string[] };
      expect(f1.lockedDayIds).toContain('2026-11-16');
      const r1 = adaptTenKV2(g.plan, f1, at1);
      if (!r1.ok) throw new Error('korak 1');
      const f2 = factsOf(r1.plan, s, '2026-11-14') as { workouts?: unknown[] };
      const r2 = adaptTenKV2(
        r1.plan,
        {
          ...f1,
          ...f2,
          workouts: [...(f1.workouts ?? []), ...(f2.workouts ?? [])],
          lockedDayIds: f1.lockedDayIds
        },
        '2026-11-14'
      );
      if (!r2.ok) throw new Error(JSON.stringify(r2.reasons));
      expect(
        r2.plan.weeks.flatMap((w) => w.days.filter((d) => d.role === 'test').map((d) => d.date))
      ).toEqual(['2026-11-16']);
    }
  );
});
