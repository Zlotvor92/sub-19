/* 5K v2 — ulazni i izlazni tipovi. Samo tipovi; nema izvršnog koda. */

/** ISO datum YYYY-MM-DD. Namerno običan string: brendirani `IsoDate` iz fiveK/date bi zahtevao
    kast na svakom ulazu iz JSON-a; v2 sam proverava format u input.ts. */
export type IsoDate = string;

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type ResultDistanceM = 3000 | 5000 | 10000;

export interface FiveKV2Result {
  distanceM: ResultDistanceM;
  timeSec: number;
  date: IsoDate;
}

export interface FiveKV2Input {
  /** Prvi dan nedelje 1. */
  startDate: IsoDate;
  /** Dan trke = poslednji dan poslednje nedelje. */
  raceDate: IsoDate;
  runDays: readonly Weekday[];
  currentWeeklyKm: number;
  recentResult: FiveKV2Result;
  /** Ciljno vreme 5K [s]; samo se procenjuje, ne menja tempo. */
  goalTimeSec?: number | null;
}

export type ReasonCode =
  | 'INPUT_SHAPE'
  | 'DATE_INVALID'
  | 'RACE_NOT_AFTER_START'
  | 'PLAN_NOT_WHOLE_WEEKS'
  | 'PLAN_LENGTH_OUT_OF_RANGE'
  | 'RUN_DAYS_COUNT'
  | 'RUN_DAYS_INVALID'
  | 'RUN_DAYS_SPACING'
  | 'WEEKLY_KM_OUT_OF_RANGE'
  | 'RESULT_DISTANCE_UNSUPPORTED'
  | 'RESULT_TIME_INVALID'
  | 'RESULT_AFTER_START'
  | 'RESULT_TOO_OLD'
  | 'VDOT_OUT_OF_RANGE'
  | 'GOAL_INVALID'
  | 'QUALITY_INFEASIBLE'
  | 'WEEK_INFEASIBLE'
  | 'PLAN_VIOLATES_POLICY';

export interface Reason {
  code: ReasonCode;
  message: string;
  week?: number;
}

export type InputCheck = { ok: true; input: FiveKV2Input } | { ok: false; reasons: Reason[] };

export type Zone = 'E' | 'T' | 'I' | 'R' | 'RP';

/** Tempo [s/km]. E je opseg; ostale zone su jedna vrednost. */
export interface Paces {
  vdot: number;
  E: { fast: number; slow: number };
  T: number;
  I: number;
  R: number;
  RP: number;
}

export type Phase = 'base' | 'peak' | 'sharpen' | 'taper' | 'race';

export interface WeekFrame {
  index: number;
  startDate: IsoDate;
  endDate: IsoDate;
  phase: Phase;
  deload: boolean;
  /** 1 ili 2 za nedelje tapera, inače null. */
  taperStep: 1 | 2 | null;
}

export type Basis = 'exact' | 'estimated';

export type SegmentKind =
  | 'warmup'
  | 'cooldown'
  | 'easy'
  | 'long'
  | 'rep'
  | 'recovery'
  | 'continuous'
  | 'progression'
  | 'stride'
  | 'race';

export interface Segment {
  kind: SegmentKind;
  /** 'jog' = oporavak (računa se sporijom granicom E). */
  zone: Zone | 'jog';
  km: number;
  sec: number;
  paceSecPerKm: number;
  kmBasis: Basis;
  secBasis: Basis;
}

export type BlockSpec =
  | { kind: 'warmup' | 'cooldown' | 'easy' | 'long'; km: number }
  | { kind: 'continuous'; zone: Zone; km: number }
  | {
      kind: 'reps';
      zone: Zone;
      reps: number;
      /** Ponavljanje je zadato distancom ILI vremenom. */
      rep: { km: number } | { sec: number };
      /** Oporavak posle svakog ponavljanja osim poslednjeg. */
      recovery: { km: number } | { sec: number };
      stride?: boolean;
    }
  | { kind: 'progression'; steps: readonly { zone: Zone; km: number }[] }
  | { kind: 'race'; km: number };

export type WorkoutKind = 'easy' | 'long' | 'quality' | 'race';

export type QualityType = 'R' | 'R_sharpen' | 'T_short' | 'T_cruise' | 'I' | 'RP' | 'RP_sharpener';

export interface Workout {
  kind: WorkoutKind;
  qualityType: QualityType | null;
  title: string;
  blocks: readonly BlockSpec[];
  segments: readonly Segment[];
  km: number;
  sec: number;
  kmBasis: Basis;
  secBasis: Basis;
  /** Km rada po zoni (ponavljanja, kontinuirano, progresija). Ubrzanja i oporavak nisu rad. */
  workKm: Record<Zone, number>;
  /** Najduže pojedinačno ponavljanje / kontinuirani blok po zoni [s]. */
  maxBoutSec: Record<Zone, number>;
}

export type DayRole = 'q1' | 'q2' | 'long' | 'easy' | 'race';

export interface PlanDay {
  date: IsoDate;
  weekday: Weekday;
  role: DayRole;
  hard: boolean;
  /** Trka se ne računa u nedeljni obim. */
  countsToWeek: boolean;
  workout: Workout;
}

export interface QualityBudgets {
  I: number;
  T: number;
  R: number;
}

export interface PlanWeek extends WeekFrame {
  targetKm: number;
  plannedKm: number;
  budgets: QualityBudgets;
  /** 2.1.0: lagani dani su ograničeni na dužinu dugog, pa je plannedKm < targetKm (namerno). */
  easyCappedAtLong: boolean;
  days: PlanDay[];
  notes: string[];
}

export interface Pattern {
  long: Weekday;
  q1: Weekday;
  q2: Weekday;
  easy: Weekday;
}

export type GoalStatus = 'feasible' | 'ambitious' | 'unrealistic';

export interface GoalAssessment {
  goalTimeSec: number;
  goalVdot: number;
  vdotGap: number;
  status: GoalStatus;
  message: string;
}

export interface Violation {
  rule: string;
  severity: 'error' | 'warning';
  week?: number;
  date?: IsoDate;
  message: string;
}

export interface FiveKV2Plan {
  policyId: string;
  policyVersion: string;
  input: FiveKV2Input;
  vdot: number;
  paces: Paces;
  predicted5kSec: number;
  goal: GoalAssessment | null;
  pattern: Pattern;
  startKm: number;
  peakKm: number;
  weeks: PlanWeek[];
  warnings: Violation[];
}

export type GenerateResult =
  { ok: true; plan: FiveKV2Plan } | { ok: false; reasons: Reason[]; violations: Violation[] };
