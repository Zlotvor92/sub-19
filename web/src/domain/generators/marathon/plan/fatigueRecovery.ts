/** Apply calendar recovery after grafting, using effective dates and preserving evidence. */
import { addDays, diffDays, mondayOnOrBefore, type IsoDate } from '../date';
import type { GenPlanState, StoredWeek } from '../exchange';
import type { PlanMeta } from '../training/types';
import { isDemanding } from './finalize';
import type { ReplanContext } from './future';
import { resolvePlan } from './resolve';

export function guardFatigueRecovery(
  plan: GenPlanState,
  today: IsoDate,
  ctx: ReplanContext,
  protectedDays: ReadonlySet<string>,
  conflicts: string[]
): GenPlanState {
  const window = plan.meta?.fatigueRecovery;
  if (!window || window.end <= today) return plan;
  const view = resolvePlan(plan.weeks, { alts: ctx.alts ?? {}, moves: ctx.moves ?? {} });
  const running = [...view.byId.values()].filter(
    (d) =>
      d.date > today &&
      d.date >= window.start &&
      d.date < window.end &&
      !d.rest &&
      d.tag !== 'snaga'
  );
  const allowedKm = (d: { date: IsoDate; km: number | null }) =>
    Math.min(d.km ?? 0, window.dayCapsKm?.[d.date] ?? Infinity);
  const scales = new Map<string, number>();
  for (const [start, cap] of Object.entries(window.weekCapsKm)) {
    const days = running.filter((d) => mondayOnOrBefore(d.date) === start);
    const lockedKm = days
      .filter((d) => protectedDays.has(d.id))
      .reduce((n, d) => n + (d.km ?? 0), 0);
    const freeKm = days
      .filter((d) => !protectedDays.has(d.id))
      .reduce((n, d) => n + allowedKm(d), 0);
    scales.set(start, freeKm > 0 ? Math.min(1, Math.max(0, cap - lockedKm) / freeKm) : 1);
    if (lockedKm > cap)
      conflicts.push(
        `Konflikt oporavka: sačuvani zaštićeni obim u nedelji ${start} (${lockedKm.toFixed(1)} km) prelazi granicu ${cap.toFixed(1)} km. Zapisi ostaju; ručno proveri opterećenje.`
      );
  }
  const eligible = new Map(running.map((d) => [d.id, d]));
  for (const day of running) {
    if (protectedDays.has(day.id) && (day.km ?? 0) > (window.dayCapsKm?.[day.date] ?? Infinity))
      conflicts.push(
        `Konflikt oporavka: sačuvan zaštićen trening ${day.id} (${day.date}) prelazi prethodni dnevni obim. Zapis ostaje; ručno proveri opterećenje.`
      );
    if (
      protectedDays.has(day.id) &&
      (ctx.alts?.[day.id]
        ? ['tempo', 'int', 'test', 'trka'].includes(day.tag ?? '')
        : isDemanding(day))
    )
      conflicts.push(
        `Konflikt oporavka: zaštićen trening ${day.id} (${day.date}) sadrži kvalitet ili ubrzanja. Zapis ostaje; ručno odluči o izmeni.`
      );
  }
  const weeks = plan.weeks.map((w) => ({
    ...w,
    ...(w.start >= mondayOnOrBefore(window.start) && w.start < window.end ? { deload: true } : {}),
    days: w.days.map((d) => {
      const effective = d.id ? eligible.get(d.id) : undefined;
      if (!effective || protectedDays.has(d.id!) || d.rest) return d;
      const { session: _session, finish: _finish, strides: _strides, ...easy } = d;
      const scale = scales.get(mondayOnOrBefore(effective.date)) ?? 1;
      return {
        ...easy,
        desc: d.desc ?? '',
        tag: d.tag === 'rw' ? 'rw' : 'lako',
        // Round down so aggregate rounding cannot exceed the recovery budget.
        km: Math.floor(allowedKm(effective) * scale * 10 + 1e-8) / 10
      } as StoredWeek['days'][number];
    })
  }));
  return { ...plan, weeks };
}

/** Capture the previous effective calendar before regeneration reindexes its phases. */
export function fatigueWindowFor(
  current: GenPlanState,
  today: IsoDate,
  weeklyKm: number,
  end: IsoDate,
  context: ReplanContext
): NonNullable<PlanMeta['fatigueRecovery']> {
  const start = addDays(today, 1);
  const view = resolvePlan(current.weeks, { alts: context.alts ?? {}, moves: context.moves ?? {} });
  const dayCapsKm = Object.fromEntries(
    view.dated
      .filter((d) => d.date >= start && d.date < end)
      .map((d) => [d.date, !d.rest && d.tag !== 'snaga' ? (d.km ?? 0) : 0])
  );
  const weekCapsKm: Record<string, number> = {};
  for (let week = mondayOnOrBefore(today); week < end; week = addDays(week, 7)) {
    const from = week < start ? start : week;
    const to = addDays(week, 7) < end ? addDays(week, 7) : end;
    const previousKm = view.dated
      .filter((d) => d.date >= from && d.date < to && !d.rest && d.tag !== 'snaga')
      .reduce((n, d) => n + (d.km ?? 0), 0);
    weekCapsKm[week] = Math.min(previousKm, (weeklyKm * diffDays(from, to)) / 7);
  }
  return { start, end, weekCapsKm, dayCapsKm };
}
