/* Pun nivo (TEST_FULL=1) mreže pouke 28 iz recent.node.test.ts: deo 3/4. */

import { part } from '@/test/level';
import { ALL, describeRecent, RECENT_PARTS } from './recent.harness.node.test.ts';

describeRecent('pouka 28: mreža skorašnjeg najdužeg trka — deo 3/4', part(ALL, 3, RECENT_PARTS));
