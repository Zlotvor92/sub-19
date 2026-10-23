/* 10K v2 → aplikacija: TOK PRILAGOĐAVANJA (segment 06). Činjenice (`./facts.ts`) → `adaptTenKV2` → plan za upis i PREGLED
   (razlozi v2 doslovno, promenjene nedelje: km cilj/plan i kvalitet). Ništa se ne upisuje ovde: aplikacija prikazuje
   pregled i upisuje tek posle potvrde (nova revizija). Odbijanje v2 se vraća sa razlozima doslovno. Obrazac je kopija
   5K v2 (08b), ne uvoz.

   Isto jezgro služi i:
   - vraćanju revizije (`restoreMerge`): odluke sačuvane verzije, prošlost/urađeno/ručno izmenjeno iz trenutnog plana —
     spaja i proverava jezgro (`adaptTenKV2`: `writtenWeeks` + `validatePlan`), pa iz njega plan za upis;
   - promeni cilja (`goalChange`): isti ulaz sa novim ciljem, svi budući dani zaključani → menja se samo ocena cilja;
   - traci „Plan treba prilagoditi" (`needed`): pravilo je SAMO u domenu (`../adapt.ts` `adaptBanner`, pouka 20). */

import { userText } from './format.ts';
import { adaptBanner, adaptTenKV2 } from '../adapt.ts';
import { checkInput } from '../input.ts';
import { TEN_K_V2_POLICY as P } from '../policy.ts';
import type { AdaptChange, AdaptReason, AdaptResult, PlanWeek, TenKV2Plan } from '../types.ts';
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
import { generatedPlan, prefixOf, storedPlan, type Prefix } from './plan.ts';
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

/** Plan v2 iz plana za upis (`tenKV2`); `null` kad ga nema ili nije 10K v2. */
export function v2Of(plan: { tenKV2?: unknown } | null | undefined): TenKV2Plan | null {
  const p = plan?.tenKV2 as { policyId?: unknown; weeks?: unknown } | null | undefined;
  return p && p.policyId === P.id && Array.isArray(p.weeks) ? (p as TenKV2Plan) : null;
}

