/* Mreža 01 (MASTER § 3): 4 dana × 12–24 ned × obim 35–65 km (korak 5) × VDOT {30,35,40,45,50,55,60,70} ×
   rasporedi A/B/C × trka sub/ned = 4368 planova. Brz nivo: uzorak (svaki 6. unutar broja nedelja + imenovani
   rubni slučajevi); pun nivo: deo 1/3 ovde, delovi 2–3 u grid.<k>.full.node.test.ts. Snimanje bazne linije
   (MARATHON_V2_WRITE_BASELINE=1) samo uz TEST_FULL=1 i samo ovaj fajl (ceo skup). */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { FULL, part, sample } from '@/test/level';
import { ALL, describeGrid, GRID_PARTS, WRITE } from './grid.harness.node.test.ts';

/** Imenovani rubni slučajevi: najmanji/najveći obim i VDOT, najkraća/najduža priprema, taper bez MP. */
const NAMED = new Set([
  '12w-35km-v30-A-sat',
  '12w-35km-v70-C-sun',
  '24w-65km-v30-B-sat',
  '24w-65km-v70-A-sun',
  '16w-45km-v45-A-sun',
  '20w-55km-v35-A-sun',
  '18w-40km-v60-C-sat'
]);

const inputs = FULL
  ? WRITE
    ? ALL
    : part(ALL, 1, GRID_PARTS)
  : sample(
      ALL,
      6,
      (g) => String(g.weeks),
      (g) => NAMED.has(g.id)
    );

describeGrid(
  `mreža 01: 4368 planova (4 dana × 12–24 ned)${FULL ? (WRITE ? '' : ` — deo 1/${GRID_PARTS}`) : ' — uzorak'}`,
  inputs,
  () => {
    it('pun nivo: postoje tačno delovi 2…N kao zasebni fajlovi', () => {
      const here = dirname(fileURLToPath(import.meta.url));
      for (let k = 2; k <= GRID_PARTS; k++)
        expect(existsSync(join(here, `grid.${k}.full.node.test.ts`))).toBe(true);
      expect(existsSync(join(here, `grid.${GRID_PARTS + 1}.full.node.test.ts`))).toBe(false);
      expect(ALL).toHaveLength(4368);
    });
  }
);
