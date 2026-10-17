/* 5K v2 → aplikacija: TOK PRILAGOĐAVANJA (segment 08b). Činjenice (`./facts.ts`) → `adaptFiveKV2` → plan za upis i
   PREGLED (razlozi v2 doslovno, promenjene nedelje: km cilj/plan i kvalitet). Ništa se ne upisuje ovde: aplikacija
   prikazuje pregled i upisuje tek posle potvrde (nova revizija). Odbijanje v2 se vraća sa razlozima doslovno.

   Isto jezgro služi i:
   - vraćanju revizije (`restoreMerge`): budući nezaštićeni dani iz sačuvane verzije, prošlost/urađeno/ručno izmenjeno iz
     trenutnog plana — spajanje na nivou plana v2, pa iz njega plan za upis;
   - promeni cilja (`goalChange`): isti ulaz sa novim ciljem, svi budući dani zaključani → menja se samo ocena cilja;
   - traci „Plan treba prilagoditi" (`needed`): aktivno ograničenje iz činjenica koje menja budući deo plana. */

import { adaptFiveKV2 } from '../adapt.ts';
import { checkInput } from '../input.ts';
import { FIVE_K_V2_POLICY as P } from '../policy.ts';
import { initialStep } from '../runWalk.ts';
import type { AdaptChange, AdaptReason, FiveKV2Plan, PlanWeek, RunWalkWeek } from '../types.ts';
import type { GenPlanState, IsoDate, LogEntry } from '../../exchange.ts';
import {
  buildFacts,
  coverageText,
  EDITS_KEY,
  trainingDates,
  type CoverageInfo,
  type FactsSource
} from './facts.ts';
import { rejection } from './generate.ts';
import { generatedPlan, storedPlan, type AnyV2Plan } from './plan.ts';
import { addDays } from './date.ts';
import type { PlanRejectionReason } from './types.ts';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const r1 = (x: number): number => Math.round(x * 10) / 10;

/** Plan v2 iz plana za upis (`fiveKV2`); `null` kad ga nema ili nije v2. */
export function v2Of(plan: GenPlanState | null | undefined): AnyV2Plan | null {
  const p = plan?.fiveKV2 as { policyId?: unknown; weeks?: unknown } | null | undefined;
  return p && p.policyId === P.id && Array.isArray(p.weeks) ? (p as AnyV2Plan) : null;
}

/** Nedelja u pregledu: cilj i planirano (km, trka van obima), kvalitet (naslovi v2) ili nivoi trčanja/hodanja. */
export interface WeekView {
  targetKm: number | null;
  plannedKm: number | null;
  quality: string;
  end: string;
}
export interface WeekChange {
  week: number;
  before: WeekView | null;
  after: WeekView | null;
}

function continuousView(w: PlanWeek): WeekView {
  const q = w.days.filter((d) => d.workout.kind === 'quality').map((d) => d.workout.title);
  return {
    targetKm: w.targetKm,
    plannedKm: w.plannedKm,
    quality: q.length ? q.join(' + ') : 'bez kvaliteta',
    end: w.endDate
  };
}

function runWalkView(w: RunWalkWeek): WeekView {
  const km = w.days.map((d) => (d.role === 'session' ? d.session.estRunKm : 0));
  const levels = w.days.map((d) => (d.role === 'race' ? 'trka' : `L${d.level}`));
  return {
    targetKm: null,
    plannedKm: km.every((k): k is number => k !== null) ? r1(km.reduce((a, b) => a + b, 0)) : null,
    quality: `trčanje/hodanje ${levels.join(', ')}`,
    end: w.endDate
  };
}

/** Nedelje plana v2 po broju nedelje aplikacije (posle prelaza i kontinuirani deo). */
export function weekViews(v2: AnyV2Plan): Map<number, WeekView> {
  const out = new Map<number, WeekView>();
  if (v2.planType === 'runWalk') {
    for (const w of v2.weeks) out.set(w.index, runWalkView(w));
    const c = v2.continuous;
    if (c) for (const w of c.plan.weeks) out.set(w.index + c.fromWeek - 1, continuousView(w));
  } else for (const w of v2.weeks) out.set(w.index, continuousView(w));
  return out;
}

const CONDITION: Readonly<Record<AdaptReason['condition'], string>> = {
  NO_FACTS: 'bez novih činjenica',
  NEW_RESULT: 'nov rezultat',
  RESULT_IGNORED: 'rezultat se ne koristi',
  UNDER_EXECUTION: 'manje od plana',
  OVER_EXECUTION: 'više od plana',
  PAUSE: 'pauza',
  PAIN: 'bol',
  FATIGUE: 'umor',
  LEVEL: 'nivo trčanja/hodanja',
  TRANSITION: 'prelaz na kontinuirani plan'
};

