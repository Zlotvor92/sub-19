import type { BudgetParams, DistanceHeuristic, DistanceProduct } from '../constants/distances';
import type { FastFinish, Intensity, QualityReadiness, SessionDay } from '../types';

/** Faza kvalitetnog ciklusa. Imena po distancama se razlikuju (5K: economy→peak→sharpening;
 *  10K i HM: threshold→peak→specific; 42K: endurance→threshold→specific). */
export type Phase = 'economy' | 'peak' | 'sharpening' | 'threshold' | 'specific' | 'endurance';

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
  /** 5K vezuje intervale za tempo trke pred kraj (tempo trke je praktično I tempo). */
  intervalPaceForWeek(pI: number, racePace: number, weeksToRace: number): number;
  paceStrategy?(racePaceSec: number): PaceStrategy;
  /** Dodatak opisu dugog trčanja (brz završetak na tempu trke). */
  longRunFinish?(
    phase: Phase,
    qualW: number,
    lrKm: number,
    racePace: number,
    strategy: PaceStrategy | null,
    cycleFactor: number | null
  ): FastFinish | null;
  /** A demanding long run leaves room for only one other quality day (HM first track). */
  singleQualityWeek?(x: SingleQualityContext): boolean;
  /** Weekly envelope trimming order: lower values are cut first (default: general before RP/M). */
  trimPriority?(day: SessionDay): number;
  /** Share of weekly running time allowed at T-or-faster; overrides the shared default. */
  weeklyFastShare?(readiness: QualityReadiness): number | undefined;
  /** Faktor ciklusa dugog trčanja po nedelji (samo maraton). */
  longRunCycle?(w: number, ctx: LongRunCycleContext): number;
}

export type { Intensity };
