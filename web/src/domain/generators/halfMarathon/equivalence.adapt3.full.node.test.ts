import { describe, it } from 'vitest';
import {
  adaptationBasesFor,
  checkAdaptation,
  partIndexOf
} from '@/test/halfMarathon/equivalenceKit';
import { hmSetup as s } from '@/test/halfMarathon/equivalence';

/* PUN NIVO (`TEST_FULL=1`; brz nivo ovaj fajl ne uključuje, v. `vitest.config.ts`): jedan deo testa
   „adaptacija" glavnog fajla `equivalence.node.test.ts`. Indeks dela je u imenu fajla (`partIndexOf`), broj
   delova je `s.parts.adaptation` (`src/test/halfMarathon/equivalence.ts`); deo 1 je u glavnom fajlu, koji proverava i da postoje
   tačno delovi 2…s.parts.adaptation. Zajednički kod: `src/test/halfMarathon/equivalenceKit.ts`. */

const k = partIndexOf(import.meta.url, 'adapt');

describe(`HM izdvojen generator = stari mehanizam (polazno stanje) · pun nivo, deo ${k}`, () => {
  it(
    `adaptacija: svi tokovi daju identičan izlaz i ne menjaju ulaze (deo ${k}/${s.parts.adaptation})`,
    { timeout: 1_200_000 },
    () => checkAdaptation(s, adaptationBasesFor(s, k), false)
  );
});
