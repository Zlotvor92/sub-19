/* Polumaraton — trenerski model.
   Prag i tempo trke su glavni motor; VO2max je potpora. Dve taper nedelje,
   srednje-dugo trčanje (MLR), uputstvo za gorivo od 90 min, kontrolna trka 3–4
   nedelje pred cilj, strategija ritma po vremenu trke. */

import { fmtClock, r1 } from '../../format';
import { HEURISTIC_21K as H, PRODUCT_21K } from '../constants/distances';
import { DELOAD_EVERY } from '../constants/heuristics';
import { sessFartlek, sessInt, sessProg, sessTempo, wuCdForVolume } from '../sessions/build';
import type { SessionDay } from '../types';
import type { DistanceProfile, PaceStrategy, Phase, QualityRequest } from './types';

/** <30% prag, <60% vrhunac, ostalo specifika. */
function phase21K(qualW: number, qualWeeks: number): Phase {
  const f = qualW / Math.max(qualWeeks, 1);
  if (f < 0.3) return 'threshold';
  if (f < 0.6) return 'peak';
  return 'specific';
}

/** Strategija ritma po vremenu trke: <80 min prag, ≤110 min blokovi na tempu trke, inače dugo. */
export function paceStrategy21K(racePaceSec: number): PaceStrategy {
  const min = (racePaceSec * 21.0975) / 60;
  if (min < 80) return 'threshold';
  if (min <= 110) return 'blocks';
  return 'long';
}

function reps21K(workKm: number, phase: Phase, wkIdx: number): { rep: number; n: number } {
  const menu = phase === 'threshold' ? [1200, 1600] : [1200, 1600, 2000];
  const wish = menu[wkIdx % menu.length] as number;
  const budgetM = workKm * 1000;
  const ladder = [2000, 1600, 1200, 1000, 800, 600].filter((x) => x <= wish);
  const rep = ladder.find((x) => 3 * x <= budgetM * 1.15) ?? 600;
  const n = Math.max(3, Math.floor(budgetM / rep + 0.08));
  return { rep, n };
}

const rest21K = (repM: number, paceSec: number): number =>
  Math.min(180, Math.max(90, Math.round((repM / 1000) * paceSec * 0.8)));

const mkIntervals = (
  dow: number,
  vol: number,
  pI: number,
  phase: Phase,
  wkIdx: number
): SessionDay => {
  const q = Math.min(Math.max(vol * H.intervalBudget.pct, 2.4), H.intervalBudget.maxKm);
  const { rep, n } = reps21K(q, phase, wkIdx);
  const [wu, cd] = wuCdForVolume(vol);
  return sessInt(dow, wu, n, rep, pI, rest21K(rep, pI), cd, 'Intervali');
};

/** `share` (0.6) deli nedeljni budžet praga kad se q1 ujedno računa na prag. */
const mkCruise = (dow: number, vol: number, pT: number, share?: number | null): SessionDay => {
  const total = Math.max(Math.min(3, vol * 0.12), vol * H.tempoBudget.pct) * (share || 1);
  const repKm = total >= 10 ? 3.0 : total >= 6 ? 2.5 : total >= 3.5 ? 1.6 : 1.0;
  const n = Math.max(2, Math.floor(total / repKm + 0.08));
  const [wu, cd] = wuCdForVolume(vol);
  return sessInt(
    dow,
    wu,
    n,
    Math.round(repKm * 1000),
    pT,
    repKm >= 2.5 ? 75 : 60,
    Math.max(cd, 1),
    'Tempo isprekidan'
  );
};

const mkTempo = (
  dow: number,
  vol: number,
  pT: number,
  fixKm?: number | null,
  share?: number | null
): SessionDay => {
  const floor = Math.min(5, r1(vol * 0.1)) * (share || 1);
  const q =
    fixKm != null
      ? fixKm
      : r1(Math.max(floor, Math.min(vol * H.tempoBudget.pct * (share || 1), H.tempoMaxSec / pT)));
  const [wu, cd] = wuCdForVolume(vol);
  return sessTempo(dow, wu, q, pT, Math.max(cd, 1), 'Tempo');
};

