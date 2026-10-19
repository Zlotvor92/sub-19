/* Pouka 28 (HI7, HI8, P1): mreža skorašnjeg najdužeg trka — recentLongRunKm 5–42 (korak 1) × svaki broj dana ×
   obim reda H15 (korak 5) × VDOT {30, 45, 70} × nedelje {10, 14, 20}, raspored A = 10 944 plana: jedina odbijanja
   su RECENT_LONG_TOO_SHORT (sa pragom; izmereno: samo nedelja 1, r ≤ 6 km, 3–4 dana); nezavisne invarijante
   (dugi svake nedelje ≤ max(1,1 × L, L + 1,0)); nedelja 1 ispod obima samo uz dugi na apsolutnom plafonu; skok
   dugog nedelja 1 → 2 ≤ max(10 %, 1 km). Brz nivo: svaki 8. unutar dana × r; pun: deo 1/4 ovde, delovi 2–4 u
   recent.<k>.full.node.test.ts (HM-06: jedan beforeAll celog skupa ≈ 82 s bio je blizu granice 120 s). Provere i
   harnes: recent.harness.node.test.ts. */

import { expect, it } from 'vitest';
import { FULL, part, sample } from '@/test/level';
import { ALL, describeRecent, EXCEPTIONS, RECENT_PARTS } from './recent.harness.node.test.ts';

describeRecent(
  'pouka 28: mreža skorašnjeg najdužeg trka (10 944 plana)',
  FULL
    ? part(ALL, 1, RECENT_PARTS)
    : sample(
        ALL,
        8,
        (g) => `${g.days}/${g.r}`,
        (g) => g.id in EXCEPTIONS
      ),
  () => {
    it('mreža ima 10 944 ulaza; 6 izuzetaka regresije (HI14 / pouka 33) je u mreži; svi delovi punog nivoa postoje', () => {
      expect(ALL).toHaveLength(10944);
      expect(ALL.filter((g) => g.id in EXCEPTIONS)).toHaveLength(6);
      expect(RECENT_PARTS).toBe(4);
    });
  }
);
