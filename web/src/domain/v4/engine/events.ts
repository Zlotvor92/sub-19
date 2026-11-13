/* V4 — DOGAĐAJI (SPEC § 3): izvedeni događaji iz plana i stanja. Događaj je samo okidač sa determinističnim `id`;
   brojeve `replan` čita iz stanja. Gleda samo dane posle `header.eventsFrom`. */
import {
  FATIGUE_RATIO,
  FATIGUE_REPEAT_DAYS,
  FATIGUE_WEEK_SHARE,
  PACE_UPDATE_DAYS,
  PACE_UPDATE_VDOT,
  PAUSE_MIN_DAYS
} from './constants';
import { addDays, diffDays, maxDate } from './dates';
import { doneIds } from './done';
import { derivedPauses, isPlanned } from './pauses';
import { pauseLength } from './readiness';
import { recentLoad } from './state';
import type { DeriveEventsFn, PlanEvent, PlanEventKind } from './types';

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

export const deriveEvents: DeriveEventsFn = (doc, state) => {
  const { header } = doc;
  const { today } = state;
  const applied = new Set(header.appliedEvents);
  const events: PlanEvent[] = [];
  const days = doc.weeks.flatMap((w) => w.days);
  const done = doneIds(state.runs);
  const runDates = new Set(state.runs.map((r) => r.date));
  const since = header.eventsFrom;

  /* O6: granica je uključiva — trka ili test na dan nastanka plana, upisani posle, daju događaj. Napor koji je
     plan već uzeo u obzir pri nastanku (uzrok sa izvorom `plan` tog dana) se ne ponavlja. */
  const known = new Set(
    (header.adjustments ?? []).flatMap((a) =>
      a.kind === 'effort' && a.source === 'plan' ? [a.date] : []
    )
  );
  for (const run of state.runs) {
    const fresh = run.date > since || (run.date === since && !known.has(run.date));
    if (run.effort !== undefined && fresh && run.date <= today) {
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
  const heavyWeek = recentLoad(state, 7) >= FATIGUE_WEEK_SHARE * header.decisions.baseLoad;
  const strained = !load.seeded && load.chronic > 0 && load.acute / load.chronic >= FATIGUE_RATIO;
  if (strained && heavyWeek && !recentFatigue) {
    events.push({ id: `fatigue:${today}`, date: today, kind: 'fatigue', source: 'opterecenje' });
  }

  const hasResult = events.some((e) => e.kind === 'result' && !applied.has(e.id));
  /* S6 (krug 4): tempa prate samo DOKAZ sa treninga — odrađen kvalitet; pripisani napredak plana menja samo
     očekivano vreme na dan trke. Ne u prozoru bolesti, bola ili pauze i ne uz takav događaj. */
  const evidence = form.history
    .filter((c) => c.signal === 'kvalitet' && c.ignored !== true && c.date > header.form.pacesUpdatedOn)
    .reduce((v, c) => v + (c.after - c.before), header.form.paceVdot);
  const troubled =
    events.some((e) => (e.kind === 'pause' || e.kind === 'fatigue') && !applied.has(e.id)) ||
    state.pain.some((p) => p.resolvedOn === undefined || diffDays(today, p.resolvedOn) < PACE_UPDATE_DAYS) ||
    state.pauses.some((p) => diffDays(today, p.to) < PACE_UPDATE_DAYS);
  if (
    !hasResult &&
    !troubled &&
    Math.abs(evidence - header.form.paceVdot) >= PACE_UPDATE_VDOT &&
    form.current.confidence !== 'niska' &&
    diffDays(today, header.form.pacesUpdatedOn) >= PACE_UPDATE_DAYS
  ) {
    events.push({
      id: `form-update:${today}`,
      date: today,
      kind: 'form-update',
      vdot: Math.round(evidence * 100) / 100
    });
  }

  return sortEvents(events.filter((e) => !applied.has(e.id)));
};
