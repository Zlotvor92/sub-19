/* D2 i D3 — VDOT, tempo po zonama i ocena cilja; D26 — tempo plana po osećaju. Sopstvena kopija Daniels–Gilbert (1979) jednačina:

   VO2(v)  = −4,60 + 0,182258·v + 0,000104·v²            v [m/min]
   %max(t) = 0,8 + 0,1894393·e^(−0,012778·t) + 0,2989558·e^(−0,1932605·t)   t [min]
   VDOT    = VO2(d/t) / %max(t)

   Jednačine su objavljeni model; udeli po zonama i pragovi cilja su 10K odluke iz policy.ts. */

import { TEN_K_V2_POLICY as P } from './policy.ts';
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

export const round1 = (x: number): number => Math.round(x * 10) / 10;

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

/** Tempo po zonama [s/km] (VDOT zaokružen na 0,1 pre računa, radi stabilnog izlaza). RP = tempo
    prognoze 10K iz TRENUTNOG VDOT-a, nikad iz cilja. */
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

/** D26: VDOT čiji je brži kraj E (udeo eFractionFast) jednak laganom tempu [s/km] (neokrugljen):
    VDOT = VO2(v) / eFractionFast, v = brzina laganog tempa. */
export function vdotFromEasyPace(easySecPerKm: number): number {
  return vo2AtSpeed(60000 / easySecPerKm) / P.paces.eFractionFast;
}

/** D26: tempo plana po osećaju. E = lagan tempo ± eRangeSec; T/I/R/RP iz procene VDOT-a (zaokružene na
    0,1 i ograničene na feel.vdotMin–vdotMax) — samo orijentir. `capped` = procena iznad vdotMax. */
export function feelPaces(easySecPerKm: number): { paces: Paces; capped: boolean } {
  const q = P.feel;
  const raw = round1(vdotFromEasyPace(easySecPerKm));
  const base = pacesFromVdot(Math.min(q.vdotMax, Math.max(q.vdotMin, raw)));
  return {
    paces: {
      ...base,
      E: { fast: easySecPerKm - q.eRangeSec, slow: easySecPerKm + q.eRangeSec }
    },
    capped: raw > q.vdotMax
  };
}

/** D14: srednji E [s/km] — osnov km zagrevanja, hlađenja i oporavka. */
export function midEasy(p: Paces): number {
  return (p.E.fast + p.E.slow) / 2;
}

export function predicted10k(p: Paces): number {
  return raceTimeForVdot(p.vdot, P.paces.raceDistanceM);
}

/** D3: ocena cilja (jedino mesto). Ne odbija i ne menja tempo. Poređenje u desetinkama VDOT-a. */
export function assessGoal(vdot: number, goalTimeSec: number, weeks: number): GoalAssessment {
  const goalVdot = round1(vdotFromResult(P.paces.raceDistanceM, goalTimeSec));
  const gap10 = Math.round(goalVdot * 10) - Math.round(vdot * 10);
  const vdotGap = gap10 / 10;
  const realistic = Math.round(P.goal.realisticPerWeek * weeks * 10);
  const ambitious = Math.round(P.goal.ambitiousPerWeek * weeks * 10);
  const status =
    gap10 <= realistic ? 'realistic' : gap10 <= ambitious ? 'ambitious' : 'unrealistic';
  const message =
    status === 'realistic'
      ? `Cilj je realističan: traži ${Math.max(0, vdotGap).toFixed(1)} VDOT za ${weeks} nedelja (≤ ${(realistic / 10).toFixed(1)}).`
      : status === 'ambitious'
        ? `Cilj je ambiciozan: traži ${vdotGap.toFixed(1)} VDOT za ${weeks} nedelja (realistično ≤ ${(realistic / 10).toFixed(1)}); tempo treninga i dalje zavisi od rezultata.`
        : `Cilj je nerealan za ovaj ciklus: traži ${vdotGap.toFixed(1)} VDOT za ${weeks} nedelja (ambiciozno ≤ ${(ambitious / 10).toFixed(1)}); tempo treninga i dalje zavisi od rezultata.`;
  return { goalTimeSec, goalVdot, vdotGap, weeks, status, message };
}
