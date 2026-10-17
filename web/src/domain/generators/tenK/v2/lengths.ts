/* D13 — dužine dugog i laganih trčanja (jedini vlasnik). Rad u desetinkama km (korak 0,1). Dugi uzima
   najveću dozvoljenu dužinu (≤ 33 % cilja, ≤ 105 min sporim E, i da lagan ostane ≥ 3 km); lagan dobija
   ostatak. Dugi ≥ svaki lagan je tvrdo pravilo: kad ne može da se ispuni, nedelja nije izvodljiva (D6). */

import { TEN_K_V2_POLICY as P } from './policy.ts';
import type { Paces } from './types.ts';

const EPS = 1e-9;
const EASY_MIN10 = Math.round(P.lengths.easyMinKm * 10);

/** D13: najduži dozvoljen dugi [0,1 km] za cilj nedelje. */
export function longCap10(target10: number, p: Paces): number {
  const share = Math.floor(P.lengths.longMaxShare * target10 + EPS);
  const time = Math.floor((P.lengths.longMaxSec / p.E.slow) * 10 + EPS);
  return Math.min(share, time);
}

/** Jedan lagan dan: dugi do `cap10`, lagan = ostatak (≥ 3 km, ≤ dugi). Ostatak u stotinkama km. */
function oneEasy(rest100: number, cap10: number): { long10: number; easy10: number[] } | null {
  const long10 = Math.min(cap10, Math.floor((rest100 - EASY_MIN10 * 10) / 10));
  if (long10 < EASY_MIN10) return null;
  const easy10 = Math.round((rest100 - long10 * 10) / 10);
  if (easy10 < EASY_MIN10 || easy10 > long10) return null;
  return { long10, easy10: [easy10] };
}

/** Nedelja izgradnje: 2 kvaliteta (zbir `quality100`) + dugi + 1 lagan. */
export function buildLengths(
  target10: number,
  quality100: number,
  p: Paces
): { long10: number; easy10: number[] } | null {
  return oneEasy(target10 * 10 - quality100, longCap10(target10, p));
}

/** D7: taper — dugi ≤ 0,75 × najduži dugi plana (i D13). */
export function taperLengths(
  target10: number,
  quality100: number,
  longest10: number,
  p: Paces
): { long10: number; easy10: number[] } | null {
  const cap10 = Math.min(longCap10(target10, p), Math.floor(P.taper.longFactor * longest10 + EPS));
  return oneEasy(target10 * 10 - quality100, cap10);
}

/** D5: rasterećenje — dugi = 0,8 × poslednji ne-rasteretni dugi (i ≤ D13); ostatak na 2 lagana dana. */
export function deloadLengths(
  target10: number,
  quality100: number,
  lastLong10: number,
  p: Paces
): { long10: number; easy10: number[] } | null {
  const long10 = Math.min(
    Math.floor(P.deload.longFactor * lastLong10 + EPS),
    longCap10(target10, p)
  );
  const total10 = Math.round((target10 * 10 - quality100 - long10 * 10) / 10);
  const a = Math.ceil(total10 / 2);
  const b = total10 - a;
  if (b < EASY_MIN10 || a > long10) return null;
  return { long10, easy10: [a, b] };
}
