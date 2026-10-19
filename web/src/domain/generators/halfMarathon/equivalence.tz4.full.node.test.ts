import { afterEach, describe, it, vi } from 'vitest';
import { checkTimezone, partIndexOf } from '@/test/halfMarathon/equivalenceKit';
import { hmSetup as s } from '@/test/halfMarathon/equivalence';

/* PUN NIVO (`TEST_FULL=1`; brz nivo ovaj fajl ne uključuje, v. `vitest.config.ts`): jedan deo testa
   „vremenska zona, sat i slučajnost" glavnog fajla `equivalence.node.test.ts`. Indeks dela je u imenu fajla (`partIndexOf`), broj
   delova je `s.parts.timezone` (`src/test/halfMarathon/equivalence.ts`); deo 1 je u glavnom fajlu, koji proverava i da postoje
   tačno delovi 2…s.parts.timezone. Zajednički kod: `src/test/halfMarathon/equivalenceKit.ts`. */

const k = partIndexOf(import.meta.url, 'tz');

describe(`HM izdvojen generator = stari mehanizam (polazno stanje) · pun nivo, deo ${k}`, () => {
  it(
    `vremenska zona, sat i slučajnost ne utiču na rezultat (deo ${k}/${s.parts.timezone})`,
    { timeout: 900_000 },
    () => checkTimezone(s, k)
  );

  afterEach(() => vi.restoreAllMocks());
});
