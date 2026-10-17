/* 5K v2 → aplikacija: članovi ugovora (b) — ADAPTACIJA I PREDLOG — posle segmenta 08b. Svaki ide kroz činjenice
   (`./facts.ts`) i `adaptFiveKV2` (`./adapt.ts`), ili je eksplicitno „ne koristi se" sa razlogom; nijedan ne poziva 5K v1.

   - izvršenje, run/walk, pauza (`buildExecutionAdjustment`, `buildRunWalkAdjustment`) → pregled adaptacije v2;
   - bol (`injuryProposal`) → zapis bola ulazi u činjenice, odluku donosi v2 (traka + pregled), bez predloga po danu;
   - forma (`vdotProposal`, `planRecalibrated`, `classifyMeasurement`) → v2 menja tempo SAMO iz rezultata (test 3 km,
     trka) kroz činjenice; tempo treninga se ne meri kao forma („ne koristi se u ovom planu", nije greška);
   - promena cilja (`planWithNewGoal`) → isti ulaz sa novim ciljem, menja se samo ocena cilja;
   - vraćanje verzije (`graftFuturePlan`) → spajanje planova v2;
   - forma za prikaz (`fitnessEvidence`, `planVdotNow`, `hasRecentMeasuredForm`) → VDOT iz rezultata.
   Ostaje nepodržano (sa razlogom): `executionBasis` (odluka o pripremi postoji samo za HM/maraton), `realignPlan`
   (v2 ne pomera dane prema uvezenim trčanjima: trčanje se beleži sa stvarnim datumom). */

import { vdotFromResult } from '../paces.ts';
import { FIVE_K_V2_POLICY as P } from '../policy.ts';
import type {
  AltRecord,
  GenPlanState,
  IsoDate,
  LogEntry,
  PainRecord,
  T3kRecord,
  VdotRecord
} from '../../exchange.ts';
import { adaptPreview, ADAPT_RUN_WALK_NOTE, goalChange, restoreMerge, v2Of } from './adapt.ts';
import { addDays, diffDays, isIsoDate } from './date.ts';
import type { FactsSource, ReportedBreak, SyncSource } from './facts.ts';
import type { ResolvedPlan } from './types.ts';

/** Odakle stiže prilagođavanje 5K v2 (poruka u ekranima koji nisu tok v2). */
export const ADAPTATION_V2 =
  'Plan 5K v2 se prilagođava iz činjenica (dnevnik, bol, rezultati, pauze): Plan → Prilagodi plan prikazuje pregled, a promena se upisuje tek posle potvrde.';
/** Merenje forme iz tempa treninga se u v2 ne koristi (nije greška). */
export const MEASUREMENT_NOT_USED =
  'Ne koristi se u ovom planu: 5K v2 menja tempo samo iz rezultata (test 3 km ili trka), ne iz tempa treninga.';
/** 5K nema odluku o ograničenoj pripremi (produženje, kraća distanca). */
export const NO_PREPARATION_DECISION =
  'Odluka o pripremi (produženje, kraća distanca) postoji samo za polumaraton i maraton; plan 5K v2 je nema.';
export const RECALIBRATION_NOT_USED =
  'Plan 5K v2 se ne preračunava prema formi iz treninga: tempo menja nov rezultat (test 3 km ili trka), kroz Plan → Prilagodi plan.';

/** Ostale činjenice aplikacije (oblik `ReplanContext.facts`). */
interface Sources {
  pain?: readonly PainRecord[];
  tests?: readonly T3kRecord[];
  outOfPlan?: Readonly<Record<string, number>>;
  sync?: readonly SyncSource[];
  confirmedDays?: number | null;
  breaks?: readonly ReportedBreak[];
}
interface Context {
  log?: Readonly<Record<string, LogEntry>>;
  alts?: Readonly<Record<string, AltRecord>>;
  moves?: Readonly<Record<string, unknown>>;
  facts?: Sources;
}

