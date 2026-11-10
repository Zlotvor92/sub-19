/* ============================================================
   IZBOR GENERATORA — aplikacioni sloj, bez trenerskih odluka.

   Jedina odluka ovde je KOJI od četiri nezavisna generatora odgovara za plan: po ciljnoj distanci ulaza (novi plan,
   regeneracija) ili po oznaci politike i distanci aktivnog plana (adaptacija nad sačuvanim ili ugrađenim planom). Sav
   proračun radi izabrani generator; ovde nema podrazumevanog generatora ni zamene jednog drugim.

   V1b (brisanje v1): nov plan pravi SAMO v2 — 5K → `./fiveK/v2/app`; 10K → `./tenK/v2/app`; polumaraton →
   `./halfMarathon/v2/app`; maraton → `./marathon/v2/app` (tačne vrednosti distance; adapter se uvozi direktno).
   - Ulaz bez distance (ili sa 0) je 5K (`raceDistM || 5000`); to nije zamena generatora, već čitanje ulaza.
   - Svaka druga distanca nema generator: `generatorForDistance`/`generatorForPlan` vraćaju `null`, a pozivalac to
     EKSPLICITNO prikazuje (`UNSUPPORTED_DISTANCE`).
   - Sačuvan plan bira generator po oznaci politike: tekuća oznaka v2 → v2 te distance; plan starog generatora (bez
     oznake ili sa oznakom v1, `isLegacyPlan`) nema generator — prikazuje se, unos radi, ali se ne prilagođava
     (`LEGACY_PLAN`, dugme „Generiši nov plan"); nepoznata verzija → `UNKNOWN_POLICY`.
   - Izuzetak: ugrađeni lični plan vlasnika (`meta.licni === true`; u store-u `genPlan === null`) → zamrznut HM v1
     (`LEGACY_PERSONAL_GENERATOR`, dokaz istog ponašanja: `personalPlan.node.test.ts`) do V1c.

   Predaja „kraća distanca" (HM v2 → 10K/5K v2, maraton v2 → HM/10K v2) ide SAMO ovuda: izvor je dobija kao argument
   (`shorterHandoffForV2Source`), bez međusobnog uvoza generatora.
   ============================================================ */

import type {
  AltRecord,
  GenPlanState,
  LogEntry,
  PainRecord,
  T3kRecord,
  VdotRecord,
  WellnessRecord
} from '../state';
import type { IsoDate } from '../date';
import type {
  Acwr,
  AcwrBand,
  AdaptationSources,
  ApplyResult,
  Assessment,
  ChoiceResult,
  DecisionBasis,
  DecisionPoint,
  DistanceProduct,
  ExecutionAdjustmentOptions,
  ExecutionAnalysis,
  ExecutionRecommendation,
  FinalizationOptions,
  FitnessEvidence,
  FitnessEvidenceContext,
  GoalChangeResult,
  HmV2PlanInput,
  MarathonV2PlanInput,
  InjuryProposal,
  Intensity,
  LoadContext,
  PainStatus,
  PersonalBest,
  PlanGenerationInput,
  PlanGenerationResult,
  PreparationAssessment,
  PreparationChoice,
  PreparationDecision,
  ProposalContext,
  QualityGateResult,
  Readiness,
  RealignInput,
  RealignResult,
  RecalibratedStoredPlan,
  RecoveryContext,
  ReplanContext,
  ReplanError,
  ResolvedDay,
  ResolvedPlan,
  ResolvedPlanView,
  ResolvedWeek,
  RpeTarget,
  RunWalkAdjustmentOptions,
  RunWalkAssessment,
  RunWalkMode,
  Signal,
  StoredPredRow,
  StructuredPlanInput,
  StructuredPlanResult,
  TenKV2PlanInput,
  VdotProposal,
  WatchBatch,
  WeatherCardInput,
  WeatherCardModel,
  Zone
} from './contract';
import { fiveKV2 } from './fiveK/v2/app/index.ts';
import * as halfMarathon from './halfMarathon';
import { hmV2 } from './halfMarathon/v2/app/index.ts';
import type { SourceFormat } from './handoff';
import { marathonV2 } from './marathon/v2/app/index.ts';
import { tenKV2 } from './tenK/v2/app/index.ts';

export type { SourceFormat } from './handoff';

export type GeneratorId = '5k' | '10k' | 'hm' | 'marathon';

/** Poruka za plan čija distanca nema generator (ručno uvezen ili oštećen plan). */
export const UNSUPPORTED_DISTANCE =
  'Plan nema podržanu distancu (5K, 10K, polumaraton ili maraton), pa ga nijedan generator ne može da prilagodi. Napravi novi plan.';

/* ============================================================
   UGOVOR GENERATORA PREMA APLIKACIJI (A5) — eksplicitan spisak članova i potpisa. Svaki od četiri generatora se proverava
   sa `satisfies PlanGenerator` (i `PreparationApi` gde postoji), pa promena jednog generatora koja ne odgovara ugovoru
   pada pri prevođenju umesto da tiho promeni ugovor ostalima. Bez frameworka i baznih klasa.

   Tipovi tereta: neutralni format razmene deklarisan u `./contract.ts` (perzistirani plan iz `../state`, ostalo tamo).
   `select.ts` iz foldera distance uzima SAMO generator objekte za izbor (izvršni `import * as`), nijedan tip — proverava
   `contract.node.test.ts`. Promena tipa unutar jednog generatora zato ne menja ugovor, već pada pri prevođenju.
   ============================================================ */

/* --- tipovi tereta (deklarisani u `./contract.ts`) --- */
export type {
  AdaptationSources,
  DistanceProduct,
  ResolvedPlanView,
  InjuryProposal,
  RecoveryContext,
  RpeTarget,
  WatchBatch,
  WeatherCardInput,
  WeatherCardModel,
  RealignInput,
  PainStatus,
  Acwr,
  AcwrBand,
  Readiness,
  ExecutionAdjustmentOptions,
  ReplanContext,
  RunWalkAdjustmentOptions,
  RunWalkMode,
  VdotProposal,
  RecalibratedStoredPlan,
  PreparationDecision,
  PreparationChoice,
  DecisionPoint
};
export type AcwrPlan = { planned: number; chronic: number | null; ratio: number | null };
export type PreparationOption = PreparationDecision['options'][number];
export type WeekPhase = 'DELOAD' | 'TRKA' | 'TAPER' | 'BAZA' | 'RAZVOJ' | 'VRHUNAC' | '';
export type PolicyStatus =
  | { status: 'current'; policyId: string; policyVersion: string }
  | { status: 'legacy'; policyId: string; policyVersion: null }
  | { status: 'unknown'; policyId: string; policyVersion: string | null };

/* --- prijem merenja forme (A1): neutralni tipovi razmene --- */
export type MeasureZone = 'I' | 'T' | 'M' | 'E' | 'LR' | 'R';
export type VdotSessionClass = 'test' | 'tempo' | 'int' | 'rep' | 'default';
export interface MeasureInput {
  row: Pick<GenPlanState['pred'][number], 'l' | 'q' | 'nemeri' | 'zone'> | undefined;
  zone?: MeasureZone | 'RP';
  paceSec: number | null | undefined;
  kind: string | null;
  auto: boolean;
  retagged: boolean;
  currentVdot: number | null;
  baselineVdot: number | null;
}
export type MeasureOutcome =
  | {
      status: 'rejected';
      reason: 'no-row' | 'no-pace' | 'out-of-table' | 'impossible' | 'auto-outlier';
    }
  | { status: 'not-measured'; measured: number; reason?: 'short-repetition' | 'race-prescription' }
  /** 08b (5K v2): plan ne uzima formu iz tempa treninga (tempo menja samo rezultat) — nije greška merenja. */
  | { status: 'not-used'; reason: 'plan-uses-results'; message: string }
  | { status: 'accepted'; measured: number };
/** Politika prijema merenja forme generatora aktivnog plana: klasifikacija (tolerancija automatskog merenja), uglađivanje
 *  lanca (α po tipu sesije) i trenutna forma. Aplikacija čuva sirova merenja (`vdotLog.measured`, datum, ID izvora). */
export interface FormPolicy {
  classifyMeasurement: (i: MeasureInput) => MeasureOutcome;
  recomputeVdotChain: (
    entries: readonly VdotRecord[],
    baseline: number | null,
    classify: (id: string) => VdotSessionClass
  ) => VdotRecord[];
  sessionClassFor: (
    isT3k: boolean,
    predLabel: string | null | undefined,
    explicitZone?: MeasureZone | 'RP'
  ) => VdotSessionClass;
  currentVdot: (chain: readonly VdotRecord[]) => number | null;
}

