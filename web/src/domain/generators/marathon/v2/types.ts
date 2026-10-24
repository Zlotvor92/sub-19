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
  /** 3–6 različitih dana (M1, M15). */
  runDays: readonly Weekday[];
  /** Dan dugog trka (M9); bez njega nedelja ako je dan trčanja, inače poslednji dan trčanja. */
  longRunDay?: Weekday | null;
  /** Prosek poslednje 4 nedelje [km]. */
  currentWeeklyKm: number;
  /** Rezultat ne stariji od 84 dana na dan starta (M1); bez pouzdanog rezultata plan po osećaju (M16). */
  recentResult?: MarathonV2Result | null;
  /** Ciljno vreme maratona [s]; samo se ocenjuje (M3), ne menja tempo. Plan po osećaju: bez ocene (M16). */
  goalTimeSec?: number | null;
  /** M13a (pouka 28): skorašnji najduži trk [km], 5–42; ulazi u plafon skoka dugog nedelja 1–4. */
  recentLongRunKm?: number | null;
  /** M17: iskustvo; podrazumevano 'regular'. */
  experience?: Experience | null;
  /** M16: lagan tempo [s/km] — obavezan za plan po osećaju (bez pouzdanog rezultata). */
  easyPaceSecPerKm?: number | null;
  /** M17: trčanje/hodanje — maraton ga ne podržava (odbijanje). */
  runWalk?: boolean | null;
}

export type Experience = 'beginner' | 'regular';

/** M16: osnova tempa — rezultat ili lagan tempo (plan po osećaju). */
export type PaceBasis = 'result' | 'feel';

export type ReasonCode =
  | 'INPUT_SHAPE'
  | 'DATE_INVALID'
  | 'RACE_NOT_AFTER_START'
  | 'PLAN_NOT_WHOLE_WEEKS'
  /** Trajno: maraton traži najmanje 12 nedelja (preporuka polumaraton). */
  | 'PLAN_TOO_SHORT'
  | 'PLAN_TOO_LONG'
  | 'RUN_DAYS_INVALID'
  /** 1, 2, 7 dana trajno (M15). */
  | 'RUN_DAYS_COUNT'
  | 'LONG_DAY_INVALID'
  | 'WEEKLY_KM_TOO_LOW'
  | 'WEEKLY_KM_TOO_HIGH'
  /** M16: bez pouzdanog rezultata lagan tempo je obavezan. */
  | 'EASY_PACE_REQUIRED'
  | 'EASY_PACE_OUT_OF_RANGE'
  | 'RESULT_TOO_OLD'
  | 'RESULT_DISTANCE_UNSUPPORTED'
  | 'RESULT_TIME_INVALID'
  | 'RESULT_AFTER_START'
  | 'VDOT_TOO_LOW'
  | 'VDOT_TOO_HIGH'
  /** M17: početnik 4–5 dana. */
  | 'BEGINNER_DAYS'
  /** M17: početnik najmanje 16 nedelja. */
  | 'BEGINNER_SHORT'
  | 'RUN_WALK_NOT_SUPPORTED'
  | 'GOAL_INVALID'
  /** M13a: skorašnji najduži trk van 5–42 km. */
  | 'RECENT_LONG_INVALID'
  /** M13a: sa skorašnjim najdužim trkom plan ne može da se sastavi (pouka 6). */
  | 'RECENT_LONG_TOO_SHORT'
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
  /** M16: nedelja testa 5 km (samo plan po osećaju koji nije početnik). */
  test?: true;
  /** Segment 04: ograničenja adaptacije za ovu nedelju (steps.ts); u planu generatora polja nema. */
  limits?: WeekLimits;
}

