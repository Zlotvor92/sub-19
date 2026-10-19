/* ============================================================
   TIPOVI RAZMENE GENERATORA I APLIKACIJE (A5) — neutralno, ni iz jednog generatora.

   Ovo je oblik koji aplikacija prosleđuje generatoru i čita iz njegovog rezultata (ugovor `PlanGenerator` u `select.ts`).
   Perzistirani plan (nedelje, dani, sesije, meta, red predikcije) dolazi iz formata stanja (`../state`); ostalo je
   deklarisano ovde. Svaki od četiri generatora mora da odgovara ovim oblicima — proverava se pri prevođenju kroz
   `satisfies PlanGenerator`/`PreparationApi` u `select.ts`; promena tipa unutar jednog generatora više ne menja ugovor.
   Samo tipovi; bez izvršnog koda.
   ============================================================ */

import type { IsoDate } from '../date';
import type {
  AltRecord,
  DayTag,
  GenPlanState,
  LogEntry,
  OffPlanRun,
  PainRecord,
  PredictionRow,
  RunWalk,
  StoredWeek,
  SyncIssue,
  T3kRecord,
  TrainingPlan,
  VdotRecord,
  Week
} from '../state';

/* --- perzistirani plan (iz formata stanja) --- */
export type PlanMeta = TrainingPlan['meta'];
type GeneratedDay = Week['days'][number];
export type Session = NonNullable<GeneratedDay['session']>;
/** 5k-v2 (08a): strukturisan trening dana (iz formata stanja). */
export type WorkoutStructure = NonNullable<GeneratedDay['structure']>;
type FastFinish = NonNullable<GeneratedDay['finish']>;
type Strides = NonNullable<GeneratedDay['strides']>;
export type Zone = Exclude<NonNullable<Session['zone']>, 'RP'>;
export type Intensity = PlanMeta['intensity'];
export type PreparationAssessment = NonNullable<PlanMeta['preparation']>;
export type Assessment = Pick<
  PlanMeta,
  'assessmentBasis' | 'vdot0' | 'vdotGoal' | 'predictedSec' | 'realno' | 'goalVdot'
>;
export type StoredPredRow = PredictionRow & { id: string };
type RaceDistanceM = 5000 | 10000 | 21097.5 | 42195;

/* --- generisanje --- */
export interface PersonalBest {
  distM: number;
  sec: number;
  date?: string;
}
export interface PlanGenerationInput {
  startDate: string;
  raceDate: string;
  raceDistM?: number;
  pb: PersonalBest;
  weeklyKm: number;
  recentLongRunKm?: number;
  currentReadiness?: { reason: 'fatigued' | 'reduced-volume' | 'returning'; until: IsoDate };
  consistentWeeks?: number;
  breakWeeks?: number;
  qualityExperience?: 'none' | 'some' | 'experienced';
  runDays?: number;
  quality?: number;
  intensity: Intensity;
  volIntensity?: Intensity;
  goalSec?: number | null;
  trainedRecently?: boolean;
  runWalkLadder?: number[];
  lrDow?: number;
  qDows?: number[];
  runDows?: number[];
  _noSuggest?: boolean;
}
export type PlanGenerationResult = TrainingPlan | { error: string };
export interface DistanceProduct {
  name: string;
  minWeeks: number;
  baseWeeksBeginner: number;
  qual2MinKm: number;
  minPeakKm: number;
  recommendedMinRunDays?: number;
}

