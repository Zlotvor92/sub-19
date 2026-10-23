/* 10K v2 06i (10k-v2.8.0, A13b, organizator K1): trajna mreža zaključanog dana TESTA — zajednički kod za
   lockedTest.node.test.ts (deo 1) i lockedTest.<k>.full.node.test.ts. Planovi po osećaju sa testom iz mreže E
   (testInputs.earlyGridBases, porodica F; pun: svaki STRIDE.full., brz: svaki STRIDE.fast.); asOf = svaki dan od
   test − 14 do test − 1 (ne pre start − 1); scenariji pauza 10/20, umor, bol 5/8; lockedDayIds = [dan testa].
   Po toku: 0 odbijanja, adaptInvariants prazno, najviše jedan test, zaključan dan bajt-isti. Na 46e72eb (organizator,
   locked-test.ts 10K 97): 5 662/8 050 odbijeno TEST „(A13, D32)" — premeštanje testa nije znalo za zaključan test. */

import { beforeAll, describe, expect, it } from 'vitest';
import { FULL, part } from '@/test/level';
import { adaptTenKV2 } from './adapt.ts';
import { adaptInvariants } from './adaptInvariants.ts';
import { addDays } from './dates.ts';
import { earlyPlan } from './earlyGrid.harness.node.test.ts';
import { GRID_TIMEOUT, missingParts } from './level.harness.node.test.ts';
import { earlyGridBases, factsOf } from './testInputs.ts';
import { fileURLToPath } from 'node:url';

export const LOCKED_TEST_PARTS = 4;
const HERE = fileURLToPath(new URL('./', import.meta.url));
const STRIDE = { full: 8, fast: 120 } as const;
export const LOCKED_TEST_SCENARIOS = ['pause10', 'pause20', 'fatigue', 'pain5', 'pain8'] as const;

export function describeLockedTest(title: string, partIndex: number): void {
  describe(title, () => {
    let n = 0;
    let bad: string[] = [];
    beforeAll(() => {
      const xs = earlyGridBases()
        .filter((b) => b.family === 'F')
        .filter((_, i) => i % (FULL ? STRIDE.full : STRIDE.fast) === 0);
      for (const b of FULL ? part(xs, partIndex, LOCKED_TEST_PARTS) : xs) {
        const p0 = earlyPlan(b);
        const td = p0.weeks.flatMap((w) => w.days).find((d) => d.role === 'test');
        if (!td) continue;
        for (let o = 14; o >= 1; o--) {
          const at = addDays(td.date, -o);
          if (at < addDays(p0.input.startDate, -1)) continue;
          for (const s of LOCKED_TEST_SCENARIOS) {
            const facts = { ...factsOf(p0, s, at), lockedDayIds: [td.date] };
            const key = `${b.id}/${s}/${at}`;
            const r = adaptTenKV2(p0, facts, at);
            n++;
            if (!r.ok) {
              bad.push(`${key}: ${r.reasons[0]!.message.slice(0, 120)}`);
              continue;
            }
            for (const v of adaptInvariants(p0, r.plan, at, facts)) bad.push(`${key}: ${v}`);
            const days = r.plan.weeks.flatMap((w) => w.days);
            if (days.filter((d) => d.role === 'test').length > 1) bad.push(`${key}: dva testa`);
            if (JSON.stringify(days.find((d) => d.date === td.date)) !== JSON.stringify(td))
              bad.push(`${key}: zaključan dan testa promenjen`);
          }
        }
      }
    }, GRID_TIMEOUT);

    it('pun nivo: svi delovi postoje; zaključan dan testa × 5 scenarija → 0 odbijanja, jedan test, dan bajt-isti', () => {
      if (FULL && partIndex === 1)
        expect(missingParts(HERE, 'lockedTest', LOCKED_TEST_PARTS)).toEqual([]);
      expect(n).toBeGreaterThan(FULL ? 1000 : 300);
      bad = bad.slice(0, 10);
      expect(bad).toEqual([]);
    });
  });
}