/** Segment 04: ograničenja nedelje iz koraka adaptacije (datumski opsezi → dani nedelje, steps.ts). */
export interface WeekLimits {
  /** 'none' = bez kvaliteta; 'one' = jedan kvalitet doze rasterećenja (taper: samo MP) (A3, A4, A9). */
  quality?: 'none' | 'one';
  /** Dani bez kvaliteta i ubrzanja (zabrana po datumu; trkačka nedelja: oštrenje). */
  noQuality?: IsoDate[];
  /** Dani odmora (bol ≥ 7, A4): trening se ne pravi. */
  rest?: IsoDate[];
  /** Dani perioda bola (A4): dugi ≤ 60 min, lagani × 0,7 (≥ 5 km), bez ubrzanja. */
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
  /** 'jog' = oporavak (km po srednjem E, M14); 'test' = test 5 km (M16, nije zona rada). */
  zone: Zone | 'jog' | 'test';
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
  | { kind: 'race'; km: number }
  | { kind: 'test'; km: number };

/** 'test' = test 5 km (M16): računa se u obim, ne u dozu kvaliteta. */
export type WorkoutKind = 'easy' | 'long' | 'quality' | 'race' | 'test';

/** M16: RPE (1–10) kvaliteta u planu po osećaju. */
export interface Rpe {
  min: number;
  max: number;
  cue: string;
}

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
  /** Izbor doze za trening kvaliteta; null za lagan, dugi, test i trku. */
  dose: Dose | null;
  /** M16: RPE kvaliteta u planu po osećaju (u planu sa rezultatom polja nema). */
  rpe?: Rpe;
}

export type DayRole = 'q1' | 'q2' | 'long' | 'easy' | 'sharpener' | 'eve' | 'race' | 'test';

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

/** M9 šablon: Q1, Q2 (3 dana: null, M15), dugi i lagani dani (rastućim danom). */
export interface Pattern {
  long: Weekday;
  q1: Weekday;
  q2: Weekday | null;
  easy: readonly Weekday[];
}

/** 'orientation' (segment 04, A3): nov start i < 12 nedelja do trke — cilj je samo orijentir (M18). */
export type GoalStatus = 'realistic' | 'ambitious' | 'unrealistic' | 'orientation';

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
  /** VDOT iz rezultata ili procena iz laganog tempa (M16, samo orijentir). */
  vdot: number;
  paceBasis: PaceBasis;
  paces: Paces;
  /** Prognoza maratona [s] iz maratonskog VDOT-a (M2); null u planu po osećaju (posle testa, M16). */
  predictedMarathonSec: number | null;
  goal: GoalAssessment | null;
  pattern: Pattern;
  startKm: number;
  /** M6: min(start × 1,5; start + 30; max nedelje M15) — početnik min(1,5×; +25; max, M17) — granica
      izgradnje pre kapaciteta konstrukcije. */
  peakCapKm: number;
  /** Najveći cilj izgradnje u planu (vrh). */
  peakKm: number;
  notes: string[];
  weeks: PlanWeek[];
  warnings: Violation[];
  /** Segment 04: istorija adaptacije (adapt.ts); u planu generatora polja nema. */
  adaptation?: MarathonV2Adaptation;
}

export type GenerateResult = { ok: true; plan: MarathonV2Plan } | { ok: false; reasons: Reason[] };

/* ---------- Segment 04: adaptacija (oblik činjenica kao 10K v2, sopstvena kopija) ---------- */

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

/** Rezultat: test plana (5 km) ili trka 5 km, 10 km, polumaraton, maraton (M18). */
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
export interface MarathonV2Facts {
  workouts?: readonly WorkoutFact[];
  results?: readonly ResultFact[];
  /** Ručno zaključani dani (dayId = datum): ostaju bajt-isti (A11). */
  lockedDayIds?: readonly string[];
  coverage?: FactsCoverage | null;
  breaks?: readonly BreakFact[];
}

/**
 * Korak adaptacije = OGRANIČENJA izvedena iz činjenica (assess.ts, jedino mesto odluka A1–A10, A17).
 * Konstruktor (generate.construct) ih primenjuje redom; plan čuva sve korake (A14).
 */
