/* F9 · SLOJ APLIKACIJA ↔ V4: `PlanDoc` → `ResolvedPlan` koji ekrani danas čitaju (INTEGRACIJA.md § 2b).
   Dokument se prevodi u sačuvan oblik plana (`StoredWeek[]` + pomeranja) i razrešava ISTOM funkcijom aplikacije
   (`resolvePlan`), pa pravila prikaza (datumi, zamena dana, sudar datuma) ostaju na jednom mestu. Čista funkcija. */
import { diffDays, parseIsoDate } from '../../domain/date';
import { resolvePlan, type ResolvedPlan } from '../../domain/plan';
import type { DayTag, StoredWeek } from '../../domain/state';
import {
  paceCtxOf,
  summarize,
  type PaceCtx,
  type PlanDay,
  type PlanDoc,
  type Step,
  type Workout
} from '../../domain/v4/engine';

/** Polja dana starog plana koja `legacy` nosi, a prikaz ih ne sme preuzeti (ručna izmena i pomeranje su već u doc-u). */
const LEGACY_SKIP = new Set(['alt', 'move', 'km']);

const hasZone = (steps: readonly Step[], zones: readonly string[]): boolean =>
  steps.some((s) =>
    'repeat' in s
      ? hasZone(s.steps, zones)
      : s.role === 'work' && s.target.type === 'zone' && zones.includes(s.target.zone)
  );

const kmOf = (w: Workout, ctx: PaceCtx): number =>
  Math.round(summarize(w, ctx).distanceM / 10) / 100;

/** Vrsta treninga V4 → oznaka dana aplikacije. `undefined` = odmor. */
export function tagOf(w: Workout | null, ctx: PaceCtx): DayTag | undefined {
  if (w === null) return undefined;
  switch (w.kind) {
    case 'easy':
      return 'lako';
    case 'long':
      return 'lr';
    case 'race':
      return 'trka';
    case 'test':
      return 'test';
    case 'quality':
      return hasZone(w.steps, ['I', 'R']) ? 'int' : 'tempo';
    case 'other':
      return kmOf(w, ctx) > 0 ? 'lako' : 'snaga';
  }
}

type StoredDay = StoredWeek['days'][number];

function storedDay(day: PlanDay, weekStart: string, ctx: PaceCtx): StoredDay {
  const origDate = day.movedFrom ?? day.date;
  const from = parseIsoDate(weekStart);
  const at = parseIsoDate(origDate);
  const dow = from !== null && at !== null ? diffDays(from, at) : 0;
  const w = day.workout;
  if (w === null) return { id: day.id, dow, rest: true, desc: null } as unknown as StoredDay;
  /* Nepromenjen preuzet dan nosi svoja stara polja (sesija, struktura, `mlr`, `test`…): prikaz ostaje kao pre. */
  const legacy =
    day.origin === 'adopted' && day.legacy !== undefined
      ? Object.fromEntries(Object.entries(day.legacy).filter(([k]) => !LEGACY_SKIP.has(k)))
      : {};
  const mlr = legacy['mlr'] === true && w.kind === 'easy';
  const tag = mlr ? 'lr' : tagOf(w, ctx);
  const km = tag === 'snaga' ? null : kmOf(w, ctx);
  return { ...legacy, id: day.id, dow, tag, km, desc: w.text } as unknown as StoredDay;
}

/** `PlanDoc` → sačuvan oblik plana + pomeranja (`moves`: id → važeći datum za premeštene dane). */
export function toStored(doc: PlanDoc): { weeks: StoredWeek[]; moves: Record<string, string> } {
  const ctx = paceCtxOf(doc.header);
  const moves: Record<string, string> = {};
  const weeks: StoredWeek[] = doc.weeks.map((wk) => {
    for (const d of wk.days)
      if (d.movedFrom !== undefined && d.movedFrom !== d.date) moves[d.id] = d.date;
    return {
      w: wk.index,
      start: wk.start,
      deload: wk.intent.kind === 'recovery',
      focus: wk.intent.phase,
      ...(wk.intent.kind === 'taper' ? { taper: true as const } : {}),
      phase: wk.intent.phase,
      days: wk.days.map((d) => storedDay(d, wk.start, ctx))
    };
  });
  return { weeks, moves };
}

/** `PlanDoc` → `ResolvedPlan` za postojeće ekrane. Baca `InvalidPlanError` samo za neispravan datum nedelje. */
export function toResolved(doc: PlanDoc): ResolvedPlan {
  const { weeks, moves } = toStored(doc);
  return resolvePlan(weeks, { alts: {}, moves });
}