export interface PlanGenerator extends FormPolicy {
  id: GeneratorId;
  /* politika plana i prikaz faze (A3, A7) */
  policyId: string;
  policyVersion: string;
  legacyPolicyId: string;
  planPolicy: (plan: Pick<GenPlanState, 'meta'> | null | undefined) => PolicyStatus;
  stampPlan: <P extends GenPlanState>(plan: P) => P;
  phaseOfWeek: (
    w:
      | { w: number; deload?: boolean; focus?: string; taper?: boolean; phase?: unknown }
      | null
      | undefined,
    totalWeeks: number
  ) => WeekPhase;
  /* generisanje */
  generatePlan: (input: PlanGenerationInput) => PlanGenerationResult;
  adaptGeneratedPlan: (gen: PlanGenerationResult) => GenPlanState | null;
  assess: (
    pb: PersonalBest,
    weeks: number,
    intensity: Intensity,
    goalSec: number | null,
    raceDistM: number
  ) => Assessment;
  product: (raceDistM: number) => DistanceProduct | undefined;
  /* adaptacija */
  executionModel: (
    plan: ResolvedPlan,
    today: string,
    context: ReplanContext,
    extras?: Record<string, number>
  ) => { analysis: ExecutionAnalysis; recommendation: ExecutionRecommendation };
  executionBasis: (
    current: GenPlanState,
    today: IsoDate,
    analysis: ExecutionAnalysis,
    options: ExecutionAdjustmentOptions
  ) => (DecisionBasis & { returning: boolean; base: number; weeklyKm: number }) | { error: string };
  buildExecutionAdjustment: (
    current: GenPlanState,
    today: IsoDate,
    analysis: ExecutionAnalysis,
    options: ExecutionAdjustmentOptions,
    context?: ReplanContext
  ) =>
    | { result: GenPlanState; notes: string[]; summary: string; decision?: PreparationDecision }
    | { error: string; decision?: PreparationDecision };
  buildRunWalkAdjustment: (
    current: GenPlanState,
    today: IsoDate,
    assessment: RunWalkAssessment,
    options: RunWalkAdjustmentOptions,
    context?: ReplanContext
  ) => { result: GenPlanState; notes: string[]; summary: string } | { error: string };
  assessRunWalkProgress: (input: {
    plan: ResolvedPlan;
    log: Readonly<Record<string, LogEntry>>;
    today: string;
    recentPainMax?: number | null;
  }) => RunWalkAssessment;
  qualityEntryGate: (input: {
    analysis: ExecutionAnalysis;
    recentPainMax?: number | null;
    formConfirmed: boolean;
  }) => QualityGateResult;
  hasRecentMeasuredForm: (
    today: string,
    evidence: { t3k?: readonly T3kRecord[]; vdotLog?: readonly VdotRecord[] }
  ) => boolean;
  planWithNewGoal: (
    plan: GenPlanState | null,
    newGoalSec: number,
    today: IsoDate,
    context?: ReplanContext
  ) => GoalChangeResult | ReplanError;
  planRecalibrated: (
    plan: GenPlanState | null,
    formVdot: number,
    today: IsoDate,
    context?: ReplanContext
  ) => RecalibratedStoredPlan | ReplanError;
  graftFuturePlan: (
    plan: GenPlanState,
    fresh: GenPlanState,
    today: IsoDate,
    ctx?: ReplanContext,
    options?: FinalizationOptions
  ) => GenPlanState;
  alignAutomaticOverlays: (
    current: GenPlanState | null,
    result: GenPlanState,
    today: string,
    context: ReplanContext
  ) => Record<string, AltRecord>;
  vdotProposal: (ctx: ProposalContext) => VdotProposal | null;
  applyVdotProposal: (
    proposal: Pick<VdotProposal, 'changes'> | null,
    plan: ResolvedPlan,
    log: Readonly<Record<string, LogEntry>>,
    alts: Readonly<Record<string, AltRecord>>,
    genPlan: GenPlanState | null
  ) => ApplyResult;
  undoVdotAdjustments: (
    plan: ResolvedPlan,
    alts: Readonly<Record<string, AltRecord>>,
    genPlan: GenPlanState | null
  ) => ApplyResult;
  fitnessEvidence: (ctx: FitnessEvidenceContext) => FitnessEvidence;
  planVdotNow: (
    ctx: Pick<ProposalContext, 'today' | 'plan' | 'meta'> & {
      pred?: readonly Pick<StoredPredRow, 'w' | 'p5k'>[];
    }
  ) => number | null;
  matchPlanRows: (
    weeks: readonly ResolvedWeek[],
    pred: readonly StoredPredRow[]
  ) => Map<string, StoredPredRow>;
  recalibrationMinMeasurements: number;
  recalibrationThreshold: number;
  /* oporavak, sat, vreme, smernice */
  injuryProposal: (ctx: RecoveryContext, today: IsoDate) => InjuryProposal | null;
  applyInjuryProposal: (
    proposal: Pick<InjuryProposal, 'changes'> | null,
    plan: ResolvedPlan,
    log: Readonly<Record<string, LogEntry>>,
    alts: Readonly<Record<string, AltRecord>>
  ) => { applied: number; alts: Record<string, AltRecord> };
  realignPlan: (input: RealignInput) => RealignResult;
  workoutsForWatch: (
    plan: Pick<ResolvedPlan, 'weeks'>,
    today: string,
    daysAhead: number,
    vdot: number | null
  ) => WatchBatch;
  thresholdPace: (vdot: number | null | undefined) => string | null;
  weatherCard: (input: WeatherCardInput) => WeatherCardModel | null;
  rpeTarget: (d: Pick<ResolvedDay, 'rest' | 'tag'> | null | undefined) => RpeTarget | null;
  paceForZone: (vdot: number, zone: Zone) => number;
  /* procena stanja */
  painStatus: (pain: readonly PainRecord[] | null | undefined, today: IsoDate) => PainStatus;
  acwrNow: (ctx: LoadContext, today: IsoDate) => Acwr;
  acwrPlan: (ctx: LoadContext, today: IsoDate) => AcwrPlan;
  readinessModel: (input: {
    status: PainStatus;
    load: Acwr;
    wellness: Readonly<Record<string, WellnessRecord>>;
    today: IsoDate;
  }) => Readiness;
  loadMeaning: (band: AcwrBand) => string;
  wellnessSignals: (
    wellness: Readonly<Record<string, WellnessRecord>>,
    today: IsoDate,
    includeStale?: boolean
  ) => { signals: Signal[]; missing: string[] };
  acwrBand: (ratio: number) => AcwrBand;
  acwrText: (v: number | null | undefined) => string;
  acwrPosition: (v: number) => number;
  ACWR_MAX: number;
  ACWR_RETURN: number;
  ACWR_HIGH: number;
  ACWR_SCALE: number;
}

/** Odluka o ograničenoj pripremi (samo HM i maraton). */
export interface PreparationApi {
  basisFromPlan: (current: GenPlanState, today: IsoDate) => DecisionBasis | null;
  preparationDecision: (
    current: GenPlanState,
    today: IsoDate,
    basis: DecisionBasis,
    context: ReplanContext,
    status: 'rejected' | 'limited',
    delivered: PreparationAssessment | undefined
  ) => PreparationDecision;
  buildPreparationChoice: (
    current: GenPlanState,
    today: IsoDate,
    basis: DecisionBasis,
    choice: PreparationChoice,
    context: ReplanContext
  ) => ChoiceResult | { error: string };
  /** 3b: `plan` (neobavezno) je ceo sačuvani plan — izvor v2 ocenjuje pripremu iz svojih nedelja, `meta` ih nema; v1
   *  ga ne čita (bajt-isto). */
  isLimitedLongPreparation: (
    meta: GenPlanState['meta'] | undefined,
    plan?: GenPlanState
  ) => boolean;
}

/** Procena stanja trkača koju ekrani oporavka dobijaju od generatora distance aktivnog plana. */
export type StateAssessment = Pick<
  PlanGenerator,
  | 'painStatus'
  | 'acwrNow'
  | 'acwrPlan'
  | 'readinessModel'
  | 'loadMeaning'
  | 'wellnessSignals'
  | 'acwrBand'
  | 'acwrText'
  | 'acwrPosition'
  | 'ACWR_MAX'
  | 'ACWR_RETURN'
  | 'ACWR_HIGH'
  | 'ACWR_SCALE'
>;

/* 5K v2 (segment 08a): sopstveni generator 5K distance, biran po oznaci politike plana (`5k-v2`) — postojeći planovi
   (`5k-v1`, `legacy-5k`) od V1b nemaju generator (`LEGACY_PLAN`). Raspodela članova: (a) v2 sam
   (generisanje, oznake, faza, procena, proizvod, tempo/prag/napor, sat iz strukture); (b) adaptacija i predlog (08b) —
   kroz činjenice i `adaptFiveKV2` sa pregledom pre upisa, bez zamene starim generatorom; (c) procena stanja i vreme —
   sopstvena kopija v2 sa istim vrednostima (v. `fiveK/v2/app/index.ts`). */