/* --- 5K v2 (08a): ulaz čarobnjaka i strukturisano odbijanje (oblik razmene; pravila ulaza su generatorova) --- */
export type WeekdayName = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export interface StructuredPlanInput {
  /** Prvi dan nedelje 1. */
  startDate: string;
  /** Dan trke = poslednji dan poslednje nedelje. */
  raceDate: string;
  runDays: WeekdayName[];
  currentWeeklyKm: number;
  recentResult?: { distanceM: 3000 | 5000 | 10000; timeSec: number; date: string } | null;
  goalTimeSec?: number | null;
  typicalEasyPaceSecPerKm?: number | null;
  experience?: 'beginner' | 'regular';
  canRun30Min?: boolean;
}
/** 10K v2 (segment 05): ulaz čarobnjaka (oblik razmene; pravila ulaza su generatorova — D1, D17, D26, D28, D29). */
export interface TenKV2PlanInput {
  /** Prvi dan nedelje 1. */
  startDate: string;
  /** Dan trke = poslednji dan poslednje nedelje. */
  raceDate: string;
  runDays: WeekdayName[];
  /** Dan dugog trčanja (jedan od dana trčanja); bez njega bira generator. */
  longRunDay?: WeekdayName | null;
  currentWeeklyKm: number;
  recentResult?: { distanceM: 3000 | 5000 | 10000 | 21097.5; timeSec: number; date: string } | null;
  goalTimeSec?: number | null;
  /** Uobičajen lagan tempo [s/km] — plan po osećaju (bez skorijeg rezultata). */
  easyPaceSecPerKm?: number | null;
  experience?: 'beginner' | 'regular';
  /** Trčanje/hodanje (10K ga ne podržava: odbijanje sa preporukom 5K plana). */
  runWalk?: boolean;
}
/** HM v2 (segment HM-05): ulaz čarobnjaka (oblik razmene; pravila ulaza su generatorova — H1, H15–H17, HI7). */
export interface HmV2PlanInput {
  /** Prvi dan nedelje 1. */
  startDate: string;
  /** Dan trke = poslednji dan poslednje nedelje. */
  raceDate: string;
  runDays: WeekdayName[];
  /** Dan dugog trčanja (jedan od dana trčanja); bez njega bira generator. */
  longRunDay?: WeekdayName | null;
  currentWeeklyKm: number;
  recentResult?: {
    distanceM: 5000 | 10000 | 21097.5 | 42195;
    timeSec: number;
    date: string;
  } | null;
  goalTimeSec?: number | null;
  /** Uobičajen lagan tempo [s/km] — plan po osećaju (bez skorijeg rezultata, H16). */
  easyPaceSecPerKm?: number | null;
  /** Skorašnji najduži trk [km] (pouka 28, opciono). */
  recentLongRunKm?: number | null;
  experience?: 'beginner' | 'regular';
  /** Trčanje/hodanje (polumaraton ga ne podržava: odbijanje sa preporukom 5K plana, H17). */
  runWalk?: boolean;
}
export interface PlanRejectionReason {
  code: string;
  message: string;
  week?: number;
}
/** Plan za upis ili odbijanje sa razlozima (prikazuje se korisniku kao poruka, ne kao greška). */
export type StructuredPlanResult =
  { ok: true; plan: GenPlanState } | { ok: false; reasons: PlanRejectionReason[] };

/* --- razrešen plan (plan + izmene + pomeranja) --- */
export interface DayOrigin {
  tag: DayTag | undefined;
  km: number | null;
  desc: string | null;
  rest: boolean;
  runWalk: RunWalk | undefined;
  finish?: FastFinish;
  strides?: Strides;
}
export interface ResolvedDay {
  id: string;
  w: number;
  weekStart: IsoDate;
  dow: number;
  origDate: IsoDate;
  date: IsoDate;
  tag: DayTag | undefined;
  rest: boolean;
  km: number | null;
  desc: string | null;
  runWalk: RunWalk | undefined;
  finish?: FastFinish;
  strides?: Strides;
  snaga: boolean;
  /** Važeći propis (nalaz 4); `undefined` kad ručna izmena nema strukturu. */
  session: Session | undefined;
  /** Originalni propis generatora. */
  originSession: Session | undefined;
  /** 5k-v2 (08a): važeća struktura treninga; nema je kod planova bez strukture. */
  structure?: WorkoutStructure;
  mlr: boolean;
  test: boolean;
  origin: DayOrigin;
}
export interface ResolvedWeek {
  w: number;
  start: IsoDate;
  deload: boolean;
  focus: string;
  taper?: true;
  phase?: string;
  days: ResolvedDay[];
}
export interface ResolvedPlan {
  weeks: ResolvedWeek[];
  byId: ReadonlyMap<string, ResolvedDay>;
  byDate: ReadonlyMap<IsoDate, ResolvedDay>;
  dated: ResolvedDay[];
  trainingDays: number;
}
export type ResolvedPlanView = ResolvedPlan;

