/* Daniels–Gilbert (1979) — odnos brzine, potrošnje kiseonika i trajanja napora.
   [E] objavljene jednačine; vidi constants/evidence.ts. */

import {
  PCT_VO2MAX_BASE,
  PCT_VO2MAX_FAST,
  PCT_VO2MAX_SLOW,
  VO2_INTERCEPT,
  VO2_LINEAR,
  VO2_QUADRATIC
} from '../constants/evidence';

/** VO2 [ml/kg/min] pri brzini v [m/min]. */
export function vo2AtV(v: number): number {
  return VO2_INTERCEPT + VO2_LINEAR * v + VO2_QUADRATIC * v * v;
}

/** Inverz `vo2AtV` (veći koren kvadratne jednačine): brzina [m/min] za dati VO2. */
export function vAtVo2(vo2: number): number {
  const a = VO2_QUADRATIC;
  const b = VO2_LINEAR;
  const c = VO2_INTERCEPT - vo2;
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
}

/** Udeo VO2max koji se može držati `tMin` minuta. */
export function pctVo2max(tMin: number): number {
  return (
    PCT_VO2MAX_BASE +
    PCT_VO2MAX_SLOW.amplitude * Math.exp(PCT_VO2MAX_SLOW.rate * tMin) +
    PCT_VO2MAX_FAST.amplitude * Math.exp(PCT_VO2MAX_FAST.rate * tMin)
  );
}
