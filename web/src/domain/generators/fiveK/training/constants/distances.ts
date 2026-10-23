/* ============================================================
   PARAMETRI 5K — dva odvojena skupa (kopija 5K dela `domain/training/constants/distances.ts`;
   parametri 10K/HM/maratona namerno nisu preneti):

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

/** Zajednički oblik heuristika svih distanci. */
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
  taperWeeks?: number;
  firstTaperFactor?: number;
  midweekLong?: MidweekLongParams;
  /** Dugo trčanje u baznoj fazi kreće od ovog udela plafona i raste do punog. */
  baseLongRunStart?: number;
  /** Uputstvo za gorivo na dugom trčanju (minuti). */
  fuelFromMin?: number;
  fuelStrongFromMin?: number;
  /** Lak dan odmah posle zahtevne duge (≥ `demandingMin`): najviše `maxShare` duge i
   *  `maxMin` minuta; višak ide na druge lake dane koji nisu uz dugu. */
  easyAfterLongRun?: { demandingMin: number; maxShare: number; maxMin: number };
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
  recommendedMinRunDays?: number;
}

/** Talasanje obima unutar 4-nedeljnog bloka kad je odredište dostignuto: lakše, normalno, malo teže, deload. */
export const UNDULATION: readonly number[] = [0.94, 0.99, 1.03];

/* ---------------------------------------------------------------- 5K */
export const PRODUCT_5K: DistanceProduct = {
  name: '5K',
  minWeeks: 6,
  baseWeeksBeginner: 6,
  qual2MinKm: 18,
  minPeakKm: 30
};
export const HEURISTIC_5K = {
  rampStep: {
    kons: { pct: 0.04, min: 1.2, max: 2.5 },
    std: { pct: 0.055, min: 1.8, max: 3.5 },
    agr: { pct: 0.07, min: 2.4, max: 4.5 }
  },
  targetVolumeKm: 55,
  hardCapKm: 120,
  longRun: { share: 0.27, lowVolumeShare: 0.4, lowVolumeCapKm: 8, timeCapMin: 90, absCapKm: 20 },
  /* Budžeti zona po nedelji (Danielsovi, primenjeni na 5K bez kompromisa). */
  intervalBudget: { pct: 0.08, maxKm: 8 },
  tempoBudget: { pct: 0.1 },
  repetitionBudget: { pct: 0.05, maxKm: 5 },
  tempoMaxSec: 20 * 60,
  introShare: 0.08,
  longRunMaxShare: 0.4,
  wuCdMaxExtraKm: 1,
  deloadFactor: 0.73,
  taperFactor: 0.65,
  raceWeekFactor: 0.3,
  taperLongRunFactor: 0.6
} as const satisfies DistanceHeuristic & Record<string, unknown>;
