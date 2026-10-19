import { describe, it } from 'vitest';
import { checkDecisions, decisionBasesFor, partIndexOf } from '@/test/halfMarathon/equivalenceKit';
import { marathonSetup as s } from '@/test/marathon/equivalence';

/* PUN NIVO (`TEST_FULL=1`; brz nivo ovaj fajl ne uključuje, v. `vitest.config.ts`): jedan deo testa
   „odluke o pripremi" glavnog fajla `equivalence.node.test.ts`. Indeks dela je u imenu fajla (`partIndexOf`), broj
   delova je `s.parts.decisions` (`src/test/marathon/equivalence.ts`); deo 1 je u glavnom fajlu, koji proverava i da postoje
   tačno delovi 2…s.parts.decisions. Zajednički kod: `src/test/halfMarathon/equivalenceKit.ts`. */

const k = partIndexOf(import.meta.url, 'decisions');

describe(`maratonski izdvojen generator = stari mehanizam (polazno stanje) · pun nivo, deo ${k}`, () => {
  it(
    `odluke o pripremi (produženje, polumaraton/10K kroz predaju, povratni režim) su identične (deo ${k}/${s.parts.decisions})`,
    { timeout: 900_000 },
    () => checkDecisions(s, decisionBasesFor(s, k))
  );
});
