/* Plan + izmene + pomeranje → plan koji aplikacija prikazuje.

   Port starog `rebuildDateIndex()`, ali čist: ne mutira plan (stari kod je mutirao `d.date`, `d.week`
   i `orig*` polja na klonu). Jedan izvor istine za datume dana. */

import { addDays, isIsoDate, parseIsoDate, type IsoDate } from '../date';
import type { AltRecord, StoredWeek } from '../state';
import type { Session } from '../training/types';
import type { DayOrigin, ResolvedDay, ResolvedPlan, ResolvedWeek } from './types';

export interface Overlay {
  alts: Readonly<Record<string, AltRecord>>;
  /** `moves[id]` = datum na koji je dan pomeren; ono što nije ispravan datum se ignoriše. */
  moves: Readonly<Record<string, unknown>>;
}

export class InvalidPlanError extends Error {}

export function resolvePlan(weeks: readonly StoredWeek[], overlay: Overlay): ResolvedPlan {
  const byId = new Map<string, ResolvedDay>();
  const byDate = new Map<IsoDate, ResolvedDay>();
  const dated: ResolvedDay[] = [];
  const out: ResolvedWeek[] = [];

  for (const wk of weeks) {
    const start = parseIsoDate(wk.start);
    if (!start)
      throw new InvalidPlanError(`Nedelja ${wk.w}: neispravan datum početka (${String(wk.start)})`);
    const days: ResolvedDay[] = [];
    for (const d of wk.days) {
      const id = d.id as string;
      const day = d as unknown as Record<string, unknown>;
      const origin: DayOrigin = {
        tag: d.tag,
        km: d.km ?? null,
        desc: d.desc ?? null,
        rest: !!d.rest,
        runWalk: 'runWalk' in d ? d.runWalk : undefined,
        ...(d.finish ? { finish: d.finish } : {}),
        ...(d.strides ? { strides: d.strides } : {})
      };
      const alt = overlay.alts[id];
      const isTest = !!day['test'];
      const origDate = addDays(start, d.dow);
      const resolved: ResolvedDay = {
        id,
        w: wk.w,
        weekStart: start,
        dow: d.dow,
        origDate,
        date: origDate,
        tag: origin.tag,
        rest: origin.rest,
        km: origin.km,
        desc: origin.desc,
        runWalk: origin.runWalk,
        ...(d.finish ? { finish: d.finish } : {}),
        ...(d.strides ? { strides: d.strides } : {}),
        snaga: false,
        session: d.session,
        mlr: 'mlr' in d && d.mlr === true,
        test: isTest,
        origin
      };
      if (alt) {
        delete resolved.finish;
        delete resolved.strides;
        resolved.rest = alt.tag === 'odmor';
        resolved.tag = resolved.rest ? undefined : alt.tag;
        resolved.km = resolved.rest ? null : alt.km != null ? alt.km : null;
        resolved.desc = alt.desc;
        /* ritam: izmena ga može postaviti, a bez nje se vraća originalni */
        if (alt.rw) resolved.runWalk = alt.rw;
        else if (origin.runWalk !== undefined) resolved.runWalk = origin.runWalk;
        resolved.snaga = !!(alt.snaga && !resolved.rest);
      }
      byId.set(id, resolved);
      if (!isTest) {
        const mv = overlay.moves[id];
        resolved.date = typeof mv === 'string' && isIsoDate(mv) ? mv : origDate;
        /* Dva dana na istom datumu (oštećeno `moves`): dan se vraća na svoje mesto po planu. */
        const occupant = byDate.get(resolved.date);
        if (occupant && occupant !== resolved) resolved.date = origDate;
        if (!byDate.has(resolved.date)) dated.push(resolved);
        byDate.set(resolved.date, resolved);
      }
      days.push(resolved);
    }
    out.push({
      w: wk.w,
      start,
      deload: !!wk.deload,
      focus: wk.focus,
      ...(wk.taper === true ? { taper: true as const } : {}),
      days
    });
  }
  dated.sort((a, b) => (a.date < b.date ? -1 : 1));
  const trainingDays = out.reduce((n, wk) => n + wk.days.filter((d) => !d.rest).length, 0);
  return { weeks: out, byId, byDate, dated, trainingDays };
}

/** Nedelja kojoj datum pripada (pon–ned), ili `null`. */
export function weekOf(plan: ResolvedPlan, date: string): ResolvedWeek | null {
  for (const w of plan.weeks) {
    const end = addDays(w.start, 6);
    if (date >= w.start && date <= end) return w;
  }
  return null;
}

export type { Session };
