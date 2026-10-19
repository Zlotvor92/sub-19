/* Pun nivo (TEST_FULL=1) mreže skorašnjeg najdužeg iz recent.node.test.ts: deo 3/3. */

import { part } from '@/test/level';
import { describeRecent, RECENT, RECENT_PARTS } from './recent.harness.node.test.ts';

describeRecent(
  'mreža skorašnjeg najdužeg (M13a): 35 910 ulaza — deo 3/3',
  part(RECENT, 3, RECENT_PARTS)
);