const v2 = fiveKV2;
export const FIVE_K_V2_GENERATOR: PlanGenerator = {
  id: '5k',
  policyId: v2.POLICY_ID,
  policyVersion: v2.POLICY_VERSION,
  legacyPolicyId: v2.LEGACY_POLICY_ID,
  planPolicy: v2.planPolicy,
  stampPlan: v2.stampPlan,
  phaseOfWeek: v2.phaseOfWeek,
  classifyMeasurement: v2.classifyMeasurement,
  recomputeVdotChain: v2.recomputeVdotChain,
  sessionClassFor: v2.sessionClassFor,
  currentVdot: v2.currentVdot,
  generatePlan: v2.generatePlan,
  adaptGeneratedPlan: v2.adaptGeneratedPlan,
  assess: v2.assess,
  product: v2.product,
  executionModel: v2.executionModel,
  executionBasis: v2.executionBasis,
  buildExecutionAdjustment: v2.buildExecutionAdjustment,
  buildRunWalkAdjustment: v2.buildRunWalkAdjustment,
  assessRunWalkProgress: v2.assessRunWalkProgress,
  qualityEntryGate: v2.qualityEntryGate,
  hasRecentMeasuredForm: v2.hasRecentMeasuredForm,
  // 08b: isti treninzi, nova ocena cilja. Plan v2 nema ulaz čarobnjaka v1 (`ulaz`), pa ga rezultat ne nosi; pozivalac
  // ga spaja preko postojećeg plana (`{ ...genPlan, ...r }`) i ne čita ga.
  planWithNewGoal: (plan, sec, today) =>
    v2.planWithNewGoal(plan, sec, today) as unknown as GoalChangeResult | ReplanError,
  planRecalibrated: v2.planRecalibrated,
  graftFuturePlan: v2.graftFuturePlan,
  alignAutomaticOverlays: v2.alignAutomaticOverlays,
  vdotProposal: v2.vdotProposal,
  applyVdotProposal: v2.applyVdotProposal,
  undoVdotAdjustments: v2.undoVdotAdjustments,
  fitnessEvidence: v2.fitnessEvidence,
  planVdotNow: v2.planVdotNow,
  matchPlanRows: v2.matchPlanRows,
  recalibrationMinMeasurements: v2.RECALIBRATION_MIN_MEASUREMENTS,
  recalibrationThreshold: v2.RECALIBRATION_THRESHOLD,
  injuryProposal: v2.injuryProposal,
  applyInjuryProposal: v2.applyInjuryProposal,
  realignPlan: v2.realignPlan,
  workoutsForWatch: v2.workoutsForWatch,
  thresholdPace: v2.thresholdPace,
  weatherCard: v2.weatherCard,
  rpeTarget: v2.rpeTarget,
  paceForZone: v2.paceForZone,
  painStatus: v2.painStatus,
  acwrNow: v2.acwrNow,
  acwrPlan: v2.acwrPlan,
  readinessModel: v2.readinessModel,
  loadMeaning: v2.loadMeaning,
  wellnessSignals: v2.wellnessSignals,
  acwrBand: v2.acwrBand,
  acwrText: v2.acwrText,
  acwrPosition: v2.acwrPosition,
  ACWR_MAX: v2.ACWR_MAX,
  ACWR_RETURN: v2.ACWR_RETURN,
  ACWR_HIGH: v2.ACWR_HIGH,
  ACWR_SCALE: v2.ACWR_SCALE
} satisfies PlanGenerator;

/** 08b: pregled prilagođavanja plana 5K v2 iz činjenica (dnevnik, izmene + `ctx.facts`, dodatne prijavljene pauze).
 *  Ne upisuje ništa: plan za upis, razlozi v2 doslovno, promenjene nedelje, pokrivenost; ili odbijanje sa razlozima. */
export const fiveKV2AdaptPreview = (
  plan: GenPlanState,
  today: IsoDate,
  ctx: ReplanContext,
  extraBreaks: ReadonlyArray<{ from: string; to: string }> = []
) => v2.adaptPreview(v2.sourceOf(plan, today, ctx, extraBreaks));
/** 08b: promena cilja plana 5K v2 — isti treninzi, nova ocena cilja; ili odbijanje sa razlozima. */
export const fiveKV2GoalChange = (plan: GenPlanState, goalSec: number, today: IsoDate) =>
  v2.goalChange(plan, goalSec, today);
/** 08b: Napredak → Forma za plan 5K v2 (VDOT iz rezultata, ocena cilja); `null` kad plan nije v2. */
export const fiveKV2FormHistory = (src: {
  plan: GenPlanState;
  today: IsoDate;
  tests?: readonly T3kRecord[];
  log?: Readonly<Record<string, LogEntry>>;
}) => v2.formHistory(src);

/** Nov 5K plan generatorom v2 (čarobnjak uz uključen prekidač): plan za upis ili razlozi odbijanja v2. */
export const generateFiveKV2Plan = (input: StructuredPlanInput): StructuredPlanResult =>
  v2.generateStructured(input);
/** Prvi dan plana v2: cele nedelje koje se završavaju danom trke, ne pre `today`; `null` bez ispravnih datuma. */
export const fiveKV2Start = (raceDate: string, today: string): string | null =>
  v2.alignedStart(raceDate, today);

/* 10K v2 (segment 05): sopstveni generator 10K distance, biran po oznaci politike plana (`10k-v2`) — postojeći planovi
   (`10k-v1`, `legacy-10k`) od V1b nemaju generator (`LEGACY_PLAN`). Raspodela članova: (a) v2 sam
   (generisanje, oznake, faza, procena, proizvod, tempo/prag/napor, sat iz strukture); (b) adaptacija i predlog
   (segment 06) — kroz činjenice i `adaptTenKV2` sa pregledom pre upisa, bez zamene 10K v1 generatorom; (c) procena stanja
   i vreme — sopstvena kopija v2 sa istim vrednostima kao tenK (v. `tenK/v2/app/index.ts`).

   GRANICA FORMATA: adapter `tenK/v2/app/` ne uvozi ni tipove formata (strogi test izolacije 10K v2, bez izuzetka), pa
   plan koji PRAVI (dan sa strukturom van unije `Day`, `meta` sa poljima koja v2 zna) ovde dobija tip formata razmene —
   samo članovi koji prave plan: `generatePlan`, `adaptGeneratedPlan`, (06) `buildExecutionAdjustment`, `planWithNewGoal`,
   `graftFuturePlan` (i `generateTenKV2Plan`, `tenKV2AdaptPreview`, `tenKV2GoalChange` ispod). Svi ostali članovi prolaze
   `satisfies` bez kasta (parametri adaptera su širi, plan/izmene/lanac prolaze generički). */
