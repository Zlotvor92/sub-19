/* ============================================================
   TIPOVI GENERATORA PLANA — WIRE OBLIK.

   Izlaz `generatePlan` je istovremeno i PERZISTIRANI oblik (`S.genPlan` u
   `user_state.data`, schema v12). Zato polja zadržavaju stara imena (`tag`,
   `desc`, `km`, `session.type`, `p5k`, …) i ne smeju se preimenovati bez bump-a
   SCHEMA i unazad-kompatibilnog čitanja — v. docs/REWRITE_PLAN.md odluka B.

   Engleski nazivi iz zadatka postoje kao tipovi (IntervalSession, TempoSession,
   LongRunDay, RaceDay, RestDay …), ali nose stare ključeve.
   ============================================================ */

import type { IsoDate } from '../date';

export type Intensity = 'kons' | 'std' | 'agr';
export type QualityReadiness = 'beginner' | 'returning' | 'developing' | 'experienced';
export type QualityExperience = 'none' | 'some' | 'experienced';

export interface AthleteAssessment {
  qualityReadiness: QualityReadiness;
  /** Current load tolerance is separate from confirmed historical continuity. */
  currentReadiness?: 'normal' | 'returning' | 'fatigued' | 'reduced-volume';
  weeklyBaseKm: number;
  repeatableLongRunKm: number;
  longRunBasis: 'reported' | 'inferred';
  consistentWeeks: number | null;
  breakWeeks: number;
  resultAgeDays: number | null;
  speedConfidence: 'recent-result' | 'undated-result' | 'stale-result' | 'returning';
  assumptions: string[];
}

/** Koliko se istorijska referenca brzine sme koristiti za propisivanje rada. */
export interface FormPolicy {
  /** `effort-first`: napor vodi, ritam je samo orijentir iz starog rezultata. */
  basis: 'confirmed' | 'effort-first';
  reason: string;
  /** Uslovi za uvođenje zahtevnijeg rada; prazno kad je forma potvrđena. */
  entryConditions: string[];
}

/** Faza trčanja/hoda: koraci lestvice po nedelji i prelaz koji korisnik mora da potvrdi. */
export interface RunWalkPhase {
  /** Korak lestvice (1–4) za svaku nedelju faze, redom. */
  ladder: number[];
  /** Prva nedelja sa neprekidnim trčanjem; probna dok se tolerancija ne potvrdi. */
  transitionWeek: number;
  /** Effective calendar anchor after grafting into an existing plan. */
  transitionStart?: IsoDate;
  conditions: string[];
}

export interface PreparationAssessment {
  endurance: 'limited' | 'developing' | 'supported';
  goalStatus: 'needs-speed-improvement' | 'endurance-limited' | 'reference-only';
  peakLongRunKm: number;
  peakWeeklyKm: number;
  demandingDaysMax: number;
  reasons: string[];
  /** No validated individual improvement model: the reference is not a forecast. */
  forecastBasis: 'result-and-delivered-preparation';
}
export type Zone = 'I' | 'T' | 'M' | 'E' | 'LR' | 'R';

/** Podržane ciljne distance u metrima. Ključ profila distance. */
export type RaceDistanceM = 5000 | 10000 | 21097.5 | 42195;

export interface RunWalk {
  runSec: number;
  walkSec: number;
  label: string;
}

/** Structured additions survive rendering, persistence and watch export. */
export interface FastFinish {
  km: number;
  paceSec: number;
  zone: 'M' | 'RP';
}
export interface Strides {
  reps: number;
  runSec: number;
  restSec: number;
  paceSec: number;
}

/* ---------- sesije (kvalitetni treninzi) ---------- */

export type SessionPurpose = 'T' | 'I' | 'R' | 'RP' | 'M' | 'activation';

interface SessionBase {
  /** Explicit prescription intent; optional for historical stored sessions. */
  purpose?: SessionPurpose;
  /** Display label; measured-form inference has a separate legacy map. */
  kind: string;
  wuKm: number;
  cdKm: number;
  paceSec: number;
  /** Polja koja je korisnik ručno zaključao (rekalibracija ih ne sme pregaziti). */
  overrides: Record<string, boolean>;
  /** Izvorni tempo pre automatskog prilagođavanja formi (v. adaptation). */
  paceSec0?: number;
  zone?: Zone | 'RP';
  paceSource?: 'current-fitness' | 'race-specific';
  /** `reference`: ritam iz neproverene reference (star rezultat/pauza), vodi se naporom. `measured`: prilagođen merenjem. */
  paceBasis?: 'reference' | 'measured';
  /** Coaching instructions are not replaced when kilometres are recalculated. */
  notes?: string;
}

