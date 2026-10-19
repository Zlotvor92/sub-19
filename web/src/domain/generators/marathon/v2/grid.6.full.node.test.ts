/* Pun nivo (TEST_FULL=1) mreže 02 iz grid.node.test.ts: deo 6/6 (grid.harness.node.test.ts). */

import { part } from '@/test/level';
import { ALL, describeGrid, GRID_PARTS } from './grid.harness.node.test.ts';

describeGrid('mreža 02: 21 840 planova (3–6 dana × 12–24 ned) — deo 6/6', part(ALL, 6, GRID_PARTS));
