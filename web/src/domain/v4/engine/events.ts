/* V4 — DOGAĐAJI (SPEC § 3): izvedeni događaji iz plana i stanja. Događaj je samo okidač sa determinističnim `id`;
   brojeve `replan` čita iz stanja. Gleda samo dane posle `header.eventsFrom`. */
import {
  FATIGUE_RATIO,
  FATIGUE_REPEAT_DAYS,
  PACE_UPDATE_DAYS,
  PACE_UPDATE_VDOT,
  PAUSE_MIN_DAYS,
  PAUSE_MIN_PLANNED
} from './constants';
import { addDays, diffDays, maxDate } from './dates';
import { doneIds } from './done';
import { pauseLength } from './readiness';
import type { DeriveEventsFn, IsoDate, Pause, PlanDay, PlanEvent, PlanEventKind } from './types';

/** Redosled vrsta iz tabele § 3 (drugi ključ sortiranja posle datuma). */
const KIND_ORDER: readonly PlanEventKind[] = [
  'result',
  'missed',
  'pause',
  'pain',
  'fatigue',
  'manual-edit',
  'goal-change',
  'availability-change',
  'form-update',
  'none'
];

/** Događaji bez duplikata, redom: datum, vrsta, `id` (§ 6.4). */
export function sortEvents(events: readonly PlanEvent[]): PlanEvent[] {
  const byId = new Map<string, PlanEvent>();
  for (const event of events) if (!byId.has(event.id)) byId.set(event.id, event);
  return [...byId.values()].sort(
    (a, b) =>
      (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) ||
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

const isPlanned = (day: PlanDay): boolean => day.workout !== null && day.workout.kind !== 'race';

/** Izvedene pauze (§ 2.3): ≥ 3 uzastopna dana bez trčanja sa ≥ 2 planirana treninga; današnji dan se ne sudi. */
function derivedPauses(
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
    let count = 0;
    for (let d = start; d <= end; d = addDays(d, 1)) if (planned.has(d)) count += 1;
    const overlaps = declared.some((p) => p.from <= end && p.to >= (start ?? end));
    if (pauseLength(start, end) >= PAUSE_MIN_DAYS && count >= PAUSE_MIN_PLANNED && !overlaps) {
      out.push({ from: start, to: end, reason: 'nepoznato' });
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

export const deriveEvents: DeriveEventsFn = (doc, state) => {
  const { header } = doc;
  const { today } = state;
  const applied = new Set(header.appliedEvents);
  const events: PlanEvent[] = [];
  const days = doc.weeks.flatMap((w) => w.days);
  const done = doneIds(state.runs);
  const runDates = new Set(state.runs.map((r) => r.date));
  const since = header.eventsFrom;

  for (const run of state.runs) {
    if (run.effort !== undefined && run.date > since && run.date <= today) {
      events.push({
        id: `result:${run.date}:${run.id}`,
        date: run.date,
        kind: 'result',
        runId: run.id
      });
    }
  }

  const declared = state.pauses.filter(
    (p) => p.to > since && pauseLength(p.from, p.to) >= PAUSE_MIN_DAYS
  );
  const firstDay = maxDate(addDays(since, 1), header.startDate);
  const pauses = [...declared, ...derivedPauses(days, runDates, firstDay, today, declared)];
  for (const pause of pauses) {
    events.push({
      id: `pause:${pause.from}:${pause.to}`,
      date: pause.to,
      kind: 'pause',
      from: pause.from,
      to: pause.to,
      reason: pause.reason
    });
  }

  for (const day of days) {
    if (day.date <= since || day.date >= today || !isPlanned(day)) continue;
    if (done.has(day.id) || runDates.has(day.date)) continue;
    if (pauses.some((p) => day.date >= p.from && day.date <= p.to)) continue;
    events.push({
      id: `missed:${day.date}:${day.id}`,
      date: day.date,
      kind: 'missed',
      dayId: day.id
    });
  }

  const { load, form } = state;
  const recentFatigue = (header.adjustments ?? []).some(
    (a) => a.kind === 'fatigue' && diffDays(today, a.date) < FATIGUE_REPEAT_DAYS
  );
  if (
    !load.seeded &&
    load.chronic > 0 &&
    load.acute / load.chronic >= FATIGUE_RATIO &&
    !recentFatigue
  ) {
    events.push({ id: `fatigue:${today}`, date: today, kind: 'fatigue', source: 'opterecenje' });
  }

  const hasResult = events.some((e) => e.kind === 'result' && !applied.has(e.id));
  if (
    !hasResult &&
    Math.abs(form.current.vdot - header.form.paceVdot) >= PACE_UPDATE_VDOT &&
    form.current.confidence !== 'niska' &&
    diffDays(today, header.form.pacesUpdatedOn) >= PACE_UPDATE_DAYS
  ) {
    events.push({
      id: `form-update:${today}`,
      date: today,
      kind: 'form-update',
      vdot: form.current.vdot
    });
  }

  return sortEvents(events.filter((e) => !applied.has(e.id)));
};
