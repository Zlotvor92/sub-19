/* FAZA 3 (segment 3e, DESIGN.md § 3 P1, § 8 O1) — okidač ponude „kraća distanca" u maratonu v2. Jedino mesto ove
   odluke (kopija obrasca HM v2 3c, ne uvoz).

   Ponuda postoji kada je plan posle prihvaćene adaptacije ispod praga najdužeg dugog MARATHON_LONG_SHORT
   (`lengths.longShortOf`, ista funkcija kao validator i konstruktor; 26 km, početnik 24 km — red tabele iz
   `checkInput`, kao validator). Plan generatora za isti ulaz (bez činjenica) NIJE ispod praga. Trka mora biti posle
   `asOf`.

   N11/M13: kad najduži dugi ograničava trajanje (150 min), validator ne daje upozorenje nego rečenicu u opisu plana.
   Okidač čita isti uslov praga (`longShortOf(...) !== null`), ne tekst upozorenja: i dugi ograničen trajanjem je ispod
   praga (npr. sporiji rezultat ili test 5 km → kraći dugi po trajanju). Ponuda nije prelaz na silu: „zadrži plan v2"
   je uvek moguće.

   „Pre adaptacije" je plan generatora za isti ulaz. On se izvodi iz sačuvanog plana, pa nema novog polja u planu. */

import { generateMarathonV2 } from './generate.ts';
import { checkInput } from './input.ts';
import { longShortOf } from './lengths.ts';
import type { IsoDate, MarathonV2Plan } from './types.ts';

/** Prag MARATHON_LONG_SHORT za ulaz plana [km] (red tabele kao validator); `null` kad ulaz nije ispravan. */
export function longShortKmOf(plan: MarathonV2Plan): number | null {
  const chk = checkInput(plan.input);
  return chk.ok ? chk.rule.longShortKm : null;
}

/** Plan je ispod praga MARATHON_LONG_SHORT (isti uslov kao validator, bez obzira na uzrok — udeo ili trajanje). */
export function belowLongShort(plan: MarathonV2Plan, longShortKm: number): boolean {
  return longShortOf(plan.weeks, longShortKm, plan.paces) !== null;
}

/** O1: adaptirani plan je ispod praga, a plan generatora za isti ulaz nije; trka je posle `asOf` (bez `asOf`: ne
 *  proverava se — pozivalac je već proverio datum). Plan bez adaptacije nikad nema ponudu. */
export function shorterOffer(plan: MarathonV2Plan, asOf?: IsoDate): boolean {
  if (!plan.adaptation) return false;
  if (asOf !== undefined && !(plan.input.raceDate > asOf)) return false;
  const km = longShortKmOf(plan);
  if (km === null || !belowLongShort(plan, km)) return false;
  const born = generateMarathonV2(plan.input);
  return born.ok && !belowLongShort(born.plan, km);
}
