/* Pouka 37 — mešovita nedelja (deo dana zaštićen: ≤ asOf, zaključan, urađen). Cilj nedelje važi za CELU nedelju:
   preostali dani se sastavljaju na ostatak = cilj − zbir zaštićenih dana, SAMO NANIŽE (nijedan preostali dan nije
   duži nego u nedelji sastavljenoj bez zaštićenih; manjak se ne nadoknađuje). Redosled (organizator, dopuna pouke 37
   iz HM-08): lagani do minimuma (izjednačavaju se), pa otpada kvalitet (Q2, pa Q1 — pouka 35; dan postaje lagan; MP
   najniži nivo ostaje, kao pouka 32) — SAMO ako time ostatak staje, inače kvalitet ostaje;
   dugi se NE skraćuje (skraćen dugi bi postao referenca poslednjeg dugog → kaskada ciljeva narednih nedelja). Dugi ≥
   lagan važi među preostalim danima (lagani samo padaju); zaštićeni dani su činjenice (A11b). Kad ni najmanji
   preostali dani ne staju → planirano > cilj uz upozorenje (pouka 14), ne odbijanje. JEDNO mesto odluke: konstruktor
   (generate.ts) i validator (MIXED_WEEK_OVER) čitaju iste funkcije. Trkačka nedelja je izuzeta (pouka 30, M8). */

import { MARATHON_V2_POLICY as P } from './policy.ts';
import type { Paces, PlanDay } from './types.ts';
import { doseOf, easyWorkout } from './workouts.ts';

const km100 = (km: number): number => Math.round(km * 100);
const sum100 = (days: readonly PlanDay[]): number =>
  days.reduce((a, d) => a + (d.countsToWeek ? km100(d.workout.km) : 0), 0);

/** Km zaštićenih dana po činjenicama (datum → km; samo dani kod kojih se razlikuju od planiranih). */
export type FactKm = Readonly<Record<string, number>>;

/**
 * Pouka 37 (dopuna organizatora iz 5K-08i, jedno pravilo za sve 4 distance): km zaštićenog dana ≤ asOf po ČINJENICAMA
 * — dan u prijavljenoj pauzi = 0; dan sa upisanim treningom (dayId, inače datum) = upisani km (neodrađen,
 * completed = false → 0); dan POZNAT iz potpune pokrivenosti (A10), a bez zapisa = 0 (MAR-08b); null = planirani km
 * (bez zapisa i bez pokrivenosti; zaključani i urađeni posle asOf su planirani). Neodrađen dan ne „jede" cilj
 * nedelje. Jedino pravilo (adapt.ts ga primenjuje, plan nosi rezultat u adaptation.factKm, validator ga čita).
 */
export function factKmOf(
  date: string,
  facts: {
    workouts: readonly { date: string; dayId?: string; km: number; completed: boolean }[];
    breaks: readonly { from: string; to: string }[];
    coverage?: { from: string; to: string; complete: boolean } | null;
  }
): number | null {
  if (facts.breaks.some((b) => b.from <= date && date <= b.to)) return 0;
  const rec = facts.workouts.filter((x) => (x.dayId ?? x.date) === date);
  if (rec.length > 0) return rec.reduce((a, x) => a + (x.completed ? x.km : 0), 0);
  const c = facts.coverage;
  return c && c.complete && c.from <= date && date <= c.to ? 0 : null;
}

/** Pouka 37: zbir zaštićenih dana [0,01 km] — po činjenicama (`fk`), inače planirani km. */
export const keptKm100 = (kept: readonly PlanDay[], fk?: FactKm): number =>
  kept.reduce((a, d) => a + (d.countsToWeek ? km100(fk?.[d.date] ?? d.workout.km) : 0), 0);

/** Pouka 37: ostatak mešovite nedelje [0,01 km] = cilj − zbir zaštićenih dana (po činjenicama). */
export const mixedRemainder100 = (
  target10: number,
  kept: readonly PlanDay[],
  fk?: FactKm
): number => target10 * 10 - keptKm100(kept, fk);

/** Pouka 37: nedelja ostatka pauze (assess: pauseRemainder, cilj pauze važi od asOf + 1) ima svog vlasnika (volume.ts) —
    ostatak do cilja se na nju ne primenjuje. */
export const pauseOwned = (
  steps: readonly { pauseRemainder: boolean; firstWeek: number; fromWeek: number }[],
  week: number
): boolean => {
  const s = steps[steps.length - 1];
  return s !== undefined && s.pauseRemainder && s.firstWeek < s.fromWeek && s.firstWeek === week;
};

export interface MixedRest {
  /** Preostali dani (datumi isti kao u sastavljenoj nedelji). */
  days: PlanDay[];
  /** Preostali dani su skraćeni (zaštićeni dani prelaze ono što bi bilo sastavljeno za njihove dane). */
  cut: boolean;
  /** Kvalitet otpada (dani kvaliteta postaju lagani). */
  dropped: boolean;
  /** Ni najmanji preostali dani ne staju u ostatak → planirano > cilj (upozorenje). */
  over: boolean;
  remainder100: number;
}

const easyDay = (d: PlanDay, km10: number, p: Paces): PlanDay => ({
  date: d.date,
  weekday: d.weekday,
  role: 'easy',
  hard: false,
  countsToWeek: true,
  workout: easyWorkout(km10 / 10, p)
});

/** Lagani na zbir `total10` (≤ zbir sastavljenih): najduži se seku prvi (lagani se izjednačavaju), svaki ≥ `floor`;
    raniji dan dobija višak zaokruženja. */
