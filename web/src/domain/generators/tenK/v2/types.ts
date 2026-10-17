/* 10K v2 — ulazni i izlazni tipovi. Samo tipovi; nema izvršnog koda. Oblik prati 5K v2 (lakši adapter
   u segmentu 05), ali je sopstvena kopija: 10K v2 ne uvozi ništa van tenK/v2/. */

/** ISO datum YYYY-MM-DD (običan string; format proverava input.ts). */
export type IsoDate = string;

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/** 3 km, 5 km, 10 km, polumaraton (21,0975 km). */
export type ResultDistanceM = 3000 | 5000 | 10000 | 21097.5;

export interface TenKV2Result {
  distanceM: ResultDistanceM;
  timeSec: number;
  date: IsoDate;
}

export interface TenKV2Input {
  /** Prvi dan nedelje 1. */
  startDate: IsoDate;
  /** Dan trke = poslednji dan poslednje nedelje. */
  raceDate: IsoDate;
  /** 3–6 različitih dana (D1, D17). */
  runDays: readonly Weekday[];
  /** Dan dugog trka (D9); bez njega nedelja ako je dan trčanja, inače poslednji dan trčanja. */
  longRunDay?: Weekday | null;
  /** Prosek poslednje 4 nedelje [km]. */
  currentWeeklyKm: number;
  /** Rezultat ne stariji od 84 dana na dan starta (D1). */
  recentResult?: TenKV2Result | null;
  /** Ciljno vreme 10K [s]; samo se ocenjuje (D3), ne menja tempo. */
  goalTimeSec?: number | null;
}

export type ReasonCode =
  | 'INPUT_SHAPE'
  | 'DATE_INVALID'
  | 'RACE_NOT_AFTER_START'
  | 'PLAN_NOT_WHOLE_WEEKS'
  /** Trajno: 10K traži najmanje 8 nedelja. */
  | 'PLAN_TOO_SHORT'
  | 'PLAN_TOO_LONG'
  | 'RUN_DAYS_INVALID'
  | 'RUN_DAYS_COUNT'
  | 'LONG_DAY_INVALID'
  | 'WEEKLY_KM_TOO_LOW'
  | 'WEEKLY_KM_TOO_HIGH'
  /** Privremeno: bez pouzdanog rezultata → plan po osećaju (segment 03). */
  | 'FEEL_PLAN_SEGMENT_03'
  | 'RESULT_DISTANCE_UNSUPPORTED'
  | 'RESULT_TIME_INVALID'
  | 'RESULT_AFTER_START'
  | 'VDOT_TOO_HIGH'
  | 'GOAL_INVALID'
  | 'SCHEDULE_NO_RECOVERY'
  | 'WEEK_INFEASIBLE'
  | 'PLAN_VIOLATES_POLICY'
  | 'ADAPT_NOT_SUPPORTED';

export interface Reason {
  code: ReasonCode;
  message: string;
  week?: number;
}

export type Zone = 'E' | 'T' | 'I' | 'R' | 'RP';
/** Zone rada (plafoni D11). */
export type WorkZone = 'T' | 'I' | 'R' | 'RP';

/** Tempo [s/km]. E je opseg; ostale zone su jedna vrednost. */
export interface Paces {
  vdot: number;
  E: { fast: number; slow: number };
  T: number;
  I: number;
  R: number;
  RP: number;
}

export type Phase = 'base' | 'development' | 'specific' | 'taper' | 'race';

export interface WeekFrame {
  index: number;
  startDate: IsoDate;
  endDate: IsoDate;
  phase: Phase;
  deload: boolean;
}

export type Basis = 'exact' | 'estimated';

export type SegmentKind =
  'warmup' | 'cooldown' | 'easy' | 'long' | 'rep' | 'recovery' | 'continuous' | 'stride' | 'race';

export interface Segment {
  kind: SegmentKind;
  /** 'jog' = oporavak (km po srednjem E, D14). */
  zone: Zone | 'jog';
  km: number;
  sec: number;
  paceSecPerKm: number;
  kmBasis: Basis;
  secBasis: Basis;
}

/** Struktura doze: kontinuirano (km), jednake deonice ili piramida (I, D10). */
export type Structure =
  | { form: 'continuous'; km: number }
  | { form: 'reps'; reps: number; repM: number }
  | { form: 'pyramid'; repsM: readonly number[] };

export type LadderId = 'R' | 'T_continuous' | 'T_cruise' | 'I' | 'RP';

