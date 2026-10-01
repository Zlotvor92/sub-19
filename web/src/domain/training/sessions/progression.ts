/* Progresivno trčanje: prve 2/3 lako, poslednja trećina na zadatom tempu. */

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
  pE: number,
  opts: { share?: number | null; atRacePace?: boolean } = {}
): SessionDay {
  const total = r1(Math.max(p.minKm, Math.min(vol * p.pct * (opts.share || 1), p.maxKm)));
  return sessProg(
    dow,
    total,
    endPace,
    pE,
    opts.atRacePace ? 'Progresivno (tempo trke)' : 'Progresivno'
  );
}
