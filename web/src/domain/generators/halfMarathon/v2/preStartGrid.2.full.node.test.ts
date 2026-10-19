/* Pun nivo (TEST_FULL=1) rane mreže pre starta iz preStartGrid.node.test.ts: deo 2/2 — planovi
   part(earlyGridBases(), 2, 2). */

import { describeAdaptGrid, earlyGridBases, preStartFlows } from './adaptGrid.harness.node.test.ts';
import { PRE_START } from './preStartGrid.node.test.ts';

describeAdaptGrid(
  'rana mreža pre starta: 17 scenarija (pouka 23, 34) — deo 2/2',
  'preStartGrid',
  preStartFlows,
  earlyGridBases,
  2,
  2,
  25,
  PRE_START
);
