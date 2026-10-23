/* Repeticije (R): kratke deonice sa punim oporavkom — ekonomija koraka, ne kondicija. */

import type { SessionDay } from '../types';
import { sessInt, wuCdForVolume } from './build';

export interface RepetitionParams {
  minTotalKm: number;
  maxKm: number;
  pct: number;
}

export function repetitions(
  p: RepetitionParams,
  repM: number,
  dow: number,
  vol: number,
  pR: number
): SessionDay {
  const total = Math.max(p.minTotalKm, Math.min(vol * p.pct, p.maxKm));
  const n = Math.max(4, Math.floor((total * 1000) / repM + 0.08));
  const restSec = Math.round((repM / 1000) * pR * 2.5);
  const [wu, cd] = wuCdForVolume(vol);
  return sessInt(dow, wu, n, repM, pR, restSec, cd, 'Repeticije');
}
