/* V4 — STANJE TRKAČA (SPEC § 2): izvedena polja računa `buildState` jednom; motor ih ne preračunava. */
import {
  CHRONIC_DAYS,
  EASY_FAST_SHARE,
  EFFORT_AS_LONG_SHARE,
  FALLBACK_TODAY,
  HISTORY_MIN_RUNS,
  HISTORY_MIN_SPAN_DAYS,
  HARD_EFFORT_DAYS,
  LONGEST_RECENT_DAYS,
  PAIN_RESOLVED_DAYS,
  PAUSE_WINDOW_DAYS,
  RECENT_QUALITY_WEEKS,
  STATE_WEEKS,
  ZONE_SHARE
} from './constants';
import { addDays, dayNumber, diffDays, isValidDate, mondayOf, toWeekday, weekdayOf } from './dates';
import {
  decideLongMax,
  decidePeak,
  ladderInputOf,
  ladderOverBase,
  longReaches,
  ranGoalDistance
} from './decide';
import { validate } from './guard';
import { derivedPauses } from './pauses';
import { declaredForm } from './formFallback';
import { paceCtxOf, rollDay, runLoad, summarize } from './load';
import { countWeeks, pickLevel, pickTemplate } from './template';
import type {
  Availability,
  BuildStateFn,
  DistanceData,
  FormEstimate,
  FormPlanned,
  Goal,
  HardEffort,
  LoadPoints,
  LoadState,
  Pause,
  PainFlag,
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
import { paceAtShare, zoneVdot } from './vdot';

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

/** Baza i umor (§ 5.3, krug 3: O2). Istorija je merodavna samo kad u poslednjih 42 dana pokriva bar 21 dan sa
    bar 6 trčanja; inače je baza izjava trkača (jedno staro trčanje ne obara izjavljenih 40 km na nulu). Merodavna
    istorija: seme iz izjave (ili proseka istorije kad izjave nema), pa se odvrti do danas. */
function loadState(
  facts: RunnerFacts,
  loads: Map<number, LoadPoints>,
  runDays: readonly number[],
  declared: LoadPoints
): LoadState {
  const today = dayNumber(facts.today);
  const recent = runDays.filter((day) => today - day < CHRONIC_DAYS);
  const span = recent.length === 0 ? 0 : today - Math.min(...recent) + 1;
  const covered = runDays.some((day) => today - day >= CHRONIC_DAYS) ? CHRONIC_DAYS : span;
  if (covered < HISTORY_MIN_SPAN_DAYS || recent.length < HISTORY_MIN_RUNS) {
    return { chronic: declared / 7, acute: declared / 7, asOf: facts.today, seeded: true };
  }
  const first = Math.min(...loads.keys());
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
    return {
      date: run.date,
      durationSec: run.durationSec,
      distanceM: run.distanceM,
      ...(run.effort === 'race' ? { race: true } : {})
    };
  }
  return null;
}

/** Činjenice iz istorije za personalizaciju (krug 3). */
interface HistoryFacts {
  recentQualityWeeks: number | null;
  weeksSincePause: number | null;
  easyTooFast?: boolean;
}

/** S8a (krug 4): stvarni prosek poslednjih 4 cele nedelje kad je istorija merodavna (km i minuti). */
/* E6 (krug 5): prosek poslednje 3 stvarne nedelje */
const HISTORY_AVG_WEEKS = 3;
function historyVolume(
  weeks: readonly WeekSummary[],
  seeded: boolean,
  today: string
): { historyWeeklyKm: number; historyWeeklyMin: number } | null {
  if (seeded) return null;
  /* tekuća nedelja je cela kad je danas nedelja */
  const done = weekdayOf(today) === 6 ? weeks : weeks.slice(0, -1);
  const full = done.slice(-HISTORY_AVG_WEEKS);
  if (full.length < HISTORY_AVG_WEEKS || full.some((w) => w.runs === 0)) return null;
  const km = full.reduce((sum, w) => sum + w.distanceM, 0) / 1000 / full.length;
  const min = full.reduce((sum, w) => sum + w.durationSec, 0) / 60 / full.length;
  return { historyWeeklyKm: Math.round(km * 10) / 10, historyWeeklyMin: Math.round(min * 10) / 10 };
}

/** Broj nedelja (od poslednjih 8 kalendarskih) sa bar jednim trčanjem bržim od laganog: krugovi rada, zadat
    kvalitet, pun napor ili prosečan tempo brži od brže granice laganog. `null` = u tom periodu nema trčanja.
    Cele nedelje od kraja poslednje pauze; `null` = pauze nije bilo. */
