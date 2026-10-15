/* ============================================================
   PARAMETRI PO DISTANCI — dva odvojena skupa za svaku:

     *_PRODUCT    [P] proizvodne odluke (najmanji broj nedelja, minimum obima…)
     *_HEURISTIC  [H] trenerska heuristika (koraci rasta, plafoni, budžeti zona,
                      dubina deloada i tapera)

   Mašina (`generatePlan`) ne sadrži nijedan broj specifičan za distancu; sve
   čita iz profila koji se sklapa od ova dva skupa. Izvori i ocene: v.
   docs/TRAINING_ENGINE_AUDIT.md §5.2–5.3. Menjati samo uz promenu otiska.
   ============================================================ */

import type { Intensity } from '../types';

export interface RampStepParams {
  /** Udeo tekućeg obima. */
  pct: number;
  /** Apsolutni pod i plafon koraka [km]: procenat sam je na malom obimu besmislen. */
  min: number;
  max: number;
}
export type RampTable = Readonly<Record<Intensity, RampStepParams>>;

export interface LongRunParams {
  /** Udeo nedelje na normalnom obimu. */
  share: number;
  /** Na niskom obimu udeo raste do `lowVolumeShare`, ali ne preko `lowVolumeCapKm`. */
  lowVolumeShare: number;
  lowVolumeCapKm: number;
  timeCapMin: number;
  absCapKm: number;
}

export interface BudgetParams {
  /** Udeo nedelje i apsolutni plafon [km] za zonu. */
  pct: number;
  maxKm?: number;
}

/** Oblik 10K heuristike (opciona polja starog zajedničkog oblika koja 10K ne definiše su uklonjena). */
export interface DistanceHeuristic {
  rampStep: RampTable;
  /** Odredište obima (km/ned) i apsolutni plafon protiv degenerisanog unosa. */
  targetVolumeKm: number;
  hardCapKm: number;
  longRun: LongRunParams;
  /** Najduži NEPREKIDAN prag rad [s]. */
  tempoMaxSec: number;
  /** Udeo nedelje za uvodnu (prvu) kvalitetnu sesiju posle bazne faze. */
  introShare: number;
  /** Plafon udela dugog trčanja u ISPORUČENOJ nedelji. */
  longRunMaxShare: number;
  /** Za koliko km WU/CD sme da se produži kad nedelja podbaci. */
  wuCdMaxExtraKm: number;
  deloadFactor: number;
  taperFactor: number;
  raceWeekFactor: number;
  taperLongRunFactor: number;
}

export interface DistanceProduct {
  name: string;
  /** Preporučeni broj nedelja za pun ciklus; služi samo napomenama, nikad blokadi plana. */
  minWeeks: number;
  baseWeeksBeginner: number;
  /** Ispod ovog vrhunca obima dva kvaliteta nedeljno nemaju smisla. */
  qual2MinKm: number;
  /** Ispod ovog vrhunca plan je „istrči distancu", ne „trči je na vreme" (upozorenje). */
  minPeakKm: number;
}

/** Talasanje obima unutar 4-nedeljnog bloka kad je odredište dostignuto: lakše, normalno, malo teže, deload. */
export const UNDULATION: readonly number[] = [0.94, 0.99, 1.03];

/* --------------------------------------------------------------- 10K */
export const PRODUCT_10K: DistanceProduct = {
  name: '10K',
  minWeeks: 8,
  baseWeeksBeginner: 8,
  qual2MinKm: 24,
  minPeakKm: 40
};
export const HEURISTIC_10K = {
  rampStep: {
    kons: { pct: 0.04, min: 1.4, max: 3.0 },
    std: { pct: 0.055, min: 2.0, max: 4.0 },
    agr: { pct: 0.07, min: 2.6, max: 5.0 }
  },
  targetVolumeKm: 70,
  hardCapKm: 140,
  longRun: { share: 0.3, lowVolumeShare: 0.42, lowVolumeCapKm: 11, timeCapMin: 105, absCapKm: 24 },
  intervalBudget: { pct: 0.08, maxKm: 10 },
  tempoBudget: { pct: 0.1 },
  repetitionBudget: { pct: 0.04, maxKm: 4 },
  tempoMaxSec: 25 * 60,
  introShare: 0.08,
  longRunMaxShare: 0.42,
  wuCdMaxExtraKm: 1.5,
  deloadFactor: 0.75,
  taperFactor: 0.72,
  raceWeekFactor: 0.34,
  taperLongRunFactor: 0.65
} as const satisfies DistanceHeuristic & Record<string, unknown>;
