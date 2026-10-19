/* Pun nivo (TEST_FULL=1) rane mreže iz earlyGrid.node.test.ts: deo 2/4 — planovi part(earlyGridBases(), 2, 4). */

import { describeAdaptGrid, earlyFlows, earlyGridBases } from './adaptGrid.harness.node.test.ts';
import { EARLY } from './earlyGrid.node.test.ts';

describeAdaptGrid(
  'rana i srednja adaptacija (pouka 23) — deo 2/4',
  'earlyGrid',
  earlyFlows,
  earlyGridBases,
  2,
  4,
  25,
  EARLY
);
