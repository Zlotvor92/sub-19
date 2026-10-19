/* HM v2 → aplikacija: oblici formata razmene koje adapter čita i piše. Samo tipovi.

   Kao 10K v2 (strogo): `halfMarathon/v2/` ne uvozi ništa van sebe, ni tipom (`../isolation.node.test.ts`, bez izuzetka za adapter).
   Zato su ovde LOKALNI STRUKTURNI oblici formata (plan za upis, dan sa strukturom, razrešen plan, zapisi dnevnika i bola,
   tereti ugovora), prepisani iz formata razmene samo u poljima koja adapter čita ili piše. Usklađenost proverava
   `select.ts` (`satisfies PlanGenerator`): parametri su ovde širi (`string` umesto brendiranog datuma, samo potrebna
   polja), a gde adapter PRAVI plan formata (dan sa strukturom van unije `Day`, `meta` bez polja koja v2 nema), tip
   formata mu daje granica u `select.ts` (eksplicitno, sa komentarom). */

/** ISO datum YYYY-MM-DD (format aplikacije ga brendira; ovde običan string). */
export type IsoDate = string;

/* ---------- strukturisan trening (oblik `training/types.ts` → `WorkoutStructure`) ---------- */

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
export interface StructureStep {
  kind: StructureStepKind;
  zone?: string;
  km: number | null;
  sec: number | null;
  paceSec: number | null;
  paceRange?: { fast: number; slow: number };
  estimatePaceSec?: number;
  kmBasis: 'exact' | 'estimated';
  secBasis: 'exact' | 'estimated';
  effort?: StructureEffort;
}
export interface StructureBlock {
  reps: number;
  step: StructureStep;
  recovery?: StructureStep;
}
export interface WorkoutStructure {
  title: string;
  kind?: string;
  blocks: StructureBlock[];
  km: number | null;
  sec: number | null;
  kmBasis: 'exact' | 'estimated';
  secBasis: 'exact' | 'estimated';
  rpe?: { min: number; max: number; txt: string };
  level?: number;
  projection?: true;
  goal?: 'finish';
}

/* ---------- plan za upis (oblik `GenPlanState`, polja koja adapter piše) ---------- */

export type StructuredDayTag = 'lako' | 'lr' | 'int' | 'tempo' | 'trka' | 'test';
/** Dan sa strukturom (oblik `StructuredDay`): struktura je izvor istine za prikaz i sat; `desc` je naslov. */
export interface StructuredDay {
  dow: number;
  id?: string;
  tag: StructuredDayTag;
  km: number;
  desc: string;
  structure: WorkoutStructure;
}
export interface RestDay {
  dow: number;
  id?: string;
  rest: true;
  desc: null;
}
export type StoredDay = StructuredDay | RestDay;
export interface StoredWeek {
  w: number;
  start: string;
  deload: boolean;
  focus: string;
  taper?: true;
  phase?: string;
  days: StoredDay[];
}
/** Ocena cilja za doslovan prikaz (oblik `PlanMeta.goalAssessment`). */
export interface GoalAssessmentView {
  status: string;
  label: string;
  message: string;
}
/** `meta` plana HM v2: SAMO ono što v2 zna (v. `plan.ts`). */
export interface HmV2Meta {
  policyId: string;
  policyVersion: string;
  start: string;
  weeks: number;
  raceDate: string;
  raceDistM: number;
  raceName: string;
  goalSec: number | null;
  runDays: number;
  quality: number;
  dayWarnings: string[];
  paceBasis: 'result' | 'feel';
  /** VDOT iz rezultata; `null` u planu po osećaju (procena v2 je samo orijentir brzih zona). */
  vdot: number | null;
  vdot0?: number;
  trainingVdot?: number;
  racePace?: number;
  /** Prognoza polumaratona v2 (H2, samo uz rezultat). Ime iz v2 — NE `predictedSec`, koji aplikacija čita kao zamenu za
   *  cilj. */
  predictedHmSec?: number;
  goalVdot?: number;
  goalAssessment?: GoalAssessmentView;
}
export interface StoredPlan {
  weeks: StoredWeek[];
  pred: [];
  qs: Record<string, number[]>;
  meta: HmV2Meta;
  /** Izlaz generatora HM v2 doslovno (ulaz, nedelje, upozorenja) — osnova adaptacije (segment 06). */
  hmV2: unknown;
}
/** Plan koji adapter samo čita (bilo koji plan formata). */
export interface PlanLike {
  weeks: ReadonlyArray<{ w: number; phase?: unknown }>;
  meta?: unknown;
  hmV2?: unknown;
}