const t2 = tenKV2;
export const TEN_K_V2_GENERATOR: PlanGenerator = {
  id: '10k',
  policyId: t2.POLICY_ID,
  policyVersion: t2.POLICY_VERSION,
  legacyPolicyId: t2.LEGACY_POLICY_ID,
  planPolicy: t2.planPolicy,
  stampPlan: t2.stampPlan,
  phaseOfWeek: t2.phaseOfWeek,
  classifyMeasurement: t2.classifyMeasurement,
  recomputeVdotChain: t2.recomputeVdotChain,
  sessionClassFor: t2.sessionClassFor,
  currentVdot: t2.currentVdot,
  generatePlan: (input) => t2.generatePlan(input) as unknown as PlanGenerationResult,
  adaptGeneratedPlan: (gen) => t2.adaptGeneratedPlan(gen) as unknown as GenPlanState | null,
  assess: t2.assess,
  product: t2.product,
  executionModel: t2.executionModel,
  executionBasis: t2.executionBasis,
  // 06: plan za upis pravi adapter (granica formata, v. gore).
  buildExecutionAdjustment: (current, today, analysis, options, context) =>
    t2.buildExecutionAdjustment(current, today, analysis, options, context) as unknown as
      { result: GenPlanState; notes: string[]; summary: string } | { error: string },
  buildRunWalkAdjustment: t2.buildRunWalkAdjustment,
  assessRunWalkProgress: t2.assessRunWalkProgress,
  qualityEntryGate: t2.qualityEntryGate,
  hasRecentMeasuredForm: t2.hasRecentMeasuredForm,
  // 06: isti treninzi, nova ocena cilja. Plan v2 nema ulaz čarobnjaka v1 (`ulaz`), pa ga rezultat ne nosi; pozivalac
  // ga spaja preko postojećeg plana (`{ ...genPlan, ...r }`) i ne čita ga.
  planWithNewGoal: (plan, sec, today) =>
    t2.planWithNewGoal(plan, sec, today) as unknown as GoalChangeResult | ReplanError,
  planRecalibrated: t2.planRecalibrated,
  graftFuturePlan: (plan, fresh, today, ctx) =>
    t2.graftFuturePlan(plan, fresh, today, ctx) as unknown as GenPlanState,
  alignAutomaticOverlays: t2.alignAutomaticOverlays,
  vdotProposal: t2.vdotProposal,
  applyVdotProposal: t2.applyVdotProposal,
  undoVdotAdjustments: t2.undoVdotAdjustments,
  fitnessEvidence: t2.fitnessEvidence,
  planVdotNow: t2.planVdotNow,
  matchPlanRows: t2.matchPlanRows,
  recalibrationMinMeasurements: t2.RECALIBRATION_MIN_MEASUREMENTS,
  recalibrationThreshold: t2.RECALIBRATION_THRESHOLD,
  injuryProposal: t2.injuryProposal,
  applyInjuryProposal: t2.applyInjuryProposal,
  realignPlan: t2.realignPlan,
  workoutsForWatch: t2.workoutsForWatch,
  thresholdPace: t2.thresholdPace,
  weatherCard: t2.weatherCard,
  rpeTarget: t2.rpeTarget,
  paceForZone: t2.paceForZone,
  painStatus: t2.painStatus,
  acwrNow: t2.acwrNow,
  acwrPlan: t2.acwrPlan,
  readinessModel: t2.readinessModel,
  loadMeaning: t2.loadMeaning,
  wellnessSignals: t2.wellnessSignals,
  acwrBand: t2.acwrBand,
  acwrText: t2.acwrText,
  acwrPosition: t2.acwrPosition,
  ACWR_MAX: t2.ACWR_MAX,
  ACWR_RETURN: t2.ACWR_RETURN,
  ACWR_HIGH: t2.ACWR_HIGH,
  ACWR_SCALE: t2.ACWR_SCALE
} satisfies PlanGenerator;

/** Nov 10K plan generatorom v2 (čarobnjak uz uključen prekidač): plan za upis ili razlozi odbijanja v2. */
export const generateTenKV2Plan = (input: TenKV2PlanInput): StructuredPlanResult =>
  t2.generateStructured(input) as unknown as StructuredPlanResult;
/** Prvi dan plana 10K v2: cele nedelje koje se završavaju danom trke, ne pre `today`; `null` bez ispravnih datuma. */
export const tenKV2Start = (raceDate: string, today: string): string | null =>
  t2.alignedStart(raceDate, today);

type TenKV2Preview = ReturnType<typeof t2.adaptPreview>;
/** Pregled prilagođavanja 10K v2 u tipu formata: plan za upis je `GenPlanState` (granica formata). */
export type TenKV2AdaptOutcome =
  | (Omit<Extract<TenKV2Preview, { ok: true }>, 'result'> & { result: GenPlanState })
  | Extract<TenKV2Preview, { ok: false }>;
/** 06: pregled prilagođavanja plana 10K v2 iz činjenica (dnevnik, izmene + `ctx.facts`, dodatne prijavljene pauze).
 *  Ne upisuje ništa: plan za upis, razlozi v2 doslovno, promenjene nedelje, pokrivenost; ili odbijanje sa razlozima. */
export const tenKV2AdaptPreview = (
  plan: GenPlanState,
  today: IsoDate,
  ctx: ReplanContext,
  extraBreaks: ReadonlyArray<{ from: string; to: string }> = []
): TenKV2AdaptOutcome =>
  t2.adaptPreview(t2.sourceOf(plan, today, ctx, extraBreaks)) as unknown as TenKV2AdaptOutcome;
type TenKV2Goal = ReturnType<typeof t2.goalChange>;
/** 06: promena cilja plana 10K v2 — isti treninzi, nova ocena cilja; ili odbijanje sa razlozima. */
export const tenKV2GoalChange = (
  plan: GenPlanState,
  goalSec: number,
  today: IsoDate
):
  | (Omit<Extract<TenKV2Goal, { ok: true }>, 'result'> & { result: GenPlanState })
  | Extract<TenKV2Goal, { ok: false }> =>
  t2.goalChange(plan, goalSec, today) as unknown as
    | (Omit<Extract<TenKV2Goal, { ok: true }>, 'result'> & { result: GenPlanState })
    | Extract<TenKV2Goal, { ok: false }>;
/** 06: Napredak → Forma za plan 10K v2 (VDOT iz rezultata, ocena cilja); `null` kad plan nije v2. */
export const tenKV2FormHistory = (src: {
  plan: GenPlanState;
  today: IsoDate;
  tests?: readonly T3kRecord[];
  log?: Readonly<Record<string, LogEntry>>;
}) => t2.formHistory(src);
/** 06: polje unosa dana testa 10K v2 sa vremenom 5 km [s] (činjenica rezultata za adaptaciju). */
export const TEN_K_V2_TEST_FIELD = t2.TEST_FIELD;

/** Faza 3 (3b): vraćanje sačuvane verzije DRUGE distance (plan pre predaje „kraća distanca") se izričito odbija — ništa
 *  se ne menja, razlog je u `meta.futureChanges.conflicts` (isti oblik kao odbijanje vraćanja u adapteru v2). */
export const RESTORE_OTHER_DISTANCE =
  'Sačuvana verzija je plan druge distance (pre izbora kraće distance), pa se ne može vratiti preko ovog plana.';
function sameDistanceGraft(
  graft: PlanGenerator['graftFuturePlan']
): PlanGenerator['graftFuturePlan'] {
  return (plan, fresh, today, ctx) => {
    const from = plan.meta?.raceDistM;
    const to = fresh.meta?.raceDistM;
    if (from === undefined || to === undefined || from === to)
      return graft(plan, fresh, today, ctx);
    return {
      ...plan,
      meta: { ...plan.meta, futureChanges: { changedDays: 0, conflicts: [RESTORE_OTHER_DISTANCE] } }
    } as GenPlanState;
  };
}

/** V1b: ugrađeni lični plan nema predaju „kraća distanca" (odluka o pripremi traži sačuvan `genPlan`, a lični plan ga
 *  nema — `stores/trainingStore.ts`), a v1 ciljevi 5K/10K više ne postoje: HM v1 dobija predaju bez cilja. */
const NO_SHORTER_HANDOFF = (): null => null;

/* HM v2 (segment HM-05): sopstveni generator polumaratona, biran po oznaci politike plana (`hm-v2`) — postojeći planovi
   (`hm-v1`, `legacy-hm`) od V1b nemaju generator (`LEGACY_PLAN`); ugrađeni lični plan vlasnika ostaje na
   `LEGACY_PERSONAL_GENERATOR`.
   Raspodela članova: (a) v2 sam (generisanje, oznake, faza, procena, proizvod, tempo/prag/napor, sat iz strukture);
   (b) adaptacija i predlog (segment HM-06) — kroz činjenice i `adaptHmV2` sa pregledom pre upisa, ili „ne koristi se" sa
   razlogom (`MEMBERS`), bez zamene HM v1 generatorom;
   (c) procena stanja i vreme — sopstvena kopija v2 sa istim vrednostima kao HM v1 (v. `halfMarathon/v2/app/index.ts`).
   Odluka o ograničenoj pripremi (`preparationForPlan`): HM v2 kao izvor predaje „kraća distanca" od faze 3 (3c, `hmV2Preparation`).

   GRANICA FORMATA (kao 10K v2): adapter `halfMarathon/v2/app/` ne uvozi ni tipove formata (strogi test izolacije HM v2,
   bez izuzetka), pa plan koji PRAVI (dan sa strukturom van unije `Day`, `meta` sa poljima koja v2 zna) ovde dobija tip
   formata razmene — samo članovi koji prave plan: `generatePlan`, `adaptGeneratedPlan`, (HM-06)
   `buildExecutionAdjustment`, `planWithNewGoal`, `graftFuturePlan` (i `generateHmV2Plan`, `hmV2AdaptPreview`,
   `hmV2GoalChange` ispod). Svi ostali članovi prolaze `satisfies` bez kasta. */
