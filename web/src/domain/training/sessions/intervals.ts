/* VO2max intervali, piramida i fartlek. */

import type { SessionDay } from '../types';
import { sessFartlek, sessInt, sessPyramid, wuCdForVolume } from './build';

/**
 * Dužina i broj ponavljanja za dati radni budžet [km]. Budžet zone je PLAFON:
 * DUŽINA ponavljanja se skraćuje dok tri ponavljanja ne stanu u budžet (broj
 * ostaje ≥ 3), a broj se zaokružuje NANIZE uz toleranciju 8% (Math.round bi probio
 * Danielsov budžet — nađeno u 41 scenariju).
 */
export function chooseReps(
  workKm: number,
  wishM: number,
  ladderM: readonly number[],
  fallbackM: number
): { rep: number; n: number } {
  const budgetM = workKm * 1000;
  const rep = ladderM.filter((x) => x <= wishM).find((x) => 3 * x <= budgetM * 1.15) ?? fallbackM;
  const n = Math.max(3, Math.floor(budgetM / rep + 0.08));
  return { rep, n };
}

/** Pauza: 80% vremena deonice, u granicama 90–180 s. */
export const proportionalRest = (repM: number, paceSec: number): number =>
  Math.min(180, Math.max(90, Math.round((repM / 1000) * paceSec * 0.8)));

export interface PyramidParams {
  /** Od najvećeg radnog budžeta nadole: prva piramida čiji je `fromKm` ≤ budžet. */
  tiers: ReadonlyArray<{ fromKm: number; legs: readonly number[] }>;
  fallbackLegs: readonly number[];
  restSec: number;
}

export function pyramid(
  p: PyramidParams,
  workKm: number,
  dow: number,
  vol: number,
  pI: number
): SessionDay {
  const [wu, cd] = wuCdForVolume(vol);
  const legs = p.tiers.find((t) => workKm >= t.fromKm)?.legs ?? p.fallbackLegs;
  return sessPyramid(dow, wu, [...legs], pI, p.restSec, cd, 'Piramida');
}

export interface FartlekParams {
  minN: number;
  maxN: number;
  nShare: number;
  surgeSec: number;
  restSec: number;
}

export function fartlek(
  p: FartlekParams,
  dow: number,
  vol: number,
  pI: number,
  pE: number
): SessionDay {
  const n = Math.max(p.minN, Math.min(p.maxN, Math.round(vol * p.nShare)));
  const [wu, cd] = wuCdForVolume(vol);
  return sessFartlek(dow, wu, n, p.surgeSec, p.restSec, pI, cd, pE);
}

/** Intervali sa zadatim ponavljanjima i pauzom (zagrevanje/smirivanje iz obima). */
export function intervalsOf(
  dow: number,
  vol: number,
  n: number,
  repM: number,
  paceSec: number,
  restSec: number
): SessionDay {
  const [wu, cd] = wuCdForVolume(vol);
  return sessInt(dow, wu, n, repM, paceSec, restSec, cd, 'Intervali');
}