/* ---------- razrešen plan (oblik `ResolvedPlan`, polja koja v2 čita) ---------- */

export interface ResolvedDay {
  id: string;
  w: number;
  weekStart: IsoDate;
  dow: number;
  origDate: IsoDate;
  date: IsoDate;
  tag: string | undefined;
  rest: boolean;
  km: number | null;
  desc: string | null;
  snaga: boolean;
  session?: { paceSec?: number | null } | undefined;
  structure?: WorkoutStructure;
  mlr: boolean;
  test: boolean;
  origin: { km: number | null };
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

/* ---------- zapisi aplikacije (oblici `state/types.ts`, polja koja kopija stanja čita) ---------- */

export interface LogEntry {
  status?: string;
  km?: number | null;
  sec?: number | null;
  hr?: number | null;
  ts?: string;
  runDate?: string;
  src?: string;
  lock?: boolean;
  [field: string]: unknown;
}
export interface PainRecord {
  date: string;
  pain: number;
  id?: string;
  src?: string | null;
  part?: string;
  act?: string;
  note?: string;
  [field: string]: unknown;
}
export interface WellnessRecord {
  datum: string;
  hrv: number | null;
  pulsUMiru: number | null;
  sanH: number | null;
  sanOcena: number | null;
  tezina: number | null;
  ctl: number | null;
  atl: number | null;
  svezina: number | null;
}

/* ---------- tereti ugovora ---------- */

/** Ulaz čarobnjaka HM v2 (oblik razmene; pravila proverava `../input.ts`). */
export interface StructuredPlanInput {
  startDate: string;
  raceDate: string;
  runDays: Array<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'>;
  longRunDay?: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun' | null;
  currentWeeklyKm: number;
  recentResult?: {
    distanceM: 5000 | 10000 | 21097.5 | 42195;
    timeSec: number;
    date: string;
  } | null;
  goalTimeSec?: number | null;
  easyPaceSecPerKm?: number | null;
  /** Pouka 28 (HI7): skorašnji najduži trk [km], opciono. */
  recentLongRunKm?: number | null;
  experience?: 'beginner' | 'regular';
  runWalk?: boolean;
}
export interface PlanRejectionReason {
  code: string;
  message: string;
  week?: number;
}
export type StructuredPlanResult =
  { ok: true; plan: StoredPlan } | { ok: false; reasons: PlanRejectionReason[] };

export type WeekPhase = 'DELOAD' | 'TRKA' | 'TAPER' | 'BAZA' | 'RAZVOJ' | 'VRHUNAC' | '';
export type PolicyStatus =
  | { status: 'current'; policyId: string; policyVersion: string }
  | { status: 'legacy'; policyId: string; policyVersion: null }
  | { status: 'unknown'; policyId: string; policyVersion: string | null };

export interface RpeTarget {
  min: number;
  max: number;
  txt: string;
}
export interface WatchEvent {
  date: string;
  externalId: string;
  name: string;
  description: string;
}
export interface WatchBatch {
  events: WatchEvent[];
  skipped: number;
  /** Zašto je svaki preskočen dan preskočen (datum · trening: razlog). */
  skippedReasons?: string[];
}
