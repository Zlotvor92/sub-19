import type { BudgetParams, DistanceHeuristic, DistanceProduct } from '../constants/distances';
import type { Intensity, QualityReadiness, SessionDay } from '../types';

/** Faza kvalitetnog ciklusa 10K: threshold→peak→specific. */
export type Phase = 'threshold' | 'peak' | 'specific';

export interface QualityRequest {
  readiness?: QualityReadiness;
  qualityIntensity?: Intensity;
  /** Confirmed consecutive training weeks; refines the experienced starting dose. */
  consistentWeeks?: number | null;
  /** Fraction of the zone budget this session may use when two days share it (60/40). */
  workShare?: number;
  /** The distance profile's nominal zone budgets; the experienced dose never exceeds them. */
  budgets?: ZoneBudgets;
  /** Remaining weekly fast-work allowance for this session [s], after the other quality day
   *  is counted. Only ever lowers the dose. */
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
  dow: number;
  racePace: number;
}

/** The distance profile's nominal per-session zone budgets (share of the week, km cap). */
export interface ZoneBudgets {
  intervalBudget: BudgetParams;
  tempoBudget: BudgetParams;
  repetitionBudget: BudgetParams;
}

/**
 * Profil 10K = PODACI (product + heuristic) + STRATEGIJE (izbor sesija, faze). `generatePlan` čita
 * brojeve odavde. Opcione strategije starog zajedničkog profila (brz završetak dugog trčanja,
 * strategija tempa trke, jedan kvalitet uz zahtevnu dugu, redosled skraćivanja, sopstveni udeo
 * brzog rada, ciklus dugog trčanja, intervali vezani za tempo trke) 10K ne definiše, pa ne postoje.
 */
export interface DistanceProfile {
  product: DistanceProduct;
  heuristic: DistanceHeuristic;
  phase(qualW: number, qualWeeks: number): Phase;
  buildQuality(req: QualityRequest): SessionDay;
}

export type { Intensity };
