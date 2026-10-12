import { addDays, diffDays, mondayOnOrBefore, parseIsoDate, type IsoDate } from '../date';
import type { ResolvedDay, ResolvedPlan } from '../plan/types';
import type { LogEntry } from '../state/types';

/** Product thresholds, not a diagnosis or a forecast of individual adaptation. */
export const EXECUTION_POLICY = {
  historyDays: 28,
  minimumVolumeCoverage: 0.75,
  repeatedMisses: 2,
  returnCheckDays: 7,
  highEasyRpe: 7,
  lowVolumeRatio: 0.8,
  lowVolumeWeeks: 2
} as const;

export interface ExecutionWeek {
  start: IsoDate;
  end: IsoDate;
  plannedKm: number;
  actualKm: number;
  completed: number;
  missed: number;
  unknown: number;
  statusCoverage: number;
  volumeCoverage: number;
}

export interface ExecutionAnalysis {
  today: IsoDate;
  windowStart: IsoDate;
  completed: number;
  missed: number;
  unknown: number;
  statusCoverage: number;
  volumeCoverage: number;
  actualKm: number;
  plannedKm: number;
  completeWeeks: ExecutionWeek[];
  /** Median of adequately covered complete weeks after the latest explicit zero week. */
  recentWeeklyKm: number | null;
  /** Last positive, adequately covered full week: historical context, never automatic return load. */
  lastPositiveWeeklyKm: number | null;
  /** Second largest actual run in the recent window; an isolated longest run is not repeatable. */
  recentLongRunKm: number | null;
  lastRunDate: IsoDate | null;
  daysSinceLastRun: number | null;
  explicitMisses14d: number;
  easyHighRpeCount: number;
  /** Consecutive covered full weeks below 80% of prescription. */
  lowerVolumeWeeks: number;
  reasons: string[];
}

export interface ExecutionRecommendation {
  kind: 'single-miss' | 'reduce' | 'return' | 'insufficient-data' | null;
  reason: string;
  actionable: boolean;
  requiresConfirmation: boolean;
  weeklyKm?: number;
  recentLongRunKm?: number;
  breakDays?: number;
  reasons: string[];
}

type ActualRun = { date: IsoDate; km: number; day?: ResolvedDay; entry?: LogEntry };
const positive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
const round = (n: number): number => Math.round(n * 10) / 10;
const running = (day: ResolvedDay): boolean => !day.rest && positive(day.km) && day.tag !== 'snaga';
const between = (date: IsoDate, from: IsoDate, to: IsoDate): boolean => date >= from && date <= to;

/** An explicit malformed/future date is rejected, rather than reassigned to a convenient date. */
function actualDate(entry: LogEntry, plannedDate: IsoDate | undefined): IsoDate | null {
  if (entry.runDate !== undefined) return parseIsoDate(entry.runDate);
  if (entry.ts !== undefined) {
    if (typeof entry.ts !== 'string') return null;
    const date = parseIsoDate(entry.ts.slice(0, 10));
    if (!date) return null;
    if (
      entry.ts.length > 10 &&
      !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.test(
        entry.ts
      )
    )
      return null;
    return date;
  }
  return plannedDate ?? null;
}

function summarize(
  days: ResolvedDay[],
  log: Record<string, LogEntry>,
  validDoneIds: Set<string>,
  runs: ActualRun[],
  start: IsoDate,
  end: IsoDate
): ExecutionWeek {
  const eligible = days.filter((day) => running(day) && between(day.date, start, end));
  let completed = 0;
  let missed = 0;
  let knownVolume = 0;
  for (const day of eligible) {
    const entry = log[day.id];
    if (entry?.status === 'skip') {
      missed++;
      knownVolume++;
    } else if (entry?.status === 'done' && validDoneIds.has(day.id)) {
      completed++;
      if (positive(entry.km)) knownVolume++;
    }
  }
  const count = eligible.length;
  return {
    start,
    end,
    plannedKm: round(eligible.reduce((sum, day) => sum + (day.km ?? 0), 0)),
    actualKm: round(
      runs.filter((run) => between(run.date, start, end)).reduce((sum, run) => sum + run.km, 0)
    ),
    completed,
    missed,
    unknown: count - completed - missed,
    statusCoverage: count ? (completed + missed) / count : 0,
    volumeCoverage: count ? knownVolume / count : 0
  };
}

