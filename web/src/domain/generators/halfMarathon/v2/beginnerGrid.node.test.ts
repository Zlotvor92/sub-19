/* Mreža 03 početnik (H17, MASTER § 3): po osećaju {330, 390, 450, 510} i VDOT {30, 35, 40} × 4–5 dana × obim H17
   (korak 5) × nedelje 12–20 × 3 rasporeda = 1890 planova (hm-v2.2.0): K1 = 0 (HI14: skraćen dugi rasterećenja
   pri najmanjem obimu, odluka posle SEGMENT-03-STOP.md), nezavisne invarijante (uvod 2 ned bez kvaliteta, ≤ 1 kvalitet bez I/R, T kontinuirano od
   1,5 km, rast 5 % (1,0–2,0 km), vrh min(1,4×, +15), dugi ≤ 135 min, WU/CD 15/10, bez testa, upozorenje < 14 km),
   determinizam, bazna linija segment03-beginner.baseline.json. Brz nivo: uzorak (svaki 3. unutar dana × tempa ×
   obima); pun: cela mreža. */

import { expect, it } from 'vitest';
import { FULL, sample } from '@/test/level';
import { describeGrid03 } from './grid03.harness.node.test.ts';
import { beginnerInputs } from './testInputs.ts';

const ALL = beginnerInputs();
const NAMED = new Set(['b-d4-16w-30km-e450-A', 'b-d5-20w-45km-v40-B', 'b-d4-12w-40km-e330-C']);

describeGrid03(
  'mreža 03 početnik: 1890 planova (tempo × 4–5 dana × obim × 12–20 ned × raspored)',
  'beginner',
  FULL
    ? ALL
    : sample(
        ALL,
        3,
        (g) => `${g.days}/${g.easy ?? g.vdot}/${g.km}`,
        (g) => NAMED.has(g.id)
      ),
  () => {
    it('mreža ima tačno 1890 ulaza (po osećaju 1080, sa rezultatom 810); ', () => {
      expect(ALL).toHaveLength(1890);
      expect(new Set(ALL.map((g) => g.id)).size).toBe(1890);
      expect([
        ALL.filter((g) => g.easy !== null).length,
        ALL.filter((g) => g.vdot !== null).length
      ]).toEqual([1080, 810]);
    });
  }
);
