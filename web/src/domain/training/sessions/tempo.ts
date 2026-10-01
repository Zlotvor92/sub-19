/* Kontinuiran prag („Tempo"). Jedna mašina za sve distance; razlikuju se samo
   podni udeo i podni plafon (parametri profila), budžet praga i najduži
   neprekidan prag (`tempoMaxSec`) — oba iz heuristike distance. */

import { r1 } from '../../format';
import type { SessionDay } from '../types';
import { sessTempo, wuCdForVolume } from './build';

export interface TempoParams {
  /** Pod trajanja: najviše `floorCapKm` km, inače `floorShare` × obim. */
  floorCapKm: number;
  floorShare: number;
}

export interface TempoBudget {
  tempoBudget: { pct: number };
  tempoMaxSec: number;
}

/**
 * `fixKm` zadaje tačnu dužinu (taper, uvodna nedelja). `share` (< 1) je udeo
 * nedeljnog budžeta praga kad se prag deli između dva dana (HM).
 */
export function continuousTempo(
  h: TempoBudget,
  p: TempoParams,
  dow: number,
  vol: number,
  pT: number,
  fixKm?: number | null,
  share?: number | null
): SessionDay {
  const floor = Math.min(p.floorCapKm, r1(vol * p.floorShare)) * (share || 1);
  const q =
    fixKm != null
      ? fixKm
      : r1(Math.max(floor, Math.min(vol * h.tempoBudget.pct * (share || 1), h.tempoMaxSec / pT)));
  const [wu, cd] = wuCdForVolume(vol);
  return sessTempo(dow, wu, q, pT, Math.max(cd, 1), 'Tempo');
}
