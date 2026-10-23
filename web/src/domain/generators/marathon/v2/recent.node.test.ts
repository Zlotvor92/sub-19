/* Mreža skorašnjeg najdužeg trka (M13a, MAR-02): 35 910 ulaza. Brz nivo: svaki 10. unutar broja dana i r;
   pun nivo: deo 1/3 ovde, delovi 2–3 u recent.<k>.full.node.test.ts. */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { FULL, part, sample } from '@/test/level';
import { describeRecent, RECENT, RECENT_PARTS } from './recent.harness.node.test.ts';

describeRecent(
  `mreža skorašnjeg najdužeg (M13a): 35 910 ulaza${FULL ? ` — deo 1/${RECENT_PARTS}` : ' — uzorak'}`,
  FULL
    ? part(RECENT, 1, RECENT_PARTS)
    : sample(RECENT, 10, (g) => `${g.days}-${String(g.input['recentLongRunKm'])}`)
);

it('mreža M13a: 35 910 ulaza; delovi 2…N postoje', () => {
  expect(RECENT).toHaveLength(35910);
  const here = dirname(fileURLToPath(import.meta.url));
  for (let k = 2; k <= RECENT_PARTS; k++)
    expect(existsSync(join(here, `recent.${k}.full.node.test.ts`))).toBe(true);
  expect(existsSync(join(here, `recent.${RECENT_PARTS + 1}.full.node.test.ts`))).toBe(false);
});
