/* Maraton v2 — ulazni i izlazni tipovi. Samo tipovi; nema izvršnog koda. Oblik prati 10K v2 (lakši adapter
   u fazi 2), ali je sopstvena kopija: maraton v2 ne uvozi ništa van marathon/v2/. */

/** ISO datum YYYY-MM-DD (običan string; format proverava input.ts). */
export type IsoDate = string;

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/** 5 km (uz upozorenje, M1), 10 km, polumaraton (21,0975 km), maraton (42,195 km). */
export type ResultDistanceM = 5000 | 10000 | 21097.5 | 42195;

export interface MarathonV2Result {
  distanceM: ResultDistanceM;
  timeSec: number;
  date: IsoDate;
}

export interface MarathonV2Input {
  /** Prvi dan nedelje 1. */
  startDate: IsoDate;
  /** Dan trke = poslednji dan poslednje nedelje. */
  raceDate: IsoDate;
  /** 4 različita dana (M1, M15 red 4). */
  runDays: readonly Weekday[];
  /** Dan dugog trka (M9); bez njega nedelja ako je dan trčanja, inače poslednji dan trčanja. */
  longRunDay?: Weekday | null;
  /** Prosek poslednje 4 nedelje [km]. */
  currentWeeklyKm: number;
  /** Rezultat ne stariji od 84 dana na dan starta (M1); u segmentu 01 obavezan. */
  recentResult?: MarathonV2Result | null;
  /** Ciljno vreme maratona [s]; samo se ocenjuje (M3), ne menja tempo. */
  goalTimeSec?: number | null;
}

export type ReasonCode =
  | 'INPUT_SHAPE'
  | 'DATE_INVALID'
  | 'RACE_NOT_AFTER_START'
  | 'PLAN_NOT_WHOLE_WEEKS'
  /** Trajno: maraton traži najmanje 12 nedelja (preporuka polumaraton). */
  | 'PLAN_TOO_SHORT'
  | 'PLAN_TOO_LONG'
  | 'RUN_DAYS_INVALID'
  /** 1, 2, 7 dana trajno; 3, 5, 6 dana od segmenta 02. */
  | 'RUN_DAYS_COUNT'
  | 'LONG_DAY_INVALID'
  | 'WEEKLY_KM_TOO_LOW'
  | 'WEEKLY_KM_TOO_HIGH'
  /** Segment 01: rezultat je obavezan (plan po osećaju i početnik: segment 03). */
  | 'RESULT_REQUIRED'
  | 'RESULT_TOO_OLD'
  | 'RESULT_DISTANCE_UNSUPPORTED'
  | 'RESULT_TIME_INVALID'
  | 'RESULT_AFTER_START'
  | 'VDOT_TOO_LOW'
  | 'VDOT_TOO_HIGH'
  | 'BEGINNER_SEGMENT_03'
  | 'RUN_WALK_NOT_SUPPORTED'
  | 'GOAL_INVALID'
  | 'SCHEDULE_NO_RECOVERY'
  | 'WEEK_INFEASIBLE'
  | 'PLAN_VIOLATES_POLICY';

export interface Reason {
  code: ReasonCode;
  message: string;
  week?: number;
}

export type Zone = 'E' | 'T' | 'I' | 'R' | 'MP';
/** Zone rada (plafoni M11). */
export type WorkZone = 'T' | 'I' | 'R' | 'MP';

/** Tempo [s/km]. E je opseg; ostale zone su jedna vrednost. */
export interface Paces {
  /** Trenutni VDOT (zone E/T/I/R). */
  vdot: number;
  /** M2: VDOT umanjen za korekciju obima (osnova MP i prognoze maratona). */
  mpVdot: number;
  E: { fast: number; slow: number };
  T: number;
  I: number;
  R: number;
  MP: number;
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
  /** 'jog' = oporavak (km po srednjem E, M14). */
  zone: Zone | 'jog';
  km: number;
  sec: number;
  paceSecPerKm: number;
  kmBasis: Basis;
  secBasis: Basis;
}

/** Struktura doze: kontinuirano (km), jednake deonice ili piramida (I, M10). */
export type Structure =
  | { form: 'continuous'; km: number }
  | { form: 'reps'; reps: number; repM: number }
  | { form: 'pyramid'; repsM: readonly number[] };

export type LadderId = 'R' | 'T_continuous' | 'T_cruise' | 'I' | 'MP';

/** Kako je doza izabrana (quality.ts, M12; M5/M7 za rasterećenje/taper). */
export type DoseStep =
  | 'start'
  | 'next'
  | 'transition'
  | 'alt'
  | 'repeat'
  /** M11 ispred M12: nijedan cilj nije izvodljiv uz „doza ne pada" → najviši nivo u plafonu. */
  | 'drop'
  | 'deload'
  | 'taper'
  | 'sharpener';

export interface Dose {
  ladder: LadderId | 'MP_sharpener';
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

export type QualityType = 'R' | 'T_continuous' | 'T_cruise' | 'I' | 'MP' | 'MP_sharpener';

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
  /** Izbor doze za trening kvaliteta; null za lagan, dugi i trku. */
  dose: Dose | null;
}

export type DayRole = 'q1' | 'q2' | 'long' | 'easy' | 'sharpener' | 'eve' | 'race';

export interface PlanDay {
  date: IsoDate;
  weekday: Weekday;
  role: DayRole;
  hard: boolean;
  /** Trka (sa WU) se ne računa u nedeljni obim (M8). */
  countsToWeek: boolean;
  workout: Workout;
}

export interface PlanWeek extends WeekFrame {
  /** Cilj nedelje (volume.ts). */
  targetKm: number;
  /** Zbir dana koji se računaju u obim. */
  plannedKm: number;
  /** Cilj po pravilu M6/M5/M7 pre provere izvodljivosti. */
  nominalKm: number;
  /** M6: nominalni cilj nije izvodljiv → najbliži izvodljiv ('down' / 'up'); null = cilj po pravilu. */
  fitted: 'down' | 'up' | null;
  days: PlanDay[];
  notes: string[];
}

/** M9 šablon: Q1, Q2, dugi i lagani dani (rastućim danom). */
export interface Pattern {
  long: Weekday;
  q1: Weekday;
  q2: Weekday;
  easy: readonly Weekday[];
}

export type GoalStatus = 'realistic' | 'ambitious' | 'unrealistic';

export interface GoalAssessment {
  goalTimeSec: number;
  goalVdot: number;
  /** VDOT cilja − maratonski VDOT (M2: umanjen za korekciju obima). */
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

export interface MarathonV2Plan {
  policyId: string;
  policyVersion: string;
  input: MarathonV2Input;
  vdot: number;
  paces: Paces;
  /** Prognoza maratona [s] iz maratonskog VDOT-a (M2). */
  predictedMarathonSec: number;
  goal: GoalAssessment | null;
  pattern: Pattern;
  startKm: number;
  /** M6: min(start × 1,5; start + 30; max nedelje M15) — granica izgradnje pre kapaciteta konstrukcije. */
  peakCapKm: number;
  /** Najveći cilj izgradnje u planu (vrh). */
  peakKm: number;
  notes: string[];
  weeks: PlanWeek[];
  warnings: Violation[];
}

export type GenerateResult = { ok: true; plan: MarathonV2Plan } | { ok: false; reasons: Reason[] };