/* --- izvršenje i prilagođavanje --- */
export interface ReplanContext {
  log?: Readonly<Record<string, LogEntry>>;
  alts?: Readonly<Record<string, AltRecord>>;
  moves?: Readonly<Record<string, unknown>>;
  pred?: Readonly<Record<string, unknown>>;
  predLock?: Readonly<Record<string, unknown>>;
  /** 08b: ostale činjenice aplikacije za adaptaciju generatora koji ih čita sam (5K v2); ostali ih ne čitaju. */
  facts?: AdaptationSources;
}
/** 08b: činjenice van dnevnika (bol, testovi 3 km, trčanja pre plana, sinhronizacija, potvrda zapisa, prijavljene
 *  pauze) u formatu aplikacije; prevod u činjenice generatora radi generator (5K v2: `fiveK/v2/app/facts.ts`). */
export interface AdaptationSources {
  pain?: readonly PainRecord[];
  tests?: readonly T3kRecord[];
  outOfPlan?: Readonly<Record<string, number>>;
  /** 08c: uvezena trčanja koja nisu uparena sa danom plana (`vanPlanaV2`). */
  offPlanRuns?: Readonly<Record<string, OffPlanRun>>;
  /** Povezani izvori sinhronizacije treninga: dan poslednje POTPUNE sinhronizacije (08c: `fullSync` — sve aktivnosti
   *  perioda preuzete i obrađene; `null` = nijedne), prvi dan njenog perioda i šta poslednja sinhronizacija nije obradila. */
  sync?: ReadonlyArray<{
    source: 'strava' | 'icu';
    lastSuccessDate: IsoDate | null;
    fromDate?: IsoDate | null;
    issues?: readonly SyncIssue[];
  }>;
  /** Korisnik potvrdio „zapis za proteklih N dana je potpun" (u toku prilagođavanja). */
  confirmedDays?: number | null;
  /** Eksplicitno prijavljene pauze (od–do). */
  breaks?: ReadonlyArray<{ from: string; to: string }>;
}
export interface ExecutionWeek {
  start: IsoDate;
  end: IsoDate;
  plannedKm: number;
  actualKm: number;
  completed: number;
  missed: number;
  unknown: number;
  statusCoverage: number;
  volumeCoverage: number;
}
export interface ExecutionAnalysis {
  today: IsoDate;
  windowStart: IsoDate;
  completed: number;
  missed: number;
  unknown: number;
  statusCoverage: number;
  volumeCoverage: number;
  actualKm: number;
  plannedKm: number;
  completeWeeks: ExecutionWeek[];
  recentWeeklyKm: number | null;
  lastPositiveWeeklyKm: number | null;
  recentLongRunKm: number | null;
  lastRunDate: IsoDate | null;
  daysSinceLastRun: number | null;
  explicitMisses14d: number;
  easyHighRpeCount: number;
  lowerVolumeWeeks: number;
  reasons: string[];
}
export interface ExecutionRecommendation {
  kind: 'single-miss' | 'reduce' | 'return' | 'insufficient-data' | null;
  reason: string;
  actionable: boolean;
  requiresConfirmation: boolean;
  weeklyKm?: number;
  recentLongRunKm?: number;
  breakDays?: number;
  reasons: string[];
}
export interface ExecutionAdjustmentOptions {
  breakDays?: number;
  weeklyKm?: number;
  recentLongRunKm?: number;
}
export interface RunWalkAdjustmentOptions {
  mode: 'hold' | 'step-back' | 'repeat-phase';
  extraWeeks?: number;
  weeklyKm?: number;
}
export type RunWalkMode = RunWalkAdjustmentOptions['mode'];
export interface RunWalkAssessment {
  decision: 'not-applicable' | 'unknown' | 'advance' | 'hold' | 'step-back';
  rung: number | null;
  finalRung: boolean;
  considered: number;
  completed: number;
  missed: number;
  tolerated: number;
  borderline: number;
  hard: number;
  unreported: number;
  reasons: string[];
  advice: string | null;
}
export interface QualityGateResult {
  open: boolean;
  met: string[];
  unmet: string[];
  unknown: string[];
}
export interface FinalizationOptions {
  returnWindow?: { start: IsoDate; end: IsoDate; requiredWeeks: number };
}
export type ReplanError = { error: string };
interface ReplannedPlan extends GenPlanState {
  error?: never;
  weeks: StoredWeek[];
  pred: Array<PredictionRow & { id: string }>;
  qs: Record<string, number[]>;
  meta: PlanMeta & Record<string, unknown>;
  ulaz: PlanGenerationInput;
}
export interface GoalChangeResult extends ReplannedPlan {
  goalChange: { week: number; from: number | null; to: number; changedWeeks: number };
}
export interface RecalibratedStoredPlan extends ReplannedPlan {
  recalibration: {
    week: number;
    changedWeeks: number;
    form: number;
    planBefore: number | null;
    predictedBefore: number;
    predictedAfter: number;
  };
}

