/* D13 — dužine dugog i laganih trčanja (jedini vlasnik); D19 — lagani dani jednaki. Rad u desetinkama km
   (korak 0,1). Dugi uzima najveću dozvoljenu dužinu (≤ udeo cilja po broju dana D17, ≤ 105 min sporim E —
   početnik 90 min, D28 — i da svaki lagan ostane ≥ 3 km); lagani dele ostatak na jednake delove (razlika
   ≤ 0,1 km). Dugi ≥ svaki lagan je tvrdo pravilo: kad ne može da se ispuni, nedelja nije izvodljiva (D6). */

import { daysBetween } from './dates.ts';
import { midEasy } from './paces.ts';
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

/**
 * T1 (10K-08, organizator; jedna funkcija za konstruktor i validator): granice laganog dana NEDELJE IZGRADNJE (ne
 * rasterećenje, taper, trkačka) [0,1 km] — najkraći max(3 km, 20 min laganim tempom), najduži 0,8 × dugi iste nedelje.
 */
export function buildEasyBounds10(long10: number, p: Paces): { min10: number; max10: number } {
  return {
    min10: Math.max(EASY_MIN10, Math.ceil((P.lengths.easyMinSec / midEasy(p)) * 10 - EPS)),
    max10: Math.floor(P.lengths.easyMaxLongShare * long10 + EPS)
  };
}

/**
 * Nedelja izgradnje: kvalitet (zbir `quality100`) + dugi + do `easyDays` laganih. Dugi kao i do sada (withEasy: ≤ plafon
 * D13, lagani ≥ 3 km); T1 (10K-08): ostatak u lagane u granicama buildEasyBounds10 — premali za sve lagane dane → manje
 * laganih dana (ostali su odmor; `easy10` kraći od `easyDays`), prevelik (lagan > 0,8 × dugi) → null: cilj nije
 * izvodljiv, volume.fit10 traži najbliži izvodljiv (planirano < cilj po pravilu, CAPACITY_LIMITED uz preporuku); ni
 * jedan lagan ne staje → svi lagani dani odmor, planirano < cilj (easyRestShort). Dugi je uvek dužina D13 za stvaran
 * broj laganih dana (≤ plafon udela/105 min); višak se u dugi ne prebacuje.
 */
export function buildLengths(
  target10: number,
  quality100: number,
  easyDays: number,
  rule: LongRule,
  p: Paces,
  t1 = true
): Lengths | null {
  const rest100 = target10 * 10 - quality100;
  const cap10 = longCap10(target10, rule, p);
  const base = withEasy(rest100, cap10, easyDays);
  if (!base || easyDays === 0 || !t1) return base;
  for (let n = easyDays; n >= 1; n--) {
    // Dugi po D13 za stvaran broj laganih dana (withEasy: ≤ plafon, ostavlja lagane ≥ 3 km) — nikad iznad plafona.
    const len = n === easyDays ? base : withEasy(rest100, cap10, n);
    if (!len) return null;
    const { min10, max10 } = buildEasyBounds10(len.long10, p);
    if (len.easy10[0]! > max10) return null;
    if (len.easy10[n - 1]! >= min10) return len;
  }
  // Ni jedan lagan od 20 min ne staje: svi lagani dani su odmor, dugi po D13 (≤ plafon, ≤ ostatak), ostatak iznad
  // plafona dugog se ne planira — planirano < cilj (easyRestShort, upozorenje validatora).
  const long10 = Math.min(cap10, Math.floor(rest100 / 10));
  return long10 < EASY_MIN10 ? null : { long10, easy10: [] };
}

/** T1: nedelja izgradnje bez ijednog laganog dana iako ih šablon ima — ostatak cilja (cilj − planirano) manji od
    najkraćeg laganog (buildLengths). Jedan predikat za validator (planirano < cilj → upozorenje). */
export function easyRestShort(
  target10: number,
  planned100: number,
  easyCount: number,
  long10: number,
  p: Paces
): boolean {
  const gap100 = target10 * 10 - planned100;
  return easyCount === 0 && gap100 > 0 && gap100 < buildEasyBounds10(long10, p).min10 * 10;
}

/** T1: koji lagani datumi ostaju kad nedelja izgradnje ima `n` laganih dana od `dates` (rastuće): odmor je prvo dan pre
    dugog (`longDate`), pa najraniji. */
export function keptEasyDates(dates: readonly string[], n: number, longDate: string): string[] {
  if (n >= dates.length) return [...dates];
  const prev = dates.filter((d) => daysBetween(d, longDate) === 1);
  const order = [...prev, ...dates.filter((d) => !prev.includes(d))];
  const drop = new Set(order.slice(0, dates.length - n));
  return dates.filter((d) => !drop.has(d));
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
