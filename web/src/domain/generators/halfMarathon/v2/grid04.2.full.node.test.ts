/* Pun nivo (TEST_FULL=1) mreže 04 iz grid04.node.test.ts: deo 2/2 — bazni planovi part(adaptBases(), 2, 2). */

import { adaptBases } from './adaptInputs.ts';
import { describeAdaptGrid, grid04Flows } from './adaptGrid.harness.node.test.ts';
import { GRID04 } from './grid04.node.test.ts';

describeAdaptGrid(
  'mreža 04: adaptacija (MASTER § 3) — deo 2/2',
  'grid04',
  grid04Flows,
  adaptBases,
  2,
  2,
  12,
  GRID04
);