export interface MarathonV2AdaptStep {
  asOf: IsoDate;
  /** Nedelja koja sadrži asOf + 1 (sidro bola r). */
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
  /** A5: umor — prinudno rasterećenje u nedelji deloadWeek (steps.deloadWeekOf). */
  deload: boolean;
  /** Pouka 36: nedelja prinudnog rasterećenja iz ZAPISA umora (prva puna nedelja posle poslednjeg RPE zapisa
      umora) kad nije fromWeek; bez polja = fromWeek. */
  deloadWeek?: number;
  noQuality: DateRange[];
  oneQuality: DateRange[];
  rest: DateRange | null;
  pain: DateRange | null;
  /** A3 (M18): nov start i < 12 nedelja do trke → cilj „orijentir". */
  orientation: boolean;
  /** A8: nivo pre smanjenja [km] — do njega cilj raste povratnim rastom; null = bez povratka. */
  levelKm: number | null;
  /** A4/A8 (pouka 18): posle nedelje sidra `week` (sadrži asOf + 1) rast kreće od osnove min(`share` × nivo
      koraka, cilj nedelje sidra) (volume.returnBase10). */
  returnFrom: { week: number; share: number } | null;
  /** A17 (pouka 22): cilj koraka (startKm) je smanjenje — true: A2 (manjak) ili A3 (pauza); false: A6
      (višak). Korak bez startKm: polja nema. */
  reduced?: boolean;
  /** A5 (pouka 34, MAR-04b): umor sa asOf pre starta — referenca prinudnog rasterećenja nedelje 1 = nedelja 1
      generatora bez činjenica (cilj [km], dugi [km], poslednja T doza [m]; nema prethodne izgradnje). Ned 1 =
      0,8 × cilj reference, ned 2 = cilj reference (bez rasta), dalje po rasporedu; dugi reference ulazi u L
      (M13a) kao nedelja 0. Korak bez umora pre starta: polja nema. */
  preStart?: PreStartRef;
  /** MAR-08b (pouka 34, K3): prinudno rasterećenje (umor) u nedelji f > 1 bez prethodne nedelje sa dugim (npr. ned 1
      cela odmor/bol pre starta) — referenca dugog i T doze je nedelja 1 generatora bez činjenica (isto kao preStart,
      samo početno stanje dugog i T). Polje samo tada. */
  deloadRef?: PreStartRef;
  /** MAR-09 t. 2 (pouka 37 za L, M13a): cele prošle nedelje (kraj ≤ asOf) čiji su svi dani poznati iz činjenica
      (potpuna pokrivenost ili pauza) → najduži odrađen trk nedelje [km] (0 = nije trčano). Polje samo kad nije
      prazno. Čita ga lengths.jumpLongs10. */
  ranLongs?: Record<string, number>;
  /** MAR-10 (Z7): primenjen manjak izvršenja — prvi dan prozora zapisa (7 dana do asOf); kasniji korak čiji se prozor
      preklapa ne pravi nov manjak. Samo kad ga ima. */
  underFrom?: IsoDate;
}

/** Pouka 34: referenca umora pre starta (nedelja 1 generatora bez činjenica). */
export interface PreStartRef {
  targetKm: number;
  longKm: number;
  tM: number;
}

export interface MarathonV2Adaptation {
  asOf: IsoDate;
  steps: MarathonV2AdaptStep[];
  /** Nedelje sa danima iz prethodnog plana (prošlost/urađeno/zaključano) koji se razlikuju od
      konstrukcije: validator na njima proverava samo dane (nedeljna pravila važe za konstrukciju). */
  mixedWeeks: number[];
  lockedDayIds: string[];
  /** MAR-07b: urađeni dani posle asOf (dayId činjenice; npr. trening odrađen dan ranije) — zaštićeni kao zaključani;
      polje samo kad nije prazno. */
  doneDayIds?: string[];
  /** MAR-08 (pouka 37): km zaštićenih dana ≤ asOf tekuće nedelje po činjenicama (mixed.factKmOf), samo kad se
      razlikuju od planiranih; polje samo kad nije prazno. */
  factKm?: Record<string, number>;
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
  | {
      ok: true;
      plan: MarathonV2Plan;
      changes: AdaptChange[];
      reasons: AdaptReason[];
      /** Pouka 20: nova ograničenja poslednjeg koraka (steps.newLimits) — prazno = bez trake. */
      newLimits: string[];
    }
  | { ok: false; reasons: Reason[]; violations: Violation[] };
