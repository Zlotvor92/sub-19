/* D13 — dužine dugog i laganih trčanja (jedini vlasnik); D19 — lagani dani jednaki. Rad u desetinkama km
   (korak 0,1). Dugi uzima najveću dozvoljenu dužinu (≤ udeo cilja po broju dana D17, ≤ 105 min sporim E —
   početnik 90 min, D28 — i da svaki lagan ostane ≥ 3 km); lagani dele ostatak na jednake delove (razlika
   ≤ 0,1 km). Dugi ≥ svaki lagan je tvrdo pravilo: kad ne može da se ispuni, nedelja nije izvodljiva (D6). */

import { TEN_K_V2_POLICY as P } from './policy.ts';
import type { Paces, PlanDay } from './types.ts';

/** Plafoni dugog iz pravila plana (policy.ts planRule): udeo cilja (D17) i trajanje (D13/D28). */
export interface LongRule {
  readonly longMaxShare: number;
  readonly longMaxSec: number;
}

const EPS = 1e-9;
const EASY_MIN10 = Math.round(P.lengths.easyMinKm * 10);

export interface Lengths {
  long10: number;
  /** Lagani dani redom (raniji dan prvi). */
  easy10: number[];
}

/** D13/D28: plafon dugog od `longMaxSec` (105 min; početnik 90 min) sporim E [0,1 km]. */
export function longTimeCap10(p: Paces, longMaxSec: number): number {
  return Math.floor((longMaxSec / p.E.slow) * 10 + EPS);
}

/** D13/D17: plafon dugog kao udeo cilja nedelje [0,1 km]. */
export function longShareCap10(target10: number, longMaxShare: number): number {
  return Math.floor(longMaxShare * target10 + EPS);
}

/** D13: najduži dozvoljen dugi [0,1 km] za cilj nedelje, udeo dugog (D17) i trajanje (D13/D28). */
export function longCap10(target10: number, rule: LongRule, p: Paces): number {
  return Math.min(longShareCap10(target10, rule.longMaxShare), longTimeCap10(p, rule.longMaxSec));
}

/** D19: `total10` na `n` jednakih delova u koraku 0,1 km; raniji dani dobijaju višak (razlika ≤ 0,1). */
export function splitEasy(total10: number, n: number): number[] {
  const each = Math.floor(total10 / n);
  return Array.from({ length: n }, (_, i) => each + (i < total10 - each * n ? 1 : 0));
}

/** `n` laganih dana: dugi do `cap10` (svaki lagan ≥ 3 km), lagani = ostatak (≥ 3 km, ≤ dugi). Ostatak u
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
  rule: LongRule,
  p: Paces
): Lengths | null {
  return withEasy(target10 * 10 - quality100, longCap10(target10, rule, p), easyDays);
}

/** D7: najduži dugi plana [0,1 km] — JEDNA definicija (10k-v2.5.1) za konstruktor i validator: dani uloge
    'long' nedelja `weeks` kakve se upisuju (adaptacija: zaštićeni dani iz prethodnog plana, written.ts); 0 bez
    dugog. */
export function longestLong10(weeks: readonly { days: readonly PlanDay[] }[]): number {
  let m = 0;
  for (const w of weeks)
    for (const d of w.days) if (d.role === 'long') m = Math.max(m, Math.round(d.workout.km * 10));
  return m;
}

/** D7: taper — dugi ≤ 0,75 × najduži dugi plana (longestLong10; i D13). */
export function taperLengths(
  target10: number,
  quality100: number,
  easyDays: number,
  longest10: number,
  rule: LongRule,
  p: Paces
): Lengths | null {
  const cap10 = Math.min(
    longCap10(target10, rule, p),
    Math.floor(P.taper.longFactor * longest10 + EPS)
  );
  return withEasy(target10 * 10 - quality100, cap10, easyDays);
}

/** A4: dugi na danu bola ≤ 60 min sporim E (korak 0,1 km). */
export function painLong10(long10: number, p: Paces): number {
  return Math.min(long10, longTimeCap10(p, P.adapt.painLongMaxSec));
}

/** A4: lagan na danu bola × 0,7 naniže na 0,1 km, ne ispod 3 km; svaki lagan ≤ dugi nedelje (D13;
    `long10` = dugi posle ograničenja, null ako dugog nema). */
export function limitedEasy10(easy10: number, inPain: boolean, long10: number | null): number {
  const k = inPain
    ? Math.max(EASY_MIN10, Math.floor(easy10 * P.adapt.painEasyFactor + EPS))
    : easy10;
  return long10 === null ? k : Math.min(k, long10);
}

/** D5: rasterećenje — dugi = 0,8 × poslednji ne-rasteretni dugi (i ≤ D13); ostatak na `easyDays`
    jednakih laganih dana (D19). `test` (D27 ispred D5, odstupanje): dugi ≤ 0,8 × — najduži koji ostavlja
    lagane ≥ 3 km (isto pravilo kao izgradnja i taper). `adapted` (segment 04, odstupanje A9: D13 ispred D5):
    isto pravilo kao test — dugi ≤ 0,8 × poslednji, najduži koji ostavlja lagane ≥ 3 km — i ne ispod 3 km
    (dugi ≥ lagan ≥ 3 km). Kad je 0,8 × pravilo izvodljivo, rezultat je isti. */
export function deloadLengths(
  target10: number,
  quality100: number,
  easyDays: number,
  lastLong10: number,
  rule: LongRule,
  p: Paces,
  test = false,
  adapted = false
): Lengths | null {
  const long10 = Math.max(
    adapted ? EASY_MIN10 : 0,
    Math.min(Math.floor(P.deload.longFactor * lastLong10 + EPS), longCap10(target10, rule, p))
  );
  if (test || adapted) return withEasy(target10 * 10 - quality100, long10, easyDays);
  const easy10 = splitEasy(Math.round((target10 * 10 - quality100 - long10 * 10) / 10), easyDays);
  if (easy10.some((e) => e < EASY_MIN10 || e > long10)) return null;
  return { long10, easy10 };
}
