/* Pun nivo (TEST_FULL=1) guste mreže nedelje 1 iz dense.node.test.ts: deo 7/8. */

import { part } from '@/test/level';
import { DENSE, DENSE_PARTS, describeDense } from './dense.harness.node.test.ts';

describeDense('gusta mreža ned 1: 157 954 plana — deo 7/8', part(DENSE, 7, DENSE_PARTS));
