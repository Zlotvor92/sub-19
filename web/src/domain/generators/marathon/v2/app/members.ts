/* Maraton v2 → aplikacija: članovi ugovora (b) — ADAPTACIJA I PREDLOG — posle segmenta MAR-06. Svaki ide kroz činjenice
   (`./facts.ts`) i `adaptMarathonV2` (`./adapt.ts`), ili je eksplicitno „ne koristi se" sa razlogom (`MEMBERS`); nijedan ne
   poziva maraton v1 (obrazac HM v2 06, kopija, ne uvoz).

   - izvršenje i pauza (`buildExecutionAdjustment`) → pregled adaptacije v2;
   - bol (`injuryProposal`) → zapis bola ulazi u činjenice, odluku donosi v2 (traka + pregled), bez predloga po danu;
   - forma (`vdotProposal`, `planRecalibrated`, `classifyMeasurement`) → v2 menja tempo SAMO iz rezultata (test 5 km
     plana, trka 5/10 km, polumaraton, maraton — M18) kroz činjenice; tempo treninga se ne meri kao forma („ne koristi se");
   - promena cilja (`planWithNewGoal`) → isti ulaz sa novim ciljem, menja se samo ocena cilja;
   - vraćanje verzije (`graftFuturePlan`) → spajanje planova v2;
   - VDOT plana (`planVdotNow`) → tekući VDOT plana v2;
   - potvrđeno izvršenje (`executionBasis`, faza 3 / 3e) → osnova predaje „kraća distanca" (`./preparation.ts`).
   „Ne koristi se" (sa razlogom): trčanje/hodanje (maraton v2 ga odbija pri izradi), `fitnessEvidence`/
   `hasRecentMeasuredForm` (ugovor nosi samo test 3 km, a on nije rezultat maratona v2 — A1), `realignPlan` (trčanje ulazi sa stvarnim datumom).

   Tipovi su lokalni ili generički (dan, izmena, zapis lanca, plan prolaze kroz član nepromenjeni); gde član PRAVI plan
   formata (`buildExecutionAdjustment`, `planWithNewGoal`, `graftFuturePlan`), tip formata mu daje granica u `select.ts`. */

import { MARATHON_V2_POLICY as P } from '../policy.ts';
import { adaptPreview, goalChange, restoreMerge } from './adapt.ts';
import { addDays, diffDays, isIsoDate } from './date.ts';
import type { FactsSource, ReportedBreak, SyncSource } from './facts.ts';
import type {
  AppPlan,
  IsoDate,
  LogEntry,
  OffPlanRunRecord,
  PainRecord,
  StoredPlan,
  T3kRecord
} from './types.ts';

/** Odakle stiže prilagođavanje maratona v2 (poruka u ekranima koji nisu tok v2). */
export const ADAPTATION_V2 =
  'Plan maratona v2 se prilagođava iz činjenica (dnevnik, bol, rezultati, pauze): Plan → Prilagodi plan prikazuje pregled, a promena se upisuje tek posle potvrde.';
/** Merenje forme iz tempa treninga se u v2 ne koristi (nije greška). */
export const MEASUREMENT_NOT_USED =
  'Ne koristi se u ovom planu: maraton v2 menja tempo samo iz rezultata (test 5 km plana ili trka na 5 ili 10 km, polumaratonu ili maratonu), ne iz tempa treninga.';
export const RECALIBRATION_NOT_USED =
  'Plan maratona v2 se ne preračunava prema formi iz treninga: tempo menja nov rezultat (test 5 km plana ili trka), kroz Plan → Prilagodi plan.';
/** Maraton v2 nema plan trčanje/hodanje (odbija ga pri izradi). */
export const NO_RUN_WALK = 'Plan maratona v2 nema trčanje/hodanje.';
/** Test 3 km (jedini rezultat koji ugovor ovde nosi) nije rezultat maratona v2 (A1, M18). */
export const T3K_NOT_USED =
  'Ne koristi se u ovom planu: test 3 km nije rezultat maratona v2 (koristi se test 5 km plana ili trka na 5 ili 10 km, polumaratonu ili maratonu).';

