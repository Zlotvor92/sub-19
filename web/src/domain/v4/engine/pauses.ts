/* V4 — IZVEDENE PAUZE (SPEC § 2.3): ≥ 3 uzastopna dana bez trčanja u kojima su bila ≥ 2 planirana treninga.
   Današnji dan se ne sudi (trčanje još može da stigne). */
import { PAUSE_MIN_DAYS, PAUSE_MIN_PLANNED } from './constants';
import { addDays, diffDays } from './dates';
import type { IsoDate, Pause, PlanDay } from './types';

/** Planirano trčanje: trening sa bar jednim korakom koji nije trka (preuzet dan snage bez koraka to nije). */
export const isPlanned = (day: PlanDay): boolean =>
  day.workout !== null && day.workout.kind !== 'race' && day.workout.steps.length > 0;

export function derivedPauses(
  days: readonly PlanDay[],
  runDates: ReadonlySet<IsoDate>,
  from: IsoDate,
  today: IsoDate,
  declared: readonly Pause[]
): Pause[] {
  const out: Pause[] = [];
  const planned = new Set(days.filter(isPlanned).map((d) => d.date));
  let start: IsoDate | null = null;
  const close = (end: IsoDate): void => {
    if (start === null) return;
    const first = start;
    let count = 0;
    for (let d = first; d <= end; d = addDays(d, 1)) if (planned.has(d)) count += 1;
    const overlaps = declared.some((p) => p.from <= end && p.to >= first);
    if (diffDays(end, first) + 1 >= PAUSE_MIN_DAYS && count >= PAUSE_MIN_PLANNED && !overlaps) {
      out.push({ from: first, to: end, reason: 'nepoznato' });
    }
    start = null;
  };
  for (let d = from; d < today; d = addDays(d, 1)) {
    if (runDates.has(d)) close(addDays(d, -1));
    else start ??= d;
  }
  close(addDays(today, -1));
  return out;
}
