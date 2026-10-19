/* Pun nivo (TEST_FULL=1) guste mreže nedelje 1 iz dense.node.test.ts: deo 3/3. */

import { part } from '@/test/level';
import { DENSE_PARTS, describeDense } from './dense.harness.node.test.ts';
import { denseWeek1Inputs } from './testInputs.ts';

describeDense(
  'gusta mreža nedelje 1: 30 401 plan — deo 3/3',
  part(denseWeek1Inputs(), 3, DENSE_PARTS)
);