/** Član (b) → kako ga maraton v2 ispunjava: `v2` (kroz činjenice i adaptaciju) ili „ne koristi se" — uvek sa razlogom
 *  (test: tabela pokriva svaki član ugovora (b) tačno jednom). */
export const MEMBERS: Readonly<Record<string, { kind: 'v2' | 'not-used'; reason: string }>> = {
  classifyMeasurement: { kind: 'not-used', reason: MEASUREMENT_NOT_USED },
  recomputeVdotChain: {
    kind: 'not-used',
    reason: 'lanac forme v1 se ne preračunava: ostaje kakav jeste'
  },
  sessionClassFor: { kind: 'not-used', reason: 'nema klase sesije bez redova predikcije' },
  currentVdot: {
    kind: 'not-used',
    reason: 'forma v2 nije lanac merenja iz treninga (Napredak → Forma)'
  },
  executionModel: { kind: 'v2', reason: 'opis 28 dana bez odluke; odluku donosi adaptacija v2' },
  executionBasis: {
    kind: 'v2',
    reason:
      'faza 3 (3e): potvrđeno izvršenje kao činjenica predaje „kraća distanca" (bez politike izvora, ./preparation.ts)'
  },
  buildExecutionAdjustment: {
    kind: 'v2',
    reason: 'pregled adaptacije v2 (potvrđena pauza → prijavljena pauza)'
  },
  buildRunWalkAdjustment: { kind: 'not-used', reason: NO_RUN_WALK },
  assessRunWalkProgress: { kind: 'not-used', reason: NO_RUN_WALK },
  qualityEntryGate: {
    kind: 'not-used',
    reason: 'v2 nema kapiju kvaliteta po formi: plan po osećaju prelazi na tempo posle rezultata'
  },
  hasRecentMeasuredForm: { kind: 'not-used', reason: T3K_NOT_USED },
  planWithNewGoal: {
    kind: 'v2',
    reason: 'isti ulaz sa novim ciljem, budući dani zaključani: menja se samo ocena'
  },
  planRecalibrated: { kind: 'not-used', reason: RECALIBRATION_NOT_USED },
  graftFuturePlan: {
    kind: 'v2',
    reason: 'spajanje planova v2: budući nezaštićeni dani iz verzije'
  },
  alignAutomaticOverlays: {
    kind: 'not-used',
    reason: 'v2 nema automatskih izmena dana: ručne izmene ostaju'
  },
  vdotProposal: { kind: 'not-used', reason: 'predlog tempa iz forme treninga ne postoji u v2' },
  applyVdotProposal: { kind: 'not-used', reason: 'nema predloga tempa: ništa se ne primenjuje' },
  undoVdotAdjustments: {
    kind: 'not-used',
    reason: 'nema primenjenih predloga tempa: ništa se ne vraća'
  },
  fitnessEvidence: { kind: 'not-used', reason: T3K_NOT_USED },
  planVdotNow: {
    kind: 'v2',
    reason: 'tekući VDOT plana v2 (posle poslednjeg primenjenog rezultata); po osećaju bez VDOT-a'
  },
  matchPlanRows: { kind: 'not-used', reason: 'v2 nema redove predikcije' },
  recalibrationMinMeasurements: {
    kind: 'not-used',
    reason: 'kapija rekalibracije se ne otvara (beskonačan prag)'
  },
  recalibrationThreshold: {
    kind: 'not-used',
    reason: 'kapija rekalibracije se ne otvara (beskonačan prag)'
  },
  injuryProposal: {
    kind: 'v2',
    reason: 'bol ulazi kao činjenica u adaptaciju v2 (traka + pregled), bez predloga po danu'
  },
  applyInjuryProposal: {
    kind: 'not-used',
    reason: 'nema predloga zbog bola: ništa se ne primenjuje'
  },
  realignPlan: {
    kind: 'not-used',
    reason: 'v2 ne pomera dane prema uvezenim trčanjima (trčanje ulazi sa stvarnim datumom)'
  }
};

