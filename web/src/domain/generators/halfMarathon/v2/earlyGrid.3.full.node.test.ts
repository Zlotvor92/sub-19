/* Pun nivo (TEST_FULL=1) rane mreže iz earlyGrid.node.test.ts: deo 3/4 — planovi part(earlyGridBases(), 3, 4). */

import { describeAdaptGrid, earlyFlows, earlyGridBases } from './adaptGrid.harness.node.test.ts';
import { EARLY } from './earlyGrid.node.test.ts';

describeAdaptGrid(
  'rana i srednja adaptacija (pouka 23) — deo 3/4',
  'earlyGrid',
  earlyFlows,
  earlyGridBases,
  3,
  4,
  25,
  EARLY
);