/* --- odluka o pripremi (HM, maraton) --- */
/** Povratna politika iz odluke generatora. Aplikacija vrednost ne čita, samo je vraća generatoru (osnov odluke ide u
 *  oba smera); oblik je neutralan, vrednosti su odluka svake distance (`RETURN_POLICY` u njenom generatoru). */
type ReturnPolicy = {
  readonly days: number;
  readonly fraction: number;
  readonly easyWeeks: number;
};
export interface ExecutionAdjustmentMeta {
  date: IsoDate;
  reason?: 'confirmed-break' | 'fatigue' | 'reduced-volume';
  breakDays: number;
  reportedBaseKm: number;
  startingKm: number;
  reportedLongRunKm?: number;
}
export interface DecisionBasis {
  input: PlanGenerationInput;
  policy: ReturnPolicy | null;
  execution: ExecutionAdjustmentMeta | null;
  guardBaseKm?: number;
}
export interface DecisionPoint {
  raceDate: string;
  raceDistM: number;
  goalSec: number | null;
}
export type PreparationChoice =
  | { kind: 'extend'; raceDate: IsoDate }
  | { kind: 'shorter'; raceDistM: RaceDistanceM }
  | { kind: 'base' };
export interface PreparationOption {
  id: string;
  choice: PreparationChoice;
  title: string;
  detail: string;
  raceDate: IsoDate;
  raceDistM: number;
  goalSec: number | null;
  coverage: 'full' | 'distance' | 'insufficient';
  peakLongRunKm: number;
  peakWeeklyKm: number;
}
export interface PreparationDecision {
  status: 'rejected' | 'limited';
  fullPreparation: false;
  statement: string;
  conditions: string[];
  options: PreparationOption[];
  unavailable: string[];
}
export interface ChoiceResult {
  result: GenPlanState;
  summary: string;
  notes: string[];
  change: { from: DecisionPoint; to: DecisionPoint };
}

/* --- forma: predlog tempa i dokaz forme --- */
export interface ProposalContext {
  today: string;
  plan: ResolvedPlan;
  pred: readonly StoredPredRow[];
  meta: Pick<PlanMeta, 'vdot0' | 'vdotGoal' | 'weeks'> | null;
  log: Readonly<Record<string, LogEntry>>;
  alts: Readonly<Record<string, AltRecord>>;
  vdotChain: readonly VdotRecord[];
  tests?: readonly T3kRecord[];
  enteredPaces?: Readonly<Record<string, unknown>>;
  predLock?: Readonly<Record<string, unknown>>;
  positiveAdjustmentAllowed?: boolean;
}
export interface ProposalChange {
  id: string;
  date: string;
  kind: string;
  zone: Zone;
  oldPace: number;
  newPace: number;
  w: number;
}
export interface VdotProposal {
  form: number;
  planVdot: number;
  delta: number;
  measurements: number;
  distinctDays: number;
  confirmedTests: number;
  daysWithPace: number;
  changes: ProposalChange[];
  faster: boolean;
  fasterCount: number;
  slowerCount: number;
  title: string;
  message: string;
}
export interface ApplyResult {
  applied: number;
  alts: Record<string, AltRecord>;
  genPlan: GenPlanState | null;
}
export interface FitnessEvidenceContext {
  today: string;
  plan: ResolvedPlan;
  pred: readonly StoredPredRow[];
  meta: Pick<PlanMeta, 'vdot0'> | null;
  log: Readonly<Record<string, LogEntry>>;
  vdotChain: readonly VdotRecord[];
  tests?: readonly T3kRecord[];
}
export interface FitnessEvidence {
  form: number | null;
  measurements: number;
  distinctDays: number;
  confirmedTests: number;
  trainingMeasurements: number;
  windowDays: number;
  chain: VdotRecord[];
  excluded: Array<{
    id: string;
    reason:
      | 'invalid-measurement'
      | 'invalid-date'
      | 'future'
      | 'stale'
      | 'not-performed'
      | 'not-matched'
      | 'not-aerobic-evidence'
      | 'short-work'
      | 'incomplete-work'
      | 'duplicate';
  }>;
}

