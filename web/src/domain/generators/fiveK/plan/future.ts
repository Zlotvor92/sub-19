/** Replace future prescriptions without reinterpreting an existing measurement. */
import { addDays, diffDays, parseIsoDate, type IsoDate } from '../date';
import type { AltRecord, GenPlanState, LogEntry, StoredWeek } from '../exchange';
import { matchPlanRows, type StoredPredRow } from '../training/adaptation/matching';
import { derivePred, deriveQSById } from '../training/prediction';
import type { PlanMeta } from '../training/types';
import { resolvePlan } from './resolve';
import { alignAutomaticOverlays } from './automaticAlts';
import { guardFatigueRecovery } from './fatigueRecovery';
import { finalizeFuturePlan, type FinalizationOptions } from './finalize';

export interface ReplanContext {
  log?: Readonly<Record<string, LogEntry>>;
  alts?: Readonly<Record<string, AltRecord>>;
  moves?: Readonly<Record<string, unknown>>;
  pred?: Readonly<Record<string, unknown>>;
  predLock?: Readonly<Record<string, unknown>>;
}

const rowsWithIds = (plan: GenPlanState): StoredPredRow[] =>
  plan.pred.map((r, i) => ({ ...r, id: r.id ?? `g${r.w}_${i}` }));
const rowBody = ({ id: _id, ...r }: StoredPredRow): string => JSON.stringify(r);
const hash = (value: string): string => {
  let n = 2166136261;
  for (let i = 0; i < value.length; i++) n = Math.imul(n ^ value.charCodeAt(i), 16777619);
  return (n >>> 0).toString(36);
};