function historyFacts(
  today: string,
  runs: readonly Run[],
  pauses: readonly Pause[],
  easyFastPace: SecPerKm
): HistoryFacts {
  const from = addDays(mondayOf(today), -7 * (RECENT_QUALITY_WEEKS - 1));
  const recent = runs.filter((run) => run.date >= from);
  /* S8c (krug 4): kvalitet je samo ono što ima krugove rada, zadat kvalitet ili pun napor — ne prosečan tempo
     (trkač koji sve trči u istom bržem tempu nema strukturisan kvalitet). */
  const fast = (run: Run): boolean =>
    run.effort !== undefined ||
    (run.laps ?? []).some((lap) => lap.role === 'work') ||
    (run.planned !== undefined && run.planned.zone !== 'E');
  const weeks = new Set(recent.filter(fast).map((run) => mondayOf(run.date)));
  const ended = pauses.map((p) => p.to).filter((to) => to <= today);
  const last = ended.length === 0 ? null : ended.reduce((a, b) => (a > b ? a : b));
  /* S8d: prosečan tempo trčanja bez kvaliteta brži od brže granice laganog */
  const plain = recent.filter((run) => !fast(run) && run.distanceM > 0);
  const meters = plain.reduce((sum, run) => sum + run.distanceM, 0);
  const secs = plain.reduce((sum, run) => sum + run.durationSec, 0);
  const tooFast = plain.length >= 4 && meters > 0 && (secs / meters) * 1000 < easyFastPace;
  return {
    recentQualityWeeks: recent.length === 0 ? null : weeks.size,
    weeksSincePause: last === null ? null : Math.floor(diffDays(today, last) / 7),
    ...(tooFast ? { easyTooFast: true } : {})
  };
}

/** Bol u poslednjih 12 meseci (§ 14.6): iz `painHistory` i sadašnjih prijava. */
export const PAIN_HISTORY_DAYS = 365;
function painHistoryOf(facts: RunnerFacts): PainFlag[] {
  return [...(facts.painHistory ?? []), ...facts.pain].filter(
    (p) =>
      isValidDate(p.date) &&
      p.date <= facts.today &&
      diffDays(facts.today, p.date) <= PAIN_HISTORY_DAYS
  );
}
function painInYear(facts: RunnerFacts): boolean {
  return painHistoryOf(facts).length > 0;
}

