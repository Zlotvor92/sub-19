/* Pun nivo (TEST_FULL=1) trajne mreže rane adaptacije iz earlyGrid.node.test.ts: deo 3/4 (MAR-07c: i umor na dan
   testa ± 1, zaseban blok). */

import { part } from '@/test/level';
import {
  describeEarly,
  EARLY_BASES,
  EARLY_PARTS,
  earlyFlows,
  TEST_DAY_BASES,
  testDayFlows
} from './earlyGrid.harness.node.test.ts';

describeEarly(`mreža rane adaptacije — deo 3/${EARLY_PARTS}`, () =>
  earlyFlows(part(EARLY_BASES, 3, EARLY_PARTS))
);
describeEarly(`MAR-07c umor na dan testa ± 1 — deo 3/${EARLY_PARTS}`, () =>
  testDayFlows(part(TEST_DAY_BASES, 3, EARLY_PARTS))
);