const h2 = hmV2;
export const HALF_MARATHON_V2_GENERATOR: PlanGenerator = {
  id: 'hm',
  policyId: h2.POLICY_ID,
  policyVersion: h2.POLICY_VERSION,
  legacyPolicyId: h2.LEGACY_POLICY_ID,
  planPolicy: h2.planPolicy,
  stampPlan: h2.stampPlan,
  phaseOfWeek: h2.phaseOfWeek,
  classifyMeasurement: h2.classifyMeasurement,
  recomputeVdotChain: h2.recomputeVdotChain,
  sessionClassFor: h2.sessionClassFor,
  currentVdot: h2.currentVdot,
  generatePlan: (input) => h2.generatePlan(input) as unknown as PlanGenerationResult,
  adaptGeneratedPlan: (gen) => h2.adaptGeneratedPlan(gen) as unknown as GenPlanState | null,
  assess: h2.assess,
  product: h2.product,
  executionModel: h2.executionModel,
  // 3c: osnova predaje (činjenice bez politike); ulaz plana po osećaju nema `pb` (tip formata daje granica).
  executionBasis: (current, today, analysis, options) =>
    h2.executionBasis(current, today, analysis, options) as unknown as ReturnType<
      PlanGenerator['executionBasis']
    >,
  // HM-06: plan za upis pravi adapter (granica formata, v. gore).
  buildExecutionAdjustment: (current, today, analysis, options, context) =>
    h2.buildExecutionAdjustment(current, today, analysis, options, context) as unknown as
      { result: GenPlanState; notes: string[]; summary: string } | { error: string },
  buildRunWalkAdjustment: h2.buildRunWalkAdjustment,
  assessRunWalkProgress: h2.assessRunWalkProgress,
  qualityEntryGate: h2.qualityEntryGate,
  hasRecentMeasuredForm: h2.hasRecentMeasuredForm,
  // HM-06: isti treninzi, nova ocena cilja. Plan v2 nema ulaz čarobnjaka v1 (`ulaz`), pa ga rezultat ne nosi; pozivalac
  // ga spaja preko postojećeg plana (`{ ...genPlan, ...r }`) i ne čita ga.
  planWithNewGoal: (plan, sec, today) =>
    h2.planWithNewGoal(plan, sec, today) as unknown as GoalChangeResult | ReplanError,
  planRecalibrated: h2.planRecalibrated,
  // 3b: verzija druge distance (pre predaje „kraća distanca") se ne vraća preko ovog plana.
  graftFuturePlan: sameDistanceGraft(
    (plan, fresh, today, ctx) =>
      h2.graftFuturePlan(plan, fresh, today, ctx) as unknown as GenPlanState
  ),
  alignAutomaticOverlays: h2.alignAutomaticOverlays,
  vdotProposal: h2.vdotProposal,
  applyVdotProposal: h2.applyVdotProposal,
  undoVdotAdjustments: h2.undoVdotAdjustments,
  fitnessEvidence: h2.fitnessEvidence,
  planVdotNow: h2.planVdotNow,
  matchPlanRows: h2.matchPlanRows,
  recalibrationMinMeasurements: h2.RECALIBRATION_MIN_MEASUREMENTS,
  recalibrationThreshold: h2.RECALIBRATION_THRESHOLD,
  injuryProposal: h2.injuryProposal,
  applyInjuryProposal: h2.applyInjuryProposal,
  realignPlan: h2.realignPlan,
  workoutsForWatch: h2.workoutsForWatch,
  thresholdPace: h2.thresholdPace,
  weatherCard: h2.weatherCard,
  rpeTarget: h2.rpeTarget,
  paceForZone: h2.paceForZone,
  painStatus: h2.painStatus,
  acwrNow: h2.acwrNow,
  acwrPlan: h2.acwrPlan,
  readinessModel: h2.readinessModel,
  loadMeaning: h2.loadMeaning,
  wellnessSignals: h2.wellnessSignals,
  acwrBand: h2.acwrBand,
  acwrText: h2.acwrText,
  acwrPosition: h2.acwrPosition,
  ACWR_MAX: h2.ACWR_MAX,
  ACWR_RETURN: h2.ACWR_RETURN,
  ACWR_HIGH: h2.ACWR_HIGH,
  ACWR_SCALE: h2.ACWR_SCALE
} satisfies PlanGenerator;

/** Nov plan polumaratona generatorom v2 (čarobnjak uz uključen prekidač): plan za upis ili razlozi odbijanja v2. */
export const generateHmV2Plan = (input: HmV2PlanInput): StructuredPlanResult =>
  h2.generateStructured(input) as unknown as StructuredPlanResult;
/** Prvi dan plana HM v2: cele nedelje koje se završavaju danom trke, ne pre `today`; `null` bez ispravnih datuma. */
export const hmV2Start = (raceDate: string, today: string): string | null =>
  h2.alignedStart(raceDate, today);

type HmV2Preview = ReturnType<typeof h2.adaptPreview>;
/** Pregled prilagođavanja HM v2 u tipu formata: plan za upis je `GenPlanState` (granica formata). */
export type HmV2AdaptOutcome =
  | (Omit<Extract<HmV2Preview, { ok: true }>, 'result'> & { result: GenPlanState })
  | Extract<HmV2Preview, { ok: false }>;
/** HM-06: pregled prilagođavanja plana HM v2 iz činjenica (dnevnik, izmene + `ctx.facts`, dodatne prijavljene pauze).
 *  Ne upisuje ništa: plan za upis, razlozi v2 doslovno, promenjene nedelje, pokrivenost, traka; ili odbijanje. */
export const hmV2AdaptPreview = (
  plan: GenPlanState,
  today: IsoDate,
  ctx: ReplanContext,
  extraBreaks: ReadonlyArray<{ from: string; to: string }> = []
): HmV2AdaptOutcome =>
  h2.adaptPreview(h2.sourceOf(plan, today, ctx, extraBreaks)) as unknown as HmV2AdaptOutcome;
type HmV2Goal = ReturnType<typeof h2.goalChange>;
type HmV2GoalOutcome =
  | (Omit<Extract<HmV2Goal, { ok: true }>, 'result'> & { result: GenPlanState })
  | Extract<HmV2Goal, { ok: false }>;
/** HM-06: promena cilja plana HM v2 — isti treninzi, nova ocena cilja; ili odbijanje sa razlozima. */
export const hmV2GoalChange = (
  plan: GenPlanState,
  goalSec: number,
  today: IsoDate
): HmV2GoalOutcome => h2.goalChange(plan, goalSec, today) as unknown as HmV2GoalOutcome;
/** HM-06: Napredak → Forma za plan HM v2 (VDOT iz rezultata, ocena cilja); `null` kad plan nije v2. */
export const hmV2FormHistory = (src: {
  plan: GenPlanState;
  today: IsoDate;
  log?: Readonly<Record<string, LogEntry>>;
}) => h2.formHistory(src);
/** HM-06: polje unosa dana testa HM v2 sa vremenom 5 km [s] (činjenica rezultata za adaptaciju). */
export const HM_V2_TEST_FIELD = h2.TEST_FIELD;

/* V1b: zamrznut HM v1 (`halfMarathon/` van `v2/`, kod se ne menja) — SAMO za ugrađeni lični plan vlasnika
   (`meta.licni === true`, `generatorForPlan`); nijedan drugi plan ni nov plan ga ne dobija. Dokaz istog ponašanja:
   `personalPlan.node.test.ts` (`personal-reference.json.gz`). Briše se u V1c (posle trke 13. 12. 2026). */