/** Missing records are unknown. Actual distance is never inferred from the prescription. */
export function analyzeExecution(input: {
  plan: ResolvedPlan;
  log: Record<string, LogEntry>;
  today: string;
  extras?: Record<string, number>;
}): ExecutionAnalysis {
  const today = parseIsoDate(input.today);
  if (!today) throw new RangeError('Neispravan datum analize treninga.');
  const windowStart = addDays(today, -(EXECUTION_POLICY.historyDays - 1));
  const validDoneIds = new Set<string>();
  const runs: ActualRun[] = [];
  const runDates = new Set<IsoDate>();
  for (const [id, entry] of Object.entries(input.log)) {
    if (entry.status !== 'done') continue;
    const day = input.plan.byId.get(id);
    const date = actualDate(entry, day?.date);
    if (!date || date > today) continue;
    if (day && running(day)) {
      validDoneIds.add(id);
      runDates.add(date);
    }
    // Strength/rest records are not running load. Orphaned IDs with an actual date survive replans.
    if (positive(entry.km) && (!day || running(day))) {
      runs.push({ date, km: entry.km, day, entry });
      runDates.add(date);
    }
  }
  const doneDates = new Set(runs.map((run) => run.date));
  for (const [key, km] of Object.entries(input.extras ?? {})) {
    const date = parseIsoDate(key);
    // vanPlana is an aggregate by date; a matched log on that date takes precedence.
    if (date && date <= today && positive(km) && !doneDates.has(date)) {
      runs.push({ date, km });
      runDates.add(date);
    }
  }
  const current = summarize(input.plan.dated, input.log, validDoneIds, runs, windowStart, today);
  const currentMonday = mondayOnOrBefore(today);
  const completeWeeks = Array.from({ length: 4 }, (_, index) => {
    const start = addDays(currentMonday, -28 + index * 7);
    return summarize(input.plan.dated, input.log, validDoneIds, runs, start, addDays(start, 6));
  });
  const coveredWeeks = completeWeeks.filter(
    (week) =>
      week.volumeCoverage >= EXECUTION_POLICY.minimumVolumeCoverage &&
      (week.actualKm > 0 || week.volumeCoverage === 1)
  );
  const lastPositiveWeek = coveredWeeks.filter((week) => week.actualKm > 0).at(-1);
  const lastExplicitZero = coveredWeeks.filter((week) => week.actualKm === 0).at(-1);
  const baseWeeks = coveredWeeks.filter(
    (week) => !lastExplicitZero || week.start >= lastExplicitZero.start
  );
  const baseValues = baseWeeks.map((week) => week.actualKm).sort((a, b) => a - b);
  const middle = Math.floor(baseValues.length / 2);
  const recentWeeklyKm = baseValues.length
    ? round(
        baseValues.length % 2
          ? baseValues[middle]!
          : (baseValues[middle - 1]! + baseValues[middle]!) / 2
      )
    : null;
  const recentRuns = runs.filter((run) => between(run.date, windowStart, today));
  const longestByDate = new Map<IsoDate, number>();
  for (const run of recentRuns)
    longestByDate.set(run.date, Math.max(longestByDate.get(run.date) ?? 0, run.km));
  const longest = [...longestByDate.values()].sort((a, b) => b - a);
  const lastRunDate = [...runDates].sort().at(-1) ?? null;
  const fortnightStart = addDays(today, -13);
  const explicitMisses14d = input.plan.dated.filter(
    (day) =>
      running(day) &&
      between(day.date, fortnightStart, today) &&
      input.log[day.id]?.status === 'skip'
  ).length;
  const easyHighRpeCount = new Set(
    recentRuns
      .filter(
        (run) =>
          run.date >= fortnightStart &&
          (run.day?.tag === 'lako' || run.day?.tag === 'rw') &&
          typeof run.entry?.['rpe'] === 'number' &&
          Number.isFinite(run.entry['rpe']) &&
          run.entry['rpe'] >= EXECUTION_POLICY.highEasyRpe &&
          run.entry['rpe'] <= 10
      )
      .map((run) => run.date)
  ).size;
  let lowerVolumeWeeks = 0;
  for (const week of [...completeWeeks].reverse()) {
    if (
      week.volumeCoverage < EXECUTION_POLICY.minimumVolumeCoverage ||
      week.plannedKm <= 0 ||
      week.actualKm / week.plannedKm >= EXECUTION_POLICY.lowVolumeRatio
    )
      break;
    lowerVolumeWeeks++;
  }
  const reasons: string[] = [];
  if (current.volumeCoverage < EXECUTION_POLICY.minimumVolumeCoverage)
    reasons.push('Nedovoljno upisanih kilometara: neupisani treninzi nisu dokaz da nisi trčao.');
  if (current.completed > 0 && current.volumeCoverage < current.statusCoverage)
    reasons.push('Završen trening bez kilometara ne potvrđuje odrađeni obim.');
  if (lastExplicitZero)
    reasons.push('Poslednja pokrivena nedelja bez trčanja prekida oslonac na raniji veći obim.');
  if (easyHighRpeCount >= 2)
    reasons.push(
      'Najmanje dva laka treninga imaju upisan napor 7–10; proveri umor pre težeg rada.'
    );
  if (lowerVolumeWeeks >= EXECUTION_POLICY.lowVolumeWeeks)
    reasons.push('Najmanje dve pokrivene pune nedelje imaju manje od 80% planiranih kilometara.');
  return {
    today,
    windowStart,
    completed: current.completed,
    missed: current.missed,
    unknown: current.unknown,
    statusCoverage: current.statusCoverage,
    volumeCoverage: current.volumeCoverage,
    actualKm: current.actualKm,
    plannedKm: current.plannedKm,
    completeWeeks,
    recentWeeklyKm,
    lastPositiveWeeklyKm: lastPositiveWeek?.actualKm ?? null,
    recentLongRunKm: longest.length >= 2 ? round(longest[1]!) : null,
    lastRunDate,
    daysSinceLastRun: lastRunDate ? diffDays(lastRunDate, today) : null,
    explicitMisses14d,
    easyHighRpeCount,
    lowerVolumeWeeks,
    reasons
  };
}