export interface IntervalSession extends SessionBase {
  type: 'int';
  reps: number;
  repM: number;
  restSec: number;
}
export interface PyramidSession extends SessionBase {
  type: 'pyramid';
  reps: number[];
  restSec: number;
}
export interface FartlekSession extends SessionBase {
  type: 'fartlek';
  reps: number;
  repSec: number;
  restSec: number;
  easyPaceSec: number;
}
export interface ProgressionSession extends SessionBase {
  type: 'prog';
  qKm: number;
  easyPaceSec: number;
}
export interface TempoSession extends SessionBase {
  type: 'tempo';
  qKm: number;
}
export type Session =
  IntervalSession | PyramidSession | FartlekSession | ProgressionSession | TempoSession;

/** Alias iz zadatka. */
export type WorkoutSession = Session;

/* ---------- dani ---------- */

interface DayBase {
  /** 1 = ponedeljak … 7 = nedelja (generator). `adaptGeneratedPlan` ga pomera na 0–6. */
  dow: number;
  finish?: FastFinish;
  strides?: Strides;
  /** 5k-v2 (08a): strukturisan trening (v. `StructuredDay`); stariji planovi ga nemaju. */
  structure?: WorkoutStructure;
}

export interface RestDay extends DayBase {
  rest: true;
  desc: string | null;
  tag?: undefined;
  km?: undefined;
  session?: undefined;
}
export interface StrengthDay extends DayBase {
  tag: 'snaga';
  km: null;
  desc: string;
  rest?: undefined;
  session?: undefined;
}
export interface EasyRunDay extends DayBase {
  tag: 'lako';
  km: number;
  desc: string;
  rest?: undefined;
  session?: undefined;
}
export interface RunWalkDay extends DayBase {
  tag: 'rw';
  km: number;
  desc: string;
  runWalk: RunWalk;
  rest?: undefined;
  session?: undefined;
}
export interface LongRunDay extends DayBase {
  tag: 'lr';
  km: number;
  desc: string;
  /** Srednje-dugo trčanje: lagan dan koji je porastao (HM i maraton). */
  mlr?: true;
  rest?: undefined;
  session?: undefined;
}
export interface RaceDay extends DayBase {
  tag: 'trka';
  km: number;
  desc: string;
  rest?: undefined;
  session?: undefined;
}
/** Dan sa kvalitetnom sesijom (`tag` je 'int' ili 'tempo'; i kontrolna trka je 'tempo'). */
export interface SessionDay extends DayBase {
  tag: 'int' | 'tempo';
  km: number;
  desc: string;
  session: Session;
  rest?: undefined;
}

/* ---------- strukturisan trening (5k-v2, segment 08a) ----------
   Opciono proširenje formata: dan generatora koji propisuje strukturu (deo po deo: km, vreme, tempo ILI napor) nosi je
   u `structure`; prikaz (Plan tab, dan) i sat je čitaju umesto teksta. Stariji planovi je nemaju i čitaju se kao ranije. */

/** Napor dela po osećaju (RPE 1–10 i opis), kad deo nema brojčani tempo. */
export interface StructureEffort {
  rpeMin: number;
  rpeMax: number;
  cue: string;
}
export type StructureStepKind =
  | 'warmup'
  | 'cooldown'
  | 'easy'
  | 'long'
  | 'work'
  | 'recovery'
  | 'stride'
  | 'race'
  | 'test'
  | 'run'
  | 'walk';
