/* Pun nivo (TEST_FULL=1) mreže 04 iz adaptGrid.node.test.ts: deo 2/2. */

import { part } from '@/test/level';
import { ADAPT_PARTS, BASES, casesOf, describeAdaptGrid } from './adaptGrid.harness.node.test.ts';

describeAdaptGrid(`mreža 04 — deo 2/${ADAPT_PARTS}`, () => casesOf(part(BASES, 2, ADAPT_PARTS)));
