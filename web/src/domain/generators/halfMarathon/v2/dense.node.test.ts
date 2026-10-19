/* Gusta mreža nedelje 1 (odluka organizatora posle zaustavljanja faf8807): obim 30,0–60,0 km korak 0,1 × VDOT
   30–80 korak 0,5, 10 nedelja, raspored A = 30 401 plan — K1 = 0, nedelja 1 ispod trenutnog obima samo uz dugi
   na 150 min (pouka 9), invarijante. Brz nivo: svaki 40. unutar obima po 1 km; pun: delovi 1–3 (part). */

import { expect, it } from 'vitest';
import { FULL, part, sample } from '@/test/level';
import { DENSE_PARTS, describeDense } from './dense.harness.node.test.ts';
import { denseWeek1Inputs } from './testInputs.ts';

const ALL = denseWeek1Inputs();
describeDense(
  'gusta mreža nedelje 1: 30 401 plan',
  FULL ? part(ALL, 1, DENSE_PARTS) : sample(ALL, 40, (g) => `${Math.floor(g.km)}`)
);

it('gusta mreža: 301 obim × 101 VDOT', () => {
  expect(ALL).toHaveLength(30401);
  expect(DENSE_PARTS).toBe(3);
});
