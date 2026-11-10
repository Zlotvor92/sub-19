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

it('pun nivo: deo 2 postoji; mreža 04 ima 30 baznih planova i 6584 toka', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  expect(existsSync(join(here, 'adaptGrid.2.full.node.test.ts'))).toBe(true);
  expect(existsSync(join(here, 'adaptGrid.3.full.node.test.ts'))).toBe(false);
  expect(BASES).toHaveLength(30);
  // P5-F1 (marathon-v2.10.0): plan sa rezultatom ima test → asOf preTest i u planovima sa rezultatom (6236 → 6468).
  // marathon-v2.12.0 (S4 O2): plan po osećaju od 12–13 nedelja ima test u razvoju → asOf preTest i u njima (6468 → 6584).
  expect(casesOf(BASES)).toHaveLength(6584);
});