/* --- oporavak i procena stanja --- */
export interface LoadContext {
  plan: ResolvedPlan;
  log: Readonly<Record<string, LogEntry>>;
  outOfPlan: Readonly<Record<string, number>>;
}
export interface RecoveryContext extends LoadContext {
  pain: readonly PainRecord[];
}
export interface InjuryChange {
  id: string;
  date: IsoDate;
  from: DayTag | undefined;
  to: DayTag;
  km: number | null;
  rw?: RunWalk | null;
  desc: string;
}
export interface InjuryProposal {
  level: 'pauza' | 'return' | 'trka' | 'runwalk' | 'warn';
  week: number | null;
  pct?: number;
  urgent?: boolean;
  maxPain: number | null;
  parts: string[];
  changes: InjuryChange[];
  rw?: RunWalk | null;
  chronicKm?: number | null;
  budgetKm?: number | null;
  race?: { date: IsoDate; km: number | null; days: number } | null;
  title: string;
  message: string;
}
export interface PainStatus {
  cls: 'ok' | 'warn' | 'stop';
  t: string;
  s: string;
}
export interface Acwr {
  acute: number;
  chronic: number | null;
  ratio: number | null;
}
export type AcwrBand = 'low' | 'ok' | 'high' | 'danger';
type Tone = 'red' | 'amber' | 'green' | 'neutral';
export interface Signal {
  key: 'bol' | 'opterecenje' | 'hrv' | 'puls' | 'san' | 'svezina' | 'zapis';
  label: string;
  short: string;
  value: string | null;
  state: string;
  tone: Tone;
  note: string | null;
  meaning: string;
  action: string | null;
  word: string;
}
export interface Readiness {
  tone: Tone;
  word: string;
  why: string;
  action: string | null;
  signals: Signal[];
  missing: string[];
}

/* --- sat, vreme, smernice, poravnanje --- */
export interface RpeTarget {
  min: number;
  max: number;
  txt: string;
}
export interface WatchBatch {
  events: Array<{ date: string; externalId: string; name: string; description: string }>;
  skipped: number;
  /** 10K v2 (segment 05): zašto je svaki preskočen dan preskočen; generatori bez polja ga ne pišu. */
  skippedReasons?: string[];
}
interface ForecastHour {
  temp: number | null;
  osecaj: number | null;
  vlaga: number | null;
  vetar: number | null;
  kisa: number | null;
}
export interface WeatherCardInput {
  day: {
    rest?: boolean;
    date?: string | null;
    tag?: string | null;
    session?: { paceSec?: number | null } | null;
  };
  today: string;
  nowHour: number;
  trainingHour: number;
  cache: { sati: Record<string, ForecastHour> } | null | undefined;
  hasLocation: boolean;
  predPace: number | null;
  vdot: number | null;
}
export interface WeatherCardModel {
  extra: string;
  rows: Array<{ label: string; parts: Array<{ kind: 'b' | 'small'; text: string }> }>;
  note: string;
}
export interface RealignInput {
  weeks: readonly StoredWeek[];
  alts: Readonly<Record<string, AltRecord>>;
  moves: Readonly<Record<string, unknown>>;
  log: Readonly<Record<string, LogEntry>>;
  runsByDate: Readonly<Record<string, ReadonlyArray<{ distance: number }>>>;
}
export interface RealignResult {
  moves: Record<string, unknown>;
  moved: number;
}