/** Izvor činjenica iz konteksta ugovora (dnevnik, izmene, ostale činjenice aplikacije). */
export function sourceOf(
  plan: GenPlanState,
  today: IsoDate,
  ctx: Context = {},
  extraBreaks: readonly ReportedBreak[] = []
): FactsSource {
  const f = ctx.facts ?? {};
  return {
    today,
    plan,
    log: ctx.log ?? {},
    alts: ctx.alts ?? {},
    moves: ctx.moves ?? {},
    ...(f.outOfPlan ? { outOfPlan: f.outOfPlan } : {}),
    pain: f.pain ?? [],
    tests: f.tests ?? [],
    sync: f.sync ?? [],
    confirmedDays: f.confirmedDays ?? null,
    breaks: [...(f.breaks ?? []), ...extraBreaks]
  };
}

/* --- merenje forme: v2 ne koristi lanac forme iz treninga --- */
export const classifyMeasurement = () => ({
  status: 'not-used' as const,
  reason: 'plan-uses-results' as const,
  message: MEASUREMENT_NOT_USED
});
/** Lanac v1 se u v2 ne preračunava (ostaje kakav jeste). */
export const recomputeVdotChain = (entries: readonly VdotRecord[]): VdotRecord[] =>
  entries.map((e) => ({ ...e }));
export const sessionClassFor = () => 'default' as const;
/** Forma v2 nije lanac merenja (v. `fitnessEvidence`). */
export const currentVdot = (): number | null => null;

/* --- izvršenje (opis, bez odluke) --- */
const isRun = (e: LogEntry | undefined): boolean => e?.status === 'done';

/** Opis izvršenja (28 dana) za ekrane koji ga traže; ODLUKU (manjak, pauza, umor) donosi samo adaptacija v2. */
export function executionModel(
  plan: ResolvedPlan,
  todayStr: string,
  context: { log?: Readonly<Record<string, LogEntry>> } = {}
) {
  const today = todayStr as IsoDate;
  const log = context.log ?? {};
  const from = isIsoDate(today) ? addDays(today, -27) : today;
  const days = plan.dated.filter((d) => !d.rest && d.date >= from && d.date <= today);
  const done = days.filter((d) => isRun(log[d.id]));
  const missed = days.filter((d) => log[d.id]?.status === 'skip');
  const kmOf = (d: (typeof days)[number]): number => {
    const k = log[d.id]?.km;
    return typeof k === 'number' && Number.isFinite(k) ? k : 0;
  };
  const withKm = done.filter((d) => kmOf(d) > 0);
  const last = done.length
    ? done
        .map((d) => d.date)
        .sort()
        .at(-1)!
    : null;
  const r1 = (x: number): number => Math.round(x * 10) / 10;
  const easy = done.filter((d) => {
    const rpe = Number(log[d.id]?.['rpe']);
    return (
      (d.tag === 'lako' || d.tag === 'lr') &&
      d.date > addDays(today, -7) &&
      Number.isFinite(rpe) &&
      rpe >= P.adapt.fatigueRpe
    );
  });
  return {
    analysis: {
      today,
      windowStart: from,
      completed: done.length,
      missed: missed.length,
      unknown: days.length - done.length - missed.length,
      statusCoverage: days.length ? r1((done.length + missed.length) / days.length) : 0,
      volumeCoverage: done.length ? r1(withKm.length / done.length) : 0,
      actualKm: r1(done.reduce((s, d) => s + kmOf(d), 0)),
      plannedKm: r1(days.reduce((s, d) => s + (d.km ?? 0), 0)),
      completeWeeks: [],
      recentWeeklyKm: null,
      lastPositiveWeeklyKm: null,
      recentLongRunKm: null,
      lastRunDate: last,
      daysSinceLastRun: last && isIsoDate(today) ? diffDays(last, today) : null,
      explicitMisses14d: missed.filter((d) => d.date > addDays(today, -14)).length,
      easyHighRpeCount: easy.length,
      lowerVolumeWeeks: 0,
      reasons: [ADAPTATION_V2]
    },
    recommendation: {
      kind: null,
      reason: ADAPTATION_V2,
      actionable: false,
      requiresConfirmation: true,
      reasons: [ADAPTATION_V2]
    }
  };
}

