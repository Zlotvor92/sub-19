/* Pun nivo (TEST_FULL=1) trajne mreže zaštite iz protectGrid.node.test.ts (MAR-08b, pouka 38, K3, K4): deo 5/8. */

import { part } from '@/test/level';
import {
  describeEarly,
  EARLY_PARTS,
  LOCKED_TEST_BASES,
  lockedTestFlows,
  PROTECT_BASES,
  prestartChainFlows
} from './earlyGrid.harness.node.test.ts';

describeEarly(`MAR-08b zaključan dan testa — deo 5/${EARLY_PARTS}`, () =>
  lockedTestFlows(part(LOCKED_TEST_BASES, 5, EARLY_PARTS))
);
describeEarly(`MAR-08b lanac pre starta → ned 1 — deo 5/${EARLY_PARTS}`, () =>
  prestartChainFlows(part(PROTECT_BASES, 5, EARLY_PARTS))
);
