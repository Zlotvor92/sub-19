/* Pun nivo (TEST_FULL=1) trajne mreže rane adaptacije iz earlyGrid.node.test.ts: deo 2/4. */

import { part } from '@/test/level';
import {
  describeEarly,
  EARLY_BASES,
  EARLY_PARTS,
  earlyFlows
} from './earlyGrid.harness.node.test.ts';

describeEarly(`mreža rane adaptacije — deo 2/${EARLY_PARTS}`, () =>
  earlyFlows(part(EARLY_BASES, 2, EARLY_PARTS))
);
