/* HM v2 — ulazni i izlazni tipovi. Samo tipovi; nema izvršnog koda. Oblik prati 10K v2 (lakši adapter u
   fazi 2), ali je sopstvena kopija: HM v2 ne uvozi ništa van halfMarathon/v2/ (Uslov 7). */

/** ISO datum YYYY-MM-DD (običan string; format proverava input.ts). */
export type IsoDate = string;

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/** H1: 5 km, 10 km, polumaraton (21,0975 km), maraton (42,195 km). */
export type ResultDistanceM = 5000 | 10000 | 21097.5 | 42195;

export interface HmV2Result {
  distanceM: ResultDistanceM;
  timeSec: number;
  date: IsoDate;
}

export interface HmV2Input {
  /** Prvi dan nedelje 1. */
  startDate: IsoDate;
  /** Dan trke = poslednji dan poslednje nedelje. */
  raceDate: IsoDate;
  /** H1/H15: 3, 4, 5 ili 6 različitih dana. */
  runDays: readonly Weekday[];
  /** H9: dan dugog; bez njega nedelja ako je dan trčanja, inače poslednji dan trčanja. */
  longRunDay?: Weekday | null;
  /** Prosek poslednje 4 nedelje [km]. */
  currentWeeklyKm: number;
  /** H1: rezultat ne stariji od 84 dana na dan starta (segment 01: obavezan). */
  recentResult?: HmV2Result | null;
  /** Ciljno vreme polumaratona [s]; samo se ocenjuje (H3), ne menja tempo. */
  goalTimeSec?: number | null;
  /** Pouka 28 (HI7): skorašnji najduži trk [km], 5–42; opcion — u planu samo kad je dat. */
  recentLongRunKm?: number | null;
  /** H17: početnik (4–5 dana, 12–20 nedelja); podrazumevano regular. U planu samo kad je 'beginner'. */
  experience?: Experience | null;
  /** H16: lagan tempo [s/km], 270–510 — obavezan kad nema pouzdanog rezultata (plan po osećaju). */
  easyPaceSecPerKm?: number | null;
  /** H17: trčanje/hodanje — polumaraton ga ne podržava (odbijanje). */
  runWalk?: boolean | null;
}

export type Experience = 'beginner' | 'regular';

/** H16: osnova tempa — rezultat ili lagan tempo (plan po osećaju). */
export type PaceBasis = 'result' | 'feel';

export type ReasonCode =
  | 'INPUT_SHAPE'
  | 'DATE_INVALID'
  | 'RACE_NOT_AFTER_START'
  | 'PLAN_NOT_WHOLE_WEEKS'
  /** Trajno: polumaraton traži najmanje 10 nedelja (preporuka 10K). */
  | 'PLAN_TOO_SHORT'
  /** > 20 nedelja: počni kasnije. */
  | 'PLAN_TOO_LONG'
  | 'RUN_DAYS_INVALID'
  /** 1, 2 i 7 dana trajno (H15). */
  | 'RUN_DAYS_COUNT'
  | 'LONG_DAY_INVALID'
  | 'WEEKLY_KM_TOO_LOW'
  | 'WEEKLY_KM_TOO_HIGH'
  /** H16: bez pouzdanog rezultata plan po osećaju traži lagan tempo. */
  | 'EASY_PACE_REQUIRED'
  | 'EASY_PACE_OUT_OF_RANGE'
  /** H17: početnik radi sa 4–5 dana trčanja. */
  | 'BEGINNER_DAYS'
  /** H17: početnik traži najmanje 12 nedelja. */
  | 'BEGINNER_SHORT'
  /** H17: nema plana polumaratona trčanja/hodanja. */
  | 'RUN_WALK_NOT_SUPPORTED'
  | 'RESULT_DISTANCE_UNSUPPORTED'
  | 'RESULT_TIME_INVALID'
  | 'RESULT_AFTER_START'
  | 'VDOT_TOO_HIGH'
  | 'GOAL_INVALID'
  /** Pouka 28: skorašnji najduži trk van 5–42 km. */
  | 'RECENT_LONG_INVALID'
  /** Pouka 28 (HI7): sa datim skorašnjim najdužim trkom nedelja nije izvodljiva (prag u poruci). */
  | 'RECENT_LONG_TOO_SHORT'
  | 'SCHEDULE_NO_RECOVERY'
  | 'WEEK_INFEASIBLE'
  | 'PLAN_VIOLATES_POLICY';

export interface Reason {
  code: ReasonCode;
  message: string;
  week?: number;
}

