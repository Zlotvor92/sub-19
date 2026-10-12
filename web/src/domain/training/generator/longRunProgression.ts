import type { DistanceHeuristic } from '../constants/distances';

/**
 * Product heuristics, not universal injury thresholds or a readiness verdict.
 * Growth uses exposure to long runs; weekly mileage is a ceiling, not its driver.
 */
export const LONG_RUN_PROGRESSION_HEURISTICS = {
  establishedWeeks: 8,
  establishedStepPct: 0.08,
  establishedStepMaxKm: 1.5,
  cautiousStepPct: 0.06,
  cautiousStepMaxKm: 1,
  deloadFactor: 0.75,
  marathonConsolidationEvery: 3,
  marathonConsolidationFactor: 0.9
} as const;

export interface LongRunProgressionRequest {
  heuristic: DistanceHeuristic;
  week: number;
  /** A distance repeated comfortably recently, not a lifetime longest run. */
  recentLongRunKm?: number;
  /** Consecutive recent weeks of regular running. Missing data uses cautious growth. */
  consistentWeeks?: number;
  trainedRecently: boolean;
  /** Highest actually delivered prior LR, never the earlier unfulfilled target. */
  previousPeakKm?: number;
  startingWeeklyKm?: number;
  weeklyKm: number;
  paceSecPerKm: number;
  isDeload?: boolean;
  /** Existing profile taper factor; taper takes precedence over recovery waves. */
  taperFactor?: number;
  marathon?: boolean;
}

export interface LongRunProgressionTarget {
  km: number;
  baselineKm: number;
  basis: 'reported' | 'inferred';
  limitedBy: Array<'weekly-share' | 'duration' | 'absolute'>;
}

const nonnegative = (n: number): number => (Number.isFinite(n) ? Math.max(0, n) : 0);
const downToTenth = (n: number): number => Math.floor((n + 1e-8) * 10) / 10;

/**
 * Independent LR target for one full week. Allocation must still reserve other
 * runs and check the final delivered mileage. Its result is not permission to
 * force a target through a weekly budget or to promise completion of a race.
 *
 * Recovery does not reset the previous exposure peak. A blocked target also
 * does not accumulate "missed" increments for a later catch-up jump.
 */
export function nextLongRunTarget(req: LongRunProgressionRequest): LongRunProgressionTarget {
  const h = req.heuristic;
  const startingWeeklyKm = nonnegative(req.startingWeeklyKm ?? req.weeklyKm);
  const reported = req.recentLongRunKm != null && req.recentLongRunKm > 0;
  const inferred = Math.min(startingWeeklyKm * h.longRun.share, h.longRun.lowVolumeCapKm);
  const durationCap =
    req.paceSecPerKm > 0 && Number.isFinite(req.paceSecPerKm)
      ? (h.longRun.timeCapMin * 60) / req.paceSecPerKm
      : h.longRun.absCapKm;
  const baselineKm = downToTenth(
    Math.min(
      reported ? nonnegative(req.recentLongRunKm!) : inferred,
      startingWeeklyKm * h.longRunMaxShare,
      durationCap,
      h.longRun.absCapKm
    )
  );
  const previous = req.previousPeakKm != null ? nonnegative(req.previousPeakKm) : baselineKm;
  const k = LONG_RUN_PROGRESSION_HEURISTICS;
  const established = req.trainedRecently && (req.consistentWeeks ?? 0) >= k.establishedWeeks;
  const step = Math.min(
    previous * (established ? k.establishedStepPct : k.cautiousStepPct),
    established ? k.establishedStepMaxKm : k.cautiousStepMaxKm
  );
  let target: number;
  if (req.taperFactor != null) target = previous * Math.max(0, Math.min(1, req.taperFactor));
  else if (req.isDeload) target = previous * k.deloadFactor;
  else if (req.marathon && req.week > 1 && req.week % k.marathonConsolidationEvery === 0)
    target = previous * k.marathonConsolidationFactor;
  else target = req.week <= 1 ? baselineKm : previous + step;

  const caps = [
    ['weekly-share', nonnegative(req.weeklyKm) * h.longRunMaxShare],
    ['duration', durationCap],
    ['absolute', h.longRun.absCapKm]
  ] as const;
  return {
    km: downToTenth(Math.min(target, ...caps.map(([, value]) => value))),
    baselineKm,
    basis: reported ? 'reported' : 'inferred',
    limitedBy: caps.filter(([, value]) => value < target - 0.01).map(([name]) => name)
  };
}
