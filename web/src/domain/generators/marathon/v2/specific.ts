/* M19 (P2-S1, marathon-v2.9.0) — specifičan dugi: smena nedelja A/B u specifičnoj fazi i završni blok dugog u
   maratonskom tempu (MP). Jedino mesto odluke o tipu nedelje, o dužini bloka i o glavnoj dozi sa blokom; konstruktor
   (week.ts, generate.ts), validator i adaptacija čitaju ove funkcije. Dužinu dugog i dalje određuje samo lengths.ts. */

import { longMaxSecOf } from './lengths.ts';
import { MARATHON_V2_POLICY as P, type PlanRule } from './policy.ts';
import type { Paces, Phase, Workout, WorkZone } from './types.ts';
import { longBlockKm, longBlockSec, longBlockWorkout } from './workouts.ts';

export type SpecificType = 'A' | 'B';

/** Okvir nedelje kakav vidi raspored tipova (konstruktor: okviri; validator: nedelje plana). */
interface FrameLike {
  index: number;
  phase: Phase;
  deload: boolean;
}

/** M19: smena A/B važi samo za redovan plan sa dva kvaliteta (4–6 dana); 3 dana i početnik nemaju nedelju B. */
export const abPlan = (rule: Pick<PlanRule, 'quality' | 'beginner'>): boolean =>
  rule.quality === 2 && !rule.beginner;

/**
 * M19 (S1/S3) — raspored tipova (jedno mesto odluke): ne-rasteretne nedelje specifične faze iz okvira plana (posle
 * koraka adaptacije: iz adaptiranih okvira); poslednja (pred taper) je B, unazad se smenjuju (… A, B, A, B). Mapa
 * indeks nedelje → tip; nedelja van mape nije specifična ne-rasteretna (ili plan nema smenu).
 */
export function specificTypes(
  frames: readonly FrameLike[],
  rule: Pick<PlanRule, 'quality' | 'beginner'>
): Map<number, SpecificType> {
  const out = new Map<number, SpecificType>();
  if (!abPlan(rule)) return out;
  const spec = frames.filter((f) => f.phase === 'specific' && !f.deload).map((f) => f.index);
  spec.reverse().forEach((i, k) => out.set(i, k % 2 === 0 ? 'B' : 'A'));
  return out;
}

/** M19 (S3): tip nedelje u adaptiranom planu — raspored (specificTypes) iz okvira sa koracima koji važe za tu nedelju:
    nedelja pre prve nedelje koraka (`firstWeeks[k]`) zadržava raspored iz okvira sa prvih k koraka (prošlost se ne
    preslaže), od nje dalje važi raspored posle koraka. `framesWith(k)` = okviri sa prvih k koraka (k = svi: okviri
    plana). Jedna funkcija za konstruktor i validator. */
export function specificTypesOver(
  rule: Pick<PlanRule, 'quality' | 'beginner'>,
  firstWeeks: readonly number[],
  framesWith: (k: number) => readonly FrameLike[]
): (week: number) => SpecificType | undefined {
  const cache = new Map<number, Map<number, SpecificType>>();
  return (week) => {
    const k = firstWeeks.filter((f) => f <= week).length;
    let m = cache.get(k);
    if (!m) cache.set(k, (m = specificTypes(framesWith(k), rule)));
    return m.get(week);
  };
}

/** M19 (S3): nedelja tipa B po rasporedu sme da se sastavi kao B — bez testa i bez ograničenja koraka (bol, odmor,
    zabrana kvaliteta, jedan kvalitet); `regular` = cilj po pravilu (adaptacija: ne povratak posle smanjenja ni nov
    start koji još nije dostigao redovan cilj). */
export const bAllowed = (
  frame: { phase: Phase; deload: boolean; test?: boolean; limits?: unknown },
  regular: boolean
): boolean =>
  regular && frame.phase === 'specific' && !frame.deload && !frame.test && !frame.limits;

/** Nedelja ima dugi sa blokom u MP (tip B). */
export const hasLongBlock = (
  days: readonly { role: string; workout: Pick<Workout, 'kind' | 'workKm'> }[]
): boolean => days.some((d) => d.role === 'long' && longBlockKm(d.workout) > 0);

