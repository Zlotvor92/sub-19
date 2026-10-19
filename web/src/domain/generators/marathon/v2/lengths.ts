/* M13 — dužine dugog i laganih trčanja (jedini vlasnik). Rad u desetinkama km (korak 0,1). Dugi uzima
   najveću dozvoljenu dužinu (≤ 40 % cilja, M15; ≤ 150 min sporim E; svaki lagan ≥ 5 km); lagani dele ostatak
   na jednake delove (razlika ≤ 0,1 km). Dugi ≥ svaki lagan je tvrdo pravilo (pouka 2): kad ne može da se
   ispuni, nedelja nije izvodljiva (M6). */

import { type DayRule, MARATHON_V2_POLICY as P } from './policy.ts';
import type { Paces } from './types.ts';

const EPS = 1e-9;
const EASY_MIN10 = Math.round(P.lengths.easyMinKm * 10);

export interface Lengths {
  long10: number;
  /** Lagani dani redom (raniji dan prvi). */
  easy10: number[];
}

/** M13: plafon dugog od 150 min sporim E [0,1 km]. */
export function longTimeCap10(p: Paces): number {
  return Math.floor((P.lengths.longMaxSec / p.E.slow) * 10 + EPS);
}

/** M13/M15: plafon dugog kao udeo cilja nedelje [0,1 km]. */
export function longShareCap10(target10: number, rule: DayRule): number {
  return Math.floor(rule.longMaxShare * target10 + EPS);
}

/** M13: najduži dozvoljen dugi [0,1 km] za cilj nedelje. */
export function longCap10(target10: number, rule: DayRule, p: Paces): number {
  return Math.min(longShareCap10(target10, rule), longTimeCap10(p));
}

/** `total10` na `n` jednakih delova u koraku 0,1 km; raniji dani dobijaju višak (razlika ≤ 0,1). */
export function splitEasy(total10: number, n: number): number[] {
  const each = Math.floor(total10 / n);
  return Array.from({ length: n }, (_, i) => each + (i < total10 - each * n ? 1 : 0));
}

/** `n` laganih dana: dugi do `cap10` (svaki lagan ≥ 5 km), lagani = ostatak (≥ 5 km, ≤ dugi). Ostatak u
    stotinkama km. */
function withEasy(rest100: number, cap10: number, n: number): Lengths | null {
  const long10 = Math.min(cap10, Math.floor((rest100 - n * EASY_MIN10 * 10) / 10));
  if (long10 < EASY_MIN10) return null;
  const easy10 = splitEasy(Math.round((rest100 - long10 * 10) / 10), n);
  if (easy10.some((e) => e < EASY_MIN10 || e > long10)) return null;
  return { long10, easy10 };
}

/** Nedelja izgradnje: kvalitet (zbir `quality100`) + dugi + `easyDays` laganih. */
export function buildLengths(
  target10: number,
  quality100: number,
  easyDays: number,
  rule: DayRule,
  p: Paces
): Lengths | null {
  return withEasy(target10 * 10 - quality100, longCap10(target10, rule, p), easyDays);
}

/** M7: nedelja tapera `step` (0 = N−2, 1 = N−1) — dugi ≤ udeo × najduži dugi plana (0,65 / 0,45) i ≤ M13. */
export function taperLengths(
  target10: number,
  quality100: number,
  easyDays: number,
  longest10: number,
  step: number,
  rule: DayRule,
  p: Paces
): Lengths | null {
  const cap10 = Math.min(
    longCap10(target10, rule, p),
    Math.floor(P.taper.weeks[step]!.longFactor * longest10 + EPS)
  );
  return withEasy(target10 * 10 - quality100, cap10, easyDays);
}

/** M5: rasterećenje — dugi = 0,8 × poslednji ne-rasteretni dugi (i ≤ M13); ostatak na `easyDays` jednakih
    laganih dana. */
export function deloadLengths(
  target10: number,
  quality100: number,
  easyDays: number,
  lastLong10: number,
  rule: DayRule,
  p: Paces
): Lengths | null {
  const long10 = Math.min(
    Math.floor(P.deload.longFactor * lastLong10 + EPS),
    longCap10(target10, rule, p)
  );
  const easy10 = splitEasy(Math.round((target10 * 10 - quality100 - long10 * 10) / 10), easyDays);
  if (easy10.some((e) => e < EASY_MIN10 || e > long10)) return null;
  return { long10, easy10 };
}
