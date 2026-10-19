/* HM v2 Segment 04 (pouka 23): trajna mreža rane i srednje adaptacije — asOf sreda i kraj ned 1, sreda svake
   nedelje 2…N − 1, kraj nedelje pre svake posebne nedelje (test, rasterećenje, taper) × pauza 10/20, bol 5/8,
   pauza 10 + bol 5, manjak, umor. 0 odbijanja, adaptInvariants prazno. Brz nivo: svaki 25. tok unutar scenarija;
   pun: deo 1/4 ovde, delovi 2–4 u earlyGrid.<k>.full.node.test.ts. */

import { describeAdaptGrid, earlyFlows, earlyGridBases } from './adaptGrid.harness.node.test.ts';

export const EARLY = { plans: 171, flows: 23471 };

describeAdaptGrid(
  'rana i srednja adaptacija (pouka 23)',
  'earlyGrid',
  earlyFlows,
  earlyGridBases,
  1,
  4,
  25,
  EARLY
);
