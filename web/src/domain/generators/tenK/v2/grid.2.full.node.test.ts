/* Pun nivo (TEST_FULL=1) mreže 02 iz grid.node.test.ts: deo 2/4 — 4 dana, part(DAYS, 2, 4)
   (grid02.harness.node.test.ts). */

import { part } from '@/test/level';
import { describeGrid02, GRID02_PARTS } from './grid02.harness.node.test.ts';
import { DAYS } from './gridInvariants.ts';

describeGrid02(
  'mreža 02 sa rezultatom: 15 840 planova (3/4/5/6 dana × 8–18 ned) — deo 2/4',
  part(DAYS, 2, GRID02_PARTS)
);
