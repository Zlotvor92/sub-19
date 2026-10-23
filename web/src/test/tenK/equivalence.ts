/* 10K EKVIVALENCIJA PO NIVOIMA (src/test/level.ts) — zajedničko za `domain/generators/tenK/equivalence.node.test.ts` i
   delove punog nivoa `equivalence.adapt<N>.full.node.test.ts`.

   - BRZ: uzorak baznih planova (svaki 9. unutar kategorije qa / seeded10k / edge10k, prvi uvek) + imenovani rubni
     `edge10k · lestvica` (run/walk lestvica) i `edge10k · iskusan` (greška generisanja) + svi QA događaji `event · …`.
   - PUN: bazni planovi podeljeni `part()`-om na `TEN_K_ADAPTATION_PARTS` delova; događaji idu u deo 1. Svaki deo poredi
     SVE redove reference svojih baznih planova, a svaki red reference ima tačno jednog vlasnika (`rowsByOwner`) — unija
     delova = cela referenca (14 267 redova), svaki red tačno jednom. */
import type { GeneratorApi } from '@/test/fiveK/legacyApi';
import { categoryOfName, pickRows, rowsByOwner, type ReferenceRow } from '@/test/fiveK/reference';
import type { GenerationCase } from '@/test/fiveK/scenarios';
import { FULL, logCompared, part, sample } from '@/test/level';
import { tenKAdaptationRows } from './reference';
import { tenKAdaptationBases } from './scenarios';

type Rows = Record<string, ReferenceRow>;

export const TEN_K_ADAPTATION_PARTS = 3;

/** Vlasnik redova originalnih QA događaja (`event · U0x · …`) u raspodeli redova po vlasniku. */
export const TEN_K_EVENT_OWNER = 'event';

const KEEP = /^edge10k · (lestvica|iskusan)$/;

/** Bazni planovi i događaji koje proverava deo `index` (1…`TEN_K_ADAPTATION_PARTS`) punog nivoa, odnosno uzorak brzog
    nivoa (tada `index` ne utiče). */
export function tenKAdaptationSlice(index: number): { bases: GenerationCase[]; events: boolean } {
  const all = tenKAdaptationBases();
  if (!FULL && index !== 1)
    throw new Error(`deo ${index} adaptacije 10K postoji samo u punom nivou`);
  if (!FULL)
    return {
      bases: sample(
        all,
        9,
        (b) => categoryOfName(b.name),
        (b) => KEEP.test(b.name)
      ),
      events: true
    };
  return { bases: part(all, index, TEN_K_ADAPTATION_PARTS), events: index === 1 };
}

/**
 * Adaptacija za deo `index` (v. `tenKAdaptationSlice`): izračunati redovi, deo reference koji im odgovara (SVI redovi
 * reference izabranih baznih planova i, ako su uključeni, događaja — u redosledu reference; beleži se `logCompared`) i
 * redovi reference bez vlasnika među SVIM baznim planovima i događajima (mora biti prazno).
 */
export function tenKAdaptationPart(
  api: GeneratorApi,
  reference: Rows,
  index: number
): { rows: Rows; expected: Rows; orphans: string[]; events: boolean } {
  const slice = tenKAdaptationSlice(index);
  const owners = [...tenKAdaptationBases().map((b) => b.name), TEN_K_EVENT_OWNER];
  const { byOwner, orphans } = rowsByOwner(Object.keys(reference), owners);
  const chosen = new Set(
    [...slice.bases.map((b) => b.name), ...(slice.events ? [TEN_K_EVENT_OWNER] : [])].flatMap(
      (o) => byOwner.get(o) ?? []
    )
  );
  const expected = pickRows(
    reference,
    Object.keys(reference).filter((n) => chosen.has(n))
  );
  logCompared('tenK.adaptation', Object.keys(expected));
  const rows = tenKAdaptationRows(api, undefined, reference, slice);
  return { rows, expected, orphans, events: slice.events };
}
