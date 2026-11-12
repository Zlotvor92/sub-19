/* V4 — STANJE TRKAČA (SPEC § 2): izvedena polja računa `buildState` jednom; motor ih ne preračunava. */
import {
  HARD_EFFORT_DAYS,
  LONGEST_RECENT_DAYS,
  PAIN_RESOLVED_DAYS,
  PAUSE_WINDOW_DAYS,
  STATE_WEEKS,
  ZONE_SHARE
} from './constants';
import { addDays, dayNumber, diffDays, isValidDate, mondayOf, toWeekday } from './dates';
import { decidePeak } from './decide';
import { declaredForm } from './formFallback';
import { rollDay, runLoad } from './load';
import { countWeeks, pickLevel, pickTemplate } from './template';
import type {
  Availability,
  BuildStateFn,
  DistanceData,
  FormEstimate,
  Goal,
  HardEffort,
  LoadPoints,
  LoadState,
  Run,
  RunnerFacts,
  RunnerState,
  SecPerKm,
  Seconds,
  WeekSummary,
  Weekday
} from './types';
import { paceAtShare } from './vdot';

/** Dani trčanja bez duplikata, rastuće; neispravne vrednosti se odbacuju (odbija ih `validate`). */
export function normalizeAvailability(a: Availability): Availability {
  const days = new Set<Weekday>();
  for (const d of a.runDays) if (Number.isInteger(d) && d >= 0 && d <= 6) days.add(toWeekday(d));
  return { runDays: [...days].sort((x, y) => x - y), longDay: a.longDay };
}

const usable = (run: Run, today: string): boolean =>
  isValidDate(run.date) && run.date <= today && run.durationSec > 0 && run.distanceM >= 0;

function dailyLoads(runs: readonly Run[], thresholdPace: SecPerKm): Map<number, LoadPoints> {
  const byDay = new Map<number, LoadPoints>();
  for (const run of runs) {
    const day = dayNumber(run.date);
    byDay.set(day, (byDay.get(day) ?? 0) + runLoad(run, thresholdPace));
  }
  return byDay;
}

/** Bazna nedelja iz izjave (§ 2.4): km × lagani tempo; bez izjave `dani × najkraće lagano`. */
function declaredWeekLoad(
  facts: RunnerFacts,
  easyPace: SecPerKm,
  data: DistanceData,
  runDays: number
): LoadPoints {
  const km = facts.profile.weeklyKm;
  if (km !== undefined && km > 0) return (km * easyPace) / 60;
  return (runDays * data.safety.minEasySec) / 60;
}

/** Baza i umor (§ 5.3): seme iz izjave (ili proseka istorije kad izjave nema), pa se odvrti istorija do danas. */
function loadState(
  facts: RunnerFacts,
  loads: Map<number, LoadPoints>,
  declared: LoadPoints
): LoadState {
  const today = dayNumber(facts.today);
  const days = [...loads.keys()];
  if (days.length === 0) {
    return { chronic: declared / 7, acute: declared / 7, asOf: facts.today, seeded: true };
  }
  const first = Math.min(...days);
  let seed = declared / 7;
  if (facts.profile.weeklyKm === undefined) {
    let total = 0;
    for (const load of loads.values()) total += load;
    seed = total / (today - first + 1);
  }
  let state = { chronic: seed, acute: seed };
  for (let day = first; day <= today; day += 1) state = rollDay(state, loads.get(day) ?? 0);
  return { ...state, asOf: facts.today, seeded: false };
}

function weekSummaries(
  facts: RunnerFacts,
  runs: readonly Run[],
  loads: (run: Run) => LoadPoints
): WeekSummary[] {
  const lastMonday = mondayOf(facts.today);
  const weeks: WeekSummary[] = [];
  for (let i = STATE_WEEKS - 1; i >= 0; i -= 1) {
    weeks.push({
      start: addDays(lastMonday, -7 * i),
      load: 0,
      distanceM: 0,
      durationSec: 0,
      runs: 0,
      longestSec: 0
    });
  }
  for (const run of runs) {
    const index = STATE_WEEKS - 1 - diffDays(lastMonday, mondayOf(run.date)) / 7;
    const week = weeks[index];
    if (week === undefined) continue;
    week.load += loads(run);
    week.distanceM += run.distanceM;
    week.durationSec += run.durationSec;
    week.runs += 1;
    week.longestSec = Math.max(week.longestSec, run.durationSec);
  }
  return weeks;
}

