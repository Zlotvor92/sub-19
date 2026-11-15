/* V4 — FORMA IZ TRČANJA: lokalni tipovi (SPEC § 7). `Run.planned` i `Run.tempC` su od kruga 2 u tipovima motora;
   ovde ostaje samo ono što motor još ne nosi (F4-REPORT, „šta treba preneti"). */
import type { FormPlanned, IsoDate, Run, RunnerFacts, Vdot } from '../engine/types';

/** Šta je dan plana zadao (§ 7.3). */
export type PlannedWork = NonNullable<Run['planned']>;

export type FitnessRun = Run;

/** Treći argument `estimateForm` (§ 7.1): od kruga 2 tip živi u motoru (`FormPlanned`). */
export type FitnessPlanned = FormPlanned;

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
  /** U trci je bilo hodanja (R14): bez korekcije, pouzdanost ≤ srednja. */
  walking: boolean;
}

export interface PauseSpan {
  from: IsoDate;
  to: IsoDate;
  days: number;
  reported: boolean;
}
