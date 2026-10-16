/* VDOT i tempo po zonama — sopstvena implementacija Daniels–Gilbert (1979) jednačina.

   VO2(v)  = −4,60 + 0,182258·v + 0,000104·v²            v [m/min]
   %max(t) = 0,8 + 0,1894393·e^(−0,012778·t) + 0,2989558·e^(−0,1932605·t)   t [min]
   VDOT    = VO2(d/t) / %max(t)

   Jednačine su objavljeni model; udeli po zonama su heuristike iz policy.ts. */

import { FIVE_K_V2_POLICY as P } from './policy.ts';
import type { GoalAssessment, Paces } from './types.ts';

const A = -4.6;
const B = 0.182258;
const C = 0.000104;

function vo2AtSpeed(v: number): number {
  return A + B * v + C * v * v;
}

/** Inverz `vo2AtSpeed` (pozitivan koren): brzina [m/min] za dati VO2. */
function speedAtVo2(vo2: number): number {
  return (-B + Math.sqrt(B * B - 4 * C * (A - vo2))) / (2 * C);
}

function fractionSustainable(tMin: number): number {
  return 0.8 + 0.1894393 * Math.exp(-0.012778 * tMin) + 0.2989558 * Math.exp(-0.1932605 * tMin);
}

const round1 = (x: number): number => Math.round(x * 10) / 10;

/** VDOT iz rezultata (neokrugljen). */
export function vdotFromResult(distanceM: number, timeSec: number): number {
  const tMin = timeSec / 60;
  return vo2AtSpeed(distanceM / tMin) / fractionSustainable(tMin);
}

/** Predviđeno vreme [s] za distancu pri datom VDOT-u (bisekcija, fiksno 80 koraka — deterministično). */
export function raceTimeForVdot(vdot: number, distanceM: number): number {
  let lo = 1; // min
  let hi = 600; // min
  for (let k = 0; k < 80; k++) {
    const mid = (lo + hi) / 2;
    // VDOT opada sa sporijim vremenom.
    if (vdotFromResult(distanceM, mid * 60) > vdot) lo = mid;
    else hi = mid;
  }
  return Math.round(((lo + hi) / 2) * 60);
}

function paceAtFraction(vdot: number, fraction: number): number {
  return Math.round(60000 / speedAtVo2(vdot * fraction));
}

/** Tempo po zonama [s/km] za VDOT (zaokružen na 0,1 pre računa, radi stabilnog izlaza). */
export function pacesFromVdot(vdotRaw: number): Paces {
  const vdot = round1(vdotRaw);
  const q = P.paces;
  return {
    vdot,
    E: { fast: paceAtFraction(vdot, q.eFractionFast), slow: paceAtFraction(vdot, q.eFractionSlow) },
    T: paceAtFraction(vdot, q.tFraction),
    I: paceAtFraction(vdot, q.iFraction),
    R: paceAtFraction(vdot, q.rFraction),
    RP: Math.round(raceTimeForVdot(vdot, q.raceDistanceM) / (q.raceDistanceM / 1000))
  };
}

/** Procena cilja prema prognozi. Ne obećava ishod i ne menja tempo. */
export function assessGoal(vdot: number, goalTimeSec: number): GoalAssessment {
  const goalVdot = round1(vdotFromResult(P.paces.raceDistanceM, goalTimeSec));
  const vdotGap = round1(goalVdot - vdot);
  const status =
    vdotGap <= P.goal.feasibleMaxGain
      ? 'feasible'
      : vdotGap <= P.goal.ambitiousMaxGain
        ? 'ambitious'
        : 'unrealistic';
  const message =
    status === 'feasible'
      ? 'Cilj je u skladu sa prognozom iz rezultata (izvodljiv).'
      : status === 'ambitious'
        ? 'Cilj traži napredak iznad prognoze (ambiciozan); tempo treninga ostaje prema rezultatu.'
        : 'Cilj je daleko iznad prognoze (nerealan za ovaj ciklus); tempo treninga ostaje prema rezultatu.';
  return { goalTimeSec, goalVdot, vdotGap, status, message };
}
