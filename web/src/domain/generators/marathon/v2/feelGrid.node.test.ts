/* Mreža 03 po osećaju (M16): lagan {270,315,360,405,450,510} × 3–6 dana × obim po redu (korak 5) × 12–24 ned ×
   A/B/C = 8190 planova. Brz nivo: uzorak (svaki 6. po broju dana i nedeljama + imenovani); pun nivo: deo 1/3
   ovde, 2–3 u feelGrid.<k>.full.node.test.ts. Snimanje bazne linije (MARATHON_V2_WRITE_BASELINE=1) samo uz
   TEST_FULL=1 i samo ovaj fajl (ceo skup). */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { FULL, part, sample } from '@/test/level';
import { WRITE } from './grid.harness.node.test.ts';
import { describeFeel, FEEL, FEEL_PARTS } from './grid03.harness.node.test.ts';

/** Rubni slučajevi: test u rasterećenju (najmanji obim reda, 14–16 ned), najbrži/najsporiji lagan. */
const NAMED = new Set([
  'feel-d3-14w-30km-e270-A',
  'feel-d4-16w-35km-e360-B',
  'feel-d5-15w-40km-e405-C',
  'feel-d6-14w-50km-e270-A',
  'feel-d3-24w-50km-e510-C',
  'feel-d6-24w-110km-e270-B',
  'feel-d4-12w-65km-e510-A'
]);

const inputs = FULL
  ? WRITE
    ? FEEL
    : part(FEEL, 1, FEEL_PARTS)
  : sample(
      FEEL,
      6,
      (g) => `${g.days}-${g.weeks}`,
      (g) => NAMED.has(g.id)
    );

describeFeel(
  `mreža 03 po osećaju: 8190 planova${FULL ? (WRITE ? '' : ` — deo 1/${FEEL_PARTS}`) : ' — uzorak'}`,
  inputs,
  () => {
    it('pun nivo: delovi 2…N kao zasebni fajlovi; veličina mreže', () => {
      const here = dirname(fileURLToPath(import.meta.url));
      for (let k = 2; k <= FEEL_PARTS; k++)
        expect(existsSync(join(here, `feelGrid.${k}.full.node.test.ts`))).toBe(true);
      expect(existsSync(join(here, `feelGrid.${FEEL_PARTS + 1}.full.node.test.ts`))).toBe(false);
      expect(FEEL).toHaveLength(8190);
      for (const id of NAMED)
        expect(
          FEEL.some((g) => g.id === id),
          id
        ).toBe(true);
    });
  }
);