/** Ostale činjenice aplikacije (oblik `ReplanContext.facts`). */
interface Sources {
  pain?: readonly PainRecord[];
  tests?: readonly T3kRecord[];
  outOfPlan?: Readonly<Record<string, number>>;
  offPlanRuns?: Readonly<Record<string, OffPlanRunRecord>>;
  sync?: readonly SyncSource[];
  confirmedDays?: number | null;
  breaks?: readonly ReportedBreak[];
}
interface Context {
  log?: Readonly<Record<string, LogEntry>>;
  alts?: Readonly<Record<string, unknown>>;
  moves?: Readonly<Record<string, unknown>>;
  facts?: Sources;
}

/** Izvor činjenica iz konteksta ugovora (dnevnik, izmene, ostale činjenice aplikacije). */
export function sourceOf(
  plan: AppPlan,
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
    ...(f.offPlanRuns ? { offPlanRuns: f.offPlanRuns } : {}),
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
export const recomputeVdotChain = <E extends object>(entries: readonly E[]): E[] =>
  entries.map((e) => ({ ...e }));
export const sessionClassFor = () => 'default' as const;
/** Forma v2 nije lanac merenja (v. `fitnessEvidence`). */
export const currentVdot = (): number | null => null;

/* --- izvršenje (opis, bez odluke) --- */
const isRun = (e: LogEntry | undefined): boolean => e?.status === 'done';
const r1 = (x: number): number => Math.round(x * 10) / 10;

/** Opis izvršenja (28 dana) za ekrane koji ga traže; ODLUKU (manjak, pauza, umor) donosi samo adaptacija v2. Datum je
 *  tipa datuma razrešenog plana (`D`). */
export function executionModel<D extends string>(
  plan: {
    weeks: ReadonlyArray<{ start: D }>;
    dated: ReadonlyArray<{
      id: string;
      date: D;
      rest: boolean;
      tag: string | undefined;
      km: number | null;
    }>;
  },
  todayStr: string,
  context: { log?: Readonly<Record<string, LogEntry>> } = {}
) {
  const today = todayStr as D;
  const log = context.log ?? {};
  const from = (isIsoDate(today) ? addDays(today, -27) : today) as D;
  const days = plan.dated.filter((d) => !d.rest && d.date >= from && d.date <= today);
  const done = days.filter((d) => isRun(log[d.id]));
  const missed = days.filter((d) => log[d.id]?.status === 'skip');
  const kmOf = (d: (typeof days)[number]): number => {
    const k = log[d.id]?.km;
    return typeof k === 'number' && Number.isFinite(k) ? k : 0;
  };
  const withKm = done.filter((d) => kmOf(d) > 0);
  const last: D | null = done.length
    ? done
        .map((d) => d.date)
        .sort()
        .at(-1)!
    : null;
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

/** Prilagođavanje prema izvršenju → pregled adaptacije v2. `breakDays` (potvrđena pauza) postaje prijavljena pauza do
 *  danas; obim i dužinu v2 izvodi sam iz činjenica (uneti km/ned se ne koristi). */
export function buildExecutionAdjustment(
  current: AppPlan,
  today: IsoDate,
  _analysis: unknown,
  options: { breakDays?: number } = {},
  context: Context = {}
): { result: StoredPlan; notes: string[]; summary: string } | { error: string } {
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

/** Ne koristi se: maraton v2 nema plan trčanje/hodanje. */
export const buildRunWalkAdjustment = (): { error: string } => ({ error: NO_RUN_WALK });
export const assessRunWalkProgress = () => ({
  decision: 'not-applicable' as const,
  rung: null,
  finalRung: false,
  considered: 0,
  completed: 0,
  missed: 0,
  tolerated: 0,
  borderline: 0,
  hard: 0,
  unreported: 0,
  reasons: [NO_RUN_WALK],
  advice: null
});

/** v2 nema kapiju kvaliteta po formi: plan po osećaju prelazi na tempo tek posle rezultata. */
export const qualityEntryGate = () => ({
  open: false,
  met: [],
  unmet: [],
  unknown: [
    'Plan maratona v2 po osećaju prelazi na tempo posle rezultata (test 5 km plana ili trka), kroz prilagođavanje.'
  ]
});

/** Ne koristi se: ugovor nosi samo test 3 km, a on nije rezultat maratona v2 (A1). */
export const hasRecentMeasuredForm = (): boolean => false;

/* --- cilj, rekalibracija, vraćanje verzije, automatske izmene --- */
export function planWithNewGoal(
  plan: (AppPlan & { meta?: { goalSec?: unknown } }) | null,
  newGoalSec: number,
  today: IsoDate
) {
  if (!plan) return { error: 'Nema plana.' };
  const r = goalChange(plan, newGoalSec, today);
  if (!r.ok) return { error: r.reasons.map((x) => x.message).join(' ') };
  const week =
    r.result.weeks.find((w) => w.start > today)?.w ??
    r.result.weeks[r.result.weeks.length - 1]?.w ??
    1;
  const from = plan.meta?.goalSec;
  return {
    ...r.result,
    goalChange: {
      week,
      from: typeof from === 'number' ? from : null,
      to: newGoalSec,
      changedWeeks: 0
    }
  };
}
export const planRecalibrated = (): { error: string } => ({ error: RECALIBRATION_NOT_USED });
export const graftFuturePlan = <T extends AppPlan>(
  plan: T,
  fresh: AppPlan,
  today: IsoDate,
  ctx: Context = {}
): T | StoredPlan => restoreMerge(plan, fresh, today, ctx);
/** v2 nema automatskih izmena dana (tempo ne menja preko `alts`): ručne izmene ostaju kakve jesu. */
export const alignAutomaticOverlays = <A>(
  _current: unknown,
  _result: unknown,
  _today: string,
  context: { alts?: Readonly<Record<string, A>> }
): Record<string, A> => ({ ...(context.alts ?? {}) });

/* --- predlog tempa i dokaz forme: samo rezultati --- */
export const vdotProposal = (): null => null;
export const applyVdotProposal = <A, G>(
  _proposal: unknown,
  _plan: unknown,
  _log: unknown,
  alts: Readonly<Record<string, A>>,
  genPlan: G
) => ({ applied: 0, alts: { ...alts }, genPlan });
export const undoVdotAdjustments = <A, G>(
  _plan: unknown,
  alts: Readonly<Record<string, A>>,
  genPlan: G
) => ({ applied: 0, alts: { ...alts }, genPlan });

/** Ne koristi se: forma maratona v2 je VDOT iz rezultata (Napredak → Forma, `./form.ts`); test 3 km nije rezultat maratona v2. */
export const fitnessEvidence = <E extends object>(_ctx: { vdotChain: readonly E[] }) => ({
  form: null,
  measurements: 0,
  distinctDays: 0,
  confirmedTests: 0,
  trainingMeasurements: 0,
  windowDays: P.input.resultMaxAgeDays,
  chain: [] as E[],
  excluded: []
});
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
export const applyInjuryProposal = <A>(
  _proposal: unknown,
  _plan: unknown,
  _log: unknown,
  alts: Readonly<Record<string, A>>
) => ({ applied: 0, alts: { ...alts } });
/** Nepodržano: v2 ne pomera dane plana prema uvezenim trčanjima (trčanje ulazi sa stvarnim datumom). */
export const realignPlan = (input: { moves: Readonly<Record<string, unknown>> }) => ({
  moves: { ...input.moves },
  moved: 0
});