export function graftFuturePlan(
  plan: GenPlanState,
  fresh: GenPlanState,
  today: IsoDate,
  ctx: ReplanContext = {},
  options: FinalizationOptions = {}
): GenPlanState {
  const alts = ctx.alts ?? {};
  const moves = ctx.moves ?? {};
  const oldRows = rowsWithIds(plan);
  const resolved = resolvePlan(plan.weeks, { alts, moves });
  // Prescription matching uses original day slots; an overlay can hide a measured session.
  const matched = matchPlanRows(resolvePlan(plan.weeks, { alts: {}, moves }).weeks, oldRows);
  const protectedDays = new Set<string>();
  const protectedRows = new Set<string>();
  const conflicts: string[] = [];
  const measured = (id: string): boolean => ctx.pred?.[id] != null || !!ctx.predLock?.[id];
  for (const w of plan.weeks) {
    for (const d of w.days) {
      const id = d.id ?? `g${w.w}d${d.dow + 1}`;
      const day = resolved.byId.get(id);
      const row = matched.get(id);
      const manualSession = Object.values(d.session?.overrides ?? {}).some(Boolean);
      const alt = alts[id];
      // Automatic pace may coexist with a user's distance, type or run/walk edit.
      const manualAlt =
        !!alt &&
        (!alt.paceAuto ||
          alt.tag !== (d.rest ? 'odmor' : d.tag) ||
          alt.km !== (d.km ?? null) ||
          alt.desc !== (d.desc ?? (d.rest ? 'Odmor' : '')) ||
          alt.rw != null ||
          !!alt.snaga);
      const protect =
        (day?.date ?? addDays(parseIsoDate(w.start)!, d.dow)) <= today ||
        !!(parseIsoDate(moves[id]) && String(moves[id]) <= today) ||
        ctx.log?.[id]?.status === 'done' ||
        !!(row && measured(row.id)) ||
        manualSession ||
        manualAlt;
      if (protect) {
        protectedDays.add(id);
        if (row) protectedRows.add(row.id);
        if (day && day.date > today && (manualSession || manualAlt))
          conflicts.push(
            `Ručno izmenjen trening ${day.date} je sačuvan; proveri da li odgovara novoj bazi.`
          );
      }
    }
  }
  // Never discard an entered/locked row even if a legacy overlay prevents day matching.
  for (const r of oldRows) {
    const week = plan.weeks.find((w) => w.w === r.w);
    const start = week ? parseIsoDate(week.start) : null;
    if (measured(r.id) || (start && addDays(start, 6) <= today)) protectedRows.add(r.id);
  }

  const oldByStart = new Map(plan.weeks.map((w) => [w.start, w]));
  const mapped = new Map<string, StoredWeek>();
  for (const w of fresh.weeks) {
    const original = oldByStart.get(w.start);
    const anchor = parseIsoDate(plan.weeks[0]?.start);
    const number =
      original?.w ??
      (anchor ? Math.round(diffDays(anchor, parseIsoDate(w.start)!) / 7) + plan.weeks[0]!.w : w.w);
    mapped.set(w.start, {
      ...w,
      w: number,
      days: w.days.map((d) => {
        const previous = original?.days.find((x) => x.dow === d.dow);
        return { ...d, id: previous?.id ?? `g${number}d${d.dow + 1}` };
      })
    });
  }
  let weeks = plan.weeks.map((old) => {
    const next = mapped.get(old.start);
    if (!next) return old;
    const days = old.days.map((d) => {
      const id = d.id ?? `g${old.w}d${d.dow + 1}`;
      if (protectedDays.has(id)) return d;
      const replacement = next.days.find((x) => x.dow === d.dow);
      if (!replacement) return d;
      return replacement;
    });
    return old.days.every((d) => protectedDays.has(d.id ?? `g${old.w}d${d.dow + 1}`))
      ? old
      : { ...next, days };
  });
  // A fresh plan may extend the race date; preserve calendar identities for shared weeks.
  for (const w of mapped.values()) if (!oldByStart.has(w.start)) weeks.push(w);
  weeks.sort((a, b) => a.start.localeCompare(b.start));

  let meta = {
    ...plan.meta,
    ...fresh.meta,
    start: plan.meta?.start ?? fresh.meta?.start,
    weeks: weeks.length
  } as PlanMeta & Record<string, unknown>;
  if (fresh.meta?.runWalk)
    meta.runWalk = {
      ...fresh.meta.runWalk,
      transitionStart: addDays(fresh.meta.start, (fresh.meta.runWalk.transitionWeek - 1) * 7)
    };
  // Keep an active calendar guard across goal changes, recalibration and restore.
  const activeRecovery = plan.meta?.fatigueRecovery;
  const nextRecovery = fresh.meta?.fatigueRecovery;
  if (activeRecovery && activeRecovery.end > today) {
    if (!nextRecovery || nextRecovery.end <= today) meta.fatigueRecovery = activeRecovery;
    else {
      const weekCapsKm = { ...activeRecovery.weekCapsKm, ...nextRecovery.weekCapsKm };
      for (const [week, cap] of Object.entries(activeRecovery.weekCapsKm))
        weekCapsKm[week] = Math.min(cap, nextRecovery.weekCapsKm[week] ?? cap);
      const dayCapsKm = { ...activeRecovery.dayCapsKm, ...nextRecovery.dayCapsKm };
      for (const [date, cap] of Object.entries(activeRecovery.dayCapsKm ?? {}))
        dayCapsKm[date] = Math.min(cap, nextRecovery.dayCapsKm?.[date] ?? cap);
      meta.fatigueRecovery = {
        start:
          activeRecovery.start < nextRecovery.start ? activeRecovery.start : nextRecovery.start,
        end: activeRecovery.end > nextRecovery.end ? activeRecovery.end : nextRecovery.end,
        weekCapsKm,
        dayCapsKm
      };
    }
  }
  if (
    meta.fatigueRecovery &&
    meta.fatigueRecovery.end > today &&
    meta.athlete &&
    meta.athlete.currentReadiness !== 'returning'
  )
    meta.athlete = {
      ...meta.athlete,
      currentReadiness: 'fatigued',
      qualityReadiness: 'developing'
    };
  const recoveryContext = {
    ...ctx,
    alts: alignAutomaticOverlays(plan, { ...fresh, weeks, meta }, today, ctx)
  };
  const recovered = guardFatigueRecovery(
    { ...fresh, weeks, meta },
    today,
    recoveryContext,
    protectedDays,
    conflicts
  );
  weeks = recovered.weeks;
  const finalized = finalizeFuturePlan(
    { ...fresh, weeks, meta },
    today,
    { ...ctx, alts: alignAutomaticOverlays(plan, { ...fresh, weeks, meta }, today, ctx) },
    protectedDays,
    conflicts,
    options
  );
  weeks = finalized.weeks;
  meta = finalized.meta!;
  const oldDays = new Map(plan.weeks.flatMap((w) => w.days).map((d) => [d.id, d]));
  const changedDays = weeks
    .flatMap((w) => w.days)
    .filter((d) => JSON.stringify(d) !== JSON.stringify(oldDays.get(d.id))).length;
  const pred: StoredPredRow[] = [];
  const qs: Record<string, number[]> = {};
  const retained = new Set<string>();
  for (const w of weeks) {
    for (const d of w.days) {
      if (!d.id) continue;
      const old = matched.get(d.id);
      if (protectedDays.has(d.id)) {
        if (old) {
          pred.push(old);
          retained.add(old.id);
        }
        if (plan.qs?.[d.id]) qs[d.id] = plan.qs[d.id]!;
        continue;
      }
      Object.assign(qs, deriveQSById([{ ...w, days: [d] }]));
      const row = derivePred([{ ...w, days: [d] }], meta.raceDistM, meta)[0];
      if (!row) continue;
      const candidate = { ...row, id: '' };
      const id =
        old && rowBody(old) === rowBody(candidate)
          ? old.id
          : `g${w.w}_${hash(`${d.id}:${rowBody(candidate)}`)}`;
      pred.push({ ...row, id });
      retained.add(id);
    }
  }
  for (const row of oldRows) if (protectedRows.has(row.id) && !retained.has(row.id)) pred.push(row);

  meta.futureChanges = { cutoff: today, preservedDays: protectedDays.size, changedDays, conflicts };
  return { ...plan, ...fresh, weeks, pred, qs, meta };
}
