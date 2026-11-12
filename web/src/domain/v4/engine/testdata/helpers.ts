/* Pomoćno za testove motora: činjenice trkača, mreža ulaza, „urađena" trčanja koja odgovaraju planu. */
import { addDays } from '../dates';
import { paceCtxOf, summarize } from '../load';
import { plan } from '../plan';
import { buildState } from '../state';
import type {
  DistanceData,
  Goal,
  IsoDate,
  PlanDoc,
  Run,
  RunnerFacts,
  RunnerProfile,
  RunnerState,
  Weekday
} from '../types';
import { SYNTHETIC } from './synthetic';

export const HALF_M = 21097.5;

export function facts(over: Partial<RunnerFacts> = {}): RunnerFacts {
  return {
    today: '2026-11-15',
    availability: { runDays: [1, 3, 5, 6], longDay: 6 },
    profile: { weeklyKm: 30, recentResult: { distanceM: HALF_M, timeSec: 6060 } },
    runs: [],
    pauses: [],
    pain: [],
    ...over
  };
}

export function goalAt(raceDate: IsoDate, over: Partial<Goal> = {}): Goal {
  return { distanceId: SYNTHETIC.id, raceDate, ...over };
}

export interface Built {
  facts: RunnerFacts;
  goal: Goal;
  state: RunnerState;
  doc: PlanDoc;
}

/** Stanje + plan; baca ako je unos odbijen (testovi ispravnih ulaza). */
export function build(f: RunnerFacts, goal: Goal, data: DistanceData = SYNTHETIC): Built {
  const state = buildState(f, goal, data);
  const result = plan(state, goal, data);
  if (!result.ok) throw new Error(`plan odbijen: ${result.errors.map((e) => e.code).join(',')}`);
  return { facts: f, goal, state, doc: result.doc };
}

/** Trčanja koja tačno odgovaraju planu za sve dane do `through` (uključivo), vezana za dan plana. */
export function runsAsPlanned(
  doc: PlanDoc,
  through: IsoDate,
  skip: (date: IsoDate) => boolean = () => false
): Run[] {
  const ctx = paceCtxOf(doc.header);
  const runs: Run[] = [];
  for (const week of doc.weeks) {
    for (const day of week.days) {
      if (day.workout === null || day.date > through || skip(day.date)) continue;
      const cost = summarize(day.workout, ctx);
      runs.push({
        id: `run-${day.id}`,
        date: day.date,
        distanceM: Math.round(cost.distanceM),
        durationSec: Math.round(cost.durationSec),
        dayId: day.id
      });
    }
  }
  return runs;
}

export function advance(b: Built, today: IsoDate, over: Partial<RunnerFacts> = {}): RunnerState {
  return buildState({ ...b.facts, today, ...over }, b.goal, SYNTHETIC);
}

const DAY_SETS: readonly Weekday[][] = [
  [6],
  [2, 6],
  [1, 3, 6],
  [1, 3, 5, 6],
  [0, 1, 3, 5, 6],
  [0, 1, 2, 3, 5, 6],
  [0, 1, 2, 3, 4, 5, 6]
];

const PROFILES: readonly RunnerProfile[] = [
  { weeklyKm: 30, recentResult: { distanceM: HALF_M, timeSec: 6060 } },
  { weeklyKm: 55, recentResult: { distanceM: 10000, timeSec: 2520 }, yearsRunning: 5 },
  { weeklyKm: 18, easyPaceSecPerKm: 420, beginner: true },
  {
    weeklyKm: 40,
    recentResult: { distanceM: 5000, timeSec: 1500 },
    longestRecentKm: 14,
    yearsRunning: 2
  }
];

export interface GridCase {
  name: string;
  facts: RunnerFacts;
  goal: Goal;
}

/** Mreža ulaza: dani 1–7 × nedelje 1–30 × profil (baza, nivo) × start van rampe / dan posle trke. */
export function grid(): GridCase[] {
  const cases: GridCase[] = [];
  const today = '2026-11-15';
  const weeksList = [1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24, 30];
  DAY_SETS.forEach((runDays, di) => {
    weeksList.forEach((weeks, wi) => {
      PROFILES.forEach((profile, pi) => {
        if ((di + wi + pi) % 2 === 1 && weeks > 4) return;
        const inRamp = (di + wi + pi) % 3 === 0;
        const raceDate = addDays('2026-11-22', 7 * (weeks - 1) + ((di + wi) % 2 === 0 ? 0 : -1));
        const runs: Run[] = inRamp
          ? [{ id: 'trka', date: today, distanceM: 10000, durationSec: 2760, effort: 'race' }]
          : [];
        cases.push({
          name: `${String(runDays.length)} dana, ${String(weeks)} ned, profil ${String(pi)}${inRamp ? ', posle trke' : ''}`,
          facts: facts({ today, availability: { runDays, longDay: 6 }, profile, runs }),
          goal: goalAt(raceDate)
        });
      });
    });
  });
  return cases;
}
