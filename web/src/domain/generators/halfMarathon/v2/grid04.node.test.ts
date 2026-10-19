/* HM v2 Segment 04: mreža 04 (MASTER § 3) — 33 bazna plana × asOf mreže 04 × 17 scenarija (+ drugi korak lanca)
   + bol 5 i 8 na svaki dan nedelje 2 i nedelje sredine plana. K1 = 0 odbijanja, adaptInvariants prazno,
   determinizam. Brz nivo: svaki 12. tok unutar scenarija; pun: deo 1/2 ovde, deo 2 u grid04.2.full.node.test.ts. */

import { adaptBases } from './adaptInputs.ts';
import { describeAdaptGrid, grid04Flows } from './adaptGrid.harness.node.test.ts';

export const GRID04 = { plans: 33, flows: 4919 };

describeAdaptGrid(
  'mreža 04: adaptacija (MASTER § 3)',
  'grid04',
  grid04Flows,
  adaptBases,
  1,
  2,
  12,
  GRID04
);