function cutEasy(e10: readonly number[], floor10: readonly number[], total10: number): number[] {
  let lo = 0;
  let hi = Math.max(0, ...e10);
  const at = (c: number) => e10.map((e, i) => Math.max(floor10[i]!, Math.min(e, c)));
  const s = (xs: number[]) => xs.reduce((a, x) => a + x, 0);
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (s(at(mid)) <= total10) lo = mid;
    else hi = mid - 1;
  }
  const out = at(lo);
  let left = total10 - s(out);
  for (let i = 0; i < out.length && left > 0; i++)
    if (out[i]! < e10[i]!) {
      out[i] = out[i]! + 1;
      left--;
    }
  return out;
}

/**
 * Preostali dani `rest` (iz nedelje sastavljene na cilj `target10` bez zaštićenih dana) uz zaštićene dane `kept`.
 * Bez viška (zbir ≤ ostatak + tolerancija) dani ostaju isti. Vraća i najmanji oblik kad ni on ne staje (`over`).
 */
export function mixedRest(
  kept: readonly PlanDay[],
  rest: readonly PlanDay[],
  target10: number,
  p: Paces,
  fk?: FactKm
): MixedRest {
  const B = mixedRemainder100(target10, kept, fk);
  const base = { cut: false, dropped: false, over: false, remainder100: B };
  // Bez preostalih dana: zaštićeni dani (po činjenicama) iznad cilja → planirano > cilj (upozorenje).
  if (rest.length === 0) return { days: [], ...base, over: B < -km100(P.tolerance.plannedKm) };
  if (sum100(rest) <= B + km100(P.tolerance.plannedKm)) return { days: [...rest], ...base };
  const min10 = Math.round(P.lengths.easyMinKm * 10);
  /** Varijanta (dani posle odbacivanja kvaliteta): lagani na ostatak (dugi i dani kvaliteta ostaju), ili lagani na
      minimumu (`fits` false). */
  const shape = (days: readonly PlanDay[]): { days: PlanDay[]; fits: boolean } => {
    const easy = days.filter((d) => d.role === 'easy');
    const fixed = days.filter((d) => d.role !== 'easy');
    const avail10 = Math.floor((B - sum100(fixed)) / 10);
    // Dugi ≥ lagan među preostalim danima (pouka 2): lagan (i kvalitet koji je postao lagan) ≤ preostali dugi.
    const long = days.find((d) => d.role === 'long');
    const l10 = long ? Math.round(long.workout.km * 10) : Infinity;
    const e10 = easy.map((d) => Math.min(Math.round(d.workout.km * 10), l10));
    const f10 = e10.map((e) => Math.min(e, min10));
    const fits = avail10 >= f10.reduce((a, x) => a + x, 0);
    const k10 = fits ? cutEasy(e10, f10, avail10) : f10;
    return {
      days: days.map((d) =>
        d.role === 'easy' && k10[easy.indexOf(d)] !== Math.round(d.workout.km * 10)
          ? easyDay(d, k10[easy.indexOf(d)]!, p)
          : d
      ),
      fits
    };
  };
  // Kvalitet otpada tek kad ni sa laganim na minimumu ne staje, i SAMO ako time staje: prvo Q2, pa Q1 (pouka 35); dan postaje lagan (≤ dan kvaliteta,
  // ≥ minimum laganog — dan kvaliteta kraći od minimuma laganog ostaje, jer lagan ne bi bio kraći).
  const km10 = (d: PlanDay): number => Math.floor(d.workout.km * 10 + 1e-9);
  // MP najniži nivo (2 × 3000 m, i minimum MP tapera M7a) ostaje — kao izuzetak pouke 32 (odluka organizatora).
  const mpFloor = (d: PlanDay): boolean =>
    d.workout.dose?.zone === 'MP' && d.workout.dose.doseM <= doseOf(P.taper.mpMin);
  const drops = (d: PlanDay, role: 'q1' | 'q2'): boolean =>
    d.role === role && km10(d) > min10 && !mpFloor(d);
  const drop = (days: readonly PlanDay[], role: 'q1' | 'q2'): PlanDay[] =>
    days.map((d) => (drops(d, role) ? easyDay(d, km10(d), p) : d));
  const variants: PlanDay[][] = [[...rest]];
  for (const role of ['q2', 'q1'] as const)
    if (rest.some((d) => drops(d, role))) variants.push(drop(variants[variants.length - 1]!, role));
  for (const [i, v] of variants.entries()) {
    const x = shape(v);
    if (x.fits) return { ...base, days: x.days, cut: true, dropped: i > 0 };
  }
  // Ni bez kvaliteta ne staje → kvalitet OSTAJE (organizator: otpadanje bez dobitka gubi stimulus i lomi progresiju
  // doze), lagani na minimumu, planirano > cilj (MIXED_WEEK_OVER).
  return { ...base, days: shape(variants[0]!).days, cut: true, over: true };
}

/** Pouka 37: napomena mešovite nedelje sa skraćenim preostalim danima. */
export const mixedNote = (m: MixedRest, keptKm: number, target10: number): string =>
  `Mešovita nedelja (pouka 37): zaštićeni dani ${fmt(keptKm)} km, preostali dani na ostatak ${fmt(Math.max(0, m.remainder100) / 100)} km od cilja ${fmt(target10 / 10)} km (samo naniže)${m.dropped ? '; kvalitet otpada' : ''}${m.over ? ' — ni najmanji preostali dani ne staju u ostatak, planirano > cilj' : ''}.`;

const fmt = (km: number): string => (Math.round(km * 100) / 100).toString().replace('.', ',');
