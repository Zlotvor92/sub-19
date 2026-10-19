/* Pun nivo (TEST_FULL=1) mreže skorašnjeg najdužeg iz recent.node.test.ts: deo 2/3. */

import { part } from '@/test/level';
import { describeRecent, RECENT, RECENT_PARTS } from './recent.harness.node.test.ts';

describeRecent(
  'mreža skorašnjeg najdužeg (M13a): 35 910 ulaza — deo 2/3',
  part(RECENT, 2, RECENT_PARTS)
);
