/* 5K — trenerski model.
   VO2max je GLAVNI motor (tempo trke je praktično I tempo): intervali 800–1200 m
   @ I su srce plana. Prag (T) je potpora, repeticije (R) grade ekonomiju (rano i
   ponovo pred trku radi oštrine). Obim je najmanje važan; dugo trčanje je
   aerobna potpora, ne specifičnost. */

import { r1 } from '../../format';
import { HEURISTIC_5K as H, PRODUCT_5K } from '../constants/distances';
import { sessInt, wuCdForVolume } from '../sessions/build';
import { cruiseIntervals, type CruiseParams } from '../sessions/cruise';
import {
  chooseReps,
  fartlek,
  intervalsOf,
  pyramid,
  type FartlekParams,
  type PyramidParams
} from '../sessions/intervals';
import { repetitions } from '../sessions/repetitions';
import { continuousTempo, type TempoParams } from '../sessions/tempo';
import type { SessionDay } from '../types';
import type { DistanceProfile, Phase, QualityRequest } from './types';

const TEMPO: TempoParams = { floorCapKm: 3, floorShare: 0.12 };
const CRUISE: CruiseParams = {
  floorCapKm: 3,
  floorShare: 0.12,
  ladder: [
    { fromKm: 6, repKm: 2.0 },
    { fromKm: 3, repKm: 1.6 }
  ],
  minRepKm: 1.0,
  restSec: () => 90
};
const FARTLEK: FartlekParams = { minN: 6, maxN: 12, nShare: 0.2, surgeSec: 60, restSec: 60 };
const PYRAMID: PyramidParams = {
  tiers: [
    { fromKm: 3.4, legs: [400, 800, 1200, 800, 400] },
    { fromKm: 2.6, legs: [400, 600, 800, 600, 400] }
  ],
  fallbackLegs: [200, 400, 600, 400, 200],
  restSec: 90
};
const INTERVAL_LADDER_M = [1200, 1000, 800, 600, 400] as const;

/** Faze po udelu kvalitetnog ciklusa: <25% ekonomija, <75% vrhunac, ostalo oštrenje. */
function phase5K(qualW: number, qualWeeks: number): Phase {
  const f = qualW / Math.max(qualWeeks, 1);
  if (f < 0.25) return 'economy';
  if (f < 0.75) return 'peak';
  return 'sharpening';
}

/** Dužina intervala za 5K: 800–1200 m je srce; kraći (600) samo u oštrenju. */
const intervalWish = (phase: Phase, wkIdx: number): number => {
  const menu = phase === 'sharpening' ? [600, 800] : phase === 'peak' ? [1000, 1200] : [800, 1000];
  return menu[wkIdx % menu.length] as number;
};

const mkIntervals = (
  dow: number,
  vol: number,
  pI: number,
  phase: Phase,
  wkIdx: number
): SessionDay => {
  const q = Math.min(Math.max(vol * H.intervalBudget.pct, 1.6), H.intervalBudget.maxKm);
  const { rep, n } = chooseReps(q, intervalWish(phase, wkIdx), INTERVAL_LADDER_M, 400);
  return intervalsOf(dow, vol, n, rep, pI, 120);
};

const mkRacePace = (dow: number, vol: number, racePace: number): SessionDay => {
  const q = Math.min(Math.max(vol * H.intervalBudget.pct, 1.6), 6);
  const rep = q >= 3 ? 1000 : 800;
  const n = Math.max(3, Math.floor((q * 1000) / rep + 0.08));
  const [wu, cd] = wuCdForVolume(vol);
  return sessInt(dow, wu, n, rep, racePace, 90, cd, 'Trkački ritam');
};

const mkPyramid = (dow: number, vol: number, pI: number): SessionDay =>
  pyramid(
    PYRAMID,
    Math.min(Math.max(vol * H.intervalBudget.pct, 1.6), H.intervalBudget.maxKm),
    dow,
    vol,
    pI
  );

const mkRepetitions = (dow: number, vol: number, pR: number, phase: Phase): SessionDay =>
  repetitions(
    { minTotalKm: 1.2, ...H.repetitionBudget },
    phase === 'sharpening' ? 200 : 300,
    dow,
    vol,
    pR
  );

const mkTempo = (dow: number, vol: number, pT: number, fixKm?: number | null): SessionDay =>
  continuousTempo(H, TEMPO, dow, vol, pT, fixKm);

const mkCruise = (dow: number, vol: number, pT: number): SessionDay =>
  cruiseIntervals(H.tempoBudget.pct, CRUISE, dow, vol, pT);

function buildQuality5K(req: QualityRequest): SessionDay {
  const { qualW, qualWeeks, slotRole, effQ, vol, pI, pT, pE, pR, isTaper1, dow, racePace } = req;
  const phase = phase5K(qualW, qualWeeks);

  /* TAPER: oštrina ostaje, količina pada; q1 = kratka serija na ciljnom ritmu, q2 = kratak tempo.
     Zagrevanje/smirivanje se skaliraju i MORAJU kroz r1() (inače procuri 1.2000000000000002). */
  if (isTaper1) {
    const [twu, tcd] = wuCdForVolume(vol);
    if (effQ === 1 || slotRole === 'q1') {
      const n = Math.max(4, Math.min(6, Math.round(vol * 0.03)));
      return sessInt(
        dow,
        r1(Math.max(twu * 0.75, 1)),
        n,
        400,
        Math.max(pI, racePace),
        90,
        r1(Math.max(tcd * 0.75, 0.8)),
        'Intervali'
      );
    }
    return mkTempo(dow, vol, pT, r1(Math.min(3, Math.max(1.5, vol * 0.08))));
  }

  if (effQ === 1) {
    /* Jedini kvalitet pokriva sve — rotira po nedeljama. */
    if (phase === 'economy')
      return qualW % 2 === 1 ? mkRepetitions(dow, vol, pR, phase) : mkCruise(dow, vol, pT);
    if (phase === 'sharpening')
      return qualW % 2 === 1 ? mkRacePace(dow, vol, racePace) : mkTempo(dow, vol, pT);
    const m = qualW % 3;
    if (m === 0) return fartlek(FARTLEK, dow, vol, pI, pE);
    if (m === 2) return mkTempo(dow, vol, pT);
    return mkIntervals(dow, vol, pI, phase, qualW);
  }

  if (slotRole === 'q1') {
    if (phase === 'economy') return mkRepetitions(dow, vol, pR, phase);
    if (phase === 'sharpening') {
      return qualW % 2 === 1
        ? mkRacePace(dow, vol, racePace)
        : mkIntervals(dow, vol, pI, phase, qualW);
    }
    if (qualW % 6 === 3) return mkPyramid(dow, vol, pI);
    if (qualW % 4 === 2) return fartlek(FARTLEK, dow, vol, pI, pE);
    return mkIntervals(dow, vol, pI, phase, qualW);
  }

  /* q2: prag */
  if (phase === 'economy') return mkCruise(dow, vol, pT);
  if (phase === 'sharpening') return mkTempo(dow, vol, pT, 3);
  return qualW % 2 === 1 ? mkCruise(dow, vol, pT) : mkTempo(dow, vol, pT);
}

export const PROFILE_5K: DistanceProfile = {
  product: PRODUCT_5K,
  heuristic: H,
  phase: phase5K,
  buildQuality: buildQuality5K,
  /* Pred kraj (≤6 nedelja) intervali se vezuju za tempo trke da se ne trče BRŽE od trke. */
  intervalPaceForWeek: (pI, racePace, weeksToRace) =>
    weeksToRace <= 6 ? Math.max(pI, racePace) : pI
};