export interface AdaptPreview {
  ok: true;
  result: GenPlanState;
  summary: string;
  /** Razlozi v2 doslovno (primenjeni i neprimenjeni). */
  reasons: AdaptReason[];
  weeks: WeekChange[];
  notes: string[];
  coverage: CoverageInfo;
  /** Aktivna ograničenja koja menjaju budući deo plana (traka „Plan treba prilagoditi"); prazno = nema. */
  needed: string[];
}
export type AdaptOutcome =
  | AdaptPreview
  | { ok: false; reasons: PlanRejectionReason[]; coverage: CoverageInfo | null; notes: string[] };

const BANNER: ReadonlySet<AdaptReason['condition']> = new Set([
  'PAIN',
  'PAUSE',
  'FATIGUE',
  'NEW_RESULT',
  'UNDER_EXECUTION',
  'OVER_EXECUTION',
  'TRANSITION'
]);

/** Ograničenja za traku: primenjena, nova posle poslednje adaptacije (bol: zapis posle nje; nivo: promenjen), a plan se
 *  zaista menja posle danas. Isti dan posle primene — ništa (bez ponovnog nuđenja). */
function neededOf(
  before: AnyV2Plan,
  after: AnyV2Plan,
  reasons: readonly AdaptReason[],
  painDates: readonly string[],
  today: IsoDate,
  weeks: readonly WeekChange[]
): string[] {
  const last = before.adaptation?.asOf ?? null;
  if ((last !== null && last >= today) || weeks.length === 0) return [];
  const newPain = painDates.some((d) => last === null || d > last);
  const levelOf = (p: AnyV2Plan): number | null =>
    p.planType === 'runWalk' ? (p.adaptation?.steps.at(-1) ?? initialStep(p.input)).level : null;
  const levelChanged = levelOf(before) !== levelOf(after);
  return reasons
    .filter(
      (r) =>
        r.applied &&
        ((BANNER.has(r.condition) && (r.condition !== 'PAIN' || newPain)) ||
          (r.condition === 'LEVEL' && levelChanged))
    )
    .map((r) => r.message);
}

/** Pregled prilagođavanja: činjenice → `adaptFiveKV2` → plan za upis + promenjene nedelje (samo one sa danima posle
 *  danas). Ne upisuje ništa. */
export function adaptPreview(src: FactsSource): AdaptOutcome {
  const v2 = v2Of(src.plan);
  if (!v2)
    return {
      ok: false,
      reasons: [
        { code: 'ADAPT_PLAN_INVALID', message: 'Plan nema podatke 5K v2 za prilagođavanje.' }
      ],
      coverage: null,
      notes: []
    };
  const built = buildFacts(src, v2);
  const notes = [coverageText(built.coverage), ...built.notes];
  const r = adaptFiveKV2(v2, built.facts, src.today);
  if (!r.ok) return { ok: false, reasons: rejection(r), coverage: built.coverage, notes };
  const after = r.plan;
  const stored = storedPlan(generatedPlan(after));
  const result: GenPlanState = {
    ...stored,
    meta: {
      ...stored.meta,
      [EDITS_KEY]: { alts: copy(src.alts ?? {}), moves: copy(src.moves ?? {}) }
    } as GenPlanState['meta']
  };
  const weeks = changedWeeks(v2, after, r.changes, src.today);
  const applied = r.reasons.filter((x) => x.applied && x.condition !== 'NO_FACTS');
  const summary = `Prilagođavanje ${src.today}: ${applied.length ? [...new Set(applied.map((x) => CONDITION[x.condition]))].join(', ') : CONDITION.NO_FACTS}`;
  const painDates = built.facts.workouts
    .filter((w) => (w.pain ?? 0) >= P.adapt.painMin)
    .map((w) => w.date);
  return {
    ok: true,
    result,
    summary,
    reasons: r.reasons,
    weeks,
    notes,
    coverage: built.coverage,
    needed: neededOf(v2, after, r.reasons, painDates, src.today, weeks)
  };
}

