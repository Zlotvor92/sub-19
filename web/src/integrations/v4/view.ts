/* F9 · SLOJ APLIKACIJA ↔ V4: `PlanDoc` → `ResolvedPlan` koji ekrani danas čitaju (INTEGRACIJA.md § 2b).
   Dokument se prevodi u sačuvan oblik plana (`StoredWeek[]` + pomeranja) i razrešava ISTOM funkcijom aplikacije
   (`resolvePlan`), pa pravila prikaza (datumi, zamena dana, sudar datuma) ostaju na jednom mestu. Čista funkcija. */
import { diffDays, parseIsoDate } from '../../domain/date';
import { resolvePlan, type ResolvedDay, type ResolvedPlan } from '../../domain/plan';
import type { DayTag, StoredWeek } from '../../domain/state';
import {
  paceCtxOf,
  summarize,
  type PaceCtx,
  type PlanDay,
  type PlanDoc,
  type SingleStep,
  type Step,
  type Workout
} from '../../domain/v4/engine';

type Structure = NonNullable<ResolvedDay['structure']>;
type SStep = Structure['blocks'][number]['step'];
type SBlock = Structure['blocks'][number];

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

/* Struktura za prikaz (zagrevanje / rad / oporavak / hlađenje, km, trajanje, tempo) iz koraka V4 treninga — isti oblik
   koji ekran „Trening" već crta za strukturisane dane. Tempo zone iz zaglavlja plana; plan „po osećaju" (`byFeel`) ne
   piše tempo kvaliteta nego ga daje samo kao orijentir. Ništa se ne upisuje: samo prikaz. */
function paceOfStep(s: SingleStep, ctx: PaceCtx): number | null {
  const t = s.target;
  if (t.type === 'pace') return t.secPerKm;
  if (t.type !== 'zone') return null;
  if (t.zone === 'E') return s.role === 'recovery' ? ctx.paces.easySlow : ctx.paces.easy;
  return ctx.paces[t.zone];
}

function kindOfStep(s: SingleStep, w: Workout): SStep['kind'] {
  switch (s.role) {
    case 'warmup':
      return 'warmup';
    case 'cooldown':
      return 'cooldown';
    case 'recovery':
      return 'recovery';
    case 'steady':
      return w.kind === 'long' ? 'long' : 'easy';
    case 'work':
      if (w.kind === 'race') return 'race';
      if (w.kind === 'test') return 'test';
      return w.kind === 'easy' ? 'stride' : 'work';
  }
}

/* Struktura PRE / RAD / POSLE samo za trening sa zagrevanjem ili hlađenjem (kvalitet, test). Lagan i dugi dan (i sa
   ubrzanjima ili završnim delom) ostaje lagan dan kao pre: opis, km i lagan tempo — ubrzanja nisu „tempo rada". */
function hasWarmupOrCooldown(w: Workout): boolean {
  return (w.steps as readonly Step[]).some(
    (s) => !('repeat' in s) && (s.role === 'warmup' || s.role === 'cooldown')
  );
}

const round2 = (x: number): number => Math.round(x * 100) / 100;

function structStep(s: SingleStep, w: Workout, ctx: PaceCtx): SStep {
  const pace = paceOfStep(s, ctx);
  const feel = ctx.paces.byFeel && s.target.type === 'zone' && s.target.zone !== 'E';
  const zone =
    s.target.type === 'zone' ? (s.role === 'recovery' ? 'jog' : s.target.zone) : undefined;
  const byDistance = 'distanceM' in s.extent;
  const km = byDistance
    ? round2((s.extent as { distanceM: number }).distanceM / 1000)
    : pace != null
      ? round2((s.extent as { durationSec: number }).durationSec / pace)
      : null;
  const sec = byDistance
    ? pace != null && km != null
      ? Math.round(km * pace)
      : null
    : (s.extent as { durationSec: number }).durationSec;
  return {
    kind: kindOfStep(s, w),
    ...(zone !== undefined ? { zone } : {}),
    km,
    sec,
    paceSec: feel ? null : pace,
    ...(feel && pace != null ? { estimatePaceSec: pace } : {}),
    kmBasis: byDistance ? 'exact' : 'estimated',
    secBasis: byDistance ? 'estimated' : 'exact'
  };
}

const sameStep = (a: SStep, b: SStep): boolean =>
  a.kind === b.kind && a.km === b.km && a.sec === b.sec && a.paceSec === b.paceSec;

export function structureOf(w: Workout, ctx: PaceCtx): Structure {
  const blocks: SBlock[] = [];
  for (const st of w.steps as readonly Step[]) {
    if (!('repeat' in st)) {
      const step = structStep(st, w, ctx);
      /* V4 piše „N × deonica" kao ponavljanje (deonica + oporavak) pa poslednju deonicu bez oporavka: spaja se u jedan blok */
      const prev = blocks[blocks.length - 1];
      if (prev && prev.recovery && sameStep(prev.step, step)) prev.reps += 1;
      else blocks.push({ reps: 1, step });
      continue;
    }
    const [main, rec, ...rest] = st.steps;
    if (main && rec && rest.length === 0 && rec.role === 'recovery') {
      blocks.push({
        reps: st.repeat,
        step: structStep(main, w, ctx),
        recovery: structStep(rec, w, ctx)
      });
      continue;
    }
    for (let i = 0; i < st.repeat; i++)
      for (const x of st.steps) blocks.push({ reps: 1, step: structStep(x, w, ctx) });
  }
  let km: number | null = 0;
  let sec: number | null = 0;
  let exact = true;
  for (const b of blocks)
    for (const x of b.recovery ? [b.step, b.recovery] : [b.step]) {
      const n = x === b.recovery ? b.reps - 1 : b.reps;
      km = km === null || x.km === null ? null : km + x.km * n;
      sec = sec === null || x.sec === null ? null : sec + x.sec * n;
      if (x.kmBasis !== 'exact') exact = false;
    }
  return {
    title: w.text,
    blocks,
    km: km === null ? null : round2(km),
    sec,
    kmBasis: exact ? 'exact' : 'estimated',
    secBasis: 'estimated'
  };
}

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
  /* Preuzet dan ostaje kao pre (svoja stara polja); generisan i ručno unet dan dobija strukturu iz koraka. */
  const structure =
    day.origin === 'adopted' || tag === 'snaga' || !hasWarmupOrCooldown(w)
      ? {}
      : { structure: structureOf(w, ctx) };
  return {
    ...legacy,
    ...structure,
    id: day.id,
    dow,
    tag,
    km,
    desc: w.text
  } as unknown as StoredDay;
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
