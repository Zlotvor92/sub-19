/* 10K — trenerski model.
   Stoji na aerobnoj bazi više nego 5K. Prag je ravnopravan sa VO2max; tempo trke
   je SPORIJI od I tempa, pa se intervali NE vezuju za njega (za rad na ritmu
   trke postoji zasebna sesija „Trkački ritam"). Duže baze za početnike. */

import { r1 } from '../../format';
import { HEURISTIC_10K as H, PRODUCT_10K } from '../constants/distances';
import {
  sessFartlek,
  sessInt,
  sessPyramid,
  sessProg,
  sessTempo,
  wuCdForVolume
} from '../sessions/build';
import type { SessionDay } from '../types';
import type { DistanceProfile, Phase, QualityRequest } from './types';

/** <30% prag, <70% vrhunac, ostalo specifika. */
function phase10K(qualW: number, qualWeeks: number): Phase {
  const f = qualW / Math.max(qualWeeks, 1);
  if (f < 0.3) return 'threshold';
  if (f < 0.7) return 'peak';
  return 'specific';
}

function reps10K(workKm: number, phase: Phase, wkIdx: number): { rep: number; n: number } {
  const menu =
    phase === 'threshold' ? [1000, 1200] : phase === 'specific' ? [1200, 1600] : [1000, 1200, 1600];
  const wish = menu[wkIdx % menu.length] as number;
  const budgetM = workKm * 1000;
  const ladder = [1600, 1200, 1000, 800, 600, 400].filter((x) => x <= wish);
  const rep = ladder.find((x) => 3 * x <= budgetM * 1.15) ?? 400;
  const n = Math.max(3, Math.floor(budgetM / rep + 0.08));
  return { rep, n };
}

/** Pauza: 80% vremena deonice, u granicama 90–180 s. */
const rest10K = (repM: number, paceSec: number): number =>
  Math.min(180, Math.max(90, Math.round((repM / 1000) * paceSec * 0.8)));

const mkIntervals = (
  dow: number,
  vol: number,
  pI: number,
  phase: Phase,
  wkIdx: number
): SessionDay => {
  const q = Math.min(Math.max(vol * H.intervalBudget.pct, 2.0), H.intervalBudget.maxKm);
  const { rep, n } = reps10K(q, phase, wkIdx);
  const [wu, cd] = wuCdForVolume(vol);
  return sessInt(dow, wu, n, rep, pI, rest10K(rep, pI), cd, 'Intervali');
};

const mkRacePace = (dow: number, vol: number, racePace: number, wkIdx: number): SessionDay => {
  const q = Math.min(Math.max(vol * 0.1, 2.5), 8);
  const longer = (wkIdx || 0) % 2 === 0;
  const rep = q >= 6 ? (longer ? 1600 : 1200) : q >= 3.5 ? (longer ? 1200 : 1000) : 1000;
  const n = Math.max(3, Math.floor((q * 1000) / rep + 0.08));
  const [wu, cd] = wuCdForVolume(vol);
  return sessInt(dow, wu, n, rep, racePace, rep >= 1600 ? 75 : 60, cd, 'Trkački ritam');
};

const mkPyramid = (dow: number, vol: number, pI: number): SessionDay => {
  const [wu, cd] = wuCdForVolume(vol);
  const q = Math.min(Math.max(vol * H.intervalBudget.pct, 2.0), H.intervalBudget.maxKm);
  const legs =
    q >= 5.0
      ? [600, 1000, 1600, 1000, 600]
      : q >= 3.5
        ? [400, 800, 1200, 800, 400]
        : [400, 600, 800, 600, 400];
  return sessPyramid(dow, wu, legs, pI, 105, cd, 'Piramida');
};

const mkFartlek = (dow: number, vol: number, pI: number, pE: number): SessionDay => {
  const n = Math.max(6, Math.min(12, Math.round(vol * 0.18)));
  const [wu, cd] = wuCdForVolume(vol);
  return sessFartlek(dow, wu, n, 90, 90, pI, cd, pE);
};

const mkRepetitions = (dow: number, vol: number, pR: number): SessionDay => {
  const total = Math.max(1.2, Math.min(vol * H.repetitionBudget.pct, H.repetitionBudget.maxKm));
  const repM = 300;
  const n = Math.max(4, Math.floor((total * 1000) / repM + 0.08));
  const restSec = Math.round((repM / 1000) * pR * 2.5);
  const [wu, cd] = wuCdForVolume(vol);
  return sessInt(dow, wu, n, repM, pR, restSec, cd, 'Repeticije');
};

const mkTempo = (dow: number, vol: number, pT: number, fixKm?: number | null): SessionDay => {
  const floor = Math.min(4, r1(vol * 0.12));
  const q =
    fixKm != null
      ? fixKm
      : r1(Math.max(floor, Math.min(vol * H.tempoBudget.pct, H.tempoMaxSec / pT)));
  const [wu, cd] = wuCdForVolume(vol);
  return sessTempo(dow, wu, q, pT, Math.max(cd, 1), 'Tempo');
};

const mkCruise = (dow: number, vol: number, pT: number): SessionDay => {
  const total = Math.max(Math.min(3, vol * 0.12), vol * H.tempoBudget.pct);
  const repKm = total >= 8 ? 3.0 : total >= 5 ? 2.0 : total >= 3 ? 1.6 : 1.0;
  const n = Math.max(2, Math.floor(total / repKm + 0.08));
  const [wu, cd] = wuCdForVolume(vol);
  return sessInt(dow, wu, n, Math.round(repKm * 1000), pT, 90, Math.max(cd, 1), 'Tempo isprekidan');
};

const mkProgression = (dow: number, vol: number, pT: number, pE: number): SessionDay => {
  const total = r1(Math.max(5, Math.min(vol * 0.2, 14)));
  return sessProg(dow, total, pT, pE);
};

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
    if (m === 0) return mkFartlek(dow, vol, pI, pE);
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
    if (qualW % 4 === 2) return mkFartlek(dow, vol, pI, pE);
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
