/* ============================================================
   PERZISTIRANO STANJE — schema v11 (`user_state.data`, localStorage `sub19-v1`).

   OVO JE DATA CONTRACT. Novi frontend čita i piše TAČNO ovaj oblik: stariji klijent na drugom
   uređaju čita isto stanje, a ne postoji migracioni alat na serveru. Polja zadržavaju stara
   (srpska) imena. Novo polje samo uz bump SCHEMA_VERSION i unazad-kompatibilno čitanje.

   Polja koja stari kod ne validira dubinom (npr. `log[*]`, `strava`, `icu`) ovde su
   `Record<string, unknown>` sa poznatim poljima — nepoznata polja se NE brišu pri čitanju/pisanju
   (novija verzija aplikacije ih možda koristi).
   ============================================================ */

import type { TrainingPlan, PredictionRow, RunWalk, Week } from '../training/types';

export const SCHEMA_VERSION = 11;

export type DayTag = 'lako' | 'rw' | 'tempo' | 'int' | 'lr' | 'snaga' | 'odmor' | 'trka' | 'test';
export const DAY_TAGS: readonly DayTag[] = [
  'lako',
  'rw',
  'tempo',
  'int',
  'lr',
  'snaga',
  'odmor',
  'trka',
  'test'
];
/** Tipovi dana uz koje se može dodati „+ Snaga". */
export const STRENGTH_WITH: ReadonlySet<string> = new Set(['lako', 'int', 'tempo', 'lr']);

/** Unos u dnevniku po ID-ju dana. Poznata polja su opciona; sve ostalo prolazi netaknuto. */
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

/** Zapis o bolu. Polje `S.knee` se zove tako iako nosi mapu tela (ime je istorijsko). */
export interface PainRecord {
  date: string;
  pain: number;
  id?: string;
  src?: string | null;
  part?: string;
  /** Aktivnost pri kojoj je bol nastao (Trčanje / Snaga / Odmor / Drugo). */
  act?: string;
  note?: string;
  [field: string]: unknown;
}

export interface WeightRecord {
  date: string;
  kg: number;
  src?: string | null;
  [field: string]: unknown;
}

export interface T3kRecord {
  id: string;
  date: string;
  sec: number;
}

/** Zapis lanca forme; `vdot`/`prev`/`delta`/`measured` su brojevi ili null — nikad string. */
export interface VdotRecord {
  id: unknown;
  ts: string;
  vdot: number | null;
  prev: number | null;
  delta: number | null;
  measured: number | null;
  vdotMigrated?: true;
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

/** Ručna izmena dana (tip/km/opis/tempo/run-walk/+snaga). */
export interface AltRecord {
  tag: DayTag;
  km: number | null;
  desc: string;
  pace: number | null;
  rw: RunWalk | null;
  paceAuto: boolean;
  snaga?: true;
}

/** Generisan plan u perzistiranom obliku (posle `adaptGeneratedPlan`: dani nose `id`, nedelje `start`). */
export interface StoredWeek {
  w: number;
  start: string;
  deload: boolean;
  focus: string;
  /** Napomena: perzistirana nedelja NEMA `vol` (ukupan km se računa iz dana). */
  days: Array<Week['days'][number] & { id?: string }>;
}
export interface GenPlanState {
  weeks: StoredWeek[];
  pred: Array<PredictionRow & { id?: string }>;
  qs?: Record<string, number[]>;
  meta?: TrainingPlan['meta'] & Record<string, unknown>;
  /** Pun ulaz generatora — potreban da se cilj promeni usred pripreme. NEPOUZDAN. */
  ulaz?: unknown;
  [field: string]: unknown;
}

export interface UiState {
  firstRun: string | null;
  lastBackup: string | null;
  snooze: string | null;
  seenWeek: unknown;
  geo: unknown;
  satTreninga: unknown;
  novo: unknown;
  [field: string]: unknown;
}

export interface CommunityState {
  vidljiv: boolean;
  nadimak: string;
  [field: string]: unknown;
}

export interface PersistedState {
  v: number;
  log: Record<string, LogEntry>;
  knee: PainRecord[];
  kg: WeightRecord[];
  pred: Record<string, unknown>;
  predLock: Record<string, unknown>;
  vdotLog: VdotRecord[];
  t3k: T3kRecord[];
  vreme: Record<string, unknown> | null;
  moves: Record<string, unknown>;
  alts: Record<string, AltRecord>;
  genPlan: GenPlanState | null;
  /** OAuth tokeni — nikad u backup ni na server. */
  strava: Record<string, unknown> | null;
  wellness: Record<string, WellnessRecord>;
  icu: Record<string, unknown> | null;
  vanPlana: Record<string, number>;
  zajed: CommunityState;
  ui: UiState;
  [field: string]: unknown;
}

/** Prazno stanje za novog korisnika. VLASNIKOVI PODACI SE NIKAD NE UBACUJU IZ KODA. */
export function seedState(todayIso: string | null = null): PersistedState {
  return {
    v: SCHEMA_VERSION,
    log: {},
    knee: [],
    kg: [],
    pred: {},
    predLock: {},
    vdotLog: [],
    t3k: [],
    vreme: null,
    moves: {},
    alts: {},
    genPlan: null,
    strava: null,
    wellness: {},
    icu: null,
    vanPlana: {},
    zajed: { vidljiv: false, nadimak: '' },
    ui: {
      firstRun: todayIso,
      lastBackup: null,
      snooze: null,
      seenWeek: null,
      geo: null,
      satTreninga: null,
      novo: null
    }
  };
}
