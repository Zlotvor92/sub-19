/* Trajna mreža rane i srednje adaptacije (pouka 23; MAR-07c: + testDayFlows, brz nivo svaki 60. plan po osećaju i
   primer organizatora): brz nivo — svaki 120. tok (MAR-07: bilo 60, brz nivo ≤ 60 s) unutar porodice (R/F/B) × vrste toka × scenarija ×
   asOf pre starta / posle (pouka 34); pun nivo — deo 1/4 ovde, delovi 2–4 u earlyGrid.<k>.full.node.test.ts. */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { FULL, part, sample } from '@/test/level';
import {
  describeEarly,
  EARLY_BASES,
  EARLY_PARTS,
  earlyFlows,
  TEST_DAY_BASES,
  TEST_DAY_EXAMPLE,
  testDayFlows
} from './earlyGrid.harness.node.test.ts';

describeEarly(
  `mreža rane adaptacije (${EARLY_BASES.length} planova)${FULL ? ` — deo 1/${EARLY_PARTS}` : ' — uzorak'}`,
  () =>
    FULL
      ? earlyFlows(part(EARLY_BASES, 1, EARLY_PARTS))
      : sample(earlyFlows(EARLY_BASES), 120, (f) => `${f.base.family}-${f.kind}-${f.s}-${f.pre}`)
);
// MAR-07c: umor na dan testa ± 1 — pun nivo deo 1/4 svih planova po osećaju; brz nivo svaki 60. (po broju dana) i
// primer organizatora.
describeEarly(
  `MAR-07c umor na dan testa ± 1${FULL ? ` — deo 1/${EARLY_PARTS}` : ' — uzorak'}`,
  () =>
    testDayFlows(
      FULL
        ? part(TEST_DAY_BASES, 1, EARLY_PARTS)
        : sample(
            TEST_DAY_BASES,
            60,
            (b) => b.id.split('-')[1]!,
            (b) => b.id === TEST_DAY_EXAMPLE
          )
    )
);

it('pun nivo: postoje tačno delovi 2…N; mreža ima sve porodice', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  for (let k = 2; k <= EARLY_PARTS; k++)
    expect(existsSync(join(here, `earlyGrid.${k}.full.node.test.ts`))).toBe(true);
  expect(existsSync(join(here, `earlyGrid.${EARLY_PARTS + 1}.full.node.test.ts`))).toBe(false);
  expect(new Set(EARLY_BASES.map((b) => b.family))).toEqual(new Set(['R', 'F', 'B']));
});
