/* Pun nivo (TEST_FULL=1) mreže po osećaju iz feelGrid.node.test.ts: deo 3/4 — 5 dana, part(DAYS, 3, 4)
   (feelGrid.harness.node.test.ts). */

import { part } from '@/test/level';
import { describeFeelGrid, FEEL_PARTS } from './feelGrid.harness.node.test.ts';
import { DAYS } from './gridInvariants.ts';

describeFeelGrid(
  'mreža po osećaju: 11 880 planova (3–6 dana × 8–18 ned × 6 laganih tempa) — deo 3/4',
  part(DAYS, 3, FEEL_PARTS)
);
