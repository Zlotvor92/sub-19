/* V4 — „urađeno" je `Run` sa `dayId` (SPEC § 1.2); plan to ne čuva. */
import type { DayId, Run } from './types';

export function doneIds(runs: readonly Run[]): Set<DayId> {
  const done = new Set<DayId>();
  for (const run of runs) if (run.dayId !== undefined) done.add(run.dayId);
  return done;
}
