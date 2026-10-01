/* 10K — trenerski model.
   Stoji na aerobnoj bazi više nego 5K. Prag je ravnopravan sa VO2max; tempo trke
   je SPORIJI od I tempa, pa se intervali NE vezuju za njega (za rad na ritmu
   trke postoji zasebna sesija „Trkački ritam"). Duže baze za početnike. */

import { r1 } from '../../format';
import { HEURISTIC_10K as H, PRODUCT_10K } from '../constants/distances';
import { sessInt, wuCdForVolume } from '../sessions/build';
import { cruiseIntervals, type CruiseParams } from '../sessions/cruise';
import {
  chooseReps,
  fartlek,
  intervalsOf,
  proportionalRest,
  pyramid,
  type FartlekParams,
  type PyramidParams
} from '../sessions/intervals';
import { progressionRun, type ProgressionParams } from '../sessions/progression';
import { repetitions } from '../sessions/repetitions';
import { continuousTempo, type TempoParams } from '../sessions/tempo';
import type { SessionDay } from '../types';
import type { DistanceProfile, Phase, QualityRequest } from './types';

const TEMPO: TempoParams = { floorCapKm: 4, floorShare: 0.12 };
const CRUISE: CruiseParams = {
  floorCapKm: 3,
  floorShare: 0.12,
  ladder: [
    { fromKm: 8, repKm: 3.0 },
    { fromKm: 5, repKm: 2.0 },
    { fromKm: 3, repKm: 1.6 }
  ],
  minRepKm: 1.0,
  restSec: () => 90
};
const FARTLEK: FartlekParams = { minN: 6, maxN: 12, nShare: 0.18, surgeSec: 90, restSec: 90 };
const PYRAMID: PyramidParams = {
  tiers: [
    { fromKm: 5.0, legs: [600, 1000, 1600, 1000, 600] },
    { fromKm: 3.5, legs: [400, 800, 1200, 800, 400] }
  ],
  fallbackLegs: [400, 600, 800, 600, 400],
  restSec: 105
};
const PROGRESSION: ProgressionParams = { minKm: 5, maxKm: 14, pct: 0.2 };
const INTERVAL_LADDER_M = [1600, 1200, 1000, 800, 600, 400] as const;

/** <30% prag, <70% vrhunac, ostalo specifika. */
function phase10K(qualW: number, qualWeeks: number): Phase {
  const f = qualW / Math.max(qualWeeks, 1);
  if (f < 0.3) return 'threshold';
  if (f < 0.7) return 'peak';
  return 'specific';
}

const intervalWish = (phase: Phase, wkIdx: number): number => {
  const menu =
    phase === 'threshold' ? [1000, 1200] : phase === 'specific' ? [1200, 1600] : [1000, 1200, 1600];
  return menu[wkIdx % menu.length] as number;
};

const mkIntervals = (
  dow: number,
  vol: number,
  pI: number,
  phase: Phase,
  wkIdx: number
): SessionDay => {
  const q = Math.min(Math.max(vol * H.intervalBudget.pct, 2.0), H.intervalBudget.maxKm);
  const { rep, n } = chooseReps(q, intervalWish(phase, wkIdx), INTERVAL_LADDER_M, 400);
  return intervalsOf(dow, vol, n, rep, pI, proportionalRest(rep, pI));
};

const mkRacePace = (dow: number, vol: number, racePace: number, wkIdx: number): SessionDay => {
  const q = Math.min(Math.max(vol * 0.1, 2.5), 8);
  const longer = (wkIdx || 0) % 2 === 0;
  const rep = q >= 6 ? (longer ? 1600 : 1200) : q >= 3.5 ? (longer ? 1200 : 1000) : 1000;
  const n = Math.max(3, Math.floor((q * 1000) / rep + 0.08));
  const [wu, cd] = wuCdForVolume(vol);
  return sessInt(dow, wu, n, rep, racePace, rep >= 1600 ? 75 : 60, cd, 'Trkački ritam');
};

const mkPyramid = (dow: number, vol: number, pI: number): SessionDay =>
  pyramid(
    PYRAMID,
    Math.min(Math.max(vol * H.intervalBudget.pct, 2.0), H.intervalBudget.maxKm),
    dow,
    vol,
    pI
  );

const mkRepetitions = (dow: number, vol: number, pR: number): SessionDay =>
  repetitions({ minTotalKm: 1.2, ...H.repetitionBudget }, 300, dow, vol, pR);

const mkTempo = (dow: number, vol: number, pT: number, fixKm?: number | null): SessionDay =>
  continuousTempo(H, TEMPO, dow, vol, pT, fixKm);

const mkCruise = (dow: number, vol: number, pT: number): SessionDay =>
  cruiseIntervals(H.tempoBudget.pct, CRUISE, dow, vol, pT);

const mkProgression = (dow: number, vol: number, pT: number, pE: number): SessionDay =>
  progressionRun(PROGRESSION, dow, vol, pT, pE);

function buildQuality10K(req: QualityRequest): SessionDay {
  const { qualW, qualWeeks, slotRole, effQ, vol, pI, pT, pE, pR, isTaper1, dow, racePace } = req;
  const phase = phase10K(qualW, qualWeeks);

  if (isTaper1) {
    const [twu, tcd] = wuCdForVolume(vol);
    if (effQ === 1 || slotRole === 'q1') {
      const n = Math.max(3, Math.min(5, Math.round(vol * 0.02)));
      return sessInt(
        dow,
        r1(Math.max(twu * 0.8, 1)),
        n,
        600,
        Math.max(pI, racePace),
        75,
        r1(Math.max(tcd * 0.8, 0.8)),
        'Trkački ritam'
      );
    }
    return mkTempo(dow, vol, pT, r1(Math.min(4, Math.max(2, vol * 0.08))));
  }

  if (effQ === 1) {
    if (phase === 'threshold')
      return qualW % 3 === 2 ? mkRepetitions(dow, vol, pR) : mkCruise(dow, vol, pT);
    if (phase === 'specific') {
      return qualW % 2 === 1
        ? mkRacePace(dow, vol, racePace, qualW)
        : mkProgression(dow, vol, pT, pE);
    }
    const m = qualW % 4;
    if (m === 0) return fartlek(FARTLEK, dow, vol, pI, pE);
    if (m === 2) return mkIntervals(dow, vol, pI, phase, qualW);
    return mkCruise(dow, vol, pT);
  }

  if (slotRole === 'q1') {
    if (phase === 'threshold') return mkRepetitions(dow, vol, pR);
    if (phase === 'specific') {
      return qualW % 3 === 0
        ? mkIntervals(dow, vol, pI, phase, qualW)
        : mkRacePace(dow, vol, racePace, qualW);
    }
    if (qualW % 6 === 3) return mkPyramid(dow, vol, pI);
    if (qualW % 4 === 2) return fartlek(FARTLEK, dow, vol, pI, pE);
    return mkIntervals(dow, vol, pI, phase, qualW);
  }

  if (phase === 'threshold')
    return qualW % 2 === 1 ? mkCruise(dow, vol, pT) : mkTempo(dow, vol, pT);
  if (phase === 'specific')
    return qualW % 2 === 1 ? mkProgression(dow, vol, pT, pE) : mkTempo(dow, vol, pT);
  return qualW % 2 === 1 ? mkCruise(dow, vol, pT) : mkTempo(dow, vol, pT);
}

export const PROFILE_10K: DistanceProfile = {
  product: PRODUCT_10K,
  heuristic: H,
  phase: phase10K,
  buildQuality: buildQuality10K,
  intervalPaceForWeek: (pI) => pI
};
