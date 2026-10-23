/* Mreža 02 (MASTER § 3): svaki broj dana (3–6) × nedelje 10–20 × obim reda H15 (korak 5) × VDOT {30…70} × 3
   rasporeda po broju dana × trka sub/ned = 16 896 planova (hm-v2.1.0): K1 = 0, nezavisne invarijante
   (gridInvariants.ts), determinizam, regresija 4 dana prema HM-01 (segment01.baseline.json i
   segment01.norm-hashes-3979237.json), bazna linija segment02.baseline.json. Brz nivo: uzorak (svaki 5. unutar
   dana × nedelje × obima, + imenovani primeri); pun: deo 1/4 ovde, delovi 2–4 u grid.<k>.full.node.test.ts.
   Bazna linija se piše samo uz TEST_FULL=1 i HM_V2_WRITE_BASELINE=1 nad celim skupom (ovaj fajl). */

import { expect, it } from 'vitest';
import { FULL, part, sample } from '@/test/level';
import { describeGrid, GRID_PARTS, WRITE } from './grid.harness.node.test.ts';
import { grid02Inputs } from './testInputs.ts';

const ALL = grid02Inputs();
const NAMED = new Set([
  'd4-10w-30km-v45-A-sun',
  'd4-16w-50km-v30-C-sat',
  'd4-18w-60km-v55-B-sun',
  'd4-12w-30km-v70-A-sun',
  'd3-14w-35km-v45-A-sun',
  'd3-20w-35km-v30-A-sun',
  'd5-12w-50km-v45-A-sun',
  'd6-16w-90km-v60-A-sun'
]);

describeGrid(
  'mreža 02: 16 896 planova (3–6 dana × 10–20 ned × obim reda × VDOT × raspored × trka)',
  FULL
    ? WRITE
      ? ALL
      : part(ALL, 1, GRID_PARTS)
    : sample(
        ALL,
        5,
        (g) => `${g.days}/${g.weeks}/${g.km}`,
        (g) => NAMED.has(g.id)
      ),
  () => {
    it('mreža ima tačno 16 896 ulaza (3 d 2640, 4 d 3696, 5 d 4752, 6 d 5808); svi delovi punog nivoa postoje', () => {
      expect(ALL).toHaveLength(16896);
      expect(new Set(ALL.map((g) => g.id)).size).toBe(16896);
      expect([3, 4, 5, 6].map((n) => ALL.filter((g) => g.days === n).length)).toEqual([
        2640, 3696, 4752, 5808
      ]);
      expect(GRID_PARTS).toBe(4);
    });
  }
);
