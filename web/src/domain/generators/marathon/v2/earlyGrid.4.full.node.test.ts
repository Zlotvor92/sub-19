/* Pun nivo (TEST_FULL=1) trajne mreže rane adaptacije iz earlyGrid.node.test.ts: deo 4/4. */

import { part } from '@/test/level';
import {
  describeEarly,
  EARLY_BASES,
  EARLY_PARTS,
  earlyFlows
} from './earlyGrid.harness.node.test.ts';

describeEarly(`mreža rane adaptacije — deo 4/${EARLY_PARTS}`, () =>
  earlyFlows(part(EARLY_BASES, 4, EARLY_PARTS))
);
