/* Pun nivo (TEST_FULL=1) mreže 01 iz grid.node.test.ts: deo 2/2. */

import { part } from '@/test/level';
import { describeGrid, GRID_PARTS } from './grid.harness.node.test.ts';
import { gridInputs } from './testInputs.ts';

describeGrid('mreža 01: 3696 planova — deo 2/2', part(gridInputs(), 2, GRID_PARTS));
