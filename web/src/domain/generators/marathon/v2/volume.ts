/* M6 — cilj obima svake nedelje (jedini vlasnik); M5/M7/M8 faktori cilja rasterećenja, tapera i trkačke
   nedelje; poruka kapaciteta. Rad u desetinkama km. Izvodljivost proverava STVARNA konstrukcija nedelje
   (week.ts), koju ovaj modul dobija kao funkciju — kapacitet nije formula (pouke 1 i 9). */

import { longCap10, longJumpCap10, longShareCap10, longTimeCap10 } from './lengths.ts';
import { isBuildPhase } from './periodize.ts';
import { type DayRule, MARATHON_V2_POLICY as P, RUN_DAYS_COUNTS } from './policy.ts';
import type { Paces, PlanWeek, WeekFrame } from './types.ts';

const EPS = 1e-9;
export const to10 = (km: number): number => Math.round(km * 10);

/** Šta je seklo spuštenu nedelju izgradnje — dugi na 150 min ('time') i/ili na udelu M15 ('share'). */
export type CapacityLimit = 'time' | 'share';

/** M6: poruka CAPACITY_LIMITED — imenuje stvarno ograničenje; preporučuje više dana samo kad veći broj
    dana postoji u tabeli M15 (6 dana → bez preporuke dana; preporuka kraće distance nije deo ove poruke). */
export function capacityMessage(
  runDays: number,
  rule: DayRule,
  limits: readonly CapacityLimit[]
): string {
  const min = `${Math.round(P.lengths.longMaxSec / 60)} min`;
  const share = `${Math.round(rule.longMaxShare * 100)} % nedelje`;
  const what =
    limits.length === 2
      ? ` uz dugi ≤ ${min} i ≤ ${share}`
      : limits[0] === 'time'
        ? ` uz dugi ≤ ${min}`
        : limits[0] === 'share'
          ? ` uz dugi ≤ ${share}`
          : '';
  const more = RUN_DAYS_COUNTS.filter((n) => n > runDays);
  const advice =
    more.length === 0
      ? ''
      : `; preporuka ${more.length === 1 ? more[0] : `${more[0]}–${more[more.length - 1]}`} dana`;
  return `${runDays} dana ne nose ovaj obim${what}${advice}.`;
}

/** Spuštene (fitted 'down') ne-rasteretne nedelje izgradnje koje seče kapacitet broja dana. Nedelja čiji je
    dugi na plafonu skoka M13a (niži od plafona M13) nije ograničenje kapaciteta (pouka 28). Jedna funkcija za
    konstruktor i validator (pouka 24). */
export function capacityWeeks(
  weeks: readonly PlanWeek[],
  rule: DayRule,
  p: Paces,
  recentLongRunKm: number | null | undefined
): PlanWeek[] {
  const longs10 = weeks.map((w) => {
    const l = w.days.find((d) => d.role === 'long');
    return l ? to10(l.workout.km) : null;
  });
  return weeks.filter((w, i) => {
    if (!isBuildPhase(w.phase) || w.deload || w.fitted !== 'down') return false;
    const jump = longJumpCap10(longs10.slice(0, i), w.index, recentLongRunKm);
    const l = longs10[i];
    return !(jump !== null && l === jump && jump < longCap10(to10(w.targetKm), rule, p));
  });
}

/** Ograničenja nedelja kapaciteta (capacityWeeks): dugi = plafon 150 min sporim E → 'time'; dugi = udeo
    cilja (M15) → 'share'. */
export function capacityLimits(
  weeks: readonly PlanWeek[],
  rule: DayRule,
  p: Paces,
  recentLongRunKm: number | null | undefined
): CapacityLimit[] {
  let time = false;
  let share = false;
  for (const w of capacityWeeks(weeks, rule, p, recentLongRunKm)) {
    const long = w.days.find((d) => d.role === 'long');
    if (!long) continue;
    const l10 = to10(long.workout.km);
    if (l10 === longTimeCap10(p)) time = true;
    if (l10 === longShareCap10(to10(w.targetKm), rule)) share = true;
  }
  return [...(time ? ['time' as const] : []), ...(share ? ['share' as const] : [])];
}

/** Trenutni obim = cilj nedelje 1 [0,1 km]. */
export function startKm10(currentWeeklyKm: number): number {
  return to10(currentWeeklyKm);
}

/** M6: granica izgradnje min(start × 1,5; start + 30; max nedelje M15) [0,1 km]; kapacitet je posebno. */
export function peakCap10(start10: number, rule: DayRule): number {
  const v = P.volume;
  return Math.min(
    Math.floor(start10 * v.peakFactor + EPS),
    start10 + to10(v.peakAddKm),
    to10(rule.peakMaxKm)
  );
}

/** M6: +6 % poslednjeg ne-rasteretnog cilja (min 1,0, max 5,0 km; korak 0,1). */
export function growth10(last10: number): number {
  const v = P.volume;
  return Math.min(
    to10(v.growthMaxKm),
    Math.max(to10(v.growthMinKm), Math.round(last10 * v.growth))
  );
}

export interface VolumeHistory {
  /** Cilj poslednje ne-rasteretne nedelje izgradnje (stvarno dobijen). */
  lastBuild10: number | null;
  /** Najveći cilj izgradnje do sada (vrh). */
  peak10: number;
}

/** Cilj po pravilu (pre provere izvodljivosti). `taper` = redni broj nedelje tapera (M7: 0,8 / 0,6 × vrh).
    Trkačka nedelja: cilj = planirano (raceWeekTarget10). */
export function nominal10(
  frame: WeekFrame,
  hist: VolumeHistory,
  start10: number,
  cap10: number,
  taper: number | null
): number {
  if (taper !== null) return Math.round(P.taper.weeks[taper]!.factor * hist.peak10);
  if (hist.lastBuild10 === null) return start10;
  if (frame.deload) return Math.round(P.deload.factor * hist.lastBuild10);
  return Math.min(hist.lastBuild10 + growth10(hist.lastBuild10), cap10);
}

/** M8: cilj trkačke nedelje = planirano (trka se ne računa). */
export function raceWeekTarget10(planned100: number): number {
  return Math.round(planned100 / 10);
}

/**
 * M6: nominalni cilj ako ga konstrukcija ispunjava; inače SAMO ova nedelja na najbliži izvodljiv cilj (pri
 * jednakoj udaljenosti niži). Izgradnja sme naviše do granice izgradnje; ned 1, rasterećenje i taper samo
 * naniže (ned 1 = trenutni obim, ispod samo uz dugi na plafonu: 150 min ili M13a; smanjenje ne sme da poraste). Donja granica je najmanji smislen obim (M15, Uslov 8).
 */
export function fit10(
  nominal: number,
  frame: WeekFrame,
  cap10: number,
  rule: DayRule,
  feasible: (target10: number) => boolean
): { target10: number; fitted: 'down' | 'up' | null } | null {
  if (feasible(nominal)) return { target10: nominal, fitted: null };
  const lo = to10(rule.weekMinKm);
  // Ned 1 = trenutni obim (samo naniže, pouka 9); rasterećenje i taper samo naniže.
  const hi = frame.index === 1 || frame.deload || frame.phase === 'taper' ? nominal : cap10;
  for (let d = 1; nominal - d >= lo || nominal + d <= hi; d++) {
    if (nominal - d >= lo && feasible(nominal - d))
      return { target10: nominal - d, fitted: 'down' };
    if (nominal + d <= hi && feasible(nominal + d)) return { target10: nominal + d, fitted: 'up' };
  }
  return null;
}