/** Jedan deo treninga. `basis` kaže koja veličina je propisana ('exact'), a koja izračunata ('estimated'). */
export interface StructureStep {
  kind: StructureStepKind;
  /** Zona dela generatora ('E', 'T', 'I', 'R', 'RP'; 'jog' = oporavak kaskanjem); bez zone za hod/trčanje run/walk. */
  zone?: string;
  /** null = nema procene km (vremenski deo bez tempa). */
  km: number | null;
  /** null = nema procene trajanja (distanca bez tempa, npr. trka trčanja/hodanja). */
  sec: number | null;
  /** null = deo po osećaju (napor u `effort`) ili hod. */
  paceSec: number | null;
  /** Opseg tempa (brža–sporija granica) kad ga generator propisuje kao opseg (lagano). */
  paceRange?: { fast: number; slow: number };
  /** Tempo kojim je generator PROCENIO km/trajanje dela kad cilj nije tempo (trčanje run/walk iz uobičajenog laganog
   *  tempa) — podatak procene, ne propisan cilj. */
  estimatePaceSec?: number;
  kmBasis: 'exact' | 'estimated';
  secBasis: 'exact' | 'estimated';
  effort?: StructureEffort;
}
/** Blok: `reps` puta deo `step`, sa oporavkom `recovery` posle svakog ponavljanja osim poslednjeg. */
export interface StructureBlock {
  reps: number;
  step: StructureStep;
  recovery?: StructureStep;
}
export interface WorkoutStructure {
  /** Pun naslov treninga (generator). */
  title: string;
  /** Kratko ime vrste za oznaku dana i uputstvo („Repeticije", „Tempo", „Trčanje/hod"…); bez njega ime tipa dana. */
  kind?: string;
  blocks: StructureBlock[];
  /** Zbir km; null kad deo nema procenu km (trčanje/hodanje bez tempa). */
  km: number | null;
  /** Zbir trajanja [s]; null kad deo nema procenu trajanja. */
  sec: number | null;
  kmBasis: 'exact' | 'estimated';
  secBasis: 'exact' | 'estimated';
  /** Napor dana kad ga generator propisuje (plan po osećaju, trčanje/hodanje). */
  rpe?: { min: number; max: number; txt: string };
  /** Trčanje/hodanje: nivo lestvice i da li zavisi od pretpostavljenog napretka. */
  level?: number;
  projection?: true;
  /** Cilj dana trke kad nije vreme („završiti"). */
  goal?: 'finish';
}

/**
 * Dan sa strukturom (5k-v2): struktura je izvor istine za prikaz i sat; `desc` je samo kratak tekst. Namerno NIJE u uniji
 * `Day` (generatori 5K v1/10K/HM/maraton čitaju sačuvane dane svojim tipovima, koji ga ne poznaju): oblik je isti kao dan
 * sa ručnom izmenom koji razrešen plan već podržava (tip kvaliteta bez `session`, `km` null), uz `structure`.
 */
export interface StructuredDay extends DayBase {
  tag: 'lako' | 'lr' | 'int' | 'tempo' | 'trka' | 'test' | 'rw';
  /** null kad dan nema procenu km (trčanje/hodanje bez tempa). */
  km: number | null;
  desc: string;
  structure: WorkoutStructure;
  runWalk?: RunWalk;
  rest?: undefined;
  session?: undefined;
}

export type Day =
  RestDay | StrengthDay | EasyRunDay | RunWalkDay | LongRunDay | RaceDay | SessionDay;

/** Dan na kome se trči (ima kilometražu). */
export type RunningDay = EasyRunDay | RunWalkDay | LongRunDay | RaceDay | SessionDay;

export interface Week {
  w: number;
  vol: number;
  days: Day[];
  deload: boolean;
  focus: string;
  /**
   * Taper nedelja (jedna na 5K/10K, dve na HM/maratonu). Izvor istine je ZASTAVICA, ne opis (kao `deload`); upisuje se samo kad je tačna,
   * pa se plan bez taper nedelje ne razlikuje od starog. Planovi napravljeni pre nje je nemaju — `weekPhase` tada čita opis (ENGINE_CHANGES D5).
   */
  taper?: true;
}

/** Red predikcije: `p5k` NOSI VREME NA CILJNOJ DISTANCI (ime je istorijsko i perzistirano). */
export interface PredictionRow {
  w: number;
  l: string;
  q: number;
  pt: number;
  p5k: number;
  /** Explicit prescription zone; legacy rows fall back to their kind label. */
  zone?: Zone | 'RP';
  /** Sesija čiji je propis izveden iz cilja — ne sme se čitati kao merenje forme. */
  nemeri?: true;
}

