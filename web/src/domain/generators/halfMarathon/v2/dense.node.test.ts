/* Gusta mreža nedelje 1 po broju dana (MASTER § 3, HM-02): obim reda H15 korak 0,1 × VDOT 30–80 korak 0,5, 10
   nedelja, raspored A — 3 d 20 301, 4 d 30 401, 5 d 40 501, 6 d 50 601 = 141 804 plana: K1 = 0, nedelja 1 ispod
   trenutnog obima samo uz dugi na apsolutnom plafonu (pouka 9, HI8), invarijante. Brz nivo: svaki 40. unutar
   dana × obima po 1 km; pun: delovi 1–8 (part; 2–8 u dense.<k>.full.node.test.ts). */

import { expect, it } from 'vitest';
import { FULL, part, sample } from '@/test/level';
import { DENSE_PARTS, describeDense } from './dense.harness.node.test.ts';
import { DAY_COUNTS, denseInputs } from './testInputs.ts';

const ALL = DAY_COUNTS.flatMap((n) => denseInputs(n));
describeDense(
  'gusta mreža nedelje 1: 141 804 plana (3–6 dana)',
  FULL
    ? part(ALL, 1, DENSE_PARTS)
    : sample(ALL, 40, (g) => `${g.id.slice(0, 2)}/${Math.floor(g.km)}`)
);

it('gusta mreža: obim reda × 101 VDOT po broju dana', () => {
  expect(DAY_COUNTS.map((n) => denseInputs(n).length)).toEqual([20301, 30401, 40501, 50601]);
  expect(ALL).toHaveLength(141804);
  expect(DENSE_PARTS).toBe(8);
});
