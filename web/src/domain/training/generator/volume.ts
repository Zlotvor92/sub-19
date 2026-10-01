/* Rast obima: apsolutan na malom obimu, procentualan na velikom. Mašina je
   zajednička; brojevi dolaze iz heuristike distance. */

import type { DistanceHeuristic } from '../constants/distances';
import type { Intensity } from '../types';

/**
 * Nedeljni korak rasta = clamp(obim × procenat, min, max).
 *
 * Procenat sam je POGREŠNA MERA na niskom obimu (+5% od 10 km/ned je 0,5 km —
 * to je šum, ne napredak); rizik povrede prati apsolutno opterećenje tkiva.
 * Zato apsolutni pod, a na velikom obimu apsolutni plafon.
 */
export function rampStep(h: DistanceHeuristic, vol: number, intensity: Intensity): number {
  const k = h.rampStep[intensity];
  return Math.max(k.min, Math.min(k.max, vol * k.pct));
}

/**
 * Vrhunac nedeljnog obima. Tri ograničenja redom: (1) koliko stopa rasta
 * dozvoli u raspoloživim rampnim nedeljama, (2) ODREDIŠTE distance skalirano
 * polaznom tačkom (najviše ~75% iznad onoga što već trči, uz apsolutni pod od
 * +20 km), (3) apsolutni plafon protiv degenerisanog unosa. Nikad ispod unetog.
 */
export function peakVolume(
  h: DistanceHeuristic,
  cur: number,
  rampSteps: number,
  intensity: Intensity
): number {
  let v = cur;
  for (let i = 0; i < rampSteps; i++) v += rampStep(h, v, intensity);
  const destination = Math.min(h.targetVolumeKm, Math.max(cur * 1.75, cur + 20));
  const upper = Math.max(cur * 1.1, destination);
  return Math.max(cur, Math.min(v, upper, h.hardCapKm));
}

/**
 * Plafon dugog trčanja [km]: udeo nedelje (na niskom obimu veći — trkač mora
 * da bude sposoban da pretrči samu distancu), vremenski plafon i apsolutni.
 */
export function longRunCap(h: DistanceHeuristic, vol: number, longRunPaceSecPerKm: number): number {
  const lr = h.longRun;
  const timeCap = longRunPaceSecPerKm > 0 ? (lr.timeCapMin * 60) / longRunPaceSecPerKm : Infinity;
  const share = Math.max(vol * lr.share, Math.min(lr.lowVolumeCapKm, vol * lr.lowVolumeShare));
  return Math.min(share, timeCap, lr.absCapKm);
}
