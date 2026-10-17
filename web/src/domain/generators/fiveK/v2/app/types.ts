/* 5K v2 → aplikacija: oblici formata razmene koje adapter čita i piše. Samo tipovi.

   Perzistirani format (plan, dnevnik, zapisi) dolazi type-only kroz `fiveK/exchange.ts` (jedina veza 5K foldera sa
   aplikacijom); razrešen plan i tereti ugovora su ovde lokalni STRUKTURNI oblici — `select.ts` ih proverava sa
   `satisfies PlanGenerator`, pa promena ugovora pada pri prevođenju umesto da se tiho razide. */

import type { DayTag, GenPlanState, IsoDate, StoredWeek, StructuredDay } from '../../exchange.ts';

export type { IsoDate };
export type { StructuredDay };
export type StoredDay = StoredWeek['days'][number];
export type RestDay = Extract<StoredDay, { rest: true }>;
export type WorkoutStructure = StructuredDay['structure'];
export type StructureBlock = WorkoutStructure['blocks'][number];
export type StructureStep = StructureBlock['step'];
export type StructureEffort = NonNullable<StructureStep['effort']>;
export type RunWalk = NonNullable<Extract<StoredDay, { tag: 'rw'; runWalk: unknown }>['runWalk']>;
export type PlanMeta = NonNullable<GenPlanState['meta']>;

/** Dan razrešenog plana (izmene i pomeranja primenjeni) — polja koja v2 čita. */
export interface ResolvedDay {
  id: string;
  w: number;
  weekStart: IsoDate;
  dow: number;
  origDate: IsoDate;
  date: IsoDate;
  tag: DayTag | undefined;
  rest: boolean;
  km: number | null;
  desc: string | null;
  runWalk: RunWalk | undefined;
  snaga: boolean;
  session?: { paceSec?: number | null } | undefined;
  structure?: WorkoutStructure;
  mlr: boolean;
  test: boolean;
  /** Original dana po planu (pre ručne izmene). */
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

/** Ulaz čarobnjaka 5K v2 (oblik razmene; pravila proverava `../input.ts`). */
export interface StructuredPlanInput {
  startDate: string;
  raceDate: string;
  runDays: Array<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'>;
  currentWeeklyKm: number;
  recentResult?: { distanceM: 3000 | 5000 | 10000; timeSec: number; date: string } | null;
  goalTimeSec?: number | null;
  typicalEasyPaceSecPerKm?: number | null;
  experience?: 'beginner' | 'regular';
  canRun30Min?: boolean;
}
export interface PlanRejectionReason {
  code: string;
  message: string;
  week?: number;
}
export type StructuredPlanResult =
  { ok: true; plan: GenPlanState } | { ok: false; reasons: PlanRejectionReason[] };

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
}
