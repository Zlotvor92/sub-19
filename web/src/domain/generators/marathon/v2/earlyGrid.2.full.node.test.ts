/* Pun nivo (TEST_FULL=1) trajne mreže rane adaptacije iz earlyGrid.node.test.ts: deo 2/8 (MAR-07c: i umor na dan
   testa ± 1, zaseban blok; organizator: 8 delova — deo 4/4 je na CI-ju prešao 600 s beforeAll). */

import { part } from '@/test/level';
import {
  describeEarly,
  EARLY_BASES,
  EARLY_PARTS,
  earlyFlows,
  TEST_DAY_BASES,
  testDayFlows
} from './earlyGrid.harness.node.test.ts';

describeEarly(`mreža rane adaptacije — deo 2/${EARLY_PARTS}`, () =>
  earlyFlows(part(EARLY_BASES, 2, EARLY_PARTS))
);
describeEarly(`MAR-07c umor na dan testa ± 1 — deo 2/${EARLY_PARTS}`, () =>
  testDayFlows(part(TEST_DAY_BASES, 2, EARLY_PARTS))
);
