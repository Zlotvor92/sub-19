/* 5K — trenerski model.
   VO2max je GLAVNI motor (tempo trke je praktično I tempo): intervali 800–1200 m
   @ I su srce plana. Prag (T) je potpora, repeticije (R) grade ekonomiju (rano i
   ponovo pred trku radi oštrine). Obim je najmanje važan; dugo trčanje je
   aerobna potpora, ne specifičnost. */

import { r1 } from '../../format';
import { HEURISTIC_5K as H, PRODUCT_5K } from '../constants/distances';
import { sessFartlek, sessInt, sessPyramid, sessTempo, wuCdForVolume } from '../sessions/build';
import type { SessionDay } from '../types';
import type { DistanceProfile, Phase, QualityRequest } from './types';

/** Faze po udelu kvalitetnog ciklusa: <25% ekonomija, <75% vrhunac, ostalo oštrenje. */
function phase5K(qualW: number, qualWeeks: number): Phase {
  const f = qualW / Math.max(qualWeeks, 1);
  if (f < 0.25) return 'economy';
  if (f < 0.75) return 'peak';
  return 'sharpening';
}

/** Dužina intervala za 5K: 800–1200 m je srce; kraći (600) samo u oštrenju. Budžet zone je PLAFON. */
function reps5K(workKm: number, phase: Phase, wkIdx: number): { rep: number; n: number } {
  const menu = phase === 'sharpening' ? [600, 800] : phase === 'peak' ? [1000, 1200] : [800, 1000];
  const wish = menu[wkIdx % menu.length] as number;
  const budgetM = workKm * 1000;
  /* Dužina ponavljanja se skraćuje dok tri ponavljanja ne stanu u budžet; broj ostaje ≥ 3. */
  const ladder = [1200, 1000, 800, 600, 400].filter((x) => x <= wish);
  const rep = ladder.find((x) => 3 * x <= budgetM * 1.15) ?? 400;
  /* Zaokružuje se NANIZE (uz toleranciju 8%): Math.round bi probio Danielsov budžet. */
  const n = Math.max(3, Math.floor(budgetM / rep + 0.08));
  return { rep, n };
}

const mkIntervals = (
  dow: number,
  vol: number,
  pI: number,
  phase: Phase,
  wkIdx: number
): SessionDay => {
  const q = Math.min(Math.max(vol * H.intervalBudget.pct, 1.6), H.intervalBudget.maxKm);
  const { rep, n } = reps5K(q, phase, wkIdx);
  const [wu, cd] = wuCdForVolume(vol);
  return sessInt(dow, wu, n, rep, pI, 120, cd, 'Intervali');
};

const mkRacePace = (dow: number, vol: number, racePace: number): SessionDay => {
  const q = Math.min(Math.max(vol * H.intervalBudget.pct, 1.6), 6);
  const rep = q >= 3 ? 1000 : 800;
  const n = Math.max(3, Math.floor((q * 1000) / rep + 0.08));
  const [wu, cd] = wuCdForVolume(vol);
  return sessInt(dow, wu, n, rep, racePace, 90, cd, 'Trkački ritam');
};

const mkPyramid = (dow: number, vol: number, pI: number): SessionDay => {
  const [wu, cd] = wuCdForVolume(vol);
  const q = Math.min(Math.max(vol * H.intervalBudget.pct, 1.6), H.intervalBudget.maxKm);
  const legs =
    q >= 3.4
      ? [400, 800, 1200, 800, 400]
      : q >= 2.6
        ? [400, 600, 800, 600, 400]
        : [200, 400, 600, 400, 200];
  return sessPyramid(dow, wu, legs, pI, 90, cd, 'Piramida');
};

const mkFartlek = (dow: number, vol: number, pI: number, pE: number): SessionDay => {
  const n = Math.max(6, Math.min(12, Math.round(vol * 0.2)));
  const [wu, cd] = wuCdForVolume(vol);
  return sessFartlek(dow, wu, n, 60, 60, pI, cd, pE);
};

const mkRepetitions = (dow: number, vol: number, pR: number, phase: Phase): SessionDay => {
  const total = Math.max(1.2, Math.min(vol * H.repetitionBudget.pct, H.repetitionBudget.maxKm));
  const repM = phase === 'sharpening' ? 200 : 300;
  const n = Math.max(4, Math.floor((total * 1000) / repM + 0.08));
  const restSec = Math.round((repM / 1000) * pR * 2.5);
  const [wu, cd] = wuCdForVolume(vol);
  return sessInt(dow, wu, n, repM, pR, restSec, cd, 'Repeticije');
};

/** Kontinuiran prag. Pod: ≥3 km ili 12% nedelje; plafon: budžet i `tempoMaxSec`. */
const mkTempo = (dow: number, vol: number, pT: number, fixKm?: number | null): SessionDay => {
  const floor = Math.min(3, r1(vol * 0.12));
  const q =
    fixKm != null
      ? fixKm
      : r1(Math.max(floor, Math.min(vol * H.tempoBudget.pct, H.tempoMaxSec / pT)));
  const [wu, cd] = wuCdForVolume(vol);
  return sessTempo(dow, wu, q, pT, Math.max(cd, 1), 'Tempo');
};

/** Cruise intervali: prag sa kratkim pauzama u laganom trčanju. */
const mkCruise = (dow: number, vol: number, pT: number): SessionDay => {
  const total = Math.max(Math.min(3, vol * 0.12), vol * H.tempoBudget.pct);
  const repKm = total >= 6 ? 2.0 : total >= 3 ? 1.6 : 1.0;
  const n = Math.max(2, Math.floor(total / repKm + 0.08));
  const [wu, cd] = wuCdForVolume(vol);
  return sessInt(dow, wu, n, Math.round(repKm * 1000), pT, 90, Math.max(cd, 1), 'Tempo isprekidan');
};

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
    if (m === 0) return mkFartlek(dow, vol, pI, pE);
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
    if (qualW % 4 === 2) return mkFartlek(dow, vol, pI, pE);
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
