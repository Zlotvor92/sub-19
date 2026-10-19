/* Gusta mreža nedelje 1 (MAR-02): svaki broj dana × obim korak 0,1 × VDOT 30–80 korak 0,5 (12 ned, raspored
   A, trka nedelja) = 157 954 plana. Brz nivo: svaki 40. unutar broja dana; pun nivo: deo 1/8 ovde, delovi 2–8
   u dense.<k>.full.node.test.ts. */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { FULL, part, sample } from '@/test/level';
import { DENSE, DENSE_PARTS, describeDense } from './dense.harness.node.test.ts';

describeDense(
  `gusta mreža ned 1: 157 954 plana${FULL ? ` — deo 1/${DENSE_PARTS}` : ' — uzorak'}`,
  FULL ? part(DENSE, 1, DENSE_PARTS) : sample(DENSE, 40, (g) => String(g.days))
);

it('gusta mreža: 20 301 + 30 401 + 45 551 + 60 701 ulaza; delovi 2…N postoje', () => {
  expect([3, 4, 5, 6].map((n) => DENSE.filter((g) => g.days === n).length)).toEqual([
    20301, 30401, 45551, 60701
  ]);
  const here = dirname(fileURLToPath(import.meta.url));
  for (let k = 2; k <= DENSE_PARTS; k++)
    expect(existsSync(join(here, `dense.${k}.full.node.test.ts`))).toBe(true);
  expect(existsSync(join(here, `dense.${DENSE_PARTS + 1}.full.node.test.ts`))).toBe(false);
});
