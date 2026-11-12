/* V4 — STANJE TRKAČA (SPEC § 2): izvedena polja računa `buildState` jednom; motor ih ne preračunava. */
import {
  CHRONIC_DAYS,
  EFFORT_AS_LONG_SHARE,
  HARD_EFFORT_DAYS,
  LONGEST_RECENT_DAYS,
  PAIN_RESOLVED_DAYS,
  PAUSE_WINDOW_DAYS,
  STATE_WEEKS,
  ZONE_SHARE
} from './constants';
import { addDays, dayNumber, diffDays, isValidDate, mondayOf, toWeekday } from './dates';
import { decidePeak } from './decide';
import { derivedPauses } from './pauses';
import { declaredForm } from './formFallback';
import { paceCtxOf, rollDay, runLoad, summarize } from './load';
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
  Pause,
  PlanDoc,
  Step,
  ZoneId,
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

/** Trajanje trčanja kao „dugog": trka i test ulaze sa 60 % trajanja (nisu dugi, ali nisu ni ništa). */
const asLong = (run: Run): Seconds =>
  run.effort === undefined ? run.durationSec : EFFORT_AS_LONG_SHARE * run.durationSec;

function longestRecent(facts: RunnerFacts, runs: readonly Run[], easyPace: SecPerKm): Seconds {
  let longest = 0;
  for (const run of runs) {
    if (diffDays(facts.today, run.date) < LONGEST_RECENT_DAYS)
      longest = Math.max(longest, asLong(run));
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

/** Zona rada dana plana: prvi korak uloge `work` sa zonom (za `Run.planned`). */
function workZone(steps: readonly Step[]): ZoneId | null {
  for (const step of steps) {
    if ('repeat' in step) {
      const inner = workZone(step.steps);
      if (inner !== null) return inner;
    } else if (step.role === 'work' && step.target.type === 'zone') {
      return step.target.zone;
    }
  }
  return null;
}

/** `Run.planned` iz plana po `dayId` (§ 7.3); trčanje koje ga već nosi ostaje kako jeste. */
function withPlanned(runs: readonly Run[], doc: PlanDoc | undefined): Run[] {
  if (doc === undefined) return [...runs];
  const ctx = paceCtxOf(doc.header);
  const days = new Map(doc.weeks.flatMap((w) => w.days.map((d) => [d.id, d] as const)));
  return runs.map((run) => {
    const workout = run.dayId === undefined ? undefined : days.get(run.dayId)?.workout;
    if (run.planned !== undefined || workout == null || workout.workSec <= 0) return run;
    const zone = workZone(workout.steps);
    if (zone === null) return run;
    const cost = summarize(workout, ctx);
    return {
      ...run,
      planned: {
        zone,
        workSec: workout.workSec,
        durationSec: Math.round(cost.durationSec),
        load: cost.load
      }
    };
  });
}

/** Prijavljene pauze + izvedene iz plana (§ 2.3), u poslednjih 42 dana. */
function allPauses(facts: RunnerFacts, runs: readonly Run[], doc: PlanDoc | undefined): Pause[] {
  const declared = facts.pauses.filter(
    (p) =>
      isValidDate(p.from) && isValidDate(p.to) && diffDays(facts.today, p.to) <= PAUSE_WINDOW_DAYS
  );
  if (doc === undefined || !isValidDate(facts.today)) return declared;
  const windowStart = addDays(facts.today, -PAUSE_WINDOW_DAYS);
  const from = doc.header.startDate > windowStart ? doc.header.startDate : windowStart;
  const derived = derivedPauses(
    doc.weeks.flatMap((w) => w.days),
    new Set(runs.map((r) => r.date)),
    from,
    facts.today,
    declared
  );
  return [...declared, ...derived].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
}

/** Opterećenje poslednjih `days` dana (uključujući danas), po pragu tekuće forme. */
export function recentLoad(state: RunnerState, days: number): LoadPoints {
  const threshold = paceAtShare(state.form.current.vdot, ZONE_SHARE.T);
  let load = 0;
  for (const run of state.runs) {
    if (diffDays(state.today, run.date) < days) load += runLoad(run, threshold);
  }
  return load;
}

/** Bazno nedeljno opterećenje PRE poslednjeg punog napora: iz baze se oduzima doprinos same trke ili testa,
    da plan koji počinje u rampi gradi od obima pre trke (četvrti krug). */
export function baseLoadOf(state: RunnerState): LoadPoints {
  let chronic = state.load.chronic;
  const effort = state.lastHardEffort;
  const run =
    effort === null
      ? undefined
      : state.runs.find((r) => r.date === effort.date && r.effort !== undefined);
  if (run !== undefined && !state.load.seeded) {
    const threshold = paceAtShare(state.form.current.vdot, ZONE_SHARE.T);
    const days = diffDays(state.today, run.date);
    chronic -= (runLoad(run, threshold) / CHRONIC_DAYS) * (1 - 1 / CHRONIC_DAYS) ** days;
  }
  return Math.round(70 * Math.max(0, chronic)) / 10;
}

/** Poslednji odrađeni dugi pre `date`: najduže trčanje u 28 dana pre tog dana (trka i test sa 60 %); 0 = nepoznat. */
export function lastLongBefore(state: RunnerState, date: string): Seconds {
  let longest = 0;
  for (const run of state.runs) {
    const age = diffDays(date, run.date);
    if (age >= 1 && age <= LONGEST_RECENT_DAYS) longest = Math.max(longest, asLong(run));
  }
  return Math.round(longest);
}

/** Referenca dugog posle punog napora: najduže pre njega ili 60 % samog napora, šta je veće. */
export function lastLongAfterEffort(
  state: RunnerState,
  date: string,
  durationSec: Seconds
): Seconds {
  return Math.max(lastLongBefore(state, date), Math.round(EFFORT_AS_LONG_SHARE * durationSec));
}

export const buildState: BuildStateFn = (facts, goal, data, estimate = declaredForm, doc) => {
  const availability = normalizeAvailability(facts.availability);
  const formGoal = { distanceM: data.distanceM, raceDate: goal.raceDate };
  const runs = withPlanned(
    facts.runs
      .filter((run) => usable(run, facts.today))
      .sort((a, b) =>
        a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0
      ),
    doc
  );
  const pauses = allPauses(facts, runs, doc);
  /* Procena forme vidi isto što i motor: trčanja sa `planned` i pauze izvedene iz plana. */
  const seen: RunnerFacts = { ...facts, runs, pauses };
  const first = estimate(seen, formGoal, null);
  const thresholdPace = paceAtShare(first.current.vdot, ZONE_SHARE.T);
  const easyPace = paceAtShare(first.current.vdot, ZONE_SHARE.E);
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
    form: planned === null ? first : estimate(seen, formGoal, planned),
    lastHardEffort: lastHardEffort(facts, runs),
    pauses,
    pain: facts.pain.filter(
      (p) => p.resolvedOn === undefined || diffDays(facts.today, p.resolvedOn) <= PAIN_RESOLVED_DAYS
    )
  };
  return state;
};