/** Advice only: the caller must collect context and show a preview before changing a plan. */
export function recommendExecution(analysis: ExecutionAnalysis): ExecutionRecommendation {
  const reasons = [...analysis.reasons];
  const base = {
    ...(analysis.recentWeeklyKm !== null && analysis.recentWeeklyKm > 0
      ? { weeklyKm: analysis.recentWeeklyKm }
      : {}),
    ...(analysis.recentLongRunKm !== null ? { recentLongRunKm: analysis.recentLongRunKm } : {})
  };
  if (
    analysis.daysSinceLastRun !== null &&
    analysis.daysSinceLastRun >= EXECUTION_POLICY.returnCheckDays
  )
    return {
      kind: 'return',
      reason: 'Dnevnik nema novije trčanje. Potvrdi da li si pravio pauzu ili trenirao bez upisa.',
      actionable: false,
      requiresConfirmation: true,
      breakDays: analysis.daysSinceLastRun,
      ...base,
      reasons
    };
  if (
    analysis.explicitMisses14d === 1 &&
    analysis.easyHighRpeCount < 2 &&
    analysis.lowerVolumeWeeks < EXECUTION_POLICY.lowVolumeWeeks
  )
    return {
      kind: 'single-miss',
      reason:
        'Jedan propušten trening ne zahteva novi plan. Nastavi raspored bez nadoknade kilometara.',
      actionable: false,
      requiresConfirmation: false,
      ...base,
      reasons
    };
  if (
    analysis.explicitMisses14d >= EXECUTION_POLICY.repeatedMisses ||
    analysis.easyHighRpeCount >= 2 ||
    analysis.lowerVolumeWeeks >= EXECUTION_POLICY.lowVolumeWeeks
  ) {
    if (base.weeklyKm === undefined)
      return {
        kind: 'insufficient-data',
        reason: 'Pre prilagođavanja unesi trenutni nedeljni obim; dnevnik ga ne potvrđuje.',
        actionable: false,
        requiresConfirmation: true,
        ...base,
        reasons
      };
    return {
      kind: 'reduce',
      reason:
        'Ponovljeni propušteni, preteški laki treninzi ili manji odrađeni obim opravdavaju pregled opterećenja.',
      actionable: true,
      requiresConfirmation: true,
      ...base,
      reasons
    };
  }
  if (analysis.recentWeeklyKm === null || analysis.recentWeeklyKm === 0)
    return {
      kind: 'insufficient-data',
      reason:
        'Dnevnik ne potvrđuje trenutni nedeljni obim. Unesi stvarne treninge ili trenutnu bazu.',
      actionable: false,
      requiresConfirmation: false,
      ...base,
      reasons
    };
  return {
    kind: null,
    reason: 'Dnevnik trenutno ne pokazuje razlog za promenu plana.',
    actionable: false,
    requiresConfirmation: false,
    ...base,
    reasons
  };
}
