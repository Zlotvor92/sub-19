/* Pun nivo (TEST_FULL=1) guste mreže nedelje 1 iz dense.node.test.ts: deo 2/8. */

import { part } from '@/test/level';
import { DENSE_PARTS, describeDense } from './dense.harness.node.test.ts';
import { DAY_COUNTS, denseInputs } from './testInputs.ts';

describeDense(
  'gusta mreža nedelje 1: 141 804 plana — deo 2/8',
  part(
    DAY_COUNTS.flatMap((n) => denseInputs(n)),
    2,
    DENSE_PARTS
  )
);
