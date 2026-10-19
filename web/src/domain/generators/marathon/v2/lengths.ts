/* M13 — dužine dugog i laganih trčanja (jedini vlasnik). Rad u desetinkama km (korak 0,1). Dugi uzima
   najveću dozvoljenu dužinu (≤ udeo cilja po broju dana, M15; ≤ 150 min sporim E; skok ≤ 10 % prema najdužem
   dugom prethodne 4 nedelje, M13a; svaki lagan ≥ 5 km); lagani dele ostatak na jednake delove (razlika ≤ 0,1 km). Dugi ≥ svaki
   lagan je tvrdo pravilo (pouka 2): kad ne može da se ispuni, nedelja nije izvodljiva (M6). */

import { type DayRule, MARATHON_V2_POLICY as P } from './policy.ts';
import type { Paces } from './types.ts';
import { fmtKm } from './workouts.ts';

const EPS = 1e-9;
const EASY_MIN10 = Math.round(P.lengths.easyMinKm * 10);

export interface Lengths {
  long10: number;
  /** Lagani dani redom (raniji dan prvi). */
  easy10: number[];
  /** M13a: dugi je na plafonu skoka (plafon skoka niži od ostalih plafona nedelje). */
  jumpBound: boolean;
}

/** M13: plafon dugog od 150 min sporim E [0,1 km]. */
export function longTimeCap10(p: Paces): number {
  return Math.floor((P.lengths.longMaxSec / p.E.slow) * 10 + EPS);
}

/** M13/M15: plafon dugog kao udeo cilja nedelje [0,1 km]. */
export function longShareCap10(target10: number, rule: DayRule): number {
  return Math.floor(rule.longMaxShare * target10 + EPS);
}

/** M13a: najduži dugi `L` [0,1 km] u prethodne 4 nedelje plana pre nedelje `week` (1-indeks); `longs10[i]` =
    dugi nedelje i + 1 (null bez dugog — trkačka nedelja). Skorašnji najduži trk iz ulaza je dugi „nedelje 0"
    (ulazi u L za nedelje 1–4). null = nema prethodnog dugog. */
export function jumpBase10(
  longs10: readonly (number | null)[],
  week: number,
  recentLongRunKm: number | null | undefined
): number | null {
  const n = P.longJump.windowWeeks;
  const r10 =
    recentLongRunKm === null || recentLongRunKm === undefined
      ? null
      : Math.round(recentLongRunKm * 10);
  const all = [r10, ...longs10];
  const prev = all.slice(Math.max(0, week - n), week).filter((x): x is number => x !== null);
  return prev.length > 0 ? Math.max(...prev) : null;
}

/** M13a (pouka 28, izmena organizatora): plafon dugog nedelje = max(1,1 × L; L + 1,0 km) [0,1 km, naniže],
    L = jumpBase10; null kad L ne postoji (nedelja 1 bez ulaza). JEDINA funkcija za konstruktor i validator
    (pouka 24). */
export function longJumpCap10(
  longs10: readonly (number | null)[],
  week: number,
  recentLongRunKm: number | null | undefined
): number | null {
  const L = jumpBase10(longs10, week, recentLongRunKm);
  if (L === null) return null;
  const q = P.longJump;
  return Math.floor(Math.max(q.factor * L, L + q.addKm * 10) + EPS);
}

/** M13a: najkraći skorašnji najduži trk [0,1 km, naviše] čiji plafon ne seče dugi `long10` — X/1,1 (za X < 11 km
    X − 1). */
export function recentLongThreshold10(long10: number): number {
  const q = P.longJump;
  return Math.ceil(Math.min(long10 / q.factor, long10 - q.addKm * 10) - EPS);
}

/** M13a: napomena nedelje čiji je dugi na plafonu skoka (`L` = jumpBase10). */
export function longJumpNote(long10: number, L10: number): string {
  return `Dugi ${fmtKm(long10 / 10)} km = plafon skoka max(1,1 × L; L + 1,0 km), L = ${fmtKm(L10 / 10)} km (najduži dugi prethodne 4 nedelje ili skorašnji najduži trk) (M13a).`;
}

/** M13a: napomena nedelje 1 bez ulaza `recentLongRunKm`. */
export function recentLongNote(long10: number): string {
  return `Dugi ${fmtKm(long10 / 10)} km: ako ti je skorašnji najduži trk kraći od ${fmtKm(recentLongThreshold10(long10) / 10)} km, unesi ga — plan počinje od njega (M13a).`;
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

/** `n` laganih dana: dugi do min(`cap10`, `jump10`) (svaki lagan ≥ 5 km), lagani = ostatak (≥ 5 km, ≤ dugi).
    Ostatak u stotinkama km. */
function withEasy(
  rest100: number,
  cap10: number,
  n: number,
  jump10: number | null
): Lengths | null {
  const top = Math.min(cap10, jump10 ?? Infinity);
  const long10 = Math.min(top, Math.floor((rest100 - n * EASY_MIN10 * 10) / 10));
  if (long10 < EASY_MIN10) return null;
  const easy10 = splitEasy(Math.round((rest100 - long10 * 10) / 10), n);
  if (easy10.some((e) => e < EASY_MIN10 || e > long10)) return null;
  return { long10, easy10, jumpBound: jump10 !== null && jump10 < cap10 && long10 === jump10 };
}

/** Nedelja izgradnje: kvalitet (zbir `quality100`) + dugi + `easyDays` laganih; `jump10` = plafon skoka M13a
    (null kad ga nema). */
export function buildLengths(
  target10: number,
  quality100: number,
  easyDays: number,
  rule: DayRule,
  p: Paces,
  jump10: number | null = null
): Lengths | null {
  return withEasy(target10 * 10 - quality100, longCap10(target10, rule, p), easyDays, jump10);
}

/** M7: nedelja tapera `step` (0 = N−2, 1 = N−1) — dugi ≤ udeo × najduži dugi plana (0,65 / 0,45) i ≤ M13. */
export function taperLengths(
  target10: number,
  quality100: number,
  easyDays: number,
  longest10: number,
  step: number,
  rule: DayRule,
  p: Paces,
  jump10: number | null = null
): Lengths | null {
  const cap10 = Math.min(
    longCap10(target10, rule, p),
    Math.floor(P.taper.weeks[step]!.longFactor * longest10 + EPS)
  );
  return withEasy(target10 * 10 - quality100, cap10, easyDays, jump10);
}

/** M5: rasterećenje — dugi = 0,8 × poslednji ne-rasteretni dugi (i ≤ M13); ostatak na `easyDays` jednakih
    laganih dana. */
export function deloadLengths(
  target10: number,
  quality100: number,
  easyDays: number,
  lastLong10: number,
  rule: DayRule,
  p: Paces,
  jump10: number | null = null
): Lengths | null {
  const cap10 = Math.min(
    Math.floor(P.deload.longFactor * lastLong10 + EPS),
    longCap10(target10, rule, p)
  );
  const long10 = Math.min(cap10, jump10 ?? Infinity);
  const easy10 = splitEasy(Math.round((target10 * 10 - quality100 - long10 * 10) / 10), easyDays);
  if (easy10.some((e) => e < EASY_MIN10 || e > long10)) return null;
  return { long10, easy10, jumpBound: jump10 !== null && jump10 < cap10 };
}