/** Kako je doza izabrana (quality.ts, D12; D5/D7 za rasterećenje/taper). */
export type DoseStep =
  | 'start'
  | 'next'
  | 'transition'
  | 'alt'
  | 'repeat'
  /** D11 ispred D12: nijedan cilj nije izvodljiv uz „doza ne pada" → najviši nivo u plafonu. */
  | 'drop'
  | 'deload'
  | 'taper'
  | 'sharpener';

export interface Dose {
  ladder: LadderId | 'RP_sharpener';
  zone: WorkZone;
  /** Ukupno u zoni [m]. */
  doseM: number;
  structure: Structure;
  step: DoseStep;
}

export type BlockSpec =
  | { kind: 'warmup' | 'cooldown'; sec: number }
  | { kind: 'easy'; km: number }
  | { kind: 'easy_time'; sec: number }
  | { kind: 'long'; km: number }
  | { kind: 'continuous'; zone: WorkZone; km: number }
  | {
      kind: 'reps';
      zone: WorkZone;
      reps: number;
      /** Deonica distancom ili vremenom (ubrzanja). */
      rep: { m: number } | { sec: number };
      /** Oporavak posle svake deonice osim poslednje. */
      recovery: { m: number } | { sec: number };
      stride?: boolean;
    }
  | {
      kind: 'pyramid';
      zone: WorkZone;
      repsM: readonly number[];
      /** Oporavak posle deonice i (i < poslednje). */
      recoveries: readonly ({ m: number } | { sec: number })[];
    }
  | { kind: 'race'; km: number };

export type WorkoutKind = 'easy' | 'long' | 'quality' | 'race';

export type QualityType = 'R' | 'T_continuous' | 'T_cruise' | 'I' | 'RP' | 'RP_sharpener';

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
  /** Km rada po zoni (deonice, kontinuirano). Ubrzanja i oporavak nisu rad. */
  workKm: Record<WorkZone, number>;
  /** Najduža pojedinačna deonica / kontinuirani blok po zoni [s]. */
  maxBoutSec: Record<WorkZone, number>;
  /** Izbor doze za trening kvaliteta; null za lagan, dugi i trku. */
  dose: Dose | null;
}

export type DayRole = 'q1' | 'q2' | 'long' | 'easy' | 'sharpener' | 'eve' | 'race';

export interface PlanDay {
  date: IsoDate;
  weekday: Weekday;
  role: DayRole;
  hard: boolean;
  /** Trka (sa WU/CD) se ne računa u nedeljni obim (D8). */
  countsToWeek: boolean;
  workout: Workout;
}

export interface PlanWeek extends WeekFrame {
  /** Cilj nedelje (volume.ts). */
  targetKm: number;
  /** Zbir dana koji se računaju u obim. */
  plannedKm: number;
  /** Cilj po pravilu D6/D5/D7 pre provere izvodljivosti. */
  nominalKm: number;
  /** D6: nominalni cilj nije izvodljiv → najbliži izvodljiv ('down' / 'up'); null = cilj po pravilu. */
  fitted: 'down' | 'up' | null;
  days: PlanDay[];
  notes: string[];
}

/** D9 šablon: Q1 (i Q2 kod 4–6 dana; null kod 3 dana, D18), dugi i lagani dani (rastućim danom). */
export interface Pattern {
  long: Weekday;
  q1: Weekday;
  q2: Weekday | null;
  easy: readonly Weekday[];
}

export type GoalStatus = 'realistic' | 'ambitious' | 'unrealistic';

export interface GoalAssessment {
  goalTimeSec: number;
  goalVdot: number;
  /** VDOT cilja − trenutni VDOT. */
  vdotGap: number;
  weeks: number;
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

export interface TenKV2Plan {
  policyId: string;
  policyVersion: string;
  input: TenKV2Input;
  vdot: number;
  paces: Paces;
  predicted10kSec: number;
  goal: GoalAssessment | null;
  pattern: Pattern;
  startKm: number;
  /** D6: min(start × 1,4; start + 15; max nedelje D17) — granica izgradnje pre kapaciteta konstrukcije. */
  peakCapKm: number;
  /** Najveći cilj izgradnje u planu (vrh). */
  peakKm: number;
  notes: string[];
  weeks: PlanWeek[];
  warnings: Violation[];
}

export type GenerateResult = { ok: true; plan: TenKV2Plan } | { ok: false; reasons: Reason[] };

/** Korak adaptacije (segment 04). Do tada nema koraka: construct(input, []). */
export type TenKV2AdaptStep = never;
