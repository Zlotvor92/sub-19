/* Maraton v2 → aplikacija: TOK PRILAGOĐAVANJA (segment MAR-06). Činjenice (`./facts.ts`) → `adaptMarathonV2` → plan za upis i PREGLED
   (razlozi v2 doslovno, promenjene nedelje: km cilj/plan i kvalitet). Ništa se ne upisuje ovde: aplikacija prikazuje
   pregled i upisuje tek posle potvrde (nova revizija). Odbijanje v2 se vraća sa razlozima doslovno. Obrazac je kopija
   HM v2 (06), ne uvoz.

   Isto jezgro služi i:
   - vraćanju revizije (`restoreMerge`): budući nezaštićeni dani iz sačuvane verzije, prošlost/urađeno/ručno izmenjeno iz
     trenutnog plana — spajanje na nivou plana v2, pa iz njega plan za upis;
   - promeni cilja (`goalChange`): isti ulaz sa novim ciljem, svi budući dani zaključani → menja se samo ocena cilja;
   - traci „Plan treba prilagoditi" (`needed`): pravilo je SAMO u domenu (`../adapt.ts` `adaptBanner`, pouka 20). */

import { adaptBanner, adaptMarathonV2 } from '../adapt.ts';
import { checkInput } from '../input.ts';
import { MARATHON_V2_POLICY as P } from '../policy.ts';
import type { AdaptChange, AdaptReason, AdaptResult, PlanWeek, MarathonV2Plan } from '../types.ts';
import { addDays } from './date.ts';
import {
  buildFacts,
  coverageText,
  EDITS_KEY,
  trainingDates,
  type CoverageInfo,
  type FactsSource
} from './facts.ts';
import { rejection } from './generate.ts';
import { generatedPlan, storedPlan } from './plan.ts';
import type {
  AppPlan,
  GoalAssessmentView,
  IsoDate,
  LogEntry,
  PlanRejectionReason,
  StoredPlan
} from './types.ts';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const metaOf = (p: { meta?: unknown } | null | undefined): Record<string, unknown> =>
  (p?.meta ?? {}) as Record<string, unknown>;

/** Plan v2 iz plana za upis (`marathonV2`); `null` kad ga nema ili nije maraton v2. */
export function v2Of(plan: { marathonV2?: unknown } | null | undefined): MarathonV2Plan | null {
  const p = plan?.marathonV2 as { policyId?: unknown; weeks?: unknown } | null | undefined;
  return p && p.policyId === P.id && Array.isArray(p.weeks) ? (p as MarathonV2Plan) : null;
}

/** Odbijanje adaptacije doslovno: razlozi v2 i greške validatora (pravilo, poruka, nedelja). */
function adaptRejection(r: Extract<AdaptResult, { ok: false }>): PlanRejectionReason[] {
  return [
    ...rejection(r.reasons),
    ...r.violations
      .filter((v) => v.severity === 'error')
      .map((v) => ({
        code: v.rule,
        message: v.message,
        ...(v.week != null ? { week: v.week } : {})
      }))
  ];
}

/** Nedelja u pregledu: cilj i planirano (km, trka van obima), kvalitet i test (naslovi v2). */
export interface WeekView {
  targetKm: number;
  plannedKm: number;
  quality: string;
  end: string;
}
export interface WeekChange {
  week: number;
  before: WeekView | null;
  after: WeekView | null;
}

function weekView(w: PlanWeek): WeekView {
  const q = w.days
    .filter((d) => d.workout.kind === 'quality' || d.workout.kind === 'test')
    .map((d) => d.workout.title);
  return {
    targetKm: w.targetKm,
    plannedKm: w.plannedKm,
    quality: q.length ? q.join(' + ') : 'bez kvaliteta',
    end: w.endDate
  };
}

/** Nedelje plana v2 po broju nedelje (nedelja aplikacije = nedelja v2). */
export function weekViews(v2: MarathonV2Plan): Map<number, WeekView> {
  return new Map(v2.weeks.map((w) => [w.index, weekView(w)]));
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
  TEST_MOVED: `test ${P.test.km} km premešten`
};