/** Odbijanje adaptacije doslovno: razlozi v2 i greške validatora (pravilo, poruka, nedelja). */
function adaptRejection(r: Extract<AdaptResult, { ok: false }>): PlanRejectionReason[] {
  return [
    ...rejection(r.reasons),
    ...r.violations
      .filter((v) => v.severity === 'error')
      .map((v) => ({
        code: v.rule,
        message: userText(v.message),
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
export function weekViews(v2: TenKV2Plan): Map<number, WeekView> {
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

/** Plan za upis iz plana v2 (+ snimak ručnih izmena u trenutku adaptacije, ako ga ima; 3d-10K: nedelje izvora predaje
 *  ispred, `prefix`). */
function stored(v2: TenKV2Plan, edits: unknown, prefix: Prefix | null = null): StoredPlan {
  const s = storedPlan(generatedPlan(v2), prefix);
  return edits === undefined
    ? s
    : { ...s, meta: { ...s.meta, [EDITS_KEY]: edits } as StoredPlan['meta'] };
}

/** Pregled prilagođavanja: činjenice → `adaptTenKV2` → plan za upis + promenjene nedelje (samo one sa danima posle
 *  danas). Ne upisuje ništa. */
export function adaptPreview(src: FactsSource): AdaptOutcome {
  const v2 = v2Of(src.plan);
  if (!v2)
    return {
      ok: false,
      reasons: [
        { code: 'ADAPT_PLAN_INVALID', message: 'Plan nema podatke 10K v2 za prilagođavanje.' }
      ],
      coverage: null,
      notes: []
    };
  const built = buildFacts(src, v2);
  const notes = [coverageText(built.coverage), ...built.notes];
  const r = adaptTenKV2(v2, built.facts, src.today);
  if (!r.ok) return { ok: false, reasons: adaptRejection(r), coverage: built.coverage, notes };
  const after = r.plan;
  const prefix = prefixOf(src.plan);
  const result = stored(
    after,
    { alts: copy(src.alts ?? {}), moves: copy(src.moves ?? {}) },
    prefix
  );
  const weeks = changedWeeks(v2, after, r.changes, src.today, prefix?.offset ?? 0);
  const applied = r.reasons.filter((x) => x.applied && x.condition !== 'NO_FACTS');
  const summary = `Prilagođavanje ${src.today}: ${applied.length ? [...new Set(applied.map((x) => CONDITION[x.condition]))].join(', ') : CONDITION.NO_FACTS}`;
  return {
    ok: true,
    result,
    summary,
    reasons: r.reasons.map((x) => ({ ...x, message: userText(x.message) })),
    weeks,
    notes,
    coverage: built.coverage,
    // Pouka 20: pravilo trake živi samo u domenu (`adaptBanner`); aplikacija ga samo zove.
    needed: adaptBanner(v2, r, built.facts, src.today).map(userText)
  };
}

function changedWeeks(
  before: TenKV2Plan,
  after: TenKV2Plan,
  changes: readonly AdaptChange[],
  today: IsoDate,
  offset = 0
): WeekChange[] {
  const b = weekViews(before);
  const a = weekViews(after);
  const ids = new Set(changes.filter((c) => c.week > 0).map((c) => c.week));
  for (const [w, v] of a) if (!same(v, b.get(w))) ids.add(w);
  return [...ids]
    .sort((x, y) => x - y)
    .filter((w) => (a.get(w)?.end ?? b.get(w)?.end ?? '') > today)
    .map((w) => ({ week: offset + w, before: b.get(w) ?? null, after: a.get(w) ?? null }));
}

/* ---------- vraćanje revizije ---------- */

/** Vraćanje sačuvane verzije (`graftFuturePlan`, 10K-07, Z4): vraćaju se ODLUKE verzije (ulaz i koraci adaptacije), a
 *  budući deo gradi jezgro — `adaptTenKV2` nad verzijom sa prošlošću iz trenutnog plana: dani do danas, urađeni i ručno
 *  izmenjeni ili pomereni (zaključani) ostaju iz trenutnog plana, spajanje je `writtenWeeks`, plan prolazi
 *  `validatePlan` (jedno spajanje, jedan vlasnik; ranije sopstveno spajanje ovde je davalo plan koji validator odbija).
 *  `meta.futureChanges` kaže koliko se dana menja. Verzija bez plana 10K v2, sa drugim datumima plana ili koju jezgro
 *  ne može da spoji sa prošlošću se ne vraća (razlog u `conflicts`, plan ostaje). */
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
  if (!cur || !snap) return refuse('Sačuvana verzija nema plan 10K v2, pa se ne može vratiti.');
  if (
    cur.weeks.length !== snap.weeks.length ||
    cur.input.startDate !== snap.input.startDate ||
    cur.input.raceDate !== snap.input.raceDate
  )
    return refuse('Sačuvana verzija ima druge datume plana; vraćanje bi menjalo prošle nedelje.');
  // Zaštićeni budući datumi: urađeni dani i dani sa ručnom izmenom ili pomeranjem (dani do danas jezgro čuva samo).
  const protectedIds = new Set<string>([
    ...Object.entries(ctx.log ?? {})
      .filter(([, e]) => e?.status === 'done')
      .map(([id]) => id),
    ...Object.keys(ctx.alts ?? {}),
    ...Object.keys(ctx.moves ?? {})
  ]);
  const dates = trainingDates(cur);
  const locked = new Set<string>();
  for (const w of current.weeks)
    for (const d of w.days) {
      const date = addDays(w.start, d.dow);
      if (typeof d.id === 'string' && protectedIds.has(d.id) && date > today && dates.has(date))
        locked.add(date);
    }
  // Prošlost iz trenutnog plana, odluke iz verzije; jezgro gradi budućnost i proverava plan.
  const base: TenKV2Plan = { ...copy(snap), weeks: copy(cur.weeks) };
  const r = adaptTenKV2(base, { lockedDayIds: [...locked].sort() }, today);
  // Verzija čije odluke ne odgovaraju urađenom delu (npr. posle nje je plan prilagođen pauzi ili umoru, pa jezgro iz
  // njenih koraka i upisane prošlosti ne gradi ispravan plan) se ne vraća — plan koji validator odbija se ne upisuje.
  if (!r.ok)
    return refuse(
      'Sačuvana verzija se ne može vratiti: posle nje je plan prilagođen, a njeni budući treninzi se ne slažu sa urađenim delom plana. Plan ostaje kakav jeste.'
    );
  const out = stored(r.plan, metaOf(current)[EDITS_KEY], prefixOf(current));
  const prev = new Map(current.weeks.flatMap((w) => w.days.map((d) => [d.id, d] as const)));
  let changedDays = 0;
  for (const w of out.weeks)
    for (const d of w.days)
      if (addDays(w.start, d.dow) > today && !same(prev.get(d.id), d)) changedDays++;
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
      reasons: [{ code: 'ADAPT_PLAN_INVALID', message: 'Plan nema podatke 10K v2.' }]
    };
  const c = checkInput({ ...v2.input, goalTimeSec: goalSec });
  if (!c.ok) return { ok: false, reasons: rejection(c.reasons) };
  const locked = [...trainingDates(v2)].filter((d) => d > today).sort();
  const r = adaptTenKV2({ ...v2, input: c.input }, { lockedDayIds: locked }, today);
  if (!r.ok) return { ok: false, reasons: adaptRejection(r) };
  const result = stored(r.plan, metaOf(plan)[EDITS_KEY], prefixOf(plan));
  const view = (m: unknown): GoalAssessmentView | null =>
    ((m ?? {}) as { goalAssessment?: GoalAssessmentView }).goalAssessment ?? null;
  return { ok: true, result, before: view(plan.meta), after: view(result.meta) };
}

export type { CoverageInfo };
