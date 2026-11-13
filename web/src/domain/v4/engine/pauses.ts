/* V4 — IZVEDENE PAUZE (SPEC § 2.3): ≥ 3 uzastopna dana bez trčanja u kojima su bila ≥ 2 planirana treninga.
   Današnji dan se ne sudi (trčanje još može da stigne). */
import { PAUSE_MIN_DAYS, PAUSE_MIN_PLANNED, PAUSE_SCHEDULE_SLACK_DAYS } from './constants';
import { addDays, diffDays } from './dates';
import type { IsoDate, Pause, PlanDay, Weekday } from './types';

/** Planirano trčanje: trening sa bar jednim korakom koji nije trka (preuzet dan snage bez koraka to nije). */
export const isPlanned = (day: PlanDay): boolean =>
  day.workout !== null && day.workout.kind !== 'race' && day.workout.steps.length > 0;

/** R8 t. 5: najveći razmak (u danima) između dva uzastopna dana trčanja u rasporedu trkača (sa prelazom nedelje). */
export function scheduleMaxGap(runDays: readonly Weekday[]): number {
  const sorted = [...new Set(runDays)].sort((a, b) => a - b);
  if (sorted.length === 0) return 7;
  let gap = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    const a = sorted[i] ?? 0;
    const b = i + 1 < sorted.length ? (sorted[i + 1] ?? 0) : (sorted[0] ?? 0) + 7;
    gap = Math.max(gap, b - a);
  }
  return gap;
}

/** Izvedena pauza: dani bez trčanja (≥ 2 planirana) duži od najvećeg razmaka u rasporedu + 2 dana (R8 t. 5: kod 3
    dana nedeljno 5 dana bez trčanja nije pauza) i ne kraći od `PAUSE_MIN_DAYS`. */
export function derivedPauses(
  days: readonly PlanDay[],
  runDates: ReadonlySet<IsoDate>,
  from: IsoDate,
  today: IsoDate,
  declared: readonly Pause[],
  runDays?: readonly Weekday[]
): Pause[] {
  const minDays = Math.max(
    PAUSE_MIN_DAYS,
    runDays === undefined ? 0 : scheduleMaxGap(runDays) + PAUSE_SCHEDULE_SLACK_DAYS + 1
  );
  const out: Pause[] = [];
  const planned = new Set(days.filter(isPlanned).map((d) => d.date));
  let start: IsoDate | null = null;
  const close = (end: IsoDate): void => {
    if (start === null) return;
    const first = start;
    let count = 0;
    for (let d = first; d <= end; d = addDays(d, 1)) if (planned.has(d)) count += 1;
    const overlaps = declared.some((p) => p.from <= end && p.to >= first);
    if (diffDays(end, first) + 1 >= minDays && count >= PAUSE_MIN_PLANNED && !overlaps) {
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
