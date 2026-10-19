/* Pun nivo (TEST_FULL=1) mreže 02 iz grid.node.test.ts: deo 4/4. */

import { part } from '@/test/level';
import { describeGrid, GRID_PARTS } from './grid.harness.node.test.ts';
import { grid02Inputs } from './testInputs.ts';

describeGrid('mreža 02: 16 896 planova — deo 4/4', part(grid02Inputs(), 4, GRID_PARTS));
