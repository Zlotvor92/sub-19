/* H13 — dužine dugog i laganih trčanja (jedini vlasnik). Rad u desetinkama km (korak 0,1). Dugi uzima
   najveću dozvoljenu dužinu (≤ udeo cilja po broju dana H15, ≤ 150 min sporim E, ≤ 24 km, u nedelji 1 ≤
   granica skorašnjeg najdužeg (pouka 28, HI7) i da svaki lagan ostane ≥ 4 km); lagani dele ostatak na jednake delove (razlika ≤ 0,1 km). Dugi ≥ svaki lagan je tvrdo pravilo
   (pouka 2): kad ne može da se ispuni, nedelja nije izvodljiva (H6). */

import { type DayRule, HM_V2_POLICY as P } from './policy.ts';
import type { Paces } from './types.ts';

const EPS = 1e-9;
export const EASY_MIN10 = Math.round(P.lengths.easyMinKm * 10);

export interface Lengths {
  long10: number;
  /** Lagani dani redom (raniji dan prvi). */
  easy10: number[];
}

/** H13: plafon dugog od 150 min sporim E [0,1 km]. */
export function longTimeCap10(p: Paces): number {
  return Math.floor((P.lengths.longMaxSec / p.E.slow) * 10 + EPS);
}

/** H13 (odluka HM-01 → 02): plafon dugog u km [0,1 km]. */
export const longKmCap10 = (): number => Math.round(P.lengths.longMaxKm * 10);

/** Pouka 28 (HI7): granica dugog nedelje 1 iz skorašnjeg najdužeg trka — max(1,1 × r, r + 1,0) [0,1 km,
    naniže]. */
export function recentLongCap10(recentKm: number): number {
  const r10 = Math.round(recentKm * 10);
  const q = P.recentLong;
  return Math.max(Math.floor(q.factor * r10 + EPS), r10 + Math.round(q.addKm * 10));
}

/** Pouka 28 (HI7): najmanji skorašnji najduži trk [0,1 km] (≥ 5 km) za koji je dugi `long10` u granici. */
export function recentLongNeeded10(long10: number): number {
  let r10 = Math.round(P.recentLong.minKm * 10);
  while (recentLongCap10(r10 / 10) < long10) r10++;
  return r10;
}

/** HI8: apsolutni plafon dugog nedelje 1 — min(150 min, 24 km, granica skorašnjeg najdužeg ako je dat)
    [0,1 km]. Jedna funkcija za konstruktor, poruku i validator (pouka 9, pouka 24). */
export function week1LongCap10(p: Paces, recentKm: number | null | undefined): number {
  const abs = Math.min(longTimeCap10(p), longKmCap10());
  return recentKm == null ? abs : Math.min(abs, recentLongCap10(recentKm));
}

/** H13/H15: plafon dugog kao udeo cilja nedelje [0,1 km]. */
export function longShareCap10(target10: number, rule: DayRule): number {
  return Math.floor(rule.longMaxShare * target10 + EPS);
}

/** H13: najduži dozvoljen dugi [0,1 km] za cilj nedelje (udeo H15, trajanje, 24 km; `recent10` — granica
    skorašnjeg najdužeg u nedelji 1, HI7). */
export function longCap10(
  target10: number,
  rule: DayRule,
  p: Paces,
  recent10: number | null = null
): number {
  return Math.min(
    longShareCap10(target10, rule),
    longTimeCap10(p),
    longKmCap10(),
    recent10 ?? Infinity
  );
}

/** H7: plafon dugog tapera — 0,6 × najduži dugi plana [0,1 km]. */
export function taperLongCap10(longest10: number): number {
  return Math.floor(P.taper.longFactor * longest10 + EPS);
}

/** H5: dugi rasterećenja — 0,8 × poslednji ne-rasteretni dugi [0,1 km]. */
export function deloadLong10(lastLong10: number): number {
  return Math.floor(P.deload.longFactor * lastLong10 + EPS);
}

/** `total10` na `n` jednakih delova u koraku 0,1 km; raniji dani dobijaju višak (razlika ≤ 0,1). */
export function splitEasy(total10: number, n: number): number[] {
  const each = Math.floor(total10 / n);
  return Array.from({ length: n }, (_, i) => each + (i < total10 - each * n ? 1 : 0));
}

/** `n` laganih dana: dugi do `cap10` (svaki lagan ≥ 4 km), lagani = ostatak (≥ 4 km, ≤ dugi). Ostatak u
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
  p: Paces,
  recent10: number | null = null
): Lengths | null {
  return withEasy(target10 * 10 - quality100, longCap10(target10, rule, p, recent10), easyDays);
}

/** H7: taper — dugi ≤ 0,6 × najduži dugi plana (i H13). */
export function taperLengths(
  target10: number,
  quality100: number,
  easyDays: number,
  longest10: number,
  rule: DayRule,
  p: Paces
): Lengths | null {
  const cap10 = Math.min(longCap10(target10, rule, p), taperLongCap10(longest10));
  return withEasy(target10 * 10 - quality100, cap10, easyDays);
}

/** H5: rasterećenje — dugi = 0,8 × poslednji ne-rasteretni dugi (i ≤ H13); ostatak na `easyDays` jednakih
    laganih dana (≥ 4 km, ≤ dugi). */
export function deloadLengths(
  target10: number,
  quality100: number,
  easyDays: number,
  lastLong10: number,
  rule: DayRule,
  p: Paces
): Lengths | null {
  const long10 = Math.min(deloadLong10(lastLong10), longCap10(target10, rule, p));
  const easy10 = splitEasy(Math.round((target10 * 10 - quality100 - long10 * 10) / 10), easyDays);
  if (long10 < EASY_MIN10 || easy10.some((e) => e < EASY_MIN10 || e > long10)) return null;
  return { long10, easy10 };
}