/** M19: lestvica bloka [km]. */
export const blockLevels = (): readonly number[] => P.specific.blockKm;

/** M19: granice bloka `x` [km] u dugom od `km` — x ≤ 50 % dužine dugog i trajanje (lagan deo sporim E + blok u MP) ≤
    vremenska granica dugog nedelje (M13). */
export function blockFits(
  km: number,
  x: number,
  rule: PlanRule,
  p: Paces,
  /** K3-A: plafon zone MP za dugi (quality.capM, član udela) [m] — dugi do 45 % nedelje ne nosi blok preko plafona. */
  capMm = Infinity
): boolean {
  return (
    x <= P.specific.blockMaxLongShare * km + 1e-9 &&
    x * 1000 <= capMm + 1e-6 &&
    longBlockSec(km, x, p) <= longMaxSecOf(rule)
  );
}

/** M19: nivo bloka po pravilu — sledeći posle poslednjeg bloka `lastBlockM` [m] (jedan nivo po nedelji B; bez
    prethodnog prvi nivo; na vrhu vrh). */
export function nextBlockKm(lastBlockM: number): number {
  const levels = blockLevels();
  return levels.find((x) => x * 1000 > lastBlockM + 1e-6) ?? levels[levels.length - 1]!;
}

/**
 * M19 — blok nedelje B (jedino mesto; odluka organizatora posle STOP 9f4cbc8, opcija O3). Nivo po pravilu = jedan nivo
 * iznad max(poslednji blok, poslednja MP doza `lastMpM` — quality.lastMpM: poslednji MP trening ili blok). Kandidati:
 * nivoi ≥ poslednjeg bloka (blok ne opada) koji staju u granice (blockFits) i uz koje dugi ostaje najduži trening
 * nedelje (dan kvaliteta koji je ≤ lagan dugi ostaje ≤ dugi sa blokom; dan koji je već duži od laganog dugog — najniži
 * nivo zone, upozorenje pouke 14 — se ne poredi). Izbor: najviši kandidat ≤ nivoa po pravilu; null = nijedan (nedelja
 * je tip A).
 */
export function chooseBlockKm(
  long10: number,
  lastBlockM: number,
  lastMpM: number,
  rule: PlanRule,
  p: Paces,
  qualitySecs: readonly number[],
  easyLongSec: number,
  /** P5-F2: nedelja bez rasta doze — nivo po pravilu je najviši nivo ≤ max(poslednji blok, poslednja MP doza);
      nema ga (blok bi bio veći od poslednje MP doze) → null (nedelja A). */
  hold = false,
  capMm = Infinity
): number | null {
  const km = long10 / 10;
  const ok = (x: number): boolean => {
    if (x * 1000 < lastBlockM - 1e-6 || !blockFits(km, x, rule, p, capMm)) return false;
    const sec = longBlockWorkout(km, x, p).sec;
    return qualitySecs.every((s) => s > easyLongSec || s <= sec);
  };
  const top = Math.max(lastBlockM, lastMpM);
  const next = hold
    ? blockLevels()
        .filter((x) => x * 1000 <= top + 1e-6)
        .pop()
    : nextBlockKm(top);
  if (next === undefined) return null;
  const lv = blockLevels().filter((x) => x <= next + 1e-9 && ok(x));
  return lv.length > 0 ? lv[lv.length - 1]! : null;
}

/** M12 (M19): glavna doza nedelje = rad T + I + MP u treninzima kvaliteta + blok MP u dugom [m]. Jedna funkcija
    (validator MAIN_DOSE_DECREASE, mrežne invarijante). */
export const mainDoseM = (w: {
  days: readonly { workout: Pick<Workout, 'kind'> & { workKm: Record<WorkZone, number> } }[];
}): number =>
  w.days.reduce(
    (a, d) =>
      a +
      (d.workout.kind === 'quality'
        ? Math.round((d.workout.workKm.T + d.workout.workKm.I + d.workout.workKm.MP) * 1000)
        : d.workout.kind === 'long'
          ? Math.round(longBlockKm(d.workout) * 1000)
          : 0),
    0
  );
