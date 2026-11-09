/* P1-S1 (hm-v2.9.0) — specifičan dugi: smena nedelja A/B u specifičnoj fazi i blok u trkačkom tempu (RP) na kraju
   dugog. Jedino mesto odluke o tipu nedelje i o dužini bloka; konstruktor (week.ts, generate.ts), validator i
   adaptacija čitaju ove funkcije. Dužinu dugog i dalje određuje samo lengths.ts. */

import { HM_V2_POLICY as P, type PlanRule } from './policy.ts';
import { capM } from './quality.ts';
import type { Paces, Phase, Workout, WorkZone } from './types.ts';
import { longBlockKm, longBlockSec, longBlockWorkout, longWorkout } from './workouts.ts';

export type SpecificType = 'A' | 'B';

/** Nedelja kakva je upisana (konstruktor: okvir + upisani dani; validator: nedelja plana). */
export interface SpecificWeekLike {
  phase: Phase;
  deload: boolean;
  days: readonly {
    role: string;
    workout: Pick<Workout, 'kind'> & { workKm: Record<WorkZone, number> };
  }[];
}

/** Nedelja ima dugi sa blokom RP (tip B). */
export const hasLongBlock = (days: SpecificWeekLike['days']): boolean =>
  days.some((d) => d.role === 'long' && longBlockKm(d.workout) > 0);

/**
 * S1 (odluka organizatora posle P1-STOP) — raspored tipova iz okvira nedelja (jedno mesto): poslednja ne-rasteretna
 * nedelja specifične faze (pred taper) je B, unazad se smenjuju A, B, … (3 ne-rasteretne specifične: B, A, B). null =
 * nedelja nije ne-rasteretna specifična. Nedelja po rasporedu B koja ne može biti B (blok ne staje, ograničenja,
 * povratak) je A; raspored ostalih se ne pomera. Okviri u adaptaciji (prinudno rasterećenje, nov start) daju nov raspored.
 */
export function scheduledType(
  weeks: readonly { phase: Phase; deload: boolean }[],
  i0: number
): SpecificType | null {
  const w = weeks[i0];
  if (!w || w.phase !== 'specific' || w.deload) return null;
  let later = 0;
  for (let j = i0 + 1; j < weeks.length; j++)
    if (weeks[j]!.phase === 'specific' && !weeks[j]!.deload) later++;
  return later % 2 === 0 ? 'B' : 'A';
}

/** S1: lestvica bloka [km] — 4 → 6 → 8 (samo redovan plan 4–6 dana). */
export const blockLevels = (_rule?: unknown): readonly number[] => P.specific.blockKm;

/** S1: granice bloka `x` [km] u dugom od `km` — x ≤ 40 % dužine dugog i trajanje (lagan deo sporim E + blok RP) ≤
    granica dugog (150 / 135 min). */
export function blockFits(km: number, x: number, rule: PlanRule, p: Paces): boolean {
  return x <= P.specific.blockMaxLongShare * km + 1e-9 && longBlockSec(km, x, p) <= rule.longMaxSec;
}

/** S1: nivo bloka po pravilu — sledeći posle poslednjeg bloka `lastBlockM` [m] (jedan nivo po nedelji B; bez
    prethodnog prvi nivo; na vrhu vrh). */
export function wantBlockKm(lastBlockM: number): number {
  const levels = blockLevels();
  return levels.find((x) => x * 1000 > lastBlockM + 1e-6) ?? levels[levels.length - 1]!;
}

/**
 * S1 — blok nedelje B (jedino mesto): najviši nivo ≤ nivoa po pravilu (wantBlockKm) koji staje u granice (blockFits),
 * u plafon RP cilja nedelje (H11 — blok je rad RP u treningu, isti plafon kao ZONE_CAP validatora) i uz koji dugi ostaje najduži trening nedelje (pouka 32/35: dan kvaliteta koji je ≤ lagan dugi ostaje ≤ dugi sa
 * blokom; dan koji je već duži od laganog dugog — najniži nivo zone, upozorenje pouke 14 — se ne poredi). null = ni
 * prvi nivo ne staje (nedelja je tip A).
 */
export function chooseBlockKm(
  long10: number,
  lastBlockM: number,
  rule: PlanRule,
  p: Paces,
  qualitySecs: readonly number[],
  targetKm: number
): number | null {
  const km = long10 / 10;
  const want = wantBlockKm(lastBlockM);
  const easySec = longWorkout(km, p).sec;
  const levels = blockLevels().filter((x) => x <= want + 1e-9);
  for (let k = levels.length - 1; k >= 0; k--) {
    const x = levels[k]!;
    const sec = longBlockWorkout(km, x, p).sec;
    if (
      blockFits(km, x, rule, p) &&
      Math.round(x * 1000) <= capM('RP', targetKm) &&
      qualitySecs.every((s) => s > easySec || s <= sec)
    )
      return x;
  }
  return null;
}

/** S1/S3: nedelja sme biti tip B — redovan plan 4–6 dana (3 dana i početnik nemaju nedelju B), ne-rasteretna
    specifična nedelja izgradnje bez ograničenja koraka (bol, odmor, zabrana kvaliteta, jedan kvalitet) i bez testa;
    `regular` — cilj po pravilu, ne povratak / nov start (adaptacija, cilj samo naniže). */
export const bAllowed = (
  frame: { phase: Phase; deload: boolean; test?: boolean; limits?: unknown },
  regular: boolean,
  rule: Pick<PlanRule, 'quality' | 'beginner'>
): boolean =>
  regular &&
  rule.quality === 2 &&
  !rule.beginner &&
  frame.phase === 'specific' &&
  !frame.deload &&
  !frame.test &&
  !frame.limits;

/** H12 (P1-S1): glavna doza nedelje = rad T + I + RP u treninzima kvaliteta + blok RP u dugom [m]. Jedna funkcija
    (validator MAIN_DOSE_DECREASE, mrežne invarijante). */
export const mainDoseM = (w: {
  days: readonly { workout: Pick<Workout, 'kind'> & { workKm: Record<WorkZone, number> } }[];
}): number =>
  w.days.reduce(
    (a, d) =>
      a +
      (d.workout.kind === 'quality'
        ? Math.round((d.workout.workKm.T + d.workout.workKm.I + d.workout.workKm.RP) * 1000)
        : d.workout.kind === 'long'
          ? Math.round(longBlockKm(d.workout) * 1000)
          : 0),
    0
  );

/** H12 (O1, odluka organizatora posle P1-STOP): osnova poređenja glavne doze — nedelja B sa poslednjom B, ostale
    (A, baza, razvoj) sa poslednjom ne-B. Jedna funkcija (validator MAIN_DOSE_DECREASE, mrežne invarijante). */
export function mainDoseRef<T extends SpecificWeekLike>(
  refs: { a: T | null; b: T | null },
  w: T
): T | null {
  return hasLongBlock(w.days) ? refs.b : refs.a;
}
/** H12 (O1): posle nedelje `w` — nova osnova njenog tipa. */
export function mainDoseNext<T extends SpecificWeekLike>(
  refs: { a: T | null; b: T | null },
  w: T
): { a: T | null; b: T | null } {
  return hasLongBlock(w.days) ? { ...refs, b: w } : { ...refs, a: w };
}
