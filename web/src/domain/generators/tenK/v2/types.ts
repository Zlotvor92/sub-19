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
  /** Ciljno vreme 10K [s]; samo se ocenjuje (D3), ne menja tempo. Plan po osećaju: bez ocene (D26). */
  goalTimeSec?: number | null;
  /** D28: iskustvo; podrazumevano 'regular'. */
  experience?: Experience | null;
  /** D26: lagan tempo [s/km] — obavezan za plan po osećaju (bez pouzdanog rezultata). */
  easyPaceSecPerKm?: number | null;
  /** D29: trčanje/hodanje — 10K ga ne podržava (odbijanje). */
  runWalk?: boolean | null;
}

export type Experience = 'beginner' | 'regular';

/** D26: osnova tempa — rezultat ili lagan tempo (plan po osećaju). */
export type PaceBasis = 'result' | 'feel';

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
  /** D26: plan po osećaju bez laganog tempa (ili rezultata). */
  | 'EASY_PACE_REQUIRED'
  | 'EASY_PACE_OUT_OF_RANGE'
  /** D28: početnik 5–6 dana ili 8–9 nedelja. */
  | 'BEGINNER_DAYS'
  | 'BEGINNER_SHORT'
  /** D29: nema 10K plana trčanja/hodanja. */
  | 'RUN_WALK_NOT_SUPPORTED'
  | 'RESULT_DISTANCE_UNSUPPORTED'
  | 'RESULT_TIME_INVALID'
  | 'RESULT_AFTER_START'
  | 'VDOT_TOO_HIGH'
  | 'GOAL_INVALID'
  | 'SCHEDULE_NO_RECOVERY'
  | 'WEEK_INFEASIBLE'
  | 'PLAN_VIOLATES_POLICY'
  /* Segment 04 (adaptacija, adapt.ts). */
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
  /** D27: nedelja testa 5 km (samo plan po osećaju; inače polja nema). */
  test?: true;
  /** Segment 04: ograničenja adaptacije za ovu nedelju (steps.ts); u planu generatora polja nema. */
  limits?: WeekLimits;
}

/** Segment 04: ograničenja nedelje iz koraka adaptacije (datumski opsezi → dani nedelje, steps.ts). */
export interface WeekLimits {
  /** 'none' = bez kvaliteta; 'one' = jedan kvalitet doze rasterećenja (A3, A4, A9). */
  quality?: 'none' | 'one';
  /** Jedini kvalitet ide na drugi dan kvaliteta šablona (dan slota rasterećenja je u zabrani). */
  swap?: true;
  /** Dani bez kvaliteta i ubrzanja (zabrana po datumu; trkačka nedelja: oštrenje). */
  noQuality?: IsoDate[];
  /** Dani odmora (bol ≥ 7, A4): trening se ne pravi. */
  rest?: IsoDate[];
  /** Dani perioda bola (A4): dugi ≤ 60 min, lagani × 0,7 (≥ 3 km), bez ubrzanja. */
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
  | 'stride'
  | 'race'
  | 'test';

export interface Segment {
  kind: SegmentKind;
  /** 'jog' = oporavak (km po srednjem E, D14); 'test' = test 5 km (D27, nije zona rada). */
  zone: Zone | 'jog' | 'test';
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
  | { kind: 'race'; km: number }
  | { kind: 'test'; km: number };

/** 'test' = test 5 km (D27): računa se u obim, ne u dozu kvaliteta. */
export type WorkoutKind = 'easy' | 'long' | 'quality' | 'race' | 'test';

/** D26: subjektivni napor kvaliteta (plan po osećaju). */
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
  /** D26: RPE kvaliteta u planu po osećaju (u planu sa rezultatom polja nema). */
  rpe?: Rpe;
}

export type DayRole = 'q1' | 'q2' | 'long' | 'easy' | 'sharpener' | 'eve' | 'race' | 'test';

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

/** 'orientation' (segment 04, A3): nov start i < 8 nedelja do trke — cilj je samo orijentir. */
export type GoalStatus = 'realistic' | 'ambitious' | 'unrealistic' | 'orientation';

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
  /** VDOT iz rezultata ili procena iz laganog tempa (D26, samo orijentir). */
  vdot: number;
  paceBasis: PaceBasis;
  paces: Paces;
  /** Prognoza 10K; null u planu po osećaju (posle testa, D26). */
  predicted10kSec: number | null;
  goal: GoalAssessment | null;
  pattern: Pattern;
  startKm: number;
  /** D6/D28: min(start × 1,4; start + 15; max nedelje D17) — početnik 1,3× / +10 — granica izgradnje pre
      kapaciteta konstrukcije. */
  peakCapKm: number;
  /** Najveći cilj izgradnje u planu (vrh). */
  peakKm: number;
  notes: string[];
  weeks: PlanWeek[];
  warnings: Violation[];
  /** Segment 04: istorija adaptacije (adapt.ts); u planu generatora polja nema. */
  adaptation?: TenKV2Adaptation;
}

