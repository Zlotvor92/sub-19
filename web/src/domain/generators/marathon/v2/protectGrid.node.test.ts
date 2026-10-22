/* MAR-08b (marathon-v2.5.1; pouka 38, K3, K4): trajna mreža zaštite — zaključan dan testa × pauza 10/20, pauza + bol,
   umor, bol 5/8 (asOf test − 14 … − 1, svaki drugi dan; na d73b83a TEST „najviše jedan test") i lanac pre starta
   (bol 8/5, umor, pauza 20 na start − 1) → korak 2 u ned 1 sa 17 scenarija (na d73b83a EMPTY_WEEK, WEEK_INFEASIBLE,
   WEEK_MIN_VOLUME). Po toku: prihvaćen, adaptInvariants prazno. Brz nivo: uzorak; pun nivo: deo 1/8 ovde, delovi 2–8 u
   protectGrid.<k>.full.node.test.ts. */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { FULL, part, sample } from '@/test/level';
import {
  describeEarly,
  EARLY_PARTS,
  LOCKED_TEST_BASES,
  lockedTestFlows,
  PROTECT_BASES,
  prestartChainFlows
} from './earlyGrid.harness.node.test.ts';

describeEarly(
  `MAR-08b zaključan dan testa (${LOCKED_TEST_BASES.length} planova)${FULL ? ` — deo 1/${EARLY_PARTS}` : ' — uzorak'}`,
  () =>
    FULL
      ? lockedTestFlows(part(LOCKED_TEST_BASES, 1, EARLY_PARTS))
      : sample(lockedTestFlows(LOCKED_TEST_BASES), 60, (f) => f.s)
);
describeEarly(
  `MAR-08b lanac pre starta → ned 1 (${PROTECT_BASES.length} planova)${FULL ? ` — deo 1/${EARLY_PARTS}` : ' — uzorak'}`,
  () =>
    FULL
      ? prestartChainFlows(part(PROTECT_BASES, 1, EARLY_PARTS))
      : sample(prestartChainFlows(PROTECT_BASES), 60, (f) => `${f.base.family}-${f.s1}`)
);

it('pun nivo: postoje tačno delovi 2…N', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  for (let k = 2; k <= EARLY_PARTS; k++)
    expect(existsSync(join(here, `protectGrid.${k}.full.node.test.ts`))).toBe(true);
  expect(existsSync(join(here, `protectGrid.${EARLY_PARTS + 1}.full.node.test.ts`))).toBe(false);
});
