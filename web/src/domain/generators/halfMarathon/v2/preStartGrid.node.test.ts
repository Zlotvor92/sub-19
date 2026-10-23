/* HM v2 Faza 4a N10.7 (pouka 23, 34): trajna rana mreža PRE STARTA — planovi rane mreže (earlyGridBases) × asOf
   start − 1/− 3/− 6 × svih 17 scenarija mreže 04 (+ drugi korak lanca; kao 4a lib SCENARIOS). 0 odbijanja,
   adaptInvariants prazno. Brz nivo: svaki 25. tok unutar scenarija; pun: deo 1/2 ovde, deo 2 u
   preStartGrid.2.full.node.test.ts. */

import { describeAdaptGrid, earlyGridBases, preStartFlows } from './adaptGrid.harness.node.test.ts';

export const PRE_START = { plans: 171, flows: 8721 };

describeAdaptGrid(
  'rana mreža pre starta: 17 scenarija (pouka 23, 34)',
  'preStartGrid',
  preStartFlows,
  earlyGridBases,
  1,
  2,
  25,
  PRE_START
);