/** Blokovi na tempu trke (2–5 km) sa kratkim džogom između. */
const mkRaceRhythm = (
  dow: number,
  vol: number,
  racePace: number,
  pE: number,
  qualW: number
): SessionDay => {
  const q = Math.min(
    Math.max(vol * H.racePaceBudget.pct, Math.min(4, vol * 0.1)),
    H.racePaceBudget.maxKm
  );
  const early = (qualW || 0) % 2 === 0;
  const repKm = q >= 12 ? (early ? 4.0 : 5.0) : q >= 7.5 ? (early ? 3.0 : 4.0) : q >= 5 ? 3.0 : 2.0;
  const n = Math.max(2, Math.floor(q / repKm + 0.08));
  const [wu, cd] = wuCdForVolume(vol);
  return sessInt(
    dow,
    wu,
    n,
    Math.round(repKm * 1000),
    racePace,
    Math.round(pE * 0.9),
    Math.max(cd, 1),
    'Tempo trke'
  );
};

const mkFartlek = (dow: number, vol: number, pI: number, pE: number): SessionDay => {
  const n = Math.max(5, Math.min(10, Math.round(vol * 0.12)));
  const [wu, cd] = wuCdForVolume(vol);
  return sessFartlek(dow, wu, n, 120, 90, pI, cd, pE);
};

const mkRepetitions = (dow: number, vol: number, pR: number): SessionDay => {
  const total = Math.max(1.2, Math.min(vol * H.repetitionBudget.pct, H.repetitionBudget.maxKm));
  const repM = 300;
  const n = Math.max(4, Math.floor((total * 1000) / repM + 0.08));
  const restSec = Math.round((repM / 1000) * pR * 2.5);
  const [wu, cd] = wuCdForVolume(vol);
  return sessInt(dow, wu, n, repM, pR, restSec, cd, 'Repeticije');
};

const mkProgression = (
  dow: number,
  vol: number,
  endPace: number,
  pE: number,
  share: number | null,
  atRacePace: boolean
): SessionDay => {
  const total = r1(Math.max(6, Math.min(vol * 0.2 * (share || 1), 16)));
  return sessProg(dow, total, endPace, pE, atRacePace ? 'Progresivno (tempo trke)' : 'Progresivno');
};

/**
 * Kontrolna trka: pravi presek forme 3–4 nedelje pred cilj — i probni dan za
 * opremu, doručak i gorivo. NAMERNO nema Danielsovu zonu (v. ZONE_FOR_KIND):
 * korisnik je može istrčati punom snagom ili kontrolisano.
 */
const mkTimeTrial = (dow: number, vol: number, racePace: number): SessionDay => {
  const [wu, cd] = wuCdForVolume(vol);
  const trialKm = Math.max(5, Math.min(10, Math.round(vol * 0.15)));
  const km = r1(wu + trialKm + cd);
  const what = trialKm >= 8 ? '10K trka' : 'kraća trka (5K ili 10K)';
  return {
    dow,
    tag: 'tempo',
    km,
    desc:
      `Kontrolna trka — ${wu} km zagrevanje + ${trialKm} km + ${cd} km hlađenje. ` +
      `Ako nađeš pravu trku (${what}) — trči je PUNOM SNAGOM, brže od tempa polumaratona; to je najpošteniji presek forme. ` +
      `Ako je nema, istrči ${trialKm} km sam, kontrolisano na ${fmtClock(racePace)}/km (tempo polumaratona). ` +
      `Isprobaj opremu, doručak i gorivo tačno kako planiraš na dan trke. ` +
      `Sledeća 2–3 dana drži skroz lagano, bez obzira kako se osećaš.`,
    session: {
      type: 'tempo',
      kind: 'Kontrolna trka',
      wuKm: wu,
      qKm: trialKm,
      paceSec: racePace,
      cdKm: cd,
      overrides: {}
    }
  };
};

type Family = 'I' | 'R' | 'T' | 'RP';

/**
 * Koji sistem gađa q1 te nedelje — JEDAN izvor istine za izbor sesije I za
 * deljenje nedeljnog budžeta praga (Danielsov budžet je NEDELJNI, ne po sesiji).
 */
function q1Family(phase: Phase, strat: PaceStrategy, qualW: number): Family {
  if (phase === 'threshold') return qualW % 3 === 0 ? 'I' : 'R';
  if (phase === 'peak') return 'I'; // faza vrhunca je VO2max faza
  if (strat === 'blocks') return 'RP';
  if (strat === 'threshold') return qualW % 3 === 0 ? 'I' : 'T';
  return qualW % 2 === 1 ? 'RP' : 'T'; // 'long'
}

