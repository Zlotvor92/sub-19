/* PREDAJA DRUGOM GENERATORU — format izvora (aplikacioni sloj, bez trenerskih odluka).

   V1b: v1 ciljevi predaje „kraća distanca" (5K/10K/HM v1 `handoffFuture`) i pogled izvora v2 za v1 cilj
   (`sourceViewForV1`, `mondayWeeks`) obrisani su zajedno sa v1 generatorima; cilj je uvek v2 te distance
   (`select.shorterHandoffForV2Source`). Ostaje opis formata plana izvora v2 koji adapter izvora (`<distanca>/v2/app/`)
   daje kao argument — jedino mesto spiska po izvoru. */

/** Format plana izvora v2: ključ objekta plana v2, ostali ključevi plana koje piše samo v2 (npr. prefiks nedelja izvora
 *  predaje) i meta ključevi koje piše samo v2. */
export interface SourceFormat {
  readonly planKey: string;
  readonly planKeys?: readonly string[];
  readonly metaKeys: readonly string[];
}
