/* ============================================================
   TIPOVI GENERATORA PLANA — WIRE OBLIK.

   Izlaz `generatePlan` je istovremeno i PERZISTIRANI oblik (`S.genPlan` u
   `user_state.data`, schema v11). Zato polja zadržavaju stara imena (`tag`,
   `desc`, `km`, `session.type`, `p5k`, …) i ne smeju se preimenovati bez bump-a
   SCHEMA i unazad-kompatibilnog čitanja — v. docs/REWRITE_PLAN.md odluka B.

   Engleski nazivi iz zadatka postoje kao tipovi (IntervalSession, TempoSession,
   LongRunDay, RaceDay, RestDay …), ali nose stare ključeve.
   ============================================================ */

import type { IsoDate } from '../date';

export type Intensity = 'kons' | 'std' | 'agr';
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

interface SessionBase {
  /** Naziv sesije („Intervali", „Tempo isprekidan", …) — iz njega se izvodi zona. */
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
  /** Sesija čiji je propis izveden iz cilja — ne sme se čitati kao merenje forme. */
  nemeri?: true;
}

export interface Assessment {
  vdot0: number;
  vdotGoal: number;
  predictedSec: number;
  realno: boolean | null;
  goalVdot: number | null;
}

export interface PlanMeta extends Assessment {
  /** New plans prescribe current fitness; vdotGoal is a projection only. */
  trainingVdot?: number;
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
}

export interface PlanGenerationInput {
  startDate: string;
  raceDate: string;
  /** Podrazumevano 5000. */
  raceDistM?: number;
  pb: PersonalBest;
  weeklyKm: number;
  /** 2–7, podrazumevano 4. */
  runDays?: number;
  /** 1–2, podrazumevano 2. */
  quality?: number;
  /** Tempo napretka FORME (rast VDOT-a). */
  intensity: Intensity;
  /**
   * Tempo rasta OBIMA (nedeljni korak i vrhunac). Izostavljeno = isto kao `intensity` — tako se ponašaju svi planovi napravljeni
   * pre nego što je izbor razdvojen (ENGINE_CHANGES D2).
   */
  volIntensity?: Intensity;
  goalSec?: number | null;
  /** Samo `false` znači „početnik"; izostavljeno = treniran. */
  trainedRecently?: boolean;
  /** Dan dugog trčanja 1–7 (podrazumevano 7). */
  lrDow?: number;
  qDows?: number[];
  runDows?: number[];
  /** Interni flag protiv rekurzije u probnim pozivima strukturnog plafona. */
  _noSuggest?: boolean;
}
