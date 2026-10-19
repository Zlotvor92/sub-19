/* Mreža 04 (MASTER § 3, M18): brz nivo — svaki 12. tok unutar scenarija; pun nivo — deo 1/2 ovde, deo 2 u
   adaptGrid.2.full.node.test.ts (zajedno svih 6236 tokova). */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { FULL, part, sample } from '@/test/level';
import { ADAPT_PARTS, BASES, casesOf, describeAdaptGrid } from './adaptGrid.harness.node.test.ts';

describeAdaptGrid(
  `mreža 04: ${BASES.length} baznih planova × asOf × 17 scenarija${FULL ? ` — deo 1/${ADAPT_PARTS}` : ' — uzorak'}`,
  () => (FULL ? casesOf(part(BASES, 1, ADAPT_PARTS)) : sample(casesOf(BASES), 12, (c) => c.s))
);

it('pun nivo: deo 2 postoji; mreža 04 ima 30 baznih planova i 6236 tokova', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  expect(existsSync(join(here, 'adaptGrid.2.full.node.test.ts'))).toBe(true);
  expect(existsSync(join(here, 'adaptGrid.3.full.node.test.ts'))).toBe(false);
  expect(BASES).toHaveLength(30);
  expect(casesOf(BASES)).toHaveLength(6236);
});
