import type { BudgetParams, DistanceHeuristic, DistanceProduct } from '../constants/distances';
import type { FastFinish, Intensity, QualityReadiness, SessionDay } from '../types';

/** Faza maratonskog kvalitetnog ciklusa: izdržljivost → prag → specifično. */
export type Phase = 'threshold' | 'specific' | 'endurance';

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
}

/** The distance profile's nominal per-session zone budgets (share of the week, km cap). */
export interface ZoneBudgets {
  intervalBudget: BudgetParams;
  tempoBudget: BudgetParams;
  repetitionBudget: BudgetParams;
}

export interface LongRunCycleContext {
  weeks: number;
  baseWeeks: number;
  taperW: number;
  isDeload: boolean;
}

/**
 * Profil distance = PODACI (product + heuristic) + STRATEGIJE (izbor sesija,
 * faze). `generatePlan` ne sadrži nijedan broj specifičan za distancu — sve čita odavde.
 */
export interface DistanceProfile {
  product: DistanceProduct;
  heuristic: DistanceHeuristic;
  phase(qualW: number, qualWeeks: number): Phase;
  buildQuality(req: QualityRequest): SessionDay;
  /** Dodatak opisu dugog trčanja (brz završetak na maratonskom tempu). */
  longRunFinish(
    phase: Phase,
    qualW: number,
    lrKm: number,
    racePace: number,
    cycleFactor: number | null
  ): FastFinish | null;
  /** Faktor ciklusa dugog trčanja po nedelji (maraton: dužina ima sopstveni talas). */
  longRunCycle(w: number, ctx: LongRunCycleContext): number;
}

export type { Intensity };