function changedWeeks(
  before: AnyV2Plan,
  after: AnyV2Plan,
  changes: readonly AdaptChange[],
  today: IsoDate
): WeekChange[] {
  const b = weekViews(before);
  const a = weekViews(after);
  const ids = new Set(changes.filter((c) => c.week > 0).map((c) => c.week));
  for (const [w, v] of a) if (!same(v, b.get(w))) ids.add(w);
  return [...ids]
    .sort((x, y) => x - y)
    .filter((w) => (a.get(w)?.end ?? b.get(w)?.end ?? '') > today)
    .map((w) => ({ week: w, before: b.get(w) ?? null, after: a.get(w) ?? null }));
}

/* ---------- vraćanje revizije ---------- */

interface DayLike {
  date: string;
}
interface WeekLike {
  index: number;
  endDate: string;
  days: readonly DayLike[];
}

/** Spajanje nedelja: cele prošle nedelje i zaštićeni dani iz trenutnog plana, ostalo iz sačuvane verzije. */
function mergeWeeks<W extends WeekLike>(
  cur: readonly W[],
  snap: readonly W[],
  keep: (date: string) => boolean,
  today: IsoDate
): { weeks: W[]; mixed: number[] } {
  const mixed: number[] = [];
  const weeks = snap.map((s, i) => {
    const c = cur[i]!;
    if (c.endDate <= today) return c;
    const days = [
      ...c.days.filter((d) => keep(d.date)),
      ...s.days.filter((d) => !keep(d.date))
    ].sort((x, y) => x.date.localeCompare(y.date));
    if (same(days, s.days)) return s;
    mixed.push(s.index);
    const out = { ...s, days } as W & { plannedKm?: number };
    if ('plannedKm' in s)
      out.plannedKm =
        Math.round(
          (days as unknown as PlanWeek['days']).reduce(
            (sum, d) => sum + (d.countsToWeek ? d.workout.km : 0),
            0
          ) * 100
        ) / 100;
    return out;
  });
  return { weeks, mixed };
}

function sameShape(a: AnyV2Plan, b: AnyV2Plan): boolean {
  if (a.planType !== b.planType || a.weeks.length !== b.weeks.length) return false;
  if (a.planType !== 'runWalk' || b.planType !== 'runWalk') return true;
  const x = a.continuous;
  const y = b.continuous;
  return (
    (x === null && y === null) ||
    (x !== null &&
      y !== null &&
      x.fromWeek === y.fromWeek &&
      x.plan.weeks.length === y.plan.weeks.length)
  );
}

function mergeContinuous(
  cur: FiveKV2Plan,
  snap: FiveKV2Plan,
  keep: (d: string) => boolean,
  today: IsoDate
): FiveKV2Plan {
  const m = mergeWeeks(cur.weeks, snap.weeks, keep, today);
  return {
    ...copy(snap),
    weeks: m.weeks,
    ...(snap.adaptation
      ? {
          adaptation: {
            ...snap.adaptation,
            mixedWeeks: [...new Set([...snap.adaptation.mixedWeeks, ...m.mixed])].sort(
              (a, b) => a - b
            )
          }
        }
      : {})
  };
}

/** Vraćanje sačuvane verzije (`graftFuturePlan`): budući dani posle danas iz verzije, osim urađenih i ručno izmenjenih
 *  ili pomerenih (oni ostaju iz trenutnog plana); cele prošle nedelje ostaju. Druga vrsta plana (trčanje/hodanje ↔
 *  kontinuirani, drugi prelaz) se ne vraća — to bi menjalo prošlost. `meta.futureChanges` kaže koliko se dana menja. */
