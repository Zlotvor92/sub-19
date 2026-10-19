/* Mreža 03 po osećaju (H16, MASTER § 3): lagan {270, 315, 360, 405, 450, 510} × 3–6 dana × obim reda H15 (korak
   5) × nedelje 10–20 × 3 rasporeda = 6336 planova (hm-v2.2.0): K1 = 0, nezavisne invarijante (gridInvariants.ts:
   E = lagan ± 15 s, procena VDOT-a, RPE po zoni, tačno jedan test 5 km u poslednjoj nedelji baze, bez prognoze i
   cilja), determinizam, bazna linija segment03-feel.baseline.json. Brz nivo: uzorak (svaki 5. unutar dana ×
   tempa × nedelja, + imenovani primeri); pun: deo 1/3 ovde, delovi 2–3 u feelGrid.<k>.full.node.test.ts. */

import { expect, it } from 'vitest';
import { FULL, part, sample } from '@/test/level';
import { describeGrid03, FEEL_PARTS, WRITE } from './grid03.harness.node.test.ts';
import { feelInputs } from './testInputs.ts';

const ALL = feelInputs();
const NAMED = new Set([
  'f-d3-10w-25km-e510-A',
  'f-d3-12w-30km-e450-A',
  'f-d4-12w-40km-e360-A',
  'f-d4-16w-60km-e270-B',
  'f-d5-14w-50km-e405-C',
  'f-d6-20w-90km-e270-A'
]);

describeGrid03(
  'mreža 03 po osećaju: 6336 planova (lagan × 3–6 dana × obim reda × 10–20 ned × raspored)',
  'feel',
  FULL
    ? WRITE
      ? ALL
      : part(ALL, 1, FEEL_PARTS)
    : sample(
        ALL,
        5,
        (g) => `${g.days}/${g.easy}/${g.weeks}`,
        (g) => NAMED.has(g.id)
      ),
  () => {
    it('mreža ima tačno 6336 ulaza (3 d 990, 4 d 1386, 5 d 1782, 6 d 2178); svi delovi punog nivoa postoje', () => {
      expect(ALL).toHaveLength(6336);
      expect(new Set(ALL.map((g) => g.id)).size).toBe(6336);
      expect([3, 4, 5, 6].map((n) => ALL.filter((g) => g.days === n).length)).toEqual([
        990, 1386, 1782, 2178
      ]);
      expect(FEEL_PARTS).toBe(3);
    });
  }
);
