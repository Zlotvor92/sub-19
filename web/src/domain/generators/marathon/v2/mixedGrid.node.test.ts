/* MAR-08 (pouka 37): trajna mreža mešovite nedelje — umor sa asOf svaki dan nedelje k (k = 2 … N − 3) i umor sa asOf
   prvi dan nedelje k + zaključan/urađen prvi dan trčanja nedelje k + 1 (earlyGrid.harness `mixedFlows`). Po toku:
   prihvaćen, adaptInvariants prazno — mešovita nedelja posle asOf ima planirano ≤ cilj ili MIXED_WEEK_OVER (nezavisno
   od validatora). Brz nivo: svaki 360. tok po porodici (R/F/B) i vrsti + primer organizatora; pun nivo: deo 1/8 ovde,
   delovi 2–8 u mixedGrid.<k>.full.node.test.ts. */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { FULL, part, sample } from '@/test/level';
import {
  describeEarly,
  EARLY_PARTS,
  MIXED_BASES,
  MIXED_EXAMPLE,
  mixedFlows
} from './earlyGrid.harness.node.test.ts';

describeEarly(
  `MAR-08 mešovita nedelja (${MIXED_BASES.length} planova)${FULL ? ` — deo 1/${EARLY_PARTS}` : ' — uzorak'}`,
  () =>
    FULL
      ? mixedFlows(part(MIXED_BASES, 1, EARLY_PARTS))
      : [
          ...sample(
            mixedFlows(MIXED_BASES),
            120,
            (f) => `${f.base.family}-${f.kind}-${f.day?.how}`
          ),
          ...mixedFlows([MIXED_EXAMPLE]).filter((f) => f.kind === 'fatigueDay')
        ]
);

it('pun nivo: postoje tačno delovi 2…N; mreža ima sve porodice', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  for (let k = 2; k <= EARLY_PARTS; k++)
    expect(existsSync(join(here, `mixedGrid.${k}.full.node.test.ts`))).toBe(true);
  expect(existsSync(join(here, `mixedGrid.${EARLY_PARTS + 1}.full.node.test.ts`))).toBe(false);
  expect(new Set(MIXED_BASES.map((b) => b.family))).toEqual(new Set(['R', 'F', 'B']));
});
