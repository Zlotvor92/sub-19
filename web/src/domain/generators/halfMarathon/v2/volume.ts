/* H6 — cilj obima svake nedelje (jedini vlasnik); H5/H7 faktori cilja rasterećenja i tapera; H8 cilj
   trkačke nedelje; poruka kapaciteta. Rad u desetinkama km. Izvodljivost proverava STVARNA konstrukcija
   nedelje (week.ts), koju ovaj modul dobija kao funkciju — kapacitet nije formula (pouke 1 i 9). */

import { longShareCap10, longTimeCap10 } from './lengths.ts';
import { isBuildPhase } from './periodize.ts';
import { type DayRule, HM_V2_POLICY as P, RUN_DAYS_COUNTS } from './policy.ts';
import type { Paces, PlanWeek, WeekFrame } from './types.ts';

const EPS = 1e-9;
export const to10 = (km: number): number => Math.round(km * 10);

/** Šta je seklo spuštenu nedelju izgradnje — dugi na 150 min ('time') i/ili na udelu H15 ('share'). */
export type CapacityLimit = 'time' | 'share';

/** H6: poruka CAPACITY_LIMITED — imenuje stvarno ograničenje; preporučuje više dana samo kad veći broj
    dana postoji u tabeli H15 (segment 01: samo 4 dana → preporuka obima ili dana iz segmenta 02 nije
    dostupna, poruka imenuje samo ograničenje). */
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

/** HI3 (pouka 14): preporuka manje dana — brojevi dana manji od `runDays` čiji red tabele H15 podržava
    trenutni obim; prazno kad ih nema (segment 01: uvek prazno). */
export function fewerDaysAdvice(runDays: number, currentWeeklyKm: number): string {
  const km10 = to10(currentWeeklyKm);
  const fewer = RUN_DAYS_COUNTS.filter(
    (n) => n < runDays && to10(P.days[n].kmMin) <= km10 && km10 <= to10(P.days[n].kmMax)
  );
  if (fewer.length === 0) return '';
  const days = fewer.length === 1 ? `${fewer[0]}` : `${fewer[0]}–${fewer[fewer.length - 1]}`;
  return `; preporuka ${days} dana (red sa manje dana podržava obim ${currentWeeklyKm} km, dugi dobija veći udeo)`;
}

/** H6: ograničenja spuštenih (fitted 'down') ne-rasteretnih nedelja izgradnje: dugi = plafon 150 min
    sporim E → 'time'; dugi = udeo cilja (H15) → 'share'. */
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
    if (l10 === longShareCap10(to10(w.targetKm), rule)) share = true;
  }
  return [...(time ? ['time' as const] : []), ...(share ? ['share' as const] : [])];
}

/** Trenutni obim = cilj nedelje 1 [0,1 km]. */
export function startKm10(currentWeeklyKm: number): number {
  return to10(currentWeeklyKm);
}

/** H6: granica izgradnje min(start × 1,4; start + 20; max nedelje H15) [0,1 km]; kapacitet konstrukcije je
    posebno. */
export function peakCap10(start10: number, rule: DayRule): number {
  const v = P.volume;
  return Math.min(
    Math.floor(start10 * v.peakFactor + EPS),
    start10 + to10(v.peakAddKm),
    to10(rule.peakMaxKm)
  );
}

/** H6: +6 % poslednjeg ne-rasteretnog cilja (min 1,0, max 4,0 km; korak 0,1). */
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

export const INITIAL_VOLUME: VolumeHistory = { lastBuild10: null, peak10: 0 };

/** Cilj po pravilu (pre provere izvodljivosti) — jedna funkcija za konstruktor i validator (pouka 24).
    Trkačka nedelja: cilj = planirano (raceWeekTarget10). */
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

/** Posle nedelje sa ciljem `target10`: osnov rasta i vrh menja samo ne-rasteretna izgradnja. */
export function leaveWeek(h: VolumeHistory, frame: WeekFrame, target10: number): VolumeHistory {
  if (!isBuildPhase(frame.phase) || frame.deload) return h;
  return { lastBuild10: target10, peak10: Math.max(h.peak10, target10) };
}

/** H8: cilj trkačke nedelje = planirano (trka se ne računa). */
export function raceWeekTarget10(planned100: number): number {
  return Math.round(planned100 / 10);
}

/** H15/Uslov 8: minimum nedelje [0,1 km] — donja granica pretrage cilja i provera validatora (pouka 24). */
export const weekMin10 = (rule: DayRule): number => to10(rule.weekMinKm);

/**
 * H6: nominalni cilj ako ga konstrukcija ispunjava; inače SAMO ova nedelja na najbliži izvodljiv cilj
 * (pri jednakoj udaljenosti niži). Izgradnja sme naviše do granice izgradnje; rasterećenje i taper samo
 * naniže (smanjenje ne sme da poraste). Donja granica je minimum nedelje (H15).
 */
export function fit10(
  nominal: number,
  frame: WeekFrame,
  cap10: number,
  rule: DayRule,
  feasible: (target10: number) => boolean
): { target10: number; fitted: 'down' | 'up' | null } | null {
  if (feasible(nominal)) return { target10: nominal, fitted: null };
  const lo = weekMin10(rule);
  const hi = frame.deload || frame.phase === 'taper' ? nominal : cap10;
  for (let d = 1; nominal - d >= lo || nominal + d <= hi; d++) {
    if (nominal - d >= lo && feasible(nominal - d))
      return { target10: nominal - d, fitted: 'down' };
    if (nominal + d <= hi && feasible(nominal + d)) return { target10: nominal + d, fitted: 'up' };
  }
  return null;
}
