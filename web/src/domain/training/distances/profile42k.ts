/* Maraton — trenerski model.
   Aerobna izdržljivost i tempo maratona su motor; prag je potpora, VO2max i
   repeticije su minimalni. Dugo trčanje ima SOPSTVEN talas (trčanje od 3 sata
   se ne ponavlja svake nedelje), srednje-dugo trčanje je važnije nego za HM. */

import { fmtClock, r1 } from '../../format';
import { HEURISTIC_42K as H, PRODUCT_42K } from '../constants/distances';
import { sessInt, sessProg, sessTempo, wuCdForVolume } from '../sessions/build';
import type { SessionDay } from '../types';
import type { DistanceProfile, LongRunCycleContext, Phase, QualityRequest } from './types';

/** <33% izdržljivost, <73% prag, ostalo specifika. */
function phase42K(qualW: number, qualWeeks: number): Phase {
  const f = qualW / Math.max(qualWeeks, 1);
  if (f < 0.33) return 'endurance';
  if (f < 0.73) return 'threshold';
  return 'specific';
}

/**
 * Faktor ciklusa dugog trčanja: većina nedelja srednje dugačko, dva prava
 * vrhunca (3 i 0 nedelja pre kraja radnog dela), deload najviše 70%.
 */
export function longRunCycle42K(w: number, c: LongRunCycleContext): number {
  const lastWorking = c.weeks - 1 - c.taperW;
  if (w > lastWorking) return 1;
  const toEnd = lastWorking - w;
  let f: number;
  if (toEnd === 0) f = 1.0;
  else if (toEnd === 1) f = 0.85;
  else if (toEnd === 2) f = 0.75;
  else if (toEnd === 3) f = 1.0;
  else if (toEnd === 4) f = 0.85;
  else if (toEnd === 5) f = 0.92;
  else f = 0.8;
  return c.isDeload ? Math.min(f, 0.7) : f;
}

function reps42K(workKm: number, wkIdx: number): { rep: number; n: number } {
  const menu = [1200, 1600, 2000];
  const wish = menu[wkIdx % menu.length] as number;
  const budgetM = workKm * 1000;
  const ladder = [2000, 1600, 1200, 1000, 800].filter((x) => x <= wish);
  const rep = ladder.find((x) => 3 * x <= budgetM * 1.15) ?? 800;
  const n = Math.max(3, Math.floor(budgetM / rep + 0.08));
  return { rep, n };
}

const mkIntervals = (dow: number, vol: number, pI: number, wkIdx: number): SessionDay => {
  const q = Math.min(Math.max(vol * H.intervalBudget.pct, 2.4), H.intervalBudget.maxKm);
  const { rep, n } = reps42K(q, wkIdx);
  const [wu, cd] = wuCdForVolume(vol);
  const rest = Math.min(180, Math.max(90, Math.round((rep / 1000) * pI * 0.8)));
  return sessInt(dow, wu, n, rep, pI, rest, cd, 'Intervali');
};

const mkCruise = (dow: number, vol: number, pT: number, share?: number | null): SessionDay => {
  const total = Math.max(Math.min(3, vol * 0.1), vol * H.tempoBudget.pct) * (share || 1);
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
  const floor = Math.min(6, r1(vol * 0.09)) * (share || 1);
  const q =
    fixKm != null
      ? fixKm
      : r1(Math.max(floor, Math.min(vol * H.tempoBudget.pct * (share || 1), H.tempoMaxSec / pT)));
  const [wu, cd] = wuCdForVolume(vol);
  return sessTempo(dow, wu, q, pT, Math.max(cd, 1), 'Tempo');
};

/** Rad na tempu maratona: naizmenično blokovi 3–5 km sa pauzom i kontinuiran deo. */
const mkMarathonPace = (dow: number, vol: number, pM: number, qualW: number): SessionDay => {
  const q = Math.min(
    Math.max(vol * H.marathonPaceBudget.pct, Math.min(6, vol * 0.1)),
    H.marathonPaceBudget.maxKm
  );
  const [wu, cd] = wuCdForVolume(vol);
  if ((qualW || 0) % 2 === 0) {
    const repKm = q >= 12 ? 5.0 : q >= 8 ? 4.0 : 3.0;
    const n = Math.max(2, Math.floor(q / repKm + 0.08));
    return sessInt(
      dow,
      wu,
      n,
      Math.round(repKm * 1000),
      pM,
      90,
      Math.max(cd, 1),
      'Maratonski tempo'
    );
  }
  return sessTempo(dow, wu, r1(q), pM, Math.max(cd, 1), 'Maratonski tempo');
};

