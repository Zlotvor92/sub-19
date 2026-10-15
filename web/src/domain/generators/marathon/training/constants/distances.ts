/* ============================================================
   PARAMETRI MARATONA — dva odvojena skupa (samo maraton; 5K/10K/HM imaju svoje generatore):

     PRODUCT_42K    [P] proizvodne odluke (najmanji broj nedelja, minimum obima…)
     HEURISTIC_42K  [H] trenerska heuristika (koraci rasta, plafoni, budžeti zona,
                        dubina deloada i tapera)

   Mašina (`generatePlan`) čita brojeve iz profila koji se sklapa od ova dva skupa. Izvori i ocene: v.
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

export interface MidweekLongParams {
  /** Traži bar ovoliko dana trčanja i ovoliki vrhunac obima. */
  minDays: number;
  minKm: number;
  /** Udeo dugog trčanja koji dobija srednje-dugo. */
  share: number;
}

export interface BudgetParams {
  /** Udeo nedelje i apsolutni plafon [km] za zonu. */
  pct: number;
  maxKm?: number;
}

/** Oblik maratonske heuristike (parametri drugih distanci pripadaju njihovim generatorima). */
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
  /** Broj taper nedelja (podrazumevano 1) i obim prve (prelazne) taper nedelje kad ih ima više. */
  taperWeeks: number;
  firstTaperFactor: number;
  midweekLong: MidweekLongParams;
  /** Dugo trčanje u baznoj fazi kreće od ovog udela plafona i raste do punog. */
  baseLongRunStart: number;
  /** Uputstvo za gorivo na dugom trčanju (minuti). */
  fuelFromMin: number;
  fuelStrongFromMin: number;
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
  recommendedMinRunDays: number;
}

/** Talasanje obima unutar 4-nedeljnog bloka kad je odredište dostignuto: lakše, normalno, malo teže, deload. */
export const UNDULATION: readonly number[] = [0.94, 0.99, 1.03];

/* ------------------------------------------------------------ maraton */
export const PRODUCT_42K: DistanceProduct = {
  name: 'Maraton',
  minWeeks: 12,
  baseWeeksBeginner: 12,
  qual2MinKm: 38,
  minPeakKm: 55,
  recommendedMinRunDays: 5
};
export const HEURISTIC_42K = {
  rampStep: {
    kons: { pct: 0.04, min: 1.8, max: 3.8 },
    std: { pct: 0.055, min: 2.4, max: 5.0 },
    agr: { pct: 0.07, min: 3.0, max: 6.0 }
  },
  targetVolumeKm: 95,
  hardCapKm: 180,
  longRun: { share: 0.3, lowVolumeShare: 0.42, lowVolumeCapKm: 16, timeCapMin: 180, absCapKm: 32 },
  marathonPaceBudget: { pct: 0.1, maxKm: 16 },
  intervalBudget: { pct: 0.05, maxKm: 8 },
  tempoBudget: { pct: 0.1 },
  repetitionBudget: { pct: 0.02, maxKm: 2.5 },
  tempoMaxSec: 35 * 60,
  introShare: 0.07,
  longRunMaxShare: 0.42,
  wuCdMaxExtraKm: 1.5,
  taperWeeks: 2,
  firstTaperFactor: 0.8,
  deloadFactor: 0.78,
  taperFactor: 0.65,
  raceWeekFactor: 0.4,
  taperLongRunFactor: 0.7,
  midweekLong: { minDays: 5, minKm: 50, share: 0.6 },
  baseLongRunStart: 0.5,
  fuelFromMin: 75,
  fuelStrongFromMin: 120
} as const satisfies DistanceHeuristic & Record<string, unknown>;