export type GenerateResult = { ok: true; plan: TenKV2Plan } | { ok: false; reasons: Reason[] };

/* ---------- Segment 04: adaptacija (oblik činjenica kao 5K v2, sopstvena kopija) ---------- */

/** Izvršen (ili propušten) trening. `dayId` = datum dana plana (jedan trening po datumu); bez dayId =
    zapis van plana. */
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
  distM: ResultDistanceM;
  sec: number;
  date: IsoDate;
  kind: 'test' | 'race';
}

export interface DateRange {
  from: IsoDate;
  to: IsoDate;
}

/** Potpunost zapisa u [from, to] (A10): complete = true → dan bez zapisa = bez trčanja; false ili bez
    coverage → dan bez zapisa je NEPOZNAT. */
export interface FactsCoverage extends DateRange {
  complete: boolean;
}

/** Eksplicitna pauza (A3, A10: priznaje se bez obzira na coverage). */
export interface BreakFact extends DateRange {
  kind: 'break';
}

/** Činjenice (ne odluke). Prazni nizovi = nema podataka (ne pauza). */
export interface TenKV2Facts {
  workouts?: readonly WorkoutFact[];
  results?: readonly ResultFact[];
  /** Ručno zaključani dani (dayId = datum): ostaju bajt-isti (A11). */
  lockedDayIds?: readonly string[];
  coverage?: FactsCoverage | null;
  breaks?: readonly BreakFact[];
}

/**
 * Korak adaptacije = OGRANIČENJA izvedena iz činjenica (assess.ts, jedino mesto odluka A1–A10).
 * Konstruktor (generate.construct) ih primenjuje redom; plan čuva sve korake (A14).
 */
export interface TenKV2AdaptStep {
  asOf: IsoDate;
  /** Nedelja koja sadrži asOf + 1. */
  firstWeek: number;
  /** Prva puna nedelja posle asOf („sledeća nedelja"; broj nedelja + 1 ako je nema). */
  fromWeek: number;
  /** A1: novi rezultat i VDOT (važi od fromWeek). */
  result: ResultFact | null;
  vdot: number | null;
  /** A2/A3/A6: cilj nedelje fromWeek [km]; pauza: i ostatak firstWeek (pauseRemainder). */
  startKm: number | null;
  pauseRemainder: boolean;
  /** A3: pauza ≥ 28 dana — nov start (faze preostale izgradnje ponovo, vrh od novog starta). */
  restart: boolean;
  /** A5: umor — fromWeek je rasterećenje. */
  deload: boolean;
  noQuality: DateRange[];
  oneQuality: DateRange[];
  rest: DateRange | null;
  pain: DateRange | null;
  /** A3: nov start i < 8 nedelja do trke → cilj „orijentir". */
  orientation: boolean;
  /** A8: nivo pre smanjenja [km] — do njega cilj raste povratnim rastom; null = bez povratka. */
  levelKm: number | null;
  /** A4/A8 (10k-v2.4.1): posle nedelje sidra `week` (sadrži asOf + 1) rast kreće od osnove min(`share` × nivo
      koraka, cilj nedelje sidra); korak bez nivoa: `share` × cilj nedelje sidra (volume.returnBase10). */
  returnFrom: { week: number; share: number } | null;
  /** A17 (10k-v2.5.0): cilj koraka (startKm) je smanjenje — true: A2 (manjak) ili A3 (pauza); false: A6
      (višak). Korak bez startKm i korak sačuvan pre 10k-v2.5.0: polja nema (steps.reducedWeeks). */
  reduced?: boolean;
}

export interface TenKV2Adaptation {
  asOf: IsoDate;
  steps: TenKV2AdaptStep[];
  /** Nedelje sa danima iz prethodnog plana (prošlost/urađeno/zaključano) koji se razlikuju od
      konstrukcije: validator na njima proverava samo dane (nedeljna pravila važe za konstrukciju). */
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
  | 'FATIGUE'
  | 'TEST_MOVED';

/** Aktivan uslov iz činjenica; `applied` = false kad ga nadjačava viši prioritet ili ne važi (A7). */
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
  | { ok: true; plan: TenKV2Plan; changes: AdaptChange[]; reasons: AdaptReason[] }
  | { ok: false; reasons: Reason[]; violations: Violation[] };
