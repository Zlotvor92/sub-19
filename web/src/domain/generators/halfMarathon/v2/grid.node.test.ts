/* Mreža 01 (MASTER § 3): 4 dana × nedelje 10–20 × obim 30–60 km (korak 5) × VDOT {30…70} × 3 rasporeda × trka
   sub/ned = 3696 planova (hm-v2.0.0): K1 = 0, nezavisne invarijante (gridInvariants.ts), determinizam, bazna
   linija segment01.baseline.json. Brz nivo: uzorak (svaki 5. unutar nedelje × obima, + imenovani primeri);
   pun: deo 1/2 ovde, deo 2/2 u grid.2.full.node.test.ts. Bazna linija se piše samo uz TEST_FULL=1 i
   HM_V2_WRITE_BASELINE=1 nad celim skupom (ovaj fajl). */

import { expect, it } from 'vitest';
import { FULL, part, sample } from '@/test/level';
import { describeGrid, GRID_PARTS, WRITE } from './grid.harness.node.test.ts';
import { gridInputs } from './testInputs.ts';

const ALL = gridInputs();
const NAMED = new Set([
  '10w-30km-v45-A-sun',
  '16w-50km-v30-C-sat',
  '18w-60km-v55-B-sun',
  '12w-30km-v70-A-sun'
]);

describeGrid(
  'mreža 01: 3696 planova (4 dana × 10–20 ned × 30–60 km × VDOT × raspored × trka)',
  FULL
    ? WRITE
      ? ALL
      : part(ALL, 1, GRID_PARTS)
    : sample(
        ALL,
        5,
        (g) => `${g.weeks}/${g.km}`,
        (g) => NAMED.has(g.id)
      ),
  () => {
    it('mreža ima tačno 3696 ulaza; svi delovi punog nivoa postoje', () => {
      expect(ALL).toHaveLength(3696);
      expect(new Set(ALL.map((g) => g.id)).size).toBe(3696);
      expect(GRID_PARTS).toBe(2);
    });
  }
);
