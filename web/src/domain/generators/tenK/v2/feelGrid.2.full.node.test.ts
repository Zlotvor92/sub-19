/* Pun nivo (TEST_FULL=1) mreže po osećaju iz feelGrid.node.test.ts: deo 2/4 — 4 dana, part(DAYS, 2, 4)
   (feelGrid.harness.node.test.ts). */

import { part } from '@/test/level';
import { describeFeelGrid, FEEL_PARTS } from './feelGrid.harness.node.test.ts';
import { DAYS } from './gridInvariants.ts';

describeFeelGrid(
  'mreža po osećaju: 11 880 planova (3–6 dana × 8–18 ned × 6 laganih tempa) — deo 2/4',
  part(DAYS, 2, FEEL_PARTS)
);
