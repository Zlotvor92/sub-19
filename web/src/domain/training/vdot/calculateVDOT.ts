import { pctVo2max, vo2AtV } from './physiology';

/** VDOT iz trke: `distM` metara za `sec` sekundi. */
export function vdotFromRace(distM: number, sec: number): number {
  const tMin = sec / 60;
  const v = distM / tMin;
  return vo2AtV(v) / pctVo2max(tMin);
}
