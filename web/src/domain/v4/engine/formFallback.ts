/* V4 — NAJPROSTIJA PROCENA FORME (§ 2.4), privremena: važi dok `fitness/` ne isporuči `estimateForm` (§ 7).
   Jedini ugovor je `EstimateFormFn`; `buildState` prima zamenu kao argument. Signali iz § 7.2–7.5 (kvalitet,
   trend pulsa, pad u pauzi) ovde NE postoje. Brojevi plafona napretka su polazni iz § 7.5 i žive samo u ovom fajlu
   (§ 14.3: kalibriše ih `fitness/`). */
import { DEFAULT_VDOT } from './constants';
import { diffDays } from './dates';
import type { Confidence, EstimateFormFn, FormChange, FormPoint, RunnerFacts, Vdot } from './types';
import { raceTimeSec, vdotFromEasyPace, vdotFromResult } from './vdot';

const RECENT_DAYS = 42;
const KNOWN_DAYS = 180;
const MIN_RACE_M = 3000;
const MIN_TEST_M = 2000;
const SIGMA: Readonly<Record<Confidence, number>> = { visoka: 0.5, srednja: 1.0, niska: 2.0 };
const EXPECTED_SHARE = 0.6;
const MAX_WEEKS = 16;

interface Evidence {
  vdot: Vdot;
  confidence: Confidence;
  signal: FormChange['signal'];
  reason: string;
  runId?: string;
}

function evidenceOf(facts: RunnerFacts): Evidence {
  for (let i = facts.runs.length - 1; i >= 0; i -= 1) {
    const run = facts.runs[i];
    if (run === undefined || run.effort === undefined) continue;
    const age = diffDays(facts.today, run.date);
    const minM = run.effort === 'race' ? MIN_RACE_M : MIN_TEST_M;
    if (age < 0 || age > KNOWN_DAYS || run.distanceM < minM || run.durationSec <= 0) continue;
    return {
      vdot: vdotFromResult(run.distanceM, run.durationSec),
      confidence: age <= RECENT_DAYS ? 'visoka' : 'srednja',
      signal: run.effort === 'race' ? 'trka' : 'test',
      reason:
        run.effort === 'race'
          ? 'Forma je izračunata iz poslednje trke.'
          : 'Forma je izračunata iz testa.',
      runId: run.id
    };
  }
  const result = facts.profile.recentResult;
  if (result !== undefined && result.distanceM > 0 && result.timeSec > 0) {
    return {
      vdot: vdotFromResult(result.distanceM, result.timeSec),
      confidence: 'srednja',
      signal: 'izjava',
      reason: 'Forma je izračunata iz rezultata koji si uneo.'
    };
  }
  const easy = facts.profile.easyPaceSecPerKm;
  if (easy !== undefined && easy > 0) {
    return {
      vdot: vdotFromEasyPace(easy),
      confidence: 'niska',
      signal: 'izjava',
      reason: 'Forma je procenjena iz tvog laganog tempa; prvi test ili trka je popravlja.'
    };
  }
  return {
    vdot: DEFAULT_VDOT,
    confidence: 'niska',
    signal: 'izjava',
    reason: 'Nema podataka o formi; uzeta je oprezna polazna vrednost.'
  };
}

/** Stopa napretka (VDOT nedeljno) i najveći napredak po stažu (§ 7.5). */
function progressRate(facts: RunnerFacts): { rate: number; max: number } {
  const years = facts.profile.yearsRunning;
  if (facts.profile.beginner === true || (years !== undefined && years < 1))
    return { rate: 0.15, max: 3.0 };
  if (years === undefined) return { rate: 0.08, max: 1.6 };
  return years <= 3 ? { rate: 0.1, max: 2.0 } : { rate: 0.06, max: 1.2 };
}

const clamp = (value: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, value));

export const declaredForm: EstimateFormFn = (facts, goal, planned) => {
  const evidence = evidenceOf(facts);
  const point: FormPoint = {
    vdot: evidence.vdot,
    raceTimeSec: Math.round(raceTimeSec(evidence.vdot, goal.distanceM)),
    asOf: facts.today,
    confidence: evidence.confidence
  };
  const { rate, max } = progressRate(facts);
  const growth =
    planned !== null && planned.baseLoad > 0
      ? clamp(planned.peakLoad / planned.baseLoad, 1, 1.3)
      : 1;
  const volume = 0.8 + (0.4 * (growth - 1)) / 0.3;
  const daysToRace = diffDays(goal.raceDate, facts.today);
  const weeks = Number.isFinite(daysToRace)
    ? clamp(Math.floor(daysToRace / 7) - 1, 0, MAX_WEEKS)
    : 0;
  const ceilingGain = Math.min(rate * volume * weeks, max);
  const sigma = SIGMA[evidence.confidence];
  const time = (vdot: Vdot): number => Math.round(raceTimeSec(vdot, goal.distanceM));
  const change: FormChange = {
    date: facts.today,
    signal: evidence.signal,
    before: evidence.vdot,
    after: evidence.vdot,
    reason: evidence.reason,
    ...(evidence.runId === undefined ? {} : { runId: evidence.runId })
  };
  return {
    start: point,
    current: point,
    raceDay: {
      lowSec: time(evidence.vdot + ceilingGain + sigma / 2),
      expectedSec: time(evidence.vdot + EXPECTED_SHARE * ceilingGain),
      highSec: time(evidence.vdot - sigma / 2)
    },
    ceilingGain,
    history: [change]
  };
};
