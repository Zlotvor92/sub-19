/* Tempa po Danielsu (VDOT). Procenti VO2max zona kalibrisani na tablice: E 62–70 %, T 88 %, I 97,5 %, R 105 %;
   RP = tempo prognoze polumaratona za isti VDOT. */
import type { Paces, V3Input } from './types.ts';

export const HM_M = 21097.5;

const vo2 = (v: number): number => -4.6 + 0.182258 * v + 0.000104 * v * v;
const pctMax = (m: number): number =>
  0.8 + 0.1894393 * Math.exp(-0.012778 * m) + 0.2989558 * Math.exp(-0.1932605 * m);

export function vdotOf(distanceM: number, timeSec: number): number {
  const m = timeSec / 60;
  return vo2(distanceM / m) / pctMax(m);
}

/** tempo (s/km) pri udelu `f` VDOT-a */
export function paceAt(vdot: number, f: number): number {
  const a = 0.000104;
  const b = 0.182258;
  const c = -4.6 - f * vdot;
  const v = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  return 60000 / v;
}

/** vreme trke (s) za distancu pri datom VDOT-u */
export function raceTime(vdot: number, distanceM: number): number {
  let lo = 60;
  let hi = 60000;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (vdotOf(distanceM, mid) > vdot) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** VDOT za koji je sredina laganog raspona (66 %) jednaka zadatom laganom tempu */
function vdotFromEasy(easy: number): number {
  let lo = 15;
  let hi = 85;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (paceAt(mid, 0.66) > easy) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Dozvoljen napredak VDOT-a do trke: 0,1 po nedelji, najviše 2 (pretpostavka, v. izveštaj). */
export const allowedGain = (weeks: number): number => Math.min(2, 0.1 * weeks);

export function computePaces(input: V3Input, weeks: number): Paces {
  const r = input.recentResult;
  const estimated = !r;
  const vdot = r ? vdotOf(r.distanceM, r.timeSec) : vdotFromEasy(input.easyPaceSecPerKm!);
  const predictionSec = raceTime(vdot, HM_M);
  const RP = predictionSec / (HM_M / 1000);
  let racePace = RP;
  const g = input.goalTimeSec;
  if (g && !estimated && vdotOf(HM_M, g) - vdot <= allowedGain(weeks) && g < predictionSec)
    racePace = g / (HM_M / 1000);
  const easySlow = paceAt(vdot, 0.62);
  const easyFast = paceAt(vdot, 0.7);
  const easy = estimated ? input.easyPaceSecPerKm! : paceAt(vdot, 0.66);
  return {
    vdot,
    estimated,
    easyFast,
    easySlow,
    easy,
    T: paceAt(vdot, 0.88),
    I: paceAt(vdot, 0.975),
    R: paceAt(vdot, 1.05),
    RP,
    racePace,
    predictionSec
  };
}

export function fmtPace(sec: number): string {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtTime(sec: number): string {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export function fmtDuration(min: number): string {
  const m = Math.round(min);
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`;
}
