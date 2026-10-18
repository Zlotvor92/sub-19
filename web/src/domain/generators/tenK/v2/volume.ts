/* D6 — cilj obima svake nedelje (jedini vlasnik); D5/D7/D8 faktori cilja rasterećenja, tapera i trkačke
   nedelje; D22 poruka kapaciteta. Rad u desetinkama km. Izvodljivost proverava STVARNA konstrukcija
   nedelje (week.ts), koju ovaj modul dobija kao funkciju — kapacitet nije formula. */

import { longShareCap10, longTimeCap10 } from './lengths.ts';
import { isBuildPhase } from './periodize.ts';
import { type DayRule, RUN_DAYS_COUNTS, TEN_K_V2_POLICY as P } from './policy.ts';
import type { Paces, PlanWeek, WeekFrame } from './types.ts';

const EPS = 1e-9;
export const to10 = (km: number): number => Math.round(km * 10);

/** D22: šta je seklo spuštenu nedelju izgradnje — dugi na 105 min ('time') i/ili na udelu D17 ('share'). */
export type CapacityLimit = 'time' | 'share';

/**
 * D22: poruka CAPACITY_LIMITED — imenuje stvarno ograničenje i preporučuje više dana samo kad veći broj
 * dana postoji u tabeli D17 (6 dana: bez preporuke).
 */
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

/**
 * D25: preporuka manje dana — brojevi dana manji od `runDays` čiji red tabele D17 podržava trenutni obim
 * (kmMin ≤ obim ≤ kmMax); prazno kad ih nema.
 */
export function fewerDaysAdvice(runDays: number, currentWeeklyKm: number): string {
  const km10 = to10(currentWeeklyKm);
  const fewer = RUN_DAYS_COUNTS.filter(
    (n) => n < runDays && to10(P.days[n].kmMin) <= km10 && km10 <= to10(P.days[n].kmMax)
  );
  if (fewer.length === 0) return '';
  const days = fewer.length === 1 ? `${fewer[0]}` : `${fewer[0]}–${fewer[fewer.length - 1]}`;
  return `; preporuka ${days} dana (red D17 sa manje dana podržava obim ${currentWeeklyKm} km, dugi dobija veći udeo)`;
}

/** D22: ograničenja spuštenih (fitted 'down') ne-rasteretnih nedelja izgradnje: dugi = plafon 105 min
    sporim E → 'time'; dugi = udeo cilja (D17) → 'share'. */
export function capacityLimits(
  weeks: readonly PlanWeek[],
  rule: DayRule,
  p: Paces
): CapacityLimit[] {
  let time = false;
  let share = false;
  for (const w of weeks) {
    if (!isBuildPhase(w.phase) || w.deload || w.fitted !== 'down') continue;
    const long = w.days.find((d) => d.role === 'long');
    if (!long) continue;
    const l10 = to10(long.workout.km);
    if (l10 === longTimeCap10(p)) time = true;
    if (l10 === longShareCap10(to10(w.targetKm), rule.longMaxShare)) share = true;
  }
  return [...(time ? ['time' as const] : []), ...(share ? ['share' as const] : [])];
}

/** Trenutni obim = cilj nedelje 1 [0,1 km]. */
export function startKm10(currentWeeklyKm: number): number {
  return to10(currentWeeklyKm);
}

/** D6: granica izgradnje min(start × 1,4; start + 15; max nedelje D17) [0,1 km]; kapacitet konstrukcije
    je posebno. */
export function peakCap10(start10: number, rule: DayRule): number {
  const v = P.volume;
  return Math.min(
    Math.floor(start10 * v.peakFactor + EPS),
    start10 + to10(v.peakAddKm),
    to10(rule.peakMaxKm)
  );
}

/** D6: +6 % poslednjeg ne-rasteretnog cilja (min 1,0, max 3,0 km; korak 0,1). */
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

/** Cilj po pravilu (pre provere izvodljivosti). Trkačka nedelja: cilj = planirano (raceWeekTarget). */
export function nominal10(
  frame: WeekFrame,
  hist: VolumeHistory,
  start10: number,
  cap10: number
): number {
  if (frame.phase === 'taper') return Math.round(P.taper.factor * hist.peak10);
  if (hist.lastBuild10 === null) return start10;
  if (frame.deload) return Math.round(P.deload.factor * hist.lastBuild10);
  return Math.min(hist.lastBuild10 + growth10(hist.lastBuild10), cap10);
}

/** D8: cilj trkačke nedelje = planirano (trka se ne računa). */
export function raceWeekTarget10(planned100: number): number {
  return Math.round(planned100 / 10);
}

/**
 * D6: nominalni cilj ako ga konstrukcija ispunjava; inače SAMO ova nedelja na najbliži izvodljiv cilj
 * (pri jednakoj udaljenosti niži). Izgradnja sme naviše do granice izgradnje; rasterećenje i taper samo
 * naniže (smanjenje ne sme da poraste). Donja granica je najmanji smislen obim (D15, po broju dana D17).
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
  const hi = frame.deload || frame.phase === 'taper' ? nominal : cap10;
  for (let d = 1; nominal - d >= lo || nominal + d <= hi; d++) {
    if (nominal - d >= lo && feasible(nominal - d))
      return { target10: nominal - d, fitted: 'down' };
    if (nominal + d <= hi && feasible(nominal + d)) return { target10: nominal + d, fitted: 'up' };
  }
  return null;
}
