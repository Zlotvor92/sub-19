/* Explicit Phase 3 exceptions to frozen import parity. No legacy recording is changed.
 * R is a recorded work pace, never aerobic evidence; an old aerobic-outlier flag for a
 * numerically valid R pace is therefore replaced by that displayed pace. Everything else
 * in the imported log and every non-R raw measurement remains under exact oracle comparison. */
import type { GenPlanState, LogEntry, VdotRecord } from '../domain/state';
import { resolvePlan } from '../domain/plan/resolve';
import { planBaselineVdot } from '../domain/plan/baseline';
import {
  classifyMeasurement,
  matchPlanRows,
  recomputeVdotChain,
  sessionClassFor,
  zoneForPredLabel,
  type StoredPredRow
} from '../domain/training/adaptation';
import { isT3kId } from '../domain/training/vdot/limits';

export function phase3ImportExpectation<
  T extends {
    log: Record<string, LogEntry>;
    pred: Record<string, number>;
    predLock: Record<string, boolean>;
    vdotLog: VdotRecord[];
    moves: Record<string, unknown>;
  }
>(plan: GenPlanState, old: T): T {
  const expected = JSON.parse(JSON.stringify(old)) as T;
  const rows = plan.pred as StoredPredRow[];
  const resolved = resolvePlan(plan.weeks, { alts: {}, moves: old.moves });
  const matched = matchPlanRows(resolved.weeks, rows);
  for (const [dayId, row] of matched) {
    if (zoneForPredLabel(row.l) !== 'R' || old.predLock[row.id]) continue;
    const rejected = old.log[dayId]?.autoOdbijen;
    if (typeof rejected !== 'number') continue;
    const outcome = classifyMeasurement({
      row,
      paceSec: rejected,
      kind: resolved.byId.get(dayId)?.session?.kind ?? null,
      auto: false,
      retagged: false,
      currentVdot: null,
      baselineVdot: planBaselineVdot(plan.meta)
    });
    if (outcome.status !== 'not-measured') continue;
    expected.pred[row.id] = rejected;
    const log = expected.log[dayId];
    if (log) delete log.autoOdbijen;
  }
  const kept = old.vdotLog.filter((record) => {
    const row = rows.find((r) => r.id === record.id);
    return row == null || zoneForPredLabel(row.l) !== 'R';
  });
  expected.vdotLog = recomputeVdotChain(kept, planBaselineVdot(plan.meta), (id) =>
    sessionClassFor(isT3kId(id), rows.find((row) => row.id === id)?.l)
  );
  return expected;
}
