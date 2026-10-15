/* Progresivno trčanje: prve 2/3 lako, poslednja trećina na pragu (T). 10K ne pravi progresivno
   na tempu trke/maratonskom tempu. */

import { r1 } from '../../format';
import type { SessionDay } from '../types';
import { sessProg } from './build';

export interface ProgressionParams {
  minKm: number;
  maxKm: number;
  /** Udeo nedelje (puta `share` kad se budžet deli). */
  pct: number;
}

export function progressionRun(
  p: ProgressionParams,
  dow: number,
  vol: number,
  endPace: number,
  pE: number
): SessionDay {
  const total = r1(Math.max(p.minKm, Math.min(vol * p.pct, p.maxKm)));
  return sessProg(dow, total, endPace, pE, 'Progresivno', 'T');
}
