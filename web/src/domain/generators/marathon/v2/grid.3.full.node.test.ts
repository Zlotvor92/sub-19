/* Pun nivo (TEST_FULL=1) mreže 01 iz grid.node.test.ts: deo 3/3 (grid.harness.node.test.ts). */

import { part } from '@/test/level';
import { ALL, describeGrid, GRID_PARTS } from './grid.harness.node.test.ts';

describeGrid('mreža 01: 4368 planova (4 dana × 12–24 ned) — deo 3/3', part(ALL, 3, GRID_PARTS));
