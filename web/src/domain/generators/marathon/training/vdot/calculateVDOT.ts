import { pctVo2max, vo2AtV } from './physiology';
import { riegelTo5k } from './racePrediction';

/** VDOT iz trke: `distM` metara za `sec` sekundi. */
export function vdotFromRace(distM: number, sec: number): number {
  const tMin = sec / 60;
  const v = distM / tMin;
  return vo2AtV(v) / pctVo2max(tMin);
}

/**
 * VDOT iz kvalitetne sesije BEZ poznate zone — kao da je to bila trka na toj distanci (Riegel → 5K).
 * Za sesije sa zonom koristi se `vdotFromPace`; ovo je poslednji fallback.
 */
export function vdotFromQuality(paceSec: number, qKm: number): number {
  return vdotFromRace(5000, riegelTo5k(paceSec, qKm));
}
