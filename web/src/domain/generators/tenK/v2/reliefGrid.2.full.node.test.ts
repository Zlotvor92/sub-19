/* Pun nivo (TEST_FULL=1) mreže R iz reliefGrid.node.test.ts: deo 2/7 — scenario part(RELIEF_SCENARIOS, 2, 7)
   (reliefGrid.harness.node.test.ts). */

import { part } from '@/test/level';
import { describeReliefGrid, RELIEF_PARTS } from './reliefGrid.harness.node.test.ts';
import { RELIEF_SCENARIOS } from './testInputs.ts';

describeReliefGrid(
  'mreža R: 292 plana × asOf kraj ned 2…N − 4 × 7 scenarija = 18 193 toka (A17) — deo 2/7',
  part(RELIEF_SCENARIOS, 2, RELIEF_PARTS)
);