function buildQuality21K(req: QualityRequest): SessionDay {
  const { qualW, qualWeeks, slotRole, effQ, vol, pI, pT, pE, pR, isTaper1, dow, racePace, ctx } =
    req;
  const phase = phase21K(qualW, qualWeeks);
  const strat = paceStrategy21K(racePace);
  /* Kad q1 ide na prag (T), deli nedeljni budžet praga sa q2: 60% / 40%. */
  const share = effQ === 2 && q1Family(phase, strat, qualW) === 'T' ? 0.6 : 1;

  if (isTaper1) {
    const [twu, tcd] = wuCdForVolume(vol);
    if (effQ === 1 || slotRole === 'q1') {
      const km = r1(Math.min(5, Math.max(2, vol * 0.09)));
      return sessTempo(
        dow,
        r1(Math.max(twu * 0.8, 1)),
        km,
        racePace,
        r1(Math.max(tcd * 0.8, 0.8)),
        'Tempo trke'
      );
    }
    return mkTempo(dow, vol, pT, r1(Math.min(4, Math.max(2, vol * 0.07))));
  }

  /* KONTROLNA TRKA umesto q1 — cilja se 4 nedelje pre; ako je BAŠ ta nedelja deload
     (nema kvaliteta), pomera se na 3 nedelje pre. */
  if (
    ctx.weeks &&
    ctx.w &&
    phase === 'specific' &&
    (effQ === 1 || slotRole === 'q1') &&
    vol >= 30
  ) {
    const weeksToRace = ctx.weeks - ctx.w;
    const w4 = ctx.weeks - 4;
    const lastWorking = ctx.weeks - 1 - (ctx.taperW || 1);
    const fourthIsDeload = w4 > 0 && w4 % DELOAD_EVERY === 0 && w4 < lastWorking;
    if (weeksToRace === 4 ? !fourthIsDeload : weeksToRace === 3 && fourthIsDeload) {
      return mkTimeTrial(dow, vol, racePace);
    }
  }

  if (effQ === 1) {
    if (phase === 'threshold')
      return qualW % 3 === 2 ? mkRepetitions(dow, vol, pR) : mkCruise(dow, vol, pT);
    if (phase === 'peak') {
      const m = qualW % 3;
      return m === 1 ? mkIntervals(dow, vol, pI, phase, qualW) : mkCruise(dow, vol, pT);
    }
    if (strat === 'blocks') {
      return qualW % 2 === 1 ? mkRaceRhythm(dow, vol, racePace, pE, qualW) : mkTempo(dow, vol, pT);
    }
    return qualW % 2 === 1
      ? mkCruise(dow, vol, pT)
      : mkProgression(dow, vol, strat === 'long' ? racePace : pT, pE, null, strat === 'long');
  }

  if (slotRole === 'q1') {
    const fam = q1Family(phase, strat, qualW);
    if (fam === 'R') return mkRepetitions(dow, vol, pR);
    if (fam === 'I') {
      return qualW % 4 === 2
        ? mkFartlek(dow, vol, pI, pE)
        : mkIntervals(dow, vol, pI, phase, qualW);
    }
    if (fam === 'RP') {
      return phase === 'specific' && strat === 'long'
        ? mkProgression(dow, vol, racePace, pE, null, true)
        : mkRaceRhythm(dow, vol, racePace, pE, qualW);
    }
    /* fam === 'T' */
    return phase === 'peak'
      ? mkProgression(dow, vol, pT, pE, share, false)
      : mkCruise(dow, vol, pT, share);
  }

  /* q2: prag */
  if (phase === 'specific') {
    return qualW % 2 === 1 ? mkTempo(dow, vol, pT, null, share) : mkCruise(dow, vol, pT, share);
  }
  return qualW % 2 === 1 ? mkCruise(dow, vol, pT, share) : mkTempo(dow, vol, pT, null, share);
}

/** Brz završetak dugog trčanja na tempu trke u specifičnoj fazi (češće za strategiju „dugo"). */
function longRunFinish21K(
  phase: Phase,
  qualW: number,
  lrKm: number,
  racePace: number,
  strategy: PaceStrategy | null
): string {
  if (phase !== 'specific' || !(lrKm >= 10)) return '';
  const often = strategy === 'long';
  if (!often && qualW % 2 === 0) return '';
  const finish = r1(Math.max(3, Math.min(6, lrKm * 0.25)));
  return ` · brz završetak: poslednjih ${finish} km @ ${fmtClock(racePace)}/km (tempo trke, na umornim nogama)`;
}

export const PROFILE_21K: DistanceProfile = {
  product: PRODUCT_21K,
  heuristic: H,
  phase: phase21K,
  buildQuality: buildQuality21K,
  intervalPaceForWeek: (pI) => pI,
  paceStrategy: paceStrategy21K,
  longRunFinish: longRunFinish21K
};