export const LEGACY_PERSONAL_GENERATOR: PlanGenerator = {
  id: 'hm',
  policyId: halfMarathon.POLICY_ID,
  policyVersion: halfMarathon.POLICY_VERSION,
  legacyPolicyId: halfMarathon.LEGACY_POLICY_ID,
  planPolicy: halfMarathon.planPolicy,
  stampPlan: halfMarathon.stampPlan,
  phaseOfWeek: halfMarathon.phaseOfWeek,
  classifyMeasurement: halfMarathon.classifyMeasurement,
  recomputeVdotChain: halfMarathon.recomputeVdotChain,
  sessionClassFor: halfMarathon.sessionClassFor,
  currentVdot: halfMarathon.currentVdot,
  generatePlan: halfMarathon.generatePlan,
  adaptGeneratedPlan: halfMarathon.adaptGeneratedPlan,
  assess: halfMarathon.assess,
  product: (raceDistM) =>
    raceDistM === halfMarathon.HALF_MARATHON_DISTANCE_M
      ? halfMarathon.HALF_MARATHON_PRODUCT
      : undefined,
  executionModel: halfMarathon.executionModel,
  executionBasis: halfMarathon.executionBasis,
  buildExecutionAdjustment: (current, today, analysis, options, context) =>
    halfMarathon.buildExecutionAdjustment(
      current,
      today,
      analysis,
      options,
      context,
      NO_SHORTER_HANDOFF
    ),
  buildRunWalkAdjustment: halfMarathon.buildRunWalkAdjustment,
  assessRunWalkProgress: halfMarathon.assessRunWalkProgress,
  qualityEntryGate: halfMarathon.qualityEntryGate,
  hasRecentMeasuredForm: halfMarathon.hasRecentMeasuredForm,
  planWithNewGoal: halfMarathon.planWithNewGoal,
  planRecalibrated: halfMarathon.planRecalibrated,
  graftFuturePlan: halfMarathon.graftFuturePlan,
  alignAutomaticOverlays: halfMarathon.alignAutomaticOverlays,
  vdotProposal: halfMarathon.vdotProposal,
  applyVdotProposal: halfMarathon.applyVdotProposal,
  undoVdotAdjustments: halfMarathon.undoVdotAdjustments,
  fitnessEvidence: halfMarathon.fitnessEvidence,
  planVdotNow: halfMarathon.planVdotNow,
  matchPlanRows: halfMarathon.matchPlanRows,
  recalibrationMinMeasurements: halfMarathon.VDOT_PROPOSAL_MIN_MEASUREMENTS,
  recalibrationThreshold: halfMarathon.VDOT_PROPOSAL_THRESHOLD,
  injuryProposal: halfMarathon.injuryProposal,
  applyInjuryProposal: halfMarathon.applyInjuryProposal,
  realignPlan: halfMarathon.realignPlan,
  workoutsForWatch: halfMarathon.workoutsForWatch,
  thresholdPace: halfMarathon.thresholdPace,
  weatherCard: halfMarathon.weatherCard,
  rpeTarget: halfMarathon.rpeTarget,
  paceForZone: halfMarathon.paceForZone,
  painStatus: halfMarathon.painStatus,
  acwrNow: halfMarathon.acwrNow,
  acwrPlan: halfMarathon.acwrPlan,
  readinessModel: halfMarathon.readinessModel,
  loadMeaning: halfMarathon.loadMeaning,
  wellnessSignals: halfMarathon.wellnessSignals,
  acwrBand: halfMarathon.acwrBand,
  acwrText: halfMarathon.acwrText,
  acwrPosition: halfMarathon.acwrPosition,
  ACWR_MAX: halfMarathon.ACWR_MAX,
  ACWR_RETURN: halfMarathon.ACWR_RETURN,
  ACWR_HIGH: halfMarathon.ACWR_HIGH,
  ACWR_SCALE: halfMarathon.ACWR_SCALE
} satisfies PlanGenerator;

/* Maraton v2 (segment MAR-05): sopstveni generator maratona, biran po oznaci politike plana (`marathon-v2`) — postojeći
   planovi (`marathon-v1`, `legacy-marathon`) od V1b nemaju generator (`LEGACY_PLAN`).
   Raspodela članova: (a) v2 sam (generisanje, oznake, faza, procena, proizvod, tempo/prag/napor, sat iz strukture);
   (b) adaptacija i predlog (segment MAR-06) — kroz činjenice i `adaptMarathonV2` sa pregledom pre upisa, ili „ne
   koristi se" sa razlogom (`MEMBERS`), bez zamene maraton v1 generatorom; (c) procena stanja i vreme — sopstvena kopija v2 sa istim vrednostima kao maraton v1 (v.
   `marathon/v2/app/index.ts`). Odluka o ograničenoj pripremi (`preparationForPlan`): maraton v2 kao izvor predaje
   „kraća distanca" od faze 3 (3e, `marathonV2Preparation`).

   GRANICA FORMATA (kao HM v2): adapter `marathon/v2/app/` ne uvozi ni tipove formata (strogi test izolacije maratona
   v2, bez izuzetka), pa plan koji PRAVI (dan sa strukturom van unije `Day`, `meta` sa poljima koja v2 zna) ovde dobija
   tip formata razmene — samo članovi koji prave plan: `generatePlan`, `adaptGeneratedPlan`, (MAR-06)
   `buildExecutionAdjustment`, `planWithNewGoal`, `graftFuturePlan` (i `generateMarathonV2Plan`,
   `marathonV2AdaptPreview`, `marathonV2GoalChange` ispod). Svi ostali članovi prolaze `satisfies` bez kasta. */
const m2 = marathonV2;
export const MARATHON_V2_GENERATOR: PlanGenerator = {
  id: 'marathon',
  policyId: m2.POLICY_ID,
  policyVersion: m2.POLICY_VERSION,
  legacyPolicyId: m2.LEGACY_POLICY_ID,
  planPolicy: m2.planPolicy,
  stampPlan: m2.stampPlan,
  phaseOfWeek: m2.phaseOfWeek,
  classifyMeasurement: m2.classifyMeasurement,
  recomputeVdotChain: m2.recomputeVdotChain,
  sessionClassFor: m2.sessionClassFor,
  currentVdot: m2.currentVdot,
  generatePlan: (input) => m2.generatePlan(input) as unknown as PlanGenerationResult,
  adaptGeneratedPlan: (gen) => m2.adaptGeneratedPlan(gen) as unknown as GenPlanState | null,
  assess: m2.assess,
  product: m2.product,
  executionModel: m2.executionModel,
  // 3e: osnova predaje (činjenice bez politike); ulaz plana po osećaju nema `pb` (tip formata daje granica).
  executionBasis: (current, today, analysis, options) =>
    m2.executionBasis(current, today, analysis, options) as unknown as ReturnType<
      PlanGenerator['executionBasis']
    >,
  // MAR-06: plan za upis pravi adapter (granica formata, v. gore).
  buildExecutionAdjustment: (current, today, analysis, options, context) =>
    m2.buildExecutionAdjustment(current, today, analysis, options, context) as unknown as
      { result: GenPlanState; notes: string[]; summary: string } | { error: string },
  buildRunWalkAdjustment: m2.buildRunWalkAdjustment,
  assessRunWalkProgress: m2.assessRunWalkProgress,
  qualityEntryGate: m2.qualityEntryGate,
  hasRecentMeasuredForm: m2.hasRecentMeasuredForm,
  // MAR-06: isti treninzi, nova ocena cilja. Plan v2 nema ulaz čarobnjaka v1 (`ulaz`), pa ga rezultat ne nosi;
  // pozivalac ga spaja preko postojećeg plana (`{ ...genPlan, ...r }`) i ne čita ga.
  planWithNewGoal: (plan, sec, today) =>
    m2.planWithNewGoal(plan, sec, today) as unknown as GoalChangeResult | ReplanError,
  planRecalibrated: m2.planRecalibrated,
  // 3b: verzija druge distance (pre predaje „kraća distanca") se ne vraća preko ovog plana.
  graftFuturePlan: sameDistanceGraft(
    (plan, fresh, today, ctx) =>
      m2.graftFuturePlan(plan, fresh, today, ctx) as unknown as GenPlanState
  ),
  alignAutomaticOverlays: m2.alignAutomaticOverlays,
  vdotProposal: m2.vdotProposal,
  applyVdotProposal: m2.applyVdotProposal,
  undoVdotAdjustments: m2.undoVdotAdjustments,
  fitnessEvidence: m2.fitnessEvidence,
  planVdotNow: m2.planVdotNow,
  matchPlanRows: m2.matchPlanRows,
  recalibrationMinMeasurements: m2.RECALIBRATION_MIN_MEASUREMENTS,
  recalibrationThreshold: m2.RECALIBRATION_THRESHOLD,
  injuryProposal: m2.injuryProposal,
  applyInjuryProposal: m2.applyInjuryProposal,
  realignPlan: m2.realignPlan,
  workoutsForWatch: m2.workoutsForWatch,
  thresholdPace: m2.thresholdPace,
  weatherCard: m2.weatherCard,
  rpeTarget: m2.rpeTarget,
  paceForZone: m2.paceForZone,
  painStatus: m2.painStatus,
  acwrNow: m2.acwrNow,
  acwrPlan: m2.acwrPlan,
  readinessModel: m2.readinessModel,
  loadMeaning: m2.loadMeaning,
  wellnessSignals: m2.wellnessSignals,
  acwrBand: m2.acwrBand,
  acwrText: m2.acwrText,
  acwrPosition: m2.acwrPosition,
  ACWR_MAX: m2.ACWR_MAX,
  ACWR_RETURN: m2.ACWR_RETURN,
  ACWR_HIGH: m2.ACWR_HIGH,
  ACWR_SCALE: m2.ACWR_SCALE
} satisfies PlanGenerator;

/** Nov plan maratona generatorom v2 (čarobnjak uz uključen prekidač): plan za upis ili razlozi odbijanja v2. */
export const generateMarathonV2Plan = (input: MarathonV2PlanInput): StructuredPlanResult =>
  m2.generateStructured(input) as unknown as StructuredPlanResult;
/** Prvi dan plana maratona v2: cele nedelje koje se završavaju danom trke, ne pre `today`; `null` bez ispravnih
 *  datuma. */
export const marathonV2Start = (raceDate: string, today: string): string | null =>
  m2.alignedStart(raceDate, today);