/** Vrh koji bi plan odlučio — samo da procena forme zna rast obima (§ 7.5); odluku i dalje donosi `plan`. */
function plannedLoads(
  facts: RunnerFacts,
  goal: Goal,
  data: DistanceData,
  form: FormEstimate,
  baseLoad: LoadPoints,
  runDays: number,
  history: HistoryFacts
): { baseLoad: LoadPoints; peakLoad: LoadPoints } | null {
  if (!isValidDate(goal.raceDate) || !isValidDate(facts.today)) return null;
  const start =
    goal.startDate !== undefined && isValidDate(goal.startDate) && goal.startDate > facts.today
      ? goal.startDate
      : addDays(facts.today, 1);
  const level = pickLevel(data, {
    yearsRunning: facts.profile.yearsRunning,
    beginner: facts.profile.beginner === true,
    vdot: form.current.vdot,
    baseLoad,
    ...history
  });
  const weeks = countWeeks(start, goal.raceDate);
  const picked = pickTemplate(data, level, weeks, runDays);
  if (picked === null) return null;
  const ladder = ladderInputOf({
    baseLoad,
    easyPaceSecPerKm: paceAtShare(zoneVdot(form.current.vdot, 'E', form.transfer), ZONE_SHARE.E),
    weeks,
    yearsRunning: facts.profile.yearsRunning,
    painInYear: painInYear(facts),
    safety: data.safety
  });
  const over = ladderOverBase(data.safety, ladder);
  const peakLoad = decidePeak(baseLoad, picked.template, data.safety, level, over);
  /* S3 (krug 4): plan od bar `longCheckMinWeeks` koji ne može da stigne do dugog za distancu — prognoza ne računa
     napredak od obima (vrh = baza za procenu, f_v = 1). */
  const easy = paceAtShare(zoneVdot(form.current.vdot, 'E', form.transfer), ZONE_SHARE.E);
  const longMax = decideLongMax(peakLoad, data.safety, level, runDays, easy);
  const ran = ranGoalDistance(facts.today, facts.runs, facts.profile.recentResult, data.distanceM);
  if (!ran && !longReaches(data, weeks, longMax, easy)) return { baseLoad, peakLoad: baseLoad };
  return { baseLoad, peakLoad };
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

/** Dužina deonice punog napora u koracima treninga; `null` kad je nema. */
function allOutM(steps: readonly Step[]): number | null {
  for (const step of steps) {
    if ('repeat' in step) {
      const inner = allOutM(step.steps);
      if (inner !== null) return inner;
    } else if (step.target.type === 'allOut' && 'distanceM' in step.extent) {
      return step.extent.distanceM;
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
    if (workout == null) return run;
    /* Dan punog napora (provera forme, pripremna trka): dužina zadate deonice — merilo rezultata (K1). */
    const effortM = allOutM(workout.steps);
    if (effortM !== null && run.plannedEffortM === undefined) {
      return { ...run, plannedEffortM: effortM };
    }
    if (run.planned !== undefined || workout.workSec <= 0) return run;
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
    declared,
    doc.header.decisions.runDays
  );
  return [...declared, ...derived].sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
}

/** Opterećenje poslednjih `days` dana (uključujući danas), po pragu tekuće forme. */
export function recentLoad(state: RunnerState, days: number): LoadPoints {
  const threshold = paceAtShare(
    zoneVdot(state.form.current.vdot, 'T', state.form.transfer),
    ZONE_SHARE.T
  );
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
    const threshold = paceAtShare(
      zoneVdot(state.form.current.vdot, 'T', state.form.transfer),
      ZONE_SHARE.T
    );
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

/** R19 (stavka 1): referentna nedelja pre pauze — najveća (km) od poslednje 4 kalendarske nedelje pre nedelje u kojoj
    pauza počinje; 0 kad nema trčanja. */
export function refWeekKmBefore(state: RunnerState, date: string): number {
  const monday = mondayOf(date);
  const prior = state.weeks.filter((w) => w.start < monday && diffDays(monday, w.start) <= 28);
  return Math.round(Math.max(0, ...prior.map((w) => w.distanceM)) / 100) / 10;
}

/** Referenca dugog posle punog napora: najduže pre njega ili 60 % samog napora, šta je veće. */
export function lastLongAfterEffort(
  state: RunnerState,
  date: string,
  durationSec: Seconds
): Seconds {
  return Math.max(lastLongBefore(state, date), Math.round(EFFORT_AS_LONG_SHARE * durationSec));
}

/** Pauze i bol sa ispravnim datumima i nivoom, u stalnom redosledu (isti ulaz drugim redom → isti plan; S1). */
function cleanFacts(facts: RunnerFacts): RunnerFacts {
  const order = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
  return {
    ...facts,
    pauses: facts.pauses
      .filter((p) => isValidDate(p.from) && isValidDate(p.to) && p.from <= p.to)
      .sort((a, b) => order(a.from, b.from) || order(a.to, b.to)),
    pain: facts.pain
      .filter(
        (p) =>
          isValidDate(p.date) &&
          Number.isFinite(p.level) &&
          (p.resolvedOn === undefined || isValidDate(p.resolvedOn))
      )
      .sort((a, b) => order(a.date, b.date) || a.level - b.level)
  };
}

export const buildState: BuildStateFn = (input, goal, data, estimate = declaredForm, doc) => {
  /* O5: neispravan „danas" ne ruši — izvedena polja se računaju nad zamenom, a unos odbija `validate`. */
  const inputErrors = validate(input, goal, data);
  if (!isValidDate(input.today)) {
    const safe = buildState({ ...input, today: FALLBACK_TODAY, runs: [] }, goal, data, estimate);
    return { ...safe, today: input.today, inputErrors };
  }
  const facts = cleanFacts(input);
  const availability = normalizeAvailability(facts.availability);
  const formGoal = {
    distanceM: data.distanceM,
    raceDate: isValidDate(goal.raceDate) ? goal.raceDate : facts.today
  };
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
  const thresholdPace = paceAtShare(
    zoneVdot(first.current.vdot, 'T', first.transfer),
    ZONE_SHARE.T
  );
  const easyPace = paceAtShare(zoneVdot(first.current.vdot, 'E', first.transfer), ZONE_SHARE.E);
  const loadOf = (run: Run): LoadPoints => runLoad(run, thresholdPace);
  const declared = declaredWeekLoad(facts, easyPace, data, availability.runDays.length);
  const load = loadState(
    facts,
    dailyLoads(runs, thresholdPace),
    runs.map((run) => dayNumber(run.date)),
    declared
  );
  const history = historyFacts(
    facts.today,
    runs,
    pauses,
    paceAtShare(zoneVdot(first.current.vdot, 'E', first.transfer), EASY_FAST_SHARE)
  );
  /* Postojeći plan: baza i vrh iz odluka plana (ne preračunato iz današnje baze) + ciljevi nedelja. */
  const planned: FormPlanned | null =
    doc === undefined
      ? plannedLoads(
          facts,
          goal,
          data,
          first,
          7 * load.chronic,
          availability.runDays.length,
          history
        )
      : {
          baseLoad: doc.header.decisions.baseLoad,
          peakLoad: doc.header.decisions.peakLoad,
          weeks: doc.weeks.map((w) => ({ start: w.start, targetLoad: w.targetLoad })),
          ...(doc.header.form.transfer !== undefined ? { transfer: doc.header.form.transfer } : {})
        };
  const weeks = weekSummaries(facts, runs, loadOf);
  const volume = historyVolume(weeks, load.seeded, facts.today);
  const state: RunnerState = {
    today: facts.today,
    availability,
    profile: facts.profile,
    runs,
    weeks,
    ...(volume === null ? {} : volume),
    load,
    longestRecentSec: Math.round(longestRecent(facts, runs, easyPace)),
    form: planned === null ? first : estimate(seen, formGoal, planned),
    lastHardEffort: lastHardEffort(facts, runs),
    pauses,
    pain: facts.pain.filter(
      (p) => p.resolvedOn === undefined || diffDays(facts.today, p.resolvedOn) <= PAIN_RESOLVED_DAYS
    ),
    ...history,
    ...(painHistoryOf(facts).length === 0 ? {} : { painHistory: painHistoryOf(facts) }),
    ...(inputErrors.length === 0 ? {} : { inputErrors })
  };
  return state;
};
