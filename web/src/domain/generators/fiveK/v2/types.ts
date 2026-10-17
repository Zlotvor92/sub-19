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

/** 2.4.0: početnik = trči redovno < 6 meseci; podrazumevano 'regular' (kompatibilnost). */
export type Experience = 'beginner' | 'regular';

export interface FiveKV2Input {
  /** Prvi dan nedelje 1. */
  startDate: IsoDate;
  /** Dan trke = poslednji dan poslednje nedelje. */
  raceDate: IsoDate;
  runDays: readonly Weekday[];
  currentWeeklyKm: number;
  /** 2.4.0: izostavljen ili stariji od 12 nedelja → plan po osećaju (star se samo prikazuje). */
  recentResult?: FiveKV2Result | null;
  /** Ciljno vreme 5K [s]; samo se procenjuje, ne menja tempo. */
  goalTimeSec?: number | null;
  /** 2.4.0: uobičajen lagan tempo korisnika [s/km]; obavezan bez pouzdanog rezultata. */
  typicalEasyPaceSecPerKm?: number | null;
  /** 2.4.0: podrazumevano 'regular'. */
  experience?: Experience;
  /** 2.4.0: može 30 min kontinuirano; početnik mora true (run/walk još nije podržan). */
  canRun30Min?: boolean;
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
  | 'MISSING_EASY_PACE'
  | 'EASY_PACE_OUT_OF_RANGE'
  | 'RUN_WALK_NOT_SUPPORTED_YET'
  | 'VDOT_OUT_OF_RANGE'
  | 'GOAL_INVALID'
  | 'QUALITY_INFEASIBLE'
  | 'WEEK_INFEASIBLE'
  | 'PLAN_VIOLATES_POLICY'
  /* 2.5.0: adaptacija (adapt.ts / assess.ts). */
  | 'ADAPT_PLAN_INVALID'
  | 'ADAPT_AS_OF_INVALID'
  | 'ADAPT_FACT_INVALID'
  | 'ADAPT_FACT_AFTER_AS_OF'
  | 'ADAPT_DAY_UNKNOWN'
  | 'ADAPT_RESULT_INVALID'
  | 'ADAPT_PROTECTION';

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

/** 2.4.0: plan po osećaju (bez pouzdanog rezultata) — samo E iz podatka korisnika (±15 s), bez VDOT-a
    i bez brojčanog tempa ostalih zona. */
export interface FeelPaces {
  vdot: null;
  E: { fast: number; slow: number };
}

export type PaceModel = Paces | FeelPaces;

/** 2.4.0: napor za deo treninga po osećaju (RPE 1–10 + opis). */
export interface Effort {
  rpeMin: number;
  rpeMax: number;
  cue: string;
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
  /** 2.4.0: kontrolno trčanje 3 km umesto glavnog kvaliteta (samo plan po osećaju). */
  test: boolean;
  /** 2.5.0: ograničenja adaptacije za ovu nedelju (steps.ts); izostavljeno u planu generatora. */
  limits?: WeekLimits;
}

/** 2.5.0: ograničenja nedelje izvedena iz koraka adaptacije (datumski opsezi → dani nedelje). */
export interface WeekLimits {
  /** 'none' = bez kvaliteta (ni ubrzanja na tim danima); 'one' = jedan kvalitet doze rasterećenja. */
  quality?: 'none' | 'one';
  /** Jedini kvalitet ide na dan q2 šablona (dan q1 je u zabrani). */
  swap?: true;
  /** Dani bez kvaliteta (zabrana po datumu; trkačka nedelja: oštrenje). */
  noQuality?: IsoDate[];
  /** Dani odmora (bol ≥ 7): trening se ne pravi. */
  rest?: IsoDate[];
  /** Dani perioda bola: dugi ≤ 60 min, lagani −30%, bez ubrzanja. */
  pain?: IsoDate[];
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
  | 'race'
  | 'test';

export interface Segment {
  kind: SegmentKind;
  /** 'jog' = oporavak (računa se sporijom granicom E). */
  zone: Zone | 'jog';
  km: number;
  sec: number;
  /** 2.4.0: null = po osećaju (bez brojčanog tempa); km/trajanje su tada procenjeni E tempom. */
  paceSecPerKm: number | null;
  kmBasis: Basis;
  secBasis: Basis;
  /** 2.4.0: napor za deo po osećaju. */
  effort?: Effort;
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
      /** 2.4.0: po osećaju (RPE + opis), bez brojčanog tempa. */
      effort?: Effort;
    }
  | { kind: 'progression'; steps: readonly { zone: Zone; km: number }[] }
  | { kind: 'race'; km: number; effort?: Effort }
  | { kind: 'test'; km: number; effort: Effort };

export type WorkoutKind = 'easy' | 'long' | 'quality' | 'race';

export type QualityType =
  | 'R'
  | 'R_sharpen'
  | 'T_short'
  | 'T_cruise'
  | 'I'
  | 'RP'
  | 'RP_sharpener'
  /* 2.4.0: po osećaju (feel.ts). */
  | 'HILLS'
  | 'FARTLEK'
  | 'FARTLEK_RP'
  | 'TEMPO_FEEL'
  | 'TEST_3K';

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
  /** 2.3.0 (Odluka 5): rasteretna nedelja čiji je kvalitet samo ubrzanja na laganom danu.
      2.4.0: i nedelje 1–2 početnika (samo lagano + ubrzanja). */
  stridesOnly: boolean;
  days: PlanDay[];
  notes: string[];
}

/** 2.3.0: q2 = null za 3 dana (jedan kvalitet); easy = lagani dani šablona (1 za 3–4, 2 za 5 dana).
    2.4.0: početnik q2 = null (4 dana: 2 lagana). */
export interface Pattern {
  long: Weekday;
  q1: Weekday;
  q2: Weekday | null;
  easy: readonly Weekday[];
}

/** 2.4.0: 'orientation' = najviše što početnik dobija; 'insufficient_data' = bez pouzdanog rezultata. */
export type GoalStatus =
  'feasible' | 'ambitious' | 'unrealistic' | 'orientation' | 'insufficient_data';

export interface GoalAssessment {
  goalTimeSec: number;
  /** null bez pouzdanog rezultata (nema broja). */
  goalVdot: number | null;
  vdotGap: number | null;
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
  /** 2.4.0: 'feel' = bez pouzdanog rezultata (izostavljen ili stariji od 12 nedelja). */
  paceMode: 'vdot' | 'feel';
  experience: Experience;
  /** null u planu po osećaju. */
  vdot: number | null;
  paces: PaceModel;
  /** null u planu po osećaju („nedovoljno podataka"). */
  predicted5kSec: number | null;
  goal: GoalAssessment | null;
  pattern: Pattern;
  startKm: number;
  peakKm: number;
  /** 2.2.0: najveći nedeljni cilj koji izabrani broj dana nosi (volume.ts); svaki cilj ≤ ovog. */
  capacityKm: number;
  /** 2.3.0: napomene celog plana (npr. kratka priprema). */
  notes: string[];
  weeks: PlanWeek[];
  warnings: Violation[];
  /** 2.5.0: istorija adaptacije (adapt.ts); izostavljeno u planu generatora. */
  adaptation?: FiveKV2Adaptation;
}

export type GenerateResult =
  { ok: true; plan: FiveKV2Plan } | { ok: false; reasons: Reason[]; violations: Violation[] };

/* ---------- 2.5.0: adaptacija ---------- */

/** Izvršen (ili propušten) trening. `dayId` = datum dana plana (jedan trening po datumu u v2). */
export interface WorkoutFact {
  date: IsoDate;
  dayId?: string;
  km: number;
  durationSec: number;
  completed: boolean;
  /** 1–10. */
  rpe?: number;
  /** 0–10. */
  pain?: number;
}

export interface ResultFact {
  distM: number;
  sec: number;
  date: IsoDate;
  kind: 'test' | 'race';
}

/** Činjenice (ne odluke). Prazni nizovi = nema podataka (ne pauza). */
export interface AdaptFacts {
  workouts?: readonly WorkoutFact[];
  results?: readonly ResultFact[];
  /** Ručno zaključani dani (dayId = datum): ostaju bajt-isti. */
  lockedDayIds?: readonly string[];
}

export interface DateRange {
  from: IsoDate;
  to: IsoDate;
}

/**
 * Jedan korak adaptacije = OGRANIČENJA izvedena iz činjenica (assess.ts, jedino mesto). Konstruktor
 * (generate.construct) ih primenjuje redom; plan čuva sve korake (ponovna adaptacija ih ponavlja).
 */
export interface AdaptStep {
  asOf: IsoDate;
  /** Nedelja koja sadrži asOf + 1. */
  firstWeek: number;
  /** Prva puna nedelja posle asOf („sledeća nedelja"; broj nedelja + 1 ako je nema). */
  fromWeek: number;
  /** Novi rezultat i VDOT (važi od fromWeek). */
  result: ResultFact | null;
  vdot: number | null;
  /** Cilj nedelje fromWeek (pauza, izvršenje, „više od plana"); pauza: i ostatak firstWeek. */
  startKm: number | null;
  pauseRemainder: boolean;
  /** Pauza ≥ 28 dana: nov start (faze preostale izgradnje iz periodize, vrh iz novog starta). */
  restart: boolean;
  /** Umor: fromWeek je rasterećenje. */
  deload: boolean;
  noQuality: DateRange[];
  oneQuality: DateRange[];
  rest: DateRange | null;
  pain: DateRange | null;
  /** Cilj → „orijentir" (nov start, < 6 nedelja do trke). */
  orientation: boolean;
}

export interface FiveKV2Adaptation {
  asOf: IsoDate;
  steps: AdaptStep[];
  /** Nedelje sa danima iz prethodnog plana (prošlost/zaključano) koji se razlikuju od konstrukcije:
      validator na njima proverava samo dane (nedeljna pravila važe za konstrukciju). */
  mixedWeeks: number[];
  lockedDayIds: string[];
}

export type AdaptCondition =
  | 'NO_FACTS'
  | 'NEW_RESULT'
  | 'RESULT_IGNORED'
  | 'UNDER_EXECUTION'
  | 'OVER_EXECUTION'
  | 'PAUSE'
  | 'PAIN'
  | 'FATIGUE';

/** Aktivan uslov iz činjenica; `applied` = false kad ga nadjačava viši prioritet ili ne važi. */
export interface AdaptReason {
  condition: AdaptCondition;
  applied: boolean;
  message: string;
}

export interface AdaptChange {
  week: number;
  date?: IsoDate;
  field: string;
  before: string;
  after: string;
}

export type AdaptResult =
  | { ok: true; plan: FiveKV2Plan; changes: AdaptChange[]; reasons: AdaptReason[] }
  | { ok: false; reasons: Reason[]; violations: Violation[] };
