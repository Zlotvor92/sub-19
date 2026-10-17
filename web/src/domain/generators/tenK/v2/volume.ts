/* D6 — cilj obima svake nedelje (jedini vlasnik); D5/D7/D8 faktori cilja rasterećenja, tapera i trkačke
   nedelje. Rad u desetinkama km. Izvodljivost proverava STVARNA konstrukcija nedelje (week.ts), koju
   ovaj modul dobija kao funkciju — kapacitet nije formula. */

import { TEN_K_V2_POLICY as P } from './policy.ts';
import type { WeekFrame } from './types.ts';

const EPS = 1e-9;
export const to10 = (km: number): number => Math.round(km * 10);

/** D6: poruka kad je nedelja izgradnje spuštena na izvodljiv cilj (CAPACITY_LIMITED, napomena plana). */
export const CAPACITY_MESSAGE =
  '4 dana ne nose ovaj obim uz dugi ≤ 105 min; preporuka 5–6 dana (od segmenta 02).';

/** Trenutni obim = cilj nedelje 1 [0,1 km]. */
export function startKm10(currentWeeklyKm: number): number {
  return to10(currentWeeklyKm);
}

/** D6: granica izgradnje min(start × 1,4; start + 15; 60) [0,1 km]; kapacitet konstrukcije je posebno. */
export function peakCap10(start10: number): number {
  const v = P.volume;
  return Math.min(
    Math.floor(start10 * v.peakFactor + EPS),
    start10 + to10(v.peakAddKm),
    to10(v.peakMaxKm)
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
 * naniže (smanjenje ne sme da poraste). Donja granica je najmanji smislen obim (D15).
 */
export function fit10(
  nominal: number,
  frame: WeekFrame,
  cap10: number,
  feasible: (target10: number) => boolean
): { target10: number; fitted: 'down' | 'up' | null } | null {
  if (feasible(nominal)) return { target10: nominal, fitted: null };
  const lo = to10(P.week.minKm);
  const hi = frame.deload || frame.phase === 'taper' ? nominal : cap10;
  for (let d = 1; nominal - d >= lo || nominal + d <= hi; d++) {
    if (nominal - d >= lo && feasible(nominal - d))
      return { target10: nominal - d, fitted: 'down' };
    if (nominal + d <= hi && feasible(nominal + d)) return { target10: nominal + d, fitted: 'up' };
  }
  return null;
}