/** Nepodržano: odluka o pripremi (osnova) postoji samo za HM/maraton. */
export const executionBasis = (): { error: string } => ({ error: NO_PREPARATION_DECISION });

/** Prilagođavanje prema izvršenju → pregled adaptacije v2. `breakDays` (potvrđena pauza) postaje prijavljena pauza do
 *  danas; obim i dužinu v2 izvodi sam iz činjenica (uneti km/ned se ne koristi). */
export function buildExecutionAdjustment(
  current: GenPlanState,
  today: IsoDate,
  _analysis: unknown,
  options: { breakDays?: number } = {},
  context: Context = {}
): { result: GenPlanState; notes: string[]; summary: string } | { error: string } {
  const n = options.breakDays;
  const extra =
    n && Number.isInteger(n) && n > 0 ? [{ from: addDays(today, 1 - n), to: today }] : [];
  const r = adaptPreview(sourceOf(current, today, context, extra));
  if (!r.ok) return { error: r.reasons.map((x) => x.message).join(' ') };
  return {
    result: r.result,
    summary: r.summary,
    notes: [...r.reasons.filter((x) => x.applied).map((x) => x.message), ...r.notes]
  };
}

/** Run/walk napredak → isti pregled adaptacije v2 (nivo iz zapisa sesija; izbor načina se ne koristi). */
export function buildRunWalkAdjustment(
  current: GenPlanState,
  today: IsoDate,
  _assessment: unknown,
  _options: unknown,
  context: Context = {}
): { result: GenPlanState; notes: string[]; summary: string } | { error: string } {
  const v2 = v2Of(current);
  if (!v2 || v2.planType !== 'runWalk') return { error: 'Plan nije plan trčanje/hodanje.' };
  const r = buildExecutionAdjustment(current, today, null, {}, context);
  return 'error' in r ? r : { ...r, notes: [ADAPT_RUN_WALK_NOTE, ...r.notes] };
}

/** Odluku o nivou donosi adaptacija v2 (jedan vlasnik odluke); ovde samo upućivanje. */
export const assessRunWalkProgress = (input: { plan: ResolvedPlan }) => {
  const runWalk = input.plan.dated.some((d) => d.structure?.level != null);
  return {
    decision: runWalk ? ('unknown' as const) : ('not-applicable' as const),
    rung: null,
    finalRung: false,
    considered: 0,
    completed: 0,
    missed: 0,
    tolerated: 0,
    borderline: 0,
    hard: 0,
    unreported: 0,
    reasons: runWalk ? [ADAPT_RUN_WALK_NOTE] : [],
    advice: runWalk ? ADAPTATION_V2 : null
  };
};

/** v2 nema kapiju kvaliteta po formi: plan po osećaju prelazi na tempo tek posle rezultata. */
export const qualityEntryGate = () => ({
  open: false,
  met: [],
  unmet: [],
  unknown: [
    'Plan 5K v2 po osećaju prelazi na tempo posle rezultata (test 3 km ili trka), kroz prilagođavanje.'
  ]
});

const freshTests = (today: string, tests: readonly T3kRecord[] = []): T3kRecord[] =>
  isIsoDate(today)
    ? tests.filter(
        (t) =>
          isIsoDate(t.date) &&
          t.date <= today &&
          diffDays(t.date, today) <= P.adapt.resultMaxAgeDays &&
          Number.isFinite(t.sec) &&
          t.sec > 0
      )
    : [];

/** Svež rezultat (test 3 km ≤ 12 nedelja). */
export const hasRecentMeasuredForm = (
  today: string,
  evidence: { t3k?: readonly T3kRecord[] }
): boolean => freshTests(today, evidence.t3k).length > 0;