const mkProgression = (
  dow: number,
  vol: number,
  endPace: number,
  pE: number,
  share: number | null,
  atRacePace: boolean
): SessionDay => {
  const total = r1(Math.max(8, Math.min(vol * 0.2 * (share || 1), 18)));
  return sessProg(dow, total, endPace, pE, atRacePace ? 'Progresivno (tempo trke)' : 'Progresivno');
};

const mkRepetitions = (dow: number, vol: number, pR: number): SessionDay => {
  const total = Math.max(1.0, Math.min(vol * H.repetitionBudget.pct, H.repetitionBudget.maxKm));
  const repM = 200;
  const n = Math.max(4, Math.floor((total * 1000) / repM + 0.08));
  const [wu, cd] = wuCdForVolume(vol);
  return sessInt(dow, wu, n, repM, pR, Math.round((repM / 1000) * pR * 2.5), cd, 'Repeticije');
};

type Family = 'R' | 'I' | 'M';

/** q1 više nikad nije pragovski, pa nema deljenja budžeta — nedeljni prag u celosti pripada q2. */
function q1Family(phase: Phase, qualW: number): Family {
  if (phase === 'endurance') return qualW % 2 === 1 ? 'R' : 'M';
  if (phase === 'threshold') return qualW % 3 === 0 ? 'I' : 'M';
  return qualW % 4 === 3 ? 'I' : 'M';
}

function buildQuality42K(req: QualityRequest): SessionDay {
  const { qualW, qualWeeks, slotRole, effQ, vol, pI, pT, pE, pR, isTaper1, dow, racePace } = req;
  const phase = phase42K(qualW, qualWeeks);
  const pM = racePace;
  const share = 1;

  if (isTaper1) {
    /* Poslednja nedelja: kratak dodir maratonskog tempa da noge zapamte ritam. */
    const [twu, tcd] = wuCdForVolume(vol);
    if (effQ === 1 || slotRole === 'q1') {
      const km = r1(Math.min(6, Math.max(3, vol * 0.1)));
      return sessTempo(
        dow,
        r1(Math.max(twu * 0.8, 1)),
        km,
        pM,
        r1(Math.max(tcd * 0.8, 0.8)),
        'Maratonski tempo'
      );
    }
    return mkTempo(dow, vol, pT, r1(Math.min(5, Math.max(2.5, vol * 0.07))));
  }

  if (effQ === 1) {
    if (phase === 'endurance')
      return qualW % 3 === 2 ? mkRepetitions(dow, vol, pR) : mkCruise(dow, vol, pT);
    if (phase === 'threshold')
      return qualW % 4 === 0 ? mkIntervals(dow, vol, pI, qualW) : mkCruise(dow, vol, pT);
    return qualW % 2 === 1 ? mkMarathonPace(dow, vol, pM, qualW) : mkTempo(dow, vol, pT);
  }

  if (slotRole === 'q1') {
    const fam = q1Family(phase, qualW);
    if (fam === 'R') return mkRepetitions(dow, vol, pR);
    if (fam === 'I') return mkIntervals(dow, vol, pI, qualW);
    /* U fazi izdržljivosti maratonski tempo ide kao PROGRESIVNO trčanje — blaže je. */
    return phase === 'endurance'
      ? mkProgression(dow, vol, pM, pE, null, true)
      : mkMarathonPace(dow, vol, pM, qualW);
  }

  /* q2: prag kroz ceo ciklus. */
  if (phase === 'endurance') return mkCruise(dow, vol, pT, share);
  return qualW % 2 === 1 ? mkTempo(dow, vol, pT, null, share) : mkCruise(dow, vol, pT, share);
}

/** Poslednjih 5–12 km dugog trčanja na tempu maratona (samo u specifičnoj fazi, ne na vrhuncu ciklusa). */
function longRunFinish42K(
  phase: Phase,
  _qualW: number,
  lrKm: number,
  racePace: number,
  _strategy: unknown,
  cycleFactor: number | null
): string {
  if (phase !== 'specific' || !(lrKm >= 16)) return '';
  if (cycleFactor != null && cycleFactor >= 0.99) return '';
  const finish = r1(Math.max(5, Math.min(12, lrKm * 0.35)));
  return ` · poslednjih ${finish} km @ ${fmtClock(racePace)}/km (maratonski tempo, na umornim nogama)`;
}

export const PROFILE_42K: DistanceProfile = {
  product: PRODUCT_42K,
  heuristic: H,
  phase: phase42K,
  buildQuality: buildQuality42K,
  intervalPaceForWeek: (pI) => pI,
  longRunFinish: longRunFinish42K,
  longRunCycle: longRunCycle42K
};
