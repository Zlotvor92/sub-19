/* V4 — FORMA IZ TRČANJA: lokalni tipovi (SPEC § 7). Polja koja `engine/types.ts` nema, a procena ih koristi;
   sva su opciona, pa je svaki `RunnerFacts` ujedno i `FitnessFacts`. Predlog za tipove motora: F4-REPORT. */
import type { IsoDate, Run, RunnerFacts, Seconds, Vdot, ZoneId } from '../engine/types';

/** Šta je dan plana zadao (§ 7.3: „trčanje vezano za dan sa zonom T/I/RP"). `Run` danas nosi samo `dayId`. */
export interface PlannedWork {
  zone: ZoneId;
  /** Zadato vreme rada (sekunde) — „odrađeno" = rad ≥ 90 % ovoga. */
  workSec: Seconds;
}

/** `Run` + opciona polja koja forma čita. */
export type FitnessRun = Run & {
  planned?: PlannedWork;
  /** Temperatura vazduha tokom trčanja (°C), sa sata/Strave. */
  tempC?: number;
};

export type FitnessFacts = Omit<RunnerFacts, 'runs'> & { runs: readonly FitnessRun[] };

/** Staž strukturisanog treninga (§ 7.5, § 14.6). */
export type Tenure = 'pocetnik' | 'srednji' | 'iskusan' | 'nepoznato';

/** Sažetak trke/testa za objašnjenje (§ 7.2 + korekcija F4). */
export interface ResultEvidence {
  vdot: Vdot;
  /** VDOT samog rezultata, pre korekcije za raspodelu tempa. */
  rawVdot: Vdot;
  /** Korekcija za izrazito negativan split (≥ 0). */
  splitBonus: Vdot;
  /** Toplo (≥ prag): rezultat je donja granica forme — sam ne spušta procenu. */
  hot: boolean;
}

export interface PauseSpan {
  from: IsoDate;
  to: IsoDate;
  days: number;
  reported: boolean;
}