export type Zone = 'E' | 'T' | 'I' | 'R' | 'RP';
/** Zone rada (plafoni H11). */
export type WorkZone = 'T' | 'I' | 'R' | 'RP';

/** Tempo [s/km]. E je opseg; ostale zone su jedna vrednost. RP = tempo prognoze polumaratona. */
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
  /** H16: nedelja testa 5 km (plan po osećaju; poslednja nedelja baze). */
  test?: true;
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
  | 'stride'
  | 'race'
  | 'test';

export interface Segment {
  kind: SegmentKind;
  /** 'jog' = oporavak (km po srednjem E, H14); 'test' = test 5 km (H16, nije zona rada). */
  zone: Zone | 'jog' | 'test';
  km: number;
  sec: number;
  paceSecPerKm: number;
  kmBasis: Basis;
  secBasis: Basis;
}

/** Struktura doze: kontinuirano (km), jednake deonice ili piramida (I, H10). */
export type Structure =
  | { form: 'continuous'; km: number }
  | { form: 'reps'; reps: number; repM: number }
  | { form: 'pyramid'; repsM: readonly number[] };

export type LadderId = 'R' | 'T_continuous' | 'T_cruise' | 'I' | 'RP';

/** Kako je doza izabrana (quality.ts, H12; H5/H7 za rasterećenje/taper). */
export type DoseStep =
  | 'start'
  | 'next'
  | 'transition'
  | 'alt'
  | 'repeat'
  /** H11 ispred H12: nijedan cilj nije izvodljiv uz „doza ne pada" → najviši nivo u plafonu. */
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
  | { kind: 'race'; km: number }
  | { kind: 'test'; km: number };

/** 'test' = test 5 km (H16): računa se u obim, ne u dozu kvaliteta. */
export type WorkoutKind = 'easy' | 'long' | 'quality' | 'race' | 'test';

/** H16: RPE kvaliteta u planu po osećaju (1–10) i opis. */
export interface Rpe {
  min: number;
  max: number;
  cue: string;
}

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
  /** Izbor doze za trening kvaliteta; null za lagan, dugi, test i trku. */
  dose: Dose | null;
  /** H16: RPE kvaliteta u planu po osećaju (u planu sa rezultatom polja nema). */
  rpe?: Rpe;
}

export type DayRole = 'q1' | 'q2' | 'long' | 'easy' | 'sharpener' | 'eve' | 'race' | 'test';

export interface PlanDay {
  date: IsoDate;
  weekday: Weekday;
  role: DayRole;
  hard: boolean;
  /** Trka (sa WU/CD) se ne računa u nedeljni obim (H8). */
  countsToWeek: boolean;
  workout: Workout;
}

export interface PlanWeek extends WeekFrame {
  /** Cilj nedelje (volume.ts). */
  targetKm: number;
  /** Zbir dana koji se računaju u obim. */
  plannedKm: number;
  /** Cilj po pravilu H6/H5/H7 pre provere izvodljivosti. */
  nominalKm: number;
  /** H6: nominalni cilj nije izvodljiv → najbliži izvodljiv ('down' / 'up'); null = cilj po pravilu. */
  fitted: 'down' | 'up' | null;
  days: PlanDay[];
  notes: string[];
}

/** H9 šablon: Q1, Q2 (3 dana: nema), dugi i lagani dani (rastućim danom). */
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

export interface HmV2Plan {
  policyId: string;
  policyVersion: string;
  input: HmV2Input;
  /** VDOT iz rezultata ili procena iz laganog tempa (H16, samo orijentir). */
  vdot: number;
  /** H16: 'feel' u planu po osećaju; u planu sa rezultatom polja nema (osnova = rezultat). */
  paceBasis?: PaceBasis;
  paces: Paces;
  /** H2: prognoza polumaratona iz trenutnog VDOT-a [s]; null u planu po osećaju (posle testa, H16). */
  predictedHmSec: number | null;
  goal: GoalAssessment | null;
  pattern: Pattern;
  startKm: number;
  /** H6: min(start × 1,4; start + 20; max nedelje) — početnik min(1,4×; +15; max), H17 — granica izgradnje
      pre kapaciteta konstrukcije. */
  peakCapKm: number;
  /** Najveći cilj izgradnje u planu (vrh). */
  peakKm: number;
  notes: string[];
  weeks: PlanWeek[];
  warnings: Violation[];
}

export type GenerateResult = { ok: true; plan: HmV2Plan } | { ok: false; reasons: Reason[] };
