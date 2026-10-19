/* Pun nivo (TEST_FULL=1) rane mreže iz earlyGrid.node.test.ts: deo 4/4 — planovi part(earlyGridBases(), 4, 4). */

import { describeAdaptGrid, earlyFlows, earlyGridBases } from './adaptGrid.harness.node.test.ts';
import { EARLY } from './earlyGrid.node.test.ts';

describeAdaptGrid(
  'rana i srednja adaptacija (pouka 23) — deo 4/4',
  'earlyGrid',
  earlyFlows,
  earlyGridBases,
  4,
  4,
  25,
  EARLY
);
