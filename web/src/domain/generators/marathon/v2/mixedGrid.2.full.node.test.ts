/* Pun nivo (TEST_FULL=1) trajne mreže mešovite nedelje iz mixedGrid.node.test.ts (MAR-08, pouka 37): deo 2/8. */

import { part } from '@/test/level';
import {
  describeEarly,
  EARLY_PARTS,
  MIXED_BASES,
  mixedFlows
} from './earlyGrid.harness.node.test.ts';

describeEarly(`MAR-08 mešovita nedelja — deo 2/${EARLY_PARTS}`, () =>
  mixedFlows(part(MIXED_BASES, 2, EARLY_PARTS))
);
