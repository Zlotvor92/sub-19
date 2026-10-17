/* ============================================================
   IZBOR GENERATORA — aplikacioni sloj, bez trenerskih odluka.

   Jedina odluka ovde je KOJI od četiri nezavisna generatora odgovara za plan: po ciljnoj distanci ulaza (novi plan,
   regeneracija) ili po distanci aktivnog plana (adaptacija nad sačuvanim ili ugrađenim planom). Sav proračun radi
   izabrani generator; ovde nema podrazumevanog generatora ni zamene jednog drugim.

   - 5K → `./fiveK`; 10K → `./tenK`; polumaraton → `./halfMarathon`; maraton → `./marathon` (tačne vrednosti distance).
   - Ulaz bez distance (ili sa 0) je 5K — isto pravilo kao stari generator (`raceDistM || 5000`); to nije zamena
     generatora, već čitanje ulaza koji distancu ne navodi.
   - Svaka druga distanca nema generator: `generatorForDistance`/`generatorForPlan` vraćaju `null`, a pozivalac to
     EKSPLICITNO prikazuje (`UNSUPPORTED_DISTANCE`). Stari zajednički mehanizam više ne postoji kao rezerva (segment 5/5).
   - Ugrađeni lični plan vlasnika (u store-u `genPlan === null`) bira se po aktivnom planu (`activeGenPlan()`), čija
     je distanca polumaraton → HM generator (dokaz istog ponašanja: `personalPlan.node.test.ts`).

   Predaja između generatora ide SAMO ovuda: HM opciju „kraća distanca" (10K/5K) i maratonsku (polumaraton/10K) pravi
   generator te distance, a HM/maraton je dobijaju kao argument (`ShorterDistanceHandoff` iz `./handoff.ts`), bez
   međusobnog uvoza generatora.
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
  VdotProposal,
  WatchBatch,
  WeatherCardInput,
  WeatherCardModel,
  Zone
} from './contract';
import * as fiveK from './fiveK';
import * as halfMarathon from './halfMarathon';
import { regeneratorForDistance } from './handoff';
import * as marathon from './marathon';
import * as tenK from './tenK';

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
  isLimitedLongPreparation: (meta: GenPlanState['meta'] | undefined) => boolean;
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

export const FIVE_K_GENERATOR: PlanGenerator = {
  id: '5k',
  policyId: fiveK.POLICY_ID,
  policyVersion: fiveK.POLICY_VERSION,
  legacyPolicyId: fiveK.LEGACY_POLICY_ID,
  planPolicy: fiveK.planPolicy,
  stampPlan: fiveK.stampPlan,
  phaseOfWeek: fiveK.phaseOfWeek,
  classifyMeasurement: fiveK.classifyMeasurement,
  recomputeVdotChain: fiveK.recomputeVdotChain,
  sessionClassFor: fiveK.sessionClassFor,
  currentVdot: fiveK.currentVdot,
  generatePlan: fiveK.generatePlan,
  adaptGeneratedPlan: fiveK.adaptGeneratedPlan,
  assess: fiveK.assess,
  product: (raceDistM) =>
    raceDistM === fiveK.FIVE_K_DISTANCE_M ? fiveK.FIVE_K_PRODUCT : undefined,
  executionModel: fiveK.executionModel,
  executionBasis: fiveK.executionBasis,
  buildExecutionAdjustment: fiveK.buildExecutionAdjustment,
  buildRunWalkAdjustment: fiveK.buildRunWalkAdjustment,
  assessRunWalkProgress: fiveK.assessRunWalkProgress,
  qualityEntryGate: fiveK.qualityEntryGate,
  hasRecentMeasuredForm: fiveK.hasRecentMeasuredForm,
  planWithNewGoal: fiveK.planWithNewGoal,
  planRecalibrated: fiveK.planRecalibrated,
  graftFuturePlan: fiveK.graftFuturePlan,
  alignAutomaticOverlays: fiveK.alignAutomaticOverlays,
  vdotProposal: fiveK.vdotProposal,
  applyVdotProposal: fiveK.applyVdotProposal,
  undoVdotAdjustments: fiveK.undoVdotAdjustments,
  fitnessEvidence: fiveK.fitnessEvidence,
  planVdotNow: fiveK.planVdotNow,
  matchPlanRows: fiveK.matchPlanRows,
  recalibrationMinMeasurements: fiveK.VDOT_PROPOSAL_MIN_MEASUREMENTS,
  recalibrationThreshold: fiveK.VDOT_PROPOSAL_THRESHOLD,
  injuryProposal: fiveK.injuryProposal,
  applyInjuryProposal: fiveK.applyInjuryProposal,
  realignPlan: fiveK.realignPlan,
  workoutsForWatch: fiveK.workoutsForWatch,
  thresholdPace: fiveK.thresholdPace,
  weatherCard: fiveK.weatherCard,
  rpeTarget: fiveK.rpeTarget,
  paceForZone: fiveK.paceForZone,
  painStatus: fiveK.painStatus,
  acwrNow: fiveK.acwrNow,
  acwrPlan: fiveK.acwrPlan,
  readinessModel: fiveK.readinessModel,
  loadMeaning: fiveK.loadMeaning,
  wellnessSignals: fiveK.wellnessSignals,
  acwrBand: fiveK.acwrBand,
  acwrText: fiveK.acwrText,
  acwrPosition: fiveK.acwrPosition,
  ACWR_MAX: fiveK.ACWR_MAX,
  ACWR_RETURN: fiveK.ACWR_RETURN,
  ACWR_HIGH: fiveK.ACWR_HIGH,
  ACWR_SCALE: fiveK.ACWR_SCALE
} satisfies PlanGenerator;

export const TEN_K_GENERATOR: PlanGenerator = {
  id: '10k',
  policyId: tenK.POLICY_ID,
  policyVersion: tenK.POLICY_VERSION,
  legacyPolicyId: tenK.LEGACY_POLICY_ID,
  planPolicy: tenK.planPolicy,
  stampPlan: tenK.stampPlan,
  phaseOfWeek: tenK.phaseOfWeek,
  classifyMeasurement: tenK.classifyMeasurement,
  recomputeVdotChain: tenK.recomputeVdotChain,
  sessionClassFor: tenK.sessionClassFor,
  currentVdot: tenK.currentVdot,
  generatePlan: tenK.generatePlan,
  adaptGeneratedPlan: tenK.adaptGeneratedPlan,
  assess: tenK.assess,
  product: (raceDistM) => (raceDistM === tenK.TEN_K_DISTANCE_M ? tenK.TEN_K_PRODUCT : undefined),
  executionModel: tenK.executionModel,
  executionBasis: tenK.executionBasis,
  buildExecutionAdjustment: tenK.buildExecutionAdjustment,
  buildRunWalkAdjustment: tenK.buildRunWalkAdjustment,
  assessRunWalkProgress: tenK.assessRunWalkProgress,
  qualityEntryGate: tenK.qualityEntryGate,
  hasRecentMeasuredForm: tenK.hasRecentMeasuredForm,
  planWithNewGoal: tenK.planWithNewGoal,
  planRecalibrated: tenK.planRecalibrated,
  graftFuturePlan: tenK.graftFuturePlan,
  alignAutomaticOverlays: tenK.alignAutomaticOverlays,
  vdotProposal: tenK.vdotProposal,
  applyVdotProposal: tenK.applyVdotProposal,
  undoVdotAdjustments: tenK.undoVdotAdjustments,
  fitnessEvidence: tenK.fitnessEvidence,
  planVdotNow: tenK.planVdotNow,
  matchPlanRows: tenK.matchPlanRows,
  recalibrationMinMeasurements: tenK.VDOT_PROPOSAL_MIN_MEASUREMENTS,
  recalibrationThreshold: tenK.VDOT_PROPOSAL_THRESHOLD,
  injuryProposal: tenK.injuryProposal,
  applyInjuryProposal: tenK.applyInjuryProposal,
  realignPlan: tenK.realignPlan,
  workoutsForWatch: tenK.workoutsForWatch,
  thresholdPace: tenK.thresholdPace,
  weatherCard: tenK.weatherCard,
  rpeTarget: tenK.rpeTarget,
  paceForZone: tenK.paceForZone,
  painStatus: tenK.painStatus,
  acwrNow: tenK.acwrNow,
  acwrPlan: tenK.acwrPlan,
  readinessModel: tenK.readinessModel,
  loadMeaning: tenK.loadMeaning,
  wellnessSignals: tenK.wellnessSignals,
  acwrBand: tenK.acwrBand,
  acwrText: tenK.acwrText,
  acwrPosition: tenK.acwrPosition,
  ACWR_MAX: tenK.ACWR_MAX,
  ACWR_RETURN: tenK.ACWR_RETURN,
  ACWR_HIGH: tenK.ACWR_HIGH,
  ACWR_SCALE: tenK.ACWR_SCALE
} satisfies PlanGenerator;

/* 5K v2 (segment 08a): sopstveni generator 5K distance, biran po oznaci politike plana (`5k-v2`) — postojeći planovi
   (`5k-v1`, `legacy-5k`) ostaju na `FIVE_K_GENERATOR` i nikad se ne prebacuju. Raspodela članova: (a) v2 sam
   (generisanje, oznake, faza, procena, proizvod, tempo/prag/napor, sat iz strukture); (b) adaptacija i predlog —
   eksplicitno nepodržano do 08b (`ADAPTATION_UNSUPPORTED`, bez zamene starim generatorom); (c) procena stanja i vreme —
   sopstvena kopija v2 sa istim vrednostima (v. `fiveK/v2/app/index.ts`). */