export interface Assessment {
  /** Absent on legacy stored projections; no schema migration needed. */
  assessmentBasis?: 'current-fitness';
  vdot0: number;
  /** Legacy name: new plans use current-fitness reference, not projected improvement. */
  vdotGoal: number;
  /** Current-fitness race equivalent; not a promise of readiness or future improvement. */
  predictedSec: number;
  realno: boolean | null;
  goalVdot: number | null;
}

export interface PlanMeta extends Assessment {
  /** Optional additions preserve reading of plans created before phase 2. */
  athlete?: AthleteAssessment;
  preparation?: PreparationAssessment;
  formPolicy?: FormPolicy;
  runWalk?: RunWalkPhase;
  /** Calendar recovery guard survives subsequent goal changes and recalibration. */
  fatigueRecovery?: {
    start: IsoDate;
    end: IsoDate;
    weekCapsKm: Record<string, number>;
    dayCapsKm?: Record<string, number>;
  };
  /** New plans prescribe current fitness. Older plans may retain projected vdotGoal. */
  trainingVdot?: number;
  /** 5k-v2 (08a): ocena cilja generatora za doslovan prikaz („nedovoljno podataka", „orijentir", „završiti"); bez broja
   *  prognoze kad ga generator nema. Stariji planovi je nemaju. */
  goalAssessment?: { status: string; label: string; message: string };
  start: IsoDate;
  weeks: number;
  intensity: Intensity;
  racePace: number;
  runDays: number;
  quality: number;
  dayWarnings: string[];
  raceDistM: number;
  raceName: string;
  baseWeeks: number;
  raceDate: string;
  goalSec: number | null;
}

export interface TrainingPlan {
  weeks: Week[];
  pred: PredictionRow[];
  /** Lap-detekcija po danu: ključ `n<nedelja>d<dow>` → dužine radnih deonica u metrima. */
  qs: Record<string, number[]>;
  meta: PlanMeta;
}

export interface PlanError {
  error: string;
}

export type PlanGenerationResult = TrainingPlan | PlanError;

export const isPlanError = (r: PlanGenerationResult): r is PlanError => 'error' in r;

/* ---------- ulaz ---------- */

export interface PersonalBest {
  distM: number;
  sec: number;
  date?: string;
}

export interface PlanGenerationInput {
  startDate: string;
  raceDate: string;
  /** Podrazumevano 5000. */
  raceDistM?: number;
  pb: PersonalBest;
  weeklyKm: number;
  /** Recent repeatable long run, not the lifetime maximum. */
  recentLongRunKm?: number;
  /** Temporary readiness constraint; never replaces historical continuity. */
  currentReadiness?: { reason: 'fatigued' | 'reduced-volume' | 'returning'; until: IsoDate };
  /** Confirmed running continuity at assessment; retained as history during replanning. */
  consistentWeeks?: number;
  /** Recent break before the current base, in weeks. */
  breakWeeks?: number;
  qualityExperience?: QualityExperience;
  /** 2–7, podrazumevano 4. */
  runDays?: number;
  /** 1–2, podrazumevano 2. */
  quality?: number;
  /** Quality dose preference; never projects fitness gains or changes training pace. */
  intensity: Intensity;
  /**
   * Tempo rasta OBIMA (nedeljni korak i vrhunac). Izostavljeno = isto kao `intensity` — tako se ponašaju svi planovi napravljeni
   * pre nego što je izbor razdvojen (ENGINE_CHANGES D2).
   */
  volIntensity?: Intensity;
  goalSec?: number | null;
  /** Samo `false` znači „početnik"; izostavljeno = treniran. */
  trainedRecently?: boolean;
  /**
   * Koraci lestvice trčanje/hod (1–4) po nedelji početničke faze, npr. `[3, 3, 4]` = zadrži korak 3 dve nedelje.
   * Izostavljeno = standardna lestvica 1→4. Samo za početnike.
   */
  runWalkLadder?: number[];
  /** Dan dugog trčanja 1–7 (podrazumevano 7). */
  lrDow?: number;
  qDows?: number[];
  runDows?: number[];
  /** Interni flag protiv rekurzije u probnim pozivima strukturnog plafona. */
  _noSuggest?: boolean;
}
