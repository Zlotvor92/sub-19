/* Mreža 02 (MASTER § 3): svaki broj dana 3–6 × 12–24 ned × obim po redu M15 (korak 5) × VDOT
   {30,35,40,45,50,55,60,70} × 3 rasporeda po broju dana × trka sub/ned = 21 840 planova (red 4 dana = mreža 01).
   Brz nivo: uzorak (svaki 6. unutar broja dana i nedelja + imenovani rubni slučajevi); pun nivo: deo 1/6 ovde,
   delovi 2–6 u grid.<k>.full.node.test.ts. Snimanje bazne linije (MARATHON_V2_WRITE_BASELINE=1) samo uz
   TEST_FULL=1 i samo ovaj fajl (ceo skup). */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { FULL, part, sample } from '@/test/level';
import { ALL, describeGrid, GRID_PARTS, WRITE } from './grid.harness.node.test.ts';

/** Imenovani rubni slučajevi: najmanji/najveći obim i VDOT svakog reda, najkraća/najduža priprema. */
const NAMED = new Set([
  'd4-12w-35km-v30-A-sat',
  'd4-12w-35km-v70-C-sun',
  'd4-24w-65km-v30-B-sat',
  'd4-24w-65km-v70-A-sun',
  'd4-16w-45km-v45-A-sun',
  'd4-18w-50km-v40-A-sat',
  'd3-12w-30km-v30-A-sun',
  'd3-24w-50km-v70-C-sat',
  'd3-16w-40km-v45-B-sun',
  'd5-12w-40km-v30-A-sat',
  'd5-24w-85km-v70-B-sun',
  'd5-18w-60km-v45-C-sun',
  'd6-12w-50km-v30-C-sat',
  'd6-24w-110km-v70-A-sun',
  'd6-20w-80km-v50-B-sat'
]);

const inputs = FULL
  ? WRITE
    ? ALL
    : part(ALL, 1, GRID_PARTS)
  : sample(
      ALL,
      6,
      (g) => `${g.days}-${g.weeks}`,
      (g) => NAMED.has(g.id)
    );

describeGrid(
  `mreža 02: 21 840 planova (3–6 dana × 12–24 ned)${FULL ? (WRITE ? '' : ` — deo 1/${GRID_PARTS}`) : ' — uzorak'}`,
  inputs,
  () => {
    it('pun nivo: postoje tačno delovi 2…N kao zasebni fajlovi; mreža po broju dana', () => {
      const here = dirname(fileURLToPath(import.meta.url));
      for (let k = 2; k <= GRID_PARTS; k++)
        expect(existsSync(join(here, `grid.${k}.full.node.test.ts`))).toBe(true);
      expect(existsSync(join(here, `grid.${GRID_PARTS + 1}.full.node.test.ts`))).toBe(false);
      expect(ALL).toHaveLength(21840);
      const by = (n: number) => ALL.filter((g) => g.days === n).length;
      expect([3, 4, 5, 6].map(by)).toEqual([3120, 4368, 6240, 8112]);
      for (const id of NAMED)
        expect(
          ALL.some((g) => g.id === id),
          id
        ).toBe(true);
    });
  }
);
