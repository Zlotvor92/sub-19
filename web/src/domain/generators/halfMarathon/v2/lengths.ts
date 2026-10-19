/* H13 — dužine dugog i laganih trčanja (jedini vlasnik). Rad u desetinkama km (korak 0,1). Dugi uzima
   najveću dozvoljenu dužinu (≤ udeo cilja po broju dana H15, ≤ 150 min sporim E, ≤ 24 km, u nedelji 1 ≤
   kotrljajuća granica pouke 28 (HI7: ≤ max(1,1 × L, L + 1,0), L = najduži dugi prethodne 4 nedelje i u nedeljama
   1–4 skorašnji najduži trk) i da svaki lagan ostane ≥ 4 km); lagani dele ostatak na jednake delove (razlika ≤ 0,1 km). Dugi ≥ svaki lagan je tvrdo pravilo
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

/** Pouka 28 (HI7): granica dugog iz najdužeg prethodnog `l10` — max(1,1 × L, L + 1,0) [0,1 km, naniže]. */
export function stepCap10(l10: number): number {
  const q = P.recentLong;
  return Math.max(Math.floor(q.factor * l10 + EPS), l10 + Math.round(q.addKm * 10));
}

/** Pouka 28 (HI7): granica dugog iz skorašnjeg najdužeg trka [0,1 km]. */
export const recentLongCap10 = (recentKm: number): number => stepCap10(Math.round(recentKm * 10));

/** Pouka 28 (HI7): kotrljajuća granica dugog nedelje `index` (1-indeks) — L = najduži dugi nedelja
    index − 4 … index − 1 (`longs10[i]` = dugi nedelje i + 1, null bez dugog) i u nedeljama 1–4 skorašnji
    najduži trk kad je dat; bez L nema granice (∞). Jedna funkcija za konstruktor, validator i poruku. */
export function rollingLongCap10(
  index: number,
  longs10: readonly (number | null)[],
  recentKm: number | null | undefined
): number {
  const w = P.recentLong.windowWeeks;
  const prev = longs10
    .slice(Math.max(0, index - 1 - w), index - 1)
    .filter((x): x is number => x !== null);
  if (recentKm != null && index <= w) prev.push(Math.round(recentKm * 10));
  return prev.length === 0 ? Infinity : stepCap10(Math.max(...prev));
}

/** Pouka 28 (HI7): najmanji skorašnji najduži trk [0,1 km] (≥ 5 km) za koji je dugi `long10` u granici. */
export function recentLongNeeded10(long10: number): number {
  let r10 = Math.round(P.recentLong.minKm * 10);
  while (recentLongCap10(r10 / 10) < long10) r10++;
  return r10;
}

/** HI8: apsolutni plafon dugog nedelje 1 — min(150 min, 24 km, kotrljajuća granica nedelje 1 = granica
    skorašnjeg najdužeg ako je dat) [0,1 km]. Jedna funkcija za konstruktor, poruku i validator (pouka 9, 24). */
export function week1LongCap10(p: Paces, recentKm: number | null | undefined): number {
  return Math.min(longTimeCap10(p), longKmCap10(), rollingLongCap10(1, [], recentKm));
}

/** H13/H15: plafon dugog kao udeo cilja nedelje [0,1 km]. */
export function longShareCap10(target10: number, rule: DayRule): number {
  return Math.floor(rule.longMaxShare * target10 + EPS);
}

/** H13: najduži dozvoljen dugi [0,1 km] za cilj nedelje (udeo H15, trajanje, 24 km; `roll10` — kotrljajuća
    granica pouke 28, HI7). */
export function longCap10(target10: number, rule: DayRule, p: Paces, roll10 = Infinity): number {
  return Math.min(longShareCap10(target10, rule), longTimeCap10(p), longKmCap10(), roll10);
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
  roll10 = Infinity
): Lengths | null {
  return withEasy(target10 * 10 - quality100, longCap10(target10, rule, p, roll10), easyDays);
}

/** H7: taper — dugi ≤ 0,6 × najduži dugi plana (i H13). */
export function taperLengths(
  target10: number,
  quality100: number,
  easyDays: number,
  longest10: number,
  rule: DayRule,
  p: Paces,
  roll10 = Infinity
): Lengths | null {
  const cap10 = Math.min(longCap10(target10, rule, p, roll10), taperLongCap10(longest10));
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
  p: Paces,
  roll10 = Infinity
): Lengths | null {
  const long10 = Math.min(deloadLong10(lastLong10), longCap10(target10, rule, p, roll10));
  const easy10 = splitEasy(Math.round((target10 * 10 - quality100 - long10 * 10) / 10), easyDays);
  if (long10 < EASY_MIN10 || easy10.some((e) => e < EASY_MIN10 || e > long10)) return null;
  return { long10, easy10 };
}