type MarathonV2Preview = ReturnType<typeof m2.adaptPreview>;
/** Pregled prilagođavanja maratona v2 u tipu formata: plan za upis je `GenPlanState` (granica formata). */
export type MarathonV2AdaptOutcome =
  | (Omit<Extract<MarathonV2Preview, { ok: true }>, 'result'> & { result: GenPlanState })
  | Extract<MarathonV2Preview, { ok: false }>;
/** MAR-06: pregled prilagođavanja plana maratona v2 iz činjenica (dnevnik, izmene + `ctx.facts`, dodatne prijavljene
 *  pauze). Ne upisuje ništa: plan za upis, razlozi v2 doslovno, promenjene nedelje, pokrivenost, traka; ili odbijanje. */
export const marathonV2AdaptPreview = (
  plan: GenPlanState,
  today: IsoDate,
  ctx: ReplanContext,
  extraBreaks: ReadonlyArray<{ from: string; to: string }> = []
): MarathonV2AdaptOutcome =>
  m2.adaptPreview(m2.sourceOf(plan, today, ctx, extraBreaks)) as unknown as MarathonV2AdaptOutcome;
type MarathonV2Goal = ReturnType<typeof m2.goalChange>;
type MarathonV2GoalOutcome =
  | (Omit<Extract<MarathonV2Goal, { ok: true }>, 'result'> & { result: GenPlanState })
  | Extract<MarathonV2Goal, { ok: false }>;
/** MAR-06: promena cilja plana maratona v2 — isti treninzi, nova ocena cilja; ili odbijanje sa razlozima. */
export const marathonV2GoalChange = (
  plan: GenPlanState,
  goalSec: number,
  today: IsoDate
): MarathonV2GoalOutcome => m2.goalChange(plan, goalSec, today) as unknown as MarathonV2GoalOutcome;
/** MAR-06: Napredak → Forma za plan maratona v2 (VDOT iz rezultata, ocena cilja); `null` kad plan nije v2. */
export const marathonV2FormHistory = (src: {
  plan: GenPlanState;
  today: IsoDate;
  log?: Readonly<Record<string, LogEntry>>;
}) => m2.formHistory(src);
/** MAR-06: polje unosa dana testa maratona v2 sa vremenom 5 km [s] (činjenica rezultata za adaptaciju). */
export const MARATHON_V2_TEST_FIELD = m2.TEST_FIELD;

/* ============================================================
   IZBOR
   ============================================================ */

const DISTANCE = { '5k': 5000, '10k': 10000, hm: 21097.5, marathon: 42195 } as const;

/** Generator za ciljnu distancu ulaza; `undefined`/0 je 5K (`raceDistM || 5000`); ostalo `null`. */
export function generatorIdFor(raceDistM: unknown): GeneratorId | null {
  const dist = (raceDistM as number) || 5000;
  if (dist === DISTANCE['5k']) return '5k';
  if (dist === DISTANCE['10k']) return '10k';
  if (dist === DISTANCE.hm) return 'hm';
  if (dist === DISTANCE.marathon) return 'marathon';
  return null;
}

/** V1b: jedini generatori za nov plan i za sačuvan plan (osim ličnog plana vlasnika). */
const GENERATORS: Readonly<Record<GeneratorId, PlanGenerator>> = {
  '5k': FIVE_K_V2_GENERATOR,
  '10k': TEN_K_V2_GENERATOR,
  hm: HALF_MARATHON_V2_GENERATOR,
  marathon: MARATHON_V2_GENERATOR
};

/** Generator (v2) ciljne distance ili `null` kad distanca nije podržana (pozivalac to prikazuje, bez zamene). */
export function generatorForDistance(raceDistM: unknown): PlanGenerator | null {
  const id = generatorIdFor(raceDistM);
  return id ? GENERATORS[id] : null;
}

/** Generator za NOV plan (čarobnjak, predaja „kraća distanca"): v2 te distance. */
export const generatorForNewPlan = (raceDistM: unknown): PlanGenerator | null =>
  generatorForDistance(raceDistM);

/** Ugrađeni lični plan vlasnika (`domain/personal`, `meta.licni`). */
export const isPersonalPlan = (plan: GenPlanState | null | undefined): boolean =>
  (plan?.meta as { licni?: unknown } | undefined)?.licni === true;

/** Oznake politike koje su pisali obrisani v1 generatori (i oznaka „bez oznake" starijih planova). */
const LEGACY_POLICY_IDS: readonly string[] = [
  '5k-v1',
  '10k-v1',
  'hm-v1',
  'marathon-v1',
  'legacy-5k',
  'legacy-10k',
  'legacy-hm',
  'legacy-marathon'
];

/** Distanca plana iz `meta`, pa iz sačuvanog ulaza. */
const planDistance = (plan: GenPlanState): unknown =>
  plan.meta?.raceDistM ?? (plan.ulaz as { raceDistM?: unknown } | null | undefined)?.raceDistM;

/**
 * V1b: plan starog (v1) generatora — podržana distanca, nije lični plan vlasnika, a oznaka politike je prazna ili oznaka
 * v1. Takav plan se prikazuje i unos radi (prikaz je u `domain/plan`, nezavisan od generatora), ali ga nijedan generator
 * ne prilagođava (`generatorForPlan` → `null`, razlog `LEGACY_PLAN`). Stanje se ne migrira.
 */
export function isLegacyPlan(plan: GenPlanState | null | undefined): boolean {
  if (!plan || isPersonalPlan(plan) || !generatorIdFor(planDistance(plan))) return false;
  const id = plan.meta?.['policyId'];
  return id == null || (typeof id === 'string' && LEGACY_POLICY_IDS.includes(id));
}

/**
 * Generator koji odgovara za plan. Za zamenu plana drugim (vraćanje verzije, regeneracija na drugoj distanci) bira se po
 * planu KOJI SE UPISUJE, jer njegova trenerska obrada pripada njemu. Za plan u prikazu prosleđuje se AKTIVNI plan
 * (uključujući ugrađeni lični plan). `null`: nema plana, distanca nije podržana, plan starog generatora (`isLegacyPlan`)
 * ili plan nosi oznaku politike koju generator te distance ne poznaje (A7: bez tihe zamene; razlog daje
 * `unsupportedPlanReason`).
 */
export function generatorForPlan(plan: GenPlanState | null | undefined): PlanGenerator | null {
  if (!plan) return null;
  if (isPersonalPlan(plan))
    return LEGACY_PERSONAL_GENERATOR.planPolicy(plan).status === 'unknown'
      ? null
      : LEGACY_PERSONAL_GENERATOR;
  const generator = generatorForDistance(planDistance(plan));
  if (!generator || isLegacyPlan(plan)) return null;
  return generator.planPolicy(plan).status === 'current' ? generator : null;
}

/** Faza 3: cilj „kraće distance" za izvor v2 (5K v2, 10K v2, HM v2) — v2 `handoffFuture` te distance. */
type V2Target = typeof v2.handoffFuture;

/**
 * „Kraća distanca" za IZVOR v2 (HM v2, maraton v2): cilj je uvek v2 te distance — HM v2 (3f), 5K v2 i 10K v2 (3d)
 * (`handoffFuture`: generate + adapt iz činjenica, prefiks nedelja izvora). Format izvora (`SourceFormat`) cilj v2 ne
 * koristi; ostaje u potpisu jer ga izvor prosleđuje. Distanca bez v2 cilja (maraton kao „kraća") → `null`.
 */
export function shorterHandoffForV2Source(
  _format?: SourceFormat
): (raceDistM: number | undefined) => V2Target | null {
  return (raceDistM) => {
    const target = generatorForNewPlan(raceDistM || 5000);
    if (target === HALF_MARATHON_V2_GENERATOR) return h2.handoffFuture as unknown as V2Target;
    if (target === FIVE_K_V2_GENERATOR) return v2.handoffFuture;
    if (target === TEN_K_V2_GENERATOR) return t2.handoffFuture as unknown as V2Target;
    return null;
  };
}

/** 08b: plan 5K v2 (prilagođavanje kroz činjenice i pregled v2). */
export function isFiveKV2Plan(plan: GenPlanState | null | undefined): boolean {
  return generatorForPlan(plan) === FIVE_K_V2_GENERATOR && v2.isV2Plan(plan);
}

/** Segment 05: plan 10K v2 (nosi izlaz v2 i tekuću oznaku `10k-v2`). */
export function isTenKV2Plan(plan: GenPlanState | null | undefined): boolean {
  return generatorForPlan(plan) === TEN_K_V2_GENERATOR && t2.isV2Plan(plan);
}

/** Segment HM-05: plan HM v2 (nosi izlaz v2 i tekuću oznaku `hm-v2`). */
export function isHmV2Plan(plan: GenPlanState | null | undefined): boolean {
  return generatorForPlan(plan) === HALF_MARATHON_V2_GENERATOR && h2.isV2Plan(plan);
}

