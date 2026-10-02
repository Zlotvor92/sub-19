import { RIEGEL_EXPONENT } from '../constants/evidence';
import { pctVo2max, vAtVo2, vo2AtV } from './physiology';

/**
 * Vreme trke [s] na `distM` koje odgovara datom VDOT-u. Rešava se Newton-ovom
 * iteracijom (najviše 40 koraka) nad `vdotFromRace(distM, t) = vdot`.
 */
export function raceTimeForVdot(vdot: number, distM: number): number {
  let t = distM / vAtVo2(vdot); // početna procena: tempo na 100% VO2max
  for (let i = 0; i < 40; i++) {
    const v = distM / t;
    const f = vo2AtV(v) / pctVo2max(t) - vdot;
    const dt = 0.01;
    const v2 = distM / (t + dt);
    const f2 = vo2AtV(v2) / pctVo2max(t + dt) - vdot;
    const d = (f2 - f) / dt;
    if (Math.abs(d) < 1e-9) break;
    t = t - f / d;
    if (Math.abs(f) < 1e-6) break;
  }
  return Math.round(t * 60);
}

/** Riegel: vreme [s] sa `fromM` preračunato na `toM`. */
export function riegelDist(sec: number, fromM: number, toM: number): number {
  return sec * Math.pow(toM / fromM, RIEGEL_EXPONENT);
}

/** Riegel: tempo [s/km] kvalitetne sesije od `qKm` radnih km → vreme [s] na 5 km. */
export function riegelTo5k(paceSec: number, qKm: number): number {
  return paceSec * qKm * Math.pow(5 / qKm, RIEGEL_EXPONENT);
}