const v2 = fiveK.fiveKV2;
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
  planWithNewGoal: v2.planWithNewGoal,
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

/** Poruka u UI-ju umesto prilagođavanja plana 5K v2 (08b). */
export const ADAPTATION_UNSUPPORTED: string = v2.ADAPTATION_UNSUPPORTED;

/** Nov 5K plan generatorom v2 (čarobnjak uz uključen prekidač): plan za upis ili razlozi odbijanja v2. */
export const generateFiveKV2Plan = (input: StructuredPlanInput): StructuredPlanResult =>
  v2.generateStructured(input);
/** Prvi dan plana v2: cele nedelje koje se završavaju danom trke, ne pre `today`; `null` bez ispravnih datuma. */
export const fiveKV2Start = (raceDate: string, today: string): string | null =>
  v2.alignedStart(raceDate, today);

/** Kraća distanca iz HM odluke o pripremi → generator te distance (aplikaciona predaja, v. `handoff.ts`). */
const HM_SHORTER_HANDOFF = regeneratorForDistance;

export const HALF_MARATHON_GENERATOR: PlanGenerator = {
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
      HM_SHORTER_HANDOFF
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

/** Kraća distanca iz maratonske odluke o pripremi → generator te distance (aplikaciona predaja, v. `handoff.ts`). */
const MARATHON_SHORTER_HANDOFF = regeneratorForDistance;

export const MARATHON_GENERATOR: PlanGenerator = {
  id: 'marathon',
  policyId: marathon.POLICY_ID,
  policyVersion: marathon.POLICY_VERSION,
  legacyPolicyId: marathon.LEGACY_POLICY_ID,
  planPolicy: marathon.planPolicy,
  stampPlan: marathon.stampPlan,
  phaseOfWeek: marathon.phaseOfWeek,
  classifyMeasurement: marathon.classifyMeasurement,
  recomputeVdotChain: marathon.recomputeVdotChain,
  sessionClassFor: marathon.sessionClassFor,
  currentVdot: marathon.currentVdot,
  generatePlan: marathon.generatePlan,
  adaptGeneratedPlan: marathon.adaptGeneratedPlan,
  assess: marathon.assess,
  product: (raceDistM) =>
    raceDistM === marathon.MARATHON_DISTANCE_M ? marathon.MARATHON_PRODUCT : undefined,
  executionModel: marathon.executionModel,
  executionBasis: marathon.executionBasis,
  buildExecutionAdjustment: (current, today, analysis, options, context) =>
    marathon.buildExecutionAdjustment(
      current,
      today,
      analysis,
      options,
      context,
      MARATHON_SHORTER_HANDOFF
    ),
  buildRunWalkAdjustment: marathon.buildRunWalkAdjustment,
  assessRunWalkProgress: marathon.assessRunWalkProgress,
  qualityEntryGate: marathon.qualityEntryGate,
  hasRecentMeasuredForm: marathon.hasRecentMeasuredForm,
  planWithNewGoal: marathon.planWithNewGoal,
  planRecalibrated: marathon.planRecalibrated,
  graftFuturePlan: marathon.graftFuturePlan,
  alignAutomaticOverlays: marathon.alignAutomaticOverlays,
  vdotProposal: marathon.vdotProposal,
  applyVdotProposal: marathon.applyVdotProposal,
  undoVdotAdjustments: marathon.undoVdotAdjustments,
  fitnessEvidence: marathon.fitnessEvidence,
  planVdotNow: marathon.planVdotNow,
  matchPlanRows: marathon.matchPlanRows,
  recalibrationMinMeasurements: marathon.VDOT_PROPOSAL_MIN_MEASUREMENTS,
  recalibrationThreshold: marathon.VDOT_PROPOSAL_THRESHOLD,
  injuryProposal: marathon.injuryProposal,
  applyInjuryProposal: marathon.applyInjuryProposal,
  realignPlan: marathon.realignPlan,
  workoutsForWatch: marathon.workoutsForWatch,
  thresholdPace: marathon.thresholdPace,
  weatherCard: marathon.weatherCard,
  rpeTarget: marathon.rpeTarget,
  paceForZone: marathon.paceForZone,
  painStatus: marathon.painStatus,
  acwrNow: marathon.acwrNow,
  acwrPlan: marathon.acwrPlan,
  readinessModel: marathon.readinessModel,
  loadMeaning: marathon.loadMeaning,
  wellnessSignals: marathon.wellnessSignals,
  acwrBand: marathon.acwrBand,
  acwrText: marathon.acwrText,
  acwrPosition: marathon.acwrPosition,
  ACWR_MAX: marathon.ACWR_MAX,
  ACWR_RETURN: marathon.ACWR_RETURN,
  ACWR_HIGH: marathon.ACWR_HIGH,
  ACWR_SCALE: marathon.ACWR_SCALE
} satisfies PlanGenerator;

/** Generator za ciljnu distancu ulaza; `undefined`/0 je 5K (stari ulaz: `raceDistM || 5000`); ostalo `null`. */
export function generatorIdFor(raceDistM: unknown): GeneratorId | null {
  const dist = (raceDistM as number) || 5000;
  if (dist === fiveK.FIVE_K_DISTANCE_M) return '5k';
  if (dist === tenK.TEN_K_DISTANCE_M) return '10k';
  if (dist === halfMarathon.HALF_MARATHON_DISTANCE_M) return 'hm';
  if (dist === marathon.MARATHON_DISTANCE_M) return 'marathon';
  return null;
}

const GENERATORS: Readonly<Record<GeneratorId, PlanGenerator>> = {
  '5k': FIVE_K_GENERATOR,
  '10k': TEN_K_GENERATOR,
  hm: HALF_MARATHON_GENERATOR,
  marathon: MARATHON_GENERATOR
};

/** Generator ciljne distance ili `null` kad distanca nije podržana (pozivalac to prikazuje, bez zamene). */
export function generatorForDistance(raceDistM: unknown): PlanGenerator | null {
  const id = generatorIdFor(raceDistM);
  return id ? GENERATORS[id] : null;
}

/**
 * Generator koji odgovara za plan: distanca iz `meta`, pa iz sačuvanog ulaza. Za zamenu plana drugim (vraćanje verzije,
 * regeneracija na drugoj distanci) bira se po planu KOJI SE UPISUJE, jer njegova trenerska obrada pripada njemu. Za plan u
 * prikazu prosleđuje se AKTIVNI plan (uključujući ugrađeni lični plan). `null`: nema plana, distanca nije podržana ili
 * plan nosi oznaku politike koju generator te distance ne poznaje (A7: bez tihe zamene; razlog daje
 * `unsupportedPlanReason`). Plan bez oznake (`legacy-<distanca>`) obrađuje postojeći generator te distance.
 */
export function generatorForPlan(plan: GenPlanState | null | undefined): PlanGenerator | null {
  const generator = generatorForDistanceOf(plan);
  if (!generator) return null;
  return generator.planPolicy(plan).status === 'unknown' ? null : generator;
}

function generatorForDistanceOf(plan: GenPlanState | null | undefined): PlanGenerator | null {
  if (!plan) return null;
  const ulaz = plan.ulaz as { raceDistM?: unknown } | null | undefined;
  const generator = generatorForDistance(plan.meta?.raceDistM ?? ulaz?.raceDistM);
  // 5K: oznaka politike bira generator (08a) — `5k-v2` → v2 (njegove nepoznate verzije su `unknown`), sve ostalo
  // (`5k-v1`, `legacy-5k`, tuđa oznaka) postojeći 5K, kao do sada.
  if (generator === FIVE_K_GENERATOR && plan.meta?.['policyId'] === v2.POLICY_ID)
    return FIVE_K_V2_GENERATOR;
  return generator;
}

/** Prekidači izbora generatora za NOV plan (vrednost daje `flags.ts`). */
export interface GeneratorFlags {
  fiveKV2: boolean;
}

/**
 * Generator za NOV plan (čarobnjak): uz uključen prekidač 5K ide u v2, sve ostalo kao `generatorForDistance`. Isključen
 * prekidač → isti generator kao do sada. Postojeći planovi se biraju po svojoj oznaci (`generatorForPlan`), nikad ovde.
 */
export function generatorForNewPlan(
  raceDistM: unknown,
  flags: GeneratorFlags
): PlanGenerator | null {
  const generator = generatorForDistance(raceDistM);
  return generator === FIVE_K_GENERATOR && flags.fiveKV2 ? FIVE_K_V2_GENERATOR : generator;
}

/** Poruka umesto prilagođavanja kad generator plana adaptaciju još nema (5K v2 do 08b); inače `null`. */
export function adaptationUnsupportedFor(plan: GenPlanState | null | undefined): string | null {
  return generatorForPlan(plan) === FIVE_K_V2_GENERATOR ? ADAPTATION_UNSUPPORTED : null;
}

/** Poruka za plan čiju je politiku upisala verzija generatora koju ova aplikacija ne poznaje. */
export const UNKNOWN_POLICY =
  'Plan je napravila verzija generatora koju ova aplikacija ne poznaje, pa ga postojeći generator ne prilagođava umesto nje. Ažuriraj aplikaciju ili napravi novi plan.';

/** Oznaka politike plana prema generatoru njegove distance; `null` kad distanca nije podržana. */
export function planPolicyOf(plan: GenPlanState | null | undefined): PolicyStatus | null {
  return generatorForDistanceOf(plan)?.planPolicy(plan) ?? null;
}

/** Zašto plan nema generator (`generatorForPlan` je `null`): nepoznata verzija politike ili nepodržana distanca. */
export function unsupportedPlanReason(plan: GenPlanState | null | undefined): string {
  return planPolicyOf(plan)?.status === 'unknown' ? UNKNOWN_POLICY : UNSUPPORTED_DISTANCE;
}

/**
 * Plan za upis (novi plan, revizija posle prilagođavanja): generator plana upisuje fazu svake nedelje i oznaku svoje
 * politike (`stampPlan`, A3/A7). Plan bez generatora se upisuje nepromenjen (pozivalac ga je već odbio ili prikazuje).
 */
export function stampForStorage<P extends GenPlanState>(plan: P): P {
  return generatorForPlan(plan)?.stampPlan(plan) ?? plan;
}

/**
 * Faza nedelje za prikaz: upisana odluka generatora plana; stari plan bez polja dobija fazu funkcijom generatora tog
 * plana. Bez generatora (nepodržana distanca, nepoznata politika) faza je prazna — nema zajedničkog procenta.
 */
export function phaseReaderFor(
  plan: GenPlanState | null | undefined
): (w: Parameters<PlanGenerator['phaseOfWeek']>[0], totalWeeks: number) => WeekPhase {
  const generator = generatorForPlan(plan);
  return generator ? (w, total) => generator.phaseOfWeek(w, total) : () => '';
}

/** Proizvodni podaci (ime, preporučene nedelje) generatora te distance; `undefined` kad distanca nije podržana. */
export const productFor = (raceDistM: number): DistanceProduct | undefined =>
  generatorForDistance(raceDistM)?.product(raceDistM);

/* ODLUKA O OGRANIČENOJ PRIPREMI (produženje, kraća distanca, povratni režim) nad sačuvanim planom. Postoji samo u
   polumaratonskom i maratonskom generatoru; 5K i 10K je nemaju (njihova priprema nikad nije „ograničena dugačka
   priprema"), pa za njih `preparationForPlan` vraća `null` — isto što je stari mehanizam za njih uvek odlučivao. */
export const HALF_MARATHON_PREPARATION: PreparationApi = {
  basisFromPlan: halfMarathon.basisFromPlan,
  preparationDecision: (current, today, basis, context, status, delivered) =>
    halfMarathon.preparationDecision(
      current,
      today,
      basis,
      context,
      status,
      delivered,
      HM_SHORTER_HANDOFF
    ),
  buildPreparationChoice: (current, today, basis, choice, context) =>
    halfMarathon.buildPreparationChoice(current, today, basis, choice, context, HM_SHORTER_HANDOFF),
  isLimitedLongPreparation: halfMarathon.isLimitedLongPreparation
} satisfies PreparationApi;

export const MARATHON_PREPARATION: PreparationApi = {
  basisFromPlan: marathon.basisFromPlan,
  preparationDecision: (current, today, basis, context, status, delivered) =>
    marathon.preparationDecision(
      current,
      today,
      basis,
      context,
      status,
      delivered,
      MARATHON_SHORTER_HANDOFF
    ),
  buildPreparationChoice: (current, today, basis, choice, context) =>
    marathon.buildPreparationChoice(
      current,
      today,
      basis,
      choice,
      context,
      MARATHON_SHORTER_HANDOFF
    ),
  isLimitedLongPreparation: marathon.isLimitedLongPreparation
} satisfies PreparationApi;

export function preparationForPlan(plan: GenPlanState | null | undefined): PreparationApi | null {
  const generator = generatorForPlan(plan);
  if (generator === HALF_MARATHON_GENERATOR) return HALF_MARATHON_PREPARATION;
  if (generator === MARATHON_GENERATOR) return MARATHON_PREPARATION;
  return null;
}
