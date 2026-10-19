/* Mreža 03 početnika (M17): po osećaju {330,390,450,510} i VDOT {30,35,40} × 4–5 dana × obim početnika (korak 5) ×
   16–24 ned × A/B/C = 1890 planova. Brz nivo: uzorak (svaki 3. po broju dana i nedeljama + imenovani); pun nivo:
   cela mreža. Snimanje bazne linije (MARATHON_V2_WRITE_BASELINE=1) samo uz TEST_FULL=1. */

import { expect, it } from 'vitest';
import { FULL, sample } from '@/test/level';
import { BEGINNER, describeBeginner } from './grid03.harness.node.test.ts';

/** Rubni slučajevi: najmanji obim (rasterećenje i taper), oba osnova tempa. */
const NAMED = new Set([
  'beg-d4-16w-25km-e510-A',
  'beg-d4-24w-25km-v30-C',
  'beg-d5-16w-30km-e330-B',
  'beg-d5-24w-50km-v40-A',
  'beg-d4-20w-45km-e390-B'
]);

const inputs = sample(
  BEGINNER,
  3,
  (g) => `${g.days}-${g.weeks}`,
  (g) => NAMED.has(g.id)
);

describeBeginner(`mreža 03 početnika: 1890 planova${FULL ? '' : ' — uzorak'}`, inputs, () => {
  it('veličina mreže; imenovani slučajevi postoje', () => {
    expect(BEGINNER).toHaveLength(1890);
    for (const id of NAMED)
      expect(
        BEGINNER.some((g) => g.id === id),
        id
      ).toBe(true);
  });
});