export interface AdaptPreview {
  ok: true;
  result: StoredPlan;
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

/** Plan za upis iz plana v2 (+ snimak ručnih izmena u trenutku adaptacije, ako ga ima). */
function stored(v2: MarathonV2Plan, edits: unknown): StoredPlan {
  const s = storedPlan(generatedPlan(v2));
  return edits === undefined
    ? s
    : { ...s, meta: { ...s.meta, [EDITS_KEY]: edits } as StoredPlan['meta'] };
}

/** Pregled prilagođavanja: činjenice → `adaptMarathonV2` → plan za upis + promenjene nedelje (samo one sa danima posle
 *  danas). Ne upisuje ništa. */
export function adaptPreview(src: FactsSource): AdaptOutcome {
  const v2 = v2Of(src.plan);
  if (!v2)
    return {
      ok: false,
      reasons: [
        { code: 'ADAPT_PLAN_INVALID', message: 'Plan nema podatke maratona v2 za prilagođavanje.' }
      ],
      coverage: null,
      notes: []
    };
  const built = buildFacts(src, v2);
  const notes = [coverageText(built.coverage), ...built.notes];
  const r = adaptMarathonV2(v2, built.facts, src.today);
  if (!r.ok) return { ok: false, reasons: adaptRejection(r), coverage: built.coverage, notes };
  const after = r.plan;
  const result = stored(after, { alts: copy(src.alts ?? {}), moves: copy(src.moves ?? {}) });
  const weeks = changedWeeks(v2, after, r.changes, src.today);
  const applied = r.reasons.filter((x) => x.applied && x.condition !== 'NO_FACTS');
  const summary = `Prilagođavanje ${src.today}: ${applied.length ? [...new Set(applied.map((x) => CONDITION[x.condition]))].join(', ') : CONDITION.NO_FACTS}`;
  return {
    ok: true,
    result,
    summary,
    reasons: r.reasons,
    weeks,
    notes,
    coverage: built.coverage,
    // Pouka 20: pravilo trake živi samo u domenu (`adaptBanner`); aplikacija ga samo zove.
    needed: adaptBanner(v2, r, built.facts, src.today)
  };
}

function changedWeeks(
  before: MarathonV2Plan,
  after: MarathonV2Plan,
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

/** Vraćanje sačuvane verzije (`graftFuturePlan`): budući dani posle danas iz verzije, osim urađenih i ručno izmenjenih
 *  ili pomerenih (oni ostaju iz trenutnog plana); cele prošle nedelje ostaju. `meta.futureChanges` kaže koliko se dana
 *  menja. Verzija bez plana maratona v2 ili sa drugim brojem nedelja se ne vraća (menjala bi prošlost). */
export function restoreMerge<T extends AppPlan>(
  current: T,
  fresh: AppPlan,
  today: IsoDate,
  ctx: {
    log?: Readonly<Record<string, LogEntry>>;
    alts?: Readonly<Record<string, unknown>>;
    moves?: Readonly<Record<string, unknown>>;
  } = {}
): T | StoredPlan {
  const refuse = (why: string): T => ({
    ...current,
    meta: { ...metaOf(current), futureChanges: { changedDays: 0, conflicts: [why] } }
  });
  const cur = v2Of(current);
  const snap = v2Of(fresh);
  if (!cur || !snap)
    return refuse('Sačuvana verzija nema plan maratona v2, pa se ne može vratiti.');
  if (cur.weeks.length !== snap.weeks.length)
    return refuse('Sačuvana verzija ima drugi broj nedelja; vraćanje bi menjalo prošle nedelje.');
  // Zaštićeni datumi (po planu): do danas, urađeni dani i dani sa ručnom izmenom ili pomeranjem.
  const protectedIds = new Set<string>([
    ...Object.entries(ctx.log ?? {})
      .filter(([, e]) => e?.status === 'done')
      .map(([id]) => id),
    ...Object.keys(ctx.alts ?? {}),
    ...Object.keys(ctx.moves ?? {})
  ]);
  const dateOf = (start: string, dow: number): string => addDays(start, dow);
  const protectedDates = new Set<string>();
  for (const w of current.weeks)
    for (const d of w.days)
      if (typeof d.id === 'string' && protectedIds.has(d.id))
        protectedDates.add(dateOf(w.start, d.dow));
  const keep = (date: string): boolean => date <= today || protectedDates.has(date);
  // Spajanje nedelja: cele prošle nedelje i zaštićeni dani iz trenutnog plana, ostalo iz sačuvane verzije.
  const mixed: number[] = [];
  const weeks: PlanWeek[] = snap.weeks.map((s, i) => {
    const c = cur.weeks[i]!;
    if (c.endDate <= today) return c;
    const days = [
      ...c.days.filter((d) => keep(d.date)),
      ...s.days.filter((d) => !keep(d.date))
    ].sort((x, y) => x.date.localeCompare(y.date));
    if (same(days, s.days)) return s;
    mixed.push(s.index);
    return {
      ...s,
      days,
      plannedKm:
        Math.round(days.reduce((sum, d) => sum + (d.countsToWeek ? d.workout.km : 0), 0) * 100) /
        100
    };
  });
  const merged: MarathonV2Plan = {
    ...copy(snap),
    weeks,
    ...(snap.adaptation
      ? {
          adaptation: {
            ...snap.adaptation,
            mixedWeeks: [...new Set([...snap.adaptation.mixedWeeks, ...mixed])].sort(
              (a, b) => a - b
            )
          }
        }
      : {})
  };
  const out = stored(merged, metaOf(current)[EDITS_KEY]);
  const prev = new Map(current.weeks.flatMap((w) => w.days.map((d) => [d.id, d] as const)));
  let changedDays = 0;
  for (const w of out.weeks)
    for (const d of w.days)
      if (dateOf(w.start, d.dow) > today && !same(prev.get(d.id), d)) changedDays++;
  return {
    ...out,
    meta: { ...out.meta, futureChanges: { changedDays, conflicts: [] } } as StoredPlan['meta']
  };
}

/* ---------- promena cilja ---------- */

export type GoalChangeOutcome =
  | {
      ok: true;
      result: StoredPlan;
      before: GoalAssessmentView | null;
      after: GoalAssessmentView | null;
    }
  | { ok: false; reasons: PlanRejectionReason[] };

/** Isti ulaz sa novim ciljem: adaptacija bez činjenica sa svim budućim danima zaključanim — treninzi, tempo i obim
 *  ostaju bajt-isti, menja se samo ocena cilja (v2 je računa iz istog VDOT-a; plan po osećaju je nema do rezultata). */
export function goalChange(plan: AppPlan, goalSec: number, today: IsoDate): GoalChangeOutcome {
  const v2 = v2Of(plan);
  if (!v2)
    return {
      ok: false,
      reasons: [{ code: 'ADAPT_PLAN_INVALID', message: 'Plan nema podatke maratona v2.' }]
    };
  const c = checkInput({ ...v2.input, goalTimeSec: goalSec });
  if (!c.ok) return { ok: false, reasons: rejection(c.reasons) };
  const locked = [...trainingDates(v2)].filter((d) => d > today).sort();
  const r = adaptMarathonV2({ ...v2, input: c.input }, { lockedDayIds: locked }, today);
  if (!r.ok) return { ok: false, reasons: adaptRejection(r) };
  const result = stored(r.plan, metaOf(plan)[EDITS_KEY]);
  const view = (m: unknown): GoalAssessmentView | null =>
    ((m ?? {}) as { goalAssessment?: GoalAssessmentView }).goalAssessment ?? null;
  return { ok: true, result, before: view(plan.meta), after: view(result.meta) };
}

export type { CoverageInfo };
