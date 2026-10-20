/* Trajna mreža rane i srednje adaptacije (pouka 23): brz nivo — svaki 120. tok (MAR-07: bilo 60, brz nivo ≤ 60 s) unutar porodice (R/F/B) × vrste toka × scenarija ×
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
  earlyFlows
} from './earlyGrid.harness.node.test.ts';

describeEarly(
  `mreža rane adaptacije (${EARLY_BASES.length} planova)${FULL ? ` — deo 1/${EARLY_PARTS}` : ' — uzorak'}`,
  () =>
    FULL
      ? earlyFlows(part(EARLY_BASES, 1, EARLY_PARTS))
      : sample(earlyFlows(EARLY_BASES), 120, (f) => `${f.base.family}-${f.kind}-${f.s}-${f.pre}`)
);

it('pun nivo: postoje tačno delovi 2…N; mreža ima sve porodice', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  for (let k = 2; k <= EARLY_PARTS; k++)
    expect(existsSync(join(here, `earlyGrid.${k}.full.node.test.ts`))).toBe(true);
  expect(existsSync(join(here, `earlyGrid.${EARLY_PARTS + 1}.full.node.test.ts`))).toBe(false);
  expect(new Set(EARLY_BASES.map((b) => b.family))).toEqual(new Set(['R', 'F', 'B']));
});