/* --- cilj, rekalibracija, vraćanje verzije, automatske izmene --- */
export function planWithNewGoal(plan: GenPlanState | null, newGoalSec: number, today: IsoDate) {
  if (!plan) return { error: 'Nema plana.' };
  const r = goalChange(plan, newGoalSec, today);
  if (!r.ok) return { error: r.reasons.map((x) => x.message).join(' ') };
  const week =
    r.result.weeks.find((w) => w.start > today)?.w ??
    r.result.weeks[r.result.weeks.length - 1]?.w ??
    1;
  return {
    ...r.result,
    meta: r.result.meta as NonNullable<GenPlanState['meta']>,
    goalChange: {
      week,
      from: plan.meta?.goalSec ?? null,
      to: newGoalSec,
      changedWeeks: 0
    }
  };
}
export const planRecalibrated = (): { error: string } => ({ error: RECALIBRATION_NOT_USED });
export const graftFuturePlan = (
  plan: GenPlanState,
  fresh: GenPlanState,
  today: IsoDate,
  ctx: Context = {}
): GenPlanState => restoreMerge(plan, fresh, today, ctx);
/** v2 nema automatskih izmena dana (tempo ne menja preko `alts`): ručne izmene ostaju kakve jesu. */
export const alignAutomaticOverlays = (
  _current: unknown,
  _result: unknown,
  _today: string,
  context: { alts?: Readonly<Record<string, AltRecord>> }
): Record<string, AltRecord> => ({ ...(context.alts ?? {}) });

/* --- predlog tempa i dokaz forme: samo rezultati --- */
export const vdotProposal = (): null => null;
export const applyVdotProposal = (
  _proposal: unknown,
  _plan: unknown,
  _log: unknown,
  alts: Readonly<Record<string, AltRecord>>,
  genPlan: GenPlanState | null
) => ({ applied: 0, alts: { ...alts }, genPlan });
export const undoVdotAdjustments = (
  _plan: unknown,
  alts: Readonly<Record<string, AltRecord>>,
  genPlan: GenPlanState | null
) => ({ applied: 0, alts: { ...alts }, genPlan });

/** Forma = VDOT poslednjeg svežeg testa 3 km (rezultat), bez lanca merenja iz treninga. */
export function fitnessEvidence(ctx: { today: string; tests?: readonly T3kRecord[] }) {
  const tests = freshTests(ctx.today, ctx.tests);
  const last = [...tests].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  return {
    form: last ? Math.round(vdotFromResult(3000, last.sec) * 10) / 10 : null,
    measurements: tests.length,
    distinctDays: new Set(tests.map((t) => t.date)).size,
    confirmedTests: tests.length,
    trainingMeasurements: 0,
    windowDays: P.adapt.resultMaxAgeDays,
    chain: [] as VdotRecord[],
    excluded: []
  };
}
/** VDOT plana sada: tekući VDOT plana v2 (posle poslednjeg primenjenog rezultata); po osećaju `null`. */
export const planVdotNow = (ctx: { meta: { trainingVdot?: unknown; vdot0?: unknown } | null }) => {
  const v = ctx.meta?.trainingVdot ?? ctx.meta?.vdot0;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};
export const matchPlanRows = <R>(): Map<string, R> => new Map<string, R>();
/** Rekalibracija iz merenja treninga ne postoji (kapija se ne otvara). */
export const RECALIBRATION_MIN_MEASUREMENTS = Number.POSITIVE_INFINITY;
export const RECALIBRATION_THRESHOLD = Number.POSITIVE_INFINITY;

/* --- bol: kroz činjenice; poravnanje sa uvezenim trčanjima: nepodržano --- */
/** Bez predloga po danu: bol ulazi u činjenice, a odluku (odmor, dani bez kvaliteta) donosi adaptacija v2. */
export const injuryProposal = (): null => null;
export const applyInjuryProposal = (
  _proposal: unknown,
  _plan: unknown,
  _log: unknown,
  alts: Readonly<Record<string, AltRecord>>
) => ({ applied: 0, alts: { ...alts } });
/** Nepodržano: v2 ne pomera dane plana prema uvezenim trčanjima (trčanje ulazi sa stvarnim datumom). */
export const realignPlan = (input: { moves: Readonly<Record<string, unknown>> }) => ({
  moves: { ...input.moves },
  moved: 0
});
