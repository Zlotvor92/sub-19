/* HM v3 — sopstveni tipovi ulaza i izlaza. Ništa se ne uvozi van ovog foldera. */

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export const WEEKDAYS: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export interface V3Input {
  startDate: string; // YYYY-MM-DD
  raceDate: string;
  runDays: Weekday[];
  longRunDay: Weekday;
  weeklyKm: number;
  recentResult?: { distanceM: number; timeSec: number } | null;
  easyPaceSecPerKm?: number | null;
  recentLongRunKm?: number | null;
  beginner: boolean;
  goalTimeSec?: number | null;
}

export type Zone = 'E' | 'T' | 'I' | 'R' | 'RP' | 'H' | 'S' | 'W';
// E lagano · T prag · I interval · R repeticije · RP tempo trke · H usponi · S ubrzanja · W hod-trk

export interface Paces {
  vdot: number;
  /** true: tempa su procena iz laganog tempa; T/I/RP se trče po osećaju dok ne dođe test. */
  estimated: boolean;
  easyFast: number; // s/km
  easySlow: number;
  easy: number; // sredina, za račun km
  T: number;
  I: number;
  R: number;
  RP: number;
  /** tempo trke na dan trke (cilj ako je realan, inače prognoza) */
  racePace: number;
  predictionSec: number;
}

export interface Segment {
  zone: Zone;
  min: number;
  km: number;
}

export type SessionKind = 'easy' | 'quality' | 'long' | 'check' | 'race';

export interface Session {
  kind: SessionKind;
  /** glavna zona rada (za kvalitet i blok u dugom) */
  zone: Zone | null;
  text: string;
  segments: Segment[];
  km: number;
  min: number;
  /** minuti rada (T/I/R/RP/usponi i test/trka provere) */
  workMin: number;
  note?: string;
}

export interface Day {
  date: string;
  weekday: Weekday;
  session: Session;
}

export type Phase = 'uvod' | 'osnova' | 'razvoj' | 'specifična' | 'taper' | 'trka';
export type WeekKind = 'build' | 'rest' | 'peak' | 'post-peak' | 'taper' | 'race';

export interface Week {
  index: number; // 1..N
  phase: Phase;
  kind: WeekKind;
  label: string;
  startDate: string;
  endDate: string;
  targetKm: number;
  plannedKm: number;
  totalMin: number;
  workMin: number;
  days: Day[];
  notes: string[];
}

export interface Finding {
  check: string;
  week: number | null;
  message: string;
}

export interface PlanDoc {
  schema: 'plan-doc';
  policyId: 'hm-v3';
  policyVersion: string;
  input: V3Input;
  paces: Paces;
  family: 'result' | 'feel' | 'beginner';
  peakKm: number;
  longMaxKm: number;
  recommendations: string[];
  notes: string[];
  weeks: Week[];
  guard: Finding[];
}

export class V3InputError extends Error {}
