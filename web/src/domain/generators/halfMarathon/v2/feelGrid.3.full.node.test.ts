/* Pun nivo (TEST_FULL=1) mreže 03 po osećaju iz feelGrid.node.test.ts: deo 3/3. */

import { part } from '@/test/level';
import { describeGrid03, FEEL_PARTS } from './grid03.harness.node.test.ts';
import { feelInputs } from './testInputs.ts';

describeGrid03(
  'mreža 03 po osećaju: 6336 planova — deo 3/3',
  'feel',
  part(feelInputs(), 3, FEEL_PARTS)
);