/** Segment MAR-05: plan maratona v2 (nosi izlaz v2 i tekuću oznaku `marathon-v2`). */
export function isMarathonV2Plan(plan: GenPlanState | null | undefined): boolean {
  return generatorForPlan(plan) === MARATHON_V2_GENERATOR && m2.isV2Plan(plan);
}

/** Uvoz (Strava/icu): plan v2 čiji uvoz beleži trčanja van plana i potpunu sinhronizaciju (5K v2 08c, 10K v2, HM v2,
 *  maraton v2). */
export function tracksOffPlanRuns(plan: GenPlanState | null | undefined): boolean {
  return isFiveKV2Plan(plan) || isTenKV2Plan(plan) || isHmV2Plan(plan) || isMarathonV2Plan(plan);
}

/** Poruka za plan čiju je politiku upisala verzija generatora koju ova aplikacija ne poznaje. */
export const UNKNOWN_POLICY =
  'Plan je napravila verzija generatora koju ova aplikacija ne poznaje, pa ga postojeći generator ne prilagođava umesto nje. Ažuriraj aplikaciju ili napravi novi plan.';

/** V1b: poruka za plan starog generatora (`isLegacyPlan`); uz nju ekran nudi „Generiši nov plan". */
export const LEGACY_PLAN =
  'Plan je napravljen starim generatorom: prikazuje se, ali se više ne prilagođava.';

/** Oznaka politike plana prema generatoru koji ga obrađuje; plan starog generatora je `legacy`; `null` kad distanca
 *  nije podržana. */
export function planPolicyOf(plan: GenPlanState | null | undefined): PolicyStatus | null {
  if (!plan) return null;
  if (isPersonalPlan(plan)) return LEGACY_PERSONAL_GENERATOR.planPolicy(plan);
  const generator = generatorForDistance(planDistance(plan));
  if (!generator) return null;
  if (isLegacyPlan(plan)) {
    const id = plan.meta?.['policyId'];
    return {
      status: 'legacy',
      policyId: typeof id === 'string' ? id : `legacy-${generator.id}`,
      policyVersion: null
    };
  }
  return generator.planPolicy(plan);
}

/** Zašto plan nema generator (`generatorForPlan` je `null`): plan starog generatora, nepoznata verzija politike ili
 *  nepodržana distanca. */
export function unsupportedPlanReason(plan: GenPlanState | null | undefined): string {
  const policy = planPolicyOf(plan);
  if (policy?.status === 'legacy') return LEGACY_PLAN;
  return policy?.status === 'unknown' ? UNKNOWN_POLICY : UNSUPPORTED_DISTANCE;
}

/**
 * Plan za upis (novi plan, revizija posle prilagođavanja): generator plana upisuje fazu svake nedelje i oznaku svoje
 * politike (`stampPlan`, A3/A7). Plan bez generatora se upisuje nepromenjen (pozivalac ga je već odbio ili prikazuje).
 */
export function stampForStorage<P extends GenPlanState>(plan: P): P {
  return generatorForPlan(plan)?.stampPlan(plan) ?? plan;
}

/**
 * Faza nedelje za prikaz: upisana odluka generatora plana; plan bez polja dobija fazu funkcijom generatora tog plana.
 * Plan starog generatora: upisana faza, a bez nje ista funkcija koju su koristili v1 generatori (`legacyWeekPhase`), pa
 * se prikaz starog plana ne menja. Bez generatora (nepodržana distanca, nepoznata politika) faza je prazna.
 */
export function phaseReaderFor(
  plan: GenPlanState | null | undefined
): (w: Parameters<PlanGenerator['phaseOfWeek']>[0], totalWeeks: number) => WeekPhase {
  const generator = generatorForPlan(plan);
  if (generator) return (w, total) => generator.phaseOfWeek(w, total);
  return isLegacyPlan(plan) ? legacyWeekPhase : () => '';
}

const PHASES: readonly string[] = ['DELOAD', 'TRKA', 'TAPER', 'BAZA', 'RAZVOJ', 'VRHUNAC', ''];

/** Prikaz faze nedelje starog plana: doslovna kopija `phaseOfWeek`/`weekPhase` obrisanih v1 generatora (isti kod u sva
 *  četiri; `halfMarathon/plan/policy.ts`, `describe.ts`) — upisana faza, inače položaj nedelje u planu. */
export function legacyWeekPhase(
  w: Parameters<PlanGenerator['phaseOfWeek']>[0],
  totalWeeks: number
): WeekPhase {
  if (w && typeof w.phase === 'string' && PHASES.includes(w.phase)) return w.phase as WeekPhase;
  if (!w) return '';
  if (w.deload || /^DELOAD/i.test(String(w.focus || ''))) return 'DELOAD';
  const n = w.w;
  const T = totalWeeks || 1;
  if (n >= T) return 'TRKA';
  if (n >= T - 1 || w.taper || /^Taper/i.test(String(w.focus || ''))) return 'TAPER';
  const frac = n / T;
  if (frac <= 0.3) return 'BAZA';
  if (frac <= 0.65) return 'RAZVOJ';
  return 'VRHUNAC';
}

/** Proizvodni podaci (ime, preporučene nedelje) generatora te distance; `undefined` kad distanca nije podržana. */
export const productFor = (raceDistM: number): DistanceProduct | undefined =>
  generatorForDistance(raceDistM)?.product(raceDistM);

/* ODLUKA O OGRANIČENOJ PRIPREMI (produženje, kraća distanca, povratni režim) nad sačuvanim planom. Postoji samo za HM v2
   i maraton v2 (izvor predaje); 5K/10K je nemaju, pa za njih `preparationForPlan` vraća `null`. Lični plan vlasnika je
   nema (traži sačuvan `genPlan`), a plan starog generatora nema generator. */

/** Faza 3 (3c): odluka o pripremi plana HM v2 kao IZVORA predaje „kraća distanca" (okidač i opcije su HM v2,
 *  `halfMarathon/v2/shorter.ts` i `app/preparation.ts`); cilj je v2 te distance (`shorterHandoffForV2Source`). Politika
 *  izvora se ne predaje (`policy: null`). */
export function hmV2Preparation(): PreparationApi {
  const handoff = shorterHandoffForV2Source(h2.SOURCE_FORMAT);
  return {
    basisFromPlan: (current, today) =>
      h2.basisFromPlan(current, today) as unknown as DecisionBasis | null,
    preparationDecision: (current, today, basis, context, status, delivered) =>
      h2.preparationDecision(
        current,
        today,
        basis as never,
        context,
        status,
        delivered,
        handoff as never
      ) as unknown as PreparationDecision,
    buildPreparationChoice: (current, today, basis, choice, context) =>
      h2.buildPreparationChoice(
        current,
        today,
        basis as never,
        choice,
        context,
        handoff as never
      ) as unknown as ChoiceResult | { error: string },
    isLimitedLongPreparation: (meta, plan) => h2.isLimitedLongPreparation(meta, plan)
  } satisfies PreparationApi;
}

/** Faza 3 (3e): odluka o pripremi plana maratona v2 kao IZVORA predaje „kraća distanca" (okidač i opcije su maraton v2,
 *  `marathon/v2/shorter.ts` i `app/preparation.ts`); cilj je v2 te distance (`shorterHandoffForV2Source`). Politika
 *  izvora se ne predaje (`policy: null`). */
export function marathonV2Preparation(): PreparationApi {
  const handoff = shorterHandoffForV2Source(m2.SOURCE_FORMAT);
  return {
    basisFromPlan: (current, today) =>
      m2.basisFromPlan(current, today) as unknown as DecisionBasis | null,
    preparationDecision: (current, today, basis, context, status, delivered) =>
      m2.preparationDecision(
        current,
        today,
        basis as never,
        context,
        status,
        delivered,
        handoff as never
      ) as unknown as PreparationDecision,
    buildPreparationChoice: (current, today, basis, choice, context) =>
      m2.buildPreparationChoice(
        current,
        today,
        basis as never,
        choice,
        context,
        handoff as never
      ) as unknown as ChoiceResult | { error: string },
    isLimitedLongPreparation: (meta, plan) => m2.isLimitedLongPreparation(meta, plan)
  } satisfies PreparationApi;
}

/** Odluka o pripremi za plan: HM v2 (3c) ili maraton v2 (3e); ostali planovi `null`. */
export function preparationForPlan(plan: GenPlanState | null | undefined): PreparationApi | null {
  const generator = generatorForPlan(plan);
  if (generator === HALF_MARATHON_V2_GENERATOR) return hmV2Preparation();
  if (generator === MARATHON_V2_GENERATOR) return marathonV2Preparation();
  return null;
}
