import { ZONE_FRACTION } from '../constants/heuristics';
import type { Zone } from '../types';
import { vAtVo2 } from './physiology';
import { raceTimeForVdot } from './racePrediction';

const MARATHON_M = 42195;

/**
 * Tempo [s/km] za zonu pri datom VDOT-u.
 *
 * Zona M NIJE procenat VO2max nego definicija: tempo maratonske trke za taj
 * VDOT (Daniels). Procenat je grešio 3–6 s/km naniže i ubrzavao plan preko
 * procene forme — zato se izvodi iz iste jednačine kao predviđanje trke.
 */
export function paceForZone(vdot: number, zone: Zone): number {
  if (zone === 'M') return Math.round(raceTimeForVdot(vdot, MARATHON_M) / 42.195);
  const v = vAtVo2(vdot * ZONE_FRACTION[zone]); // m/min
  return Math.round(60000 / v);
}