function longestRecent(facts: RunnerFacts, runs: readonly Run[], easyPace: SecPerKm): Seconds {
  let longest = 0;
  for (const run of runs) {
    if (diffDays(facts.today, run.date) < LONGEST_RECENT_DAYS)
      longest = Math.max(longest, run.durationSec);
  }
  if (longest > 0) return longest;
  const km = facts.profile.longestRecentKm;
  return km !== undefined && km > 0 ? km * easyPace : 0;
}

function lastHardEffort(facts: RunnerFacts, runs: readonly Run[]): HardEffort | null {
  for (let i = runs.length - 1; i >= 0; i -= 1) {
    const run = runs[i];
    if (run?.effort === undefined) continue;
    if (diffDays(facts.today, run.date) > HARD_EFFORT_DAYS) return null;
    return { date: run.date, durationSec: run.durationSec, distanceM: run.distanceM };
  }
  return null;
}

/** Vrh koji bi plan odlučio — samo da procena forme zna rast obima (§ 7.5); odluku i dalje donosi `plan`. */
function plannedLoads(
  facts: RunnerFacts,
  goal: Goal,
  data: DistanceData,
  form: FormEstimate,
  baseLoad: LoadPoints,
  runDays: number
): { baseLoad: LoadPoints; peakLoad: LoadPoints } | null {
  if (!isValidDate(goal.raceDate) || !isValidDate(facts.today)) return null;
  const start =
    goal.startDate !== undefined && isValidDate(goal.startDate) && goal.startDate > facts.today
      ? goal.startDate
      : addDays(facts.today, 1);
  const level = pickLevel(data, {
    beginner: facts.profile.beginner === true,
    vdot: form.current.vdot,
    baseLoad
  });
  const picked = pickTemplate(data, level, countWeeks(start, goal.raceDate), runDays);
  if (picked === null) return null;
  return { baseLoad, peakLoad: decidePeak(baseLoad, picked.template, data.safety, level) };
}

export const buildState: BuildStateFn = (facts, goal, data, estimate = declaredForm) => {
  const availability = normalizeAvailability(facts.availability);
  const formGoal = { distanceM: data.distanceM, raceDate: goal.raceDate };
  const first = estimate(facts, formGoal, null);
  const thresholdPace = paceAtShare(first.current.vdot, ZONE_SHARE.T);
  const easyPace = paceAtShare(first.current.vdot, ZONE_SHARE.E);
  const runs = facts.runs
    .filter((run) => usable(run, facts.today))
    .sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    );
  const loadOf = (run: Run): LoadPoints => runLoad(run, thresholdPace);
  const declared = declaredWeekLoad(facts, easyPace, data, availability.runDays.length);
  const load = loadState(facts, dailyLoads(runs, thresholdPace), declared);
  const planned = plannedLoads(
    facts,
    goal,
    data,
    first,
    7 * load.chronic,
    availability.runDays.length
  );
  const state: RunnerState = {
    today: facts.today,
    availability,
    profile: facts.profile,
    runs,
    weeks: weekSummaries(facts, runs, loadOf),
    load,
    longestRecentSec: Math.round(longestRecent(facts, runs, easyPace)),
    form: planned === null ? first : estimate(facts, formGoal, planned),
    lastHardEffort: lastHardEffort(facts, runs),
    pauses: facts.pauses.filter(
      (p) =>
        isValidDate(p.from) && isValidDate(p.to) && diffDays(facts.today, p.to) <= PAUSE_WINDOW_DAYS
    ),
    pain: facts.pain.filter(
      (p) => p.resolvedOn === undefined || diffDays(facts.today, p.resolvedOn) <= PAIN_RESOLVED_DAYS
    )
  };
  return state;
};
