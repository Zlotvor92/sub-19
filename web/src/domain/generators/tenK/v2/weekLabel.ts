/* Segment 3i: broj nedelje u PORUKAMA jezgra (napomene nedelja i plana, razlozi adaptacije, upozorenja, odbijanja).
   Plan cilja predaje „kraća distanca" nosi nedelje izvora ispred (`input.weekOffset` = broj nedelja prefiksa, uslov
   poznat unapred, uslov 4); kalendar prikazuje nedelju v2 `i` kao `weekOffset + i`. Jedino mesto gde poruka dobija
   broj nedelje — unutrašnji indeksi, polja `week` i poređenja ostaju v2. Bez offseta (0) → isti broj (bajt-isto). */

import type { TenKV2Input } from './types.ts';

/** Broj nedelje v2 `n` kako ga prikazuje kalendar plana. */
export function weekLabel(input: Pick<TenKV2Input, 'weekOffset'>, n: number): number {
  return (input.weekOffset ?? 0) + n;
}