export function restoreMerge(
  current: GenPlanState,
  fresh: GenPlanState,
  today: IsoDate,
  ctx: {
    log?: Readonly<Record<string, LogEntry>>;
    alts?: Readonly<Record<string, unknown>>;
    moves?: Readonly<Record<string, unknown>>;
  } = {}
): GenPlanState {
  const refuse = (why: string): GenPlanState => ({
    ...current,
    meta: {
      ...(current.meta ?? {}),
      futureChanges: { changedDays: 0, conflicts: [why] }
    } as GenPlanState['meta']
  });
  const cur = v2Of(current);
  const snap = v2Of(fresh);
  if (!cur || !snap) return refuse('Sačuvana verzija nema plan 5K v2, pa se ne može vratiti.');
  if (!sameShape(cur, snap))
    return refuse(
      'Sačuvana verzija je druga vrsta plana (trčanje/hodanje ili prelaz na kontinuirani plan); vraćanje bi menjalo prošle nedelje.'
    );
  // Zaštićeni datumi (po planu): do danas, urađeni dani i dani sa ručnom izmenom ili pomeranjem.
  const protectedIds = new Set<string>([
    ...Object.entries(ctx.log ?? {})
      .filter(([, e]) => e?.status === 'done')
      .map(([id]) => id),
    ...Object.keys(ctx.alts ?? {}),
    ...Object.keys(ctx.moves ?? {})
  ]);
  const dateOf = (start: string, dow: number): string => addDays(start as IsoDate, dow);
  const protectedDates = new Set<string>();
  for (const w of current.weeks)
    for (const d of w.days)
      if (typeof d.id === 'string' && protectedIds.has(d.id))
        protectedDates.add(dateOf(w.start, d.dow));
  const keep = (date: string): boolean => date <= today || protectedDates.has(date);
  let merged: AnyV2Plan;
  if (cur.planType === 'runWalk' && snap.planType === 'runWalk') {
    const m = mergeWeeks(cur.weeks, snap.weeks, keep, today);
    const cc = cur.continuous;
    const sc = snap.continuous;
    merged = {
      ...copy(snap),
      weeks: m.weeks,
      continuous:
        cc && sc
          ? { fromWeek: sc.fromWeek, plan: mergeContinuous(cc.plan, sc.plan, keep, today) }
          : null
    };
  } else merged = mergeContinuous(cur as FiveKV2Plan, snap as FiveKV2Plan, keep, today);
  const stored = storedPlan(generatedPlan(merged));
  const before = new Map(current.weeks.flatMap((w) => w.days.map((d) => [d.id, d] as const)));
  let changedDays = 0;
  for (const w of stored.weeks)
    for (const d of w.days)
      if (dateOf(w.start, d.dow) > today && !same(before.get(d.id), d)) changedDays++;
  return {
    ...stored,
    meta: {
      ...stored.meta,
      ...(current.meta?.[EDITS_KEY] ? { [EDITS_KEY]: current.meta[EDITS_KEY] } : {}),
      futureChanges: { changedDays, conflicts: [] }
    } as GenPlanState['meta']
  };
}

/* ---------- promena cilja ---------- */

export interface GoalView {
  status: string;
  label: string;
  message: string;
}
export type GoalChangeOutcome =
  | { ok: true; result: GenPlanState; before: GoalView | null; after: GoalView | null }
  | { ok: false; reasons: PlanRejectionReason[] };

/** Isti ulaz sa novim ciljem: adaptacija bez činjenica sa svim budućim danima zaključanim — treninzi, tempo i obim
 *  ostaju bajt-isti, menja se samo ocena cilja (v2 je računa iz istog VDOT-a). */
export function goalChange(plan: GenPlanState, goalSec: number, today: IsoDate): GoalChangeOutcome {
  const v2 = v2Of(plan);
  if (!v2)
    return {
      ok: false,
      reasons: [{ code: 'ADAPT_PLAN_INVALID', message: 'Plan nema podatke 5K v2.' }]
    };
  if (v2.planType === 'runWalk')
    return {
      ok: false,
      reasons: [
        {
          code: 'GOAL_INVALID',
          message: `Plan trčanje/hodanje ima cilj „završiti" (${v2.goal.message}); ciljno vreme se ne procenjuje.`
        }
      ]
    };
  const c = checkInput({ ...v2.input, goalTimeSec: goalSec });
  if (!c.ok)
    return { ok: false, reasons: c.reasons.map((x) => ({ code: x.code, message: x.message })) };
  const locked = [...trainingDates(v2)].filter((d) => d > today).sort();
  const r = adaptFiveKV2({ ...v2, input: c.input }, { lockedDayIds: locked }, today);
  if (!r.ok) return { ok: false, reasons: rejection(r) };
  const stored = storedPlan(generatedPlan(r.plan));
  const result: GenPlanState = {
    ...stored,
    meta: {
      ...stored.meta,
      ...(plan.meta?.[EDITS_KEY] ? { [EDITS_KEY]: plan.meta[EDITS_KEY] } : {})
    } as GenPlanState['meta']
  };
  const view = (m: GenPlanState['meta']): GoalView | null =>
    (m as { goalAssessment?: GoalView } | undefined)?.goalAssessment ?? null;
  return { ok: true, result, before: view(plan.meta), after: view(result.meta) };
}

export type { CoverageInfo };

/** Napomena uz run/walk opcije ugovora v1 (zadrži/korak nazad/ponovi): v2 nivo određuje sam iz činjenica. */
export const ADAPT_RUN_WALK_NOTE =
  'Nivo trčanja/hodanja određuje plan v2 iz zapisa sesija (RPE, bol, pauza); izbor „zadrži/korak nazad/ponovi" se ne koristi.';
