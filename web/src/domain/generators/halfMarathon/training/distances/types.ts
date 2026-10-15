import type { BudgetParams, DistanceHeuristic, DistanceProduct } from '../constants/distances';
import type { FastFinish, Intensity, QualityReadiness, SessionDay } from '../types';

/** Faza HM kvalitetnog ciklusa: prag → vrhunac → specifično (faze drugih distanci pripadaju njihovim generatorima). */
export type Phase = 'threshold' | 'peak' | 'specific';

/** Strategija tempa trke na polumaratonu (po vremenu trke). */
export type PaceStrategy = 'threshold' | 'blocks' | 'long';

/** Položaj nedelje u planu — potreban distancama sa događajima vezanim za DATUM (HM kontrolna trka). */
export interface QualityContext {
  weeks: number;
  w: number;
  taperW: number;
}

export interface QualityRequest {
  readiness?: QualityReadiness;
  qualityIntensity?: Intensity;
  /** A demanding LR replaces q2; q1 keeps its family with a recalculated dose. */
  replacesSecondQuality?: boolean;
  /** The week's long run carries a race-pace fast finish (it is the race-specific day). */
  lrFinish?: boolean;
  /** Confirmed consecutive training weeks; refines the experienced starting dose. */
  consistentWeeks?: number | null;
  /** Fraction of the zone budget this session may use when two days share it (60/40). */
  workShare?: number;
  /** The distance profile's nominal zone budgets; the experienced dose never exceeds them. */
  budgets?: ZoneBudgets;
  /** Remaining weekly fast-work allowance for this session [s], after the LR finish and
   *  the other quality day are counted. Only ever lowers the dose. */
  maxWorkSec?: number;
  /** Redni broj nedelje unutar kvalitetnog ciklusa (1-indeksiran). */
  qualW: number;
  qualWeeks: number;
  slotRole: 'q1' | 'q2';
  effQ: number;
  vol: number;
  pI: number;
  pT: number;
  pE: number;
  pR: number;
  isTaper1: boolean;
  /** First of two taper weeks: normal quality on lower volume; keeps the legacy dose. */
  taperTransition?: boolean;
  dow: number;
  racePace: number;
  ctx: QualityContext;
}

/** The distance profile's nominal per-session zone budgets (share of the week, km cap). */
export interface ZoneBudgets {
  intervalBudget: BudgetParams;
  tempoBudget: BudgetParams;
  repetitionBudget: BudgetParams;
}

/** Week context for a profile's decision to keep one quality day beside the long run. */
export interface SingleQualityContext {
  readiness: QualityReadiness;
  runDays: number;
  /** Planned long-run duration [min]. */
  longRunMin: number;
}

/**
 * Profil distance = PODACI (product + heuristic) + STRATEGIJE (izbor sesija, faze, brz završetak duge, jedan kvalitet uz
 * zahtevnu dugu, redosled skraćivanja, nedeljni omotač brzog rada). U HM generatoru postoji samo HM profil, pa su
 * HM strategije obavezne. `generatePlan` ne sadrži nijedan broj specifičan za distancu — sve čita odavde.
 * Uklonjeno jer HM to ne koristi: `intervalPaceForWeek` (HM: identitet) i `longRunCycle` (samo maraton).
 */
export interface DistanceProfile {
  product: DistanceProduct;
  heuristic: DistanceHeuristic;
  phase(qualW: number, qualWeeks: number): Phase;
  buildQuality(req: QualityRequest): SessionDay;
  paceStrategy(racePaceSec: number): PaceStrategy;
  /** Dodatak opisu dugog trčanja (brz završetak na tempu trke). */
  longRunFinish(
    phase: Phase,
    qualW: number,
    lrKm: number,
    racePace: number,
    strategy: PaceStrategy | null
  ): FastFinish | null;
  /** A demanding long run leaves room for only one other quality day (HM first track). */
  singleQualityWeek(x: SingleQualityContext): boolean;
  /** Weekly envelope trimming order: lower values are cut first (I/R, then T, HM rhythm last). */
  trimPriority(day: SessionDay): number;
  /** Share of weekly running time allowed at T-or-faster; overrides the shared default. */
  weeklyFastShare(readiness: QualityReadiness): number | undefined;
}

export type { Intensity };
