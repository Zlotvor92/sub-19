/** Replace future prescriptions without reinterpreting an existing measurement. */
import { addDays, diffDays, parseIsoDate, type IsoDate } from '../date';
import { r1 } from '../format';
import type { AltRecord, GenPlanState, LogEntry, StoredWeek } from '../state';
import { matchPlanRows, type StoredPredRow } from '../training/adaptation/matching';
import { profileFor } from '../training/distances';
import { assessPreparation } from '../training/generator/athleteAssessment';
import { derivePred, deriveQSById } from '../training/prediction';
import type { PlanMeta, Week } from '../training/types';
import { resolvePlan } from './resolve';

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
  ctx: ReplanContext = {}
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
  let changedDays = 0;
  const weeks = plan.weeks.map((old) => {
    const next = mapped.get(old.start);
    if (!next) return old;
    const days = old.days.map((d) => {
      const id = d.id ?? `g${old.w}d${d.dow + 1}`;
      if (protectedDays.has(id)) return d;
      const replacement = next.days.find((x) => x.dow === d.dow);
      if (!replacement) return d;
      if (JSON.stringify(d) !== JSON.stringify(replacement)) changedDays++;
      return replacement;
    });
    return old.days.every((d) => protectedDays.has(d.id ?? `g${old.w}d${d.dow + 1}`))
      ? old
      : { ...next, days };
  });
  // A fresh plan may extend the race date; preserve calendar identities for shared weeks.
  for (const w of mapped.values()) if (!oldByStart.has(w.start)) weeks.push(w);
  weeks.sort((a, b) => a.start.localeCompare(b.start));

  const meta = {
    ...plan.meta,
    ...fresh.meta,
    start: plan.meta?.start ?? fresh.meta?.start,
    weeks: weeks.length
  } as PlanMeta & Record<string, unknown>;
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

  const future = resolvePlan(weeks, { alts, moves });
  const remainingWeeks: Week[] = weeks.map((w) => {
    const days = w.days.filter((d) => {
      const date = d.id ? future.byId.get(d.id)?.date : undefined;
      return date != null && date > today;
    });
    return {
      ...w,
      days: days.map((d) => {
        if (d.rest || !d.id) return { ...d, dow: d.dow + 1 };
        const actual = future.byId.get(d.id);
        if (actual?.rest) return { dow: d.dow + 1, rest: true as const, desc: actual.desc };
        return {
          ...d,
          dow: d.dow + 1,
          km: actual?.km ?? d.km,
          ...(alts[d.id] && actual?.tag !== d.tag
            ? { tag: actual?.tag, session: undefined, finish: undefined }
            : {})
        };
      }) as Week['days'],
      vol: r1(days.reduce((n, d) => n + (d.id ? (future.byId.get(d.id)?.km ?? 0) : (d.km ?? 0)), 0))
    };
  });
  const profile = profileFor(meta.raceDistM);
  if (profile)
    meta.preparation = assessPreparation(
      { weeks: remainingWeeks, pred, qs, meta },
      profile.product.minPeakKm
    );
  meta.dayWarnings = [...new Set([...(fresh.meta?.dayWarnings ?? []), ...conflicts])];
  meta.futureChanges = { cutoff: today, preservedDays: protectedDays.size, changedDays, conflicts };
  return { ...plan, ...fresh, weeks, pred, qs, meta };
}
