import type { DistanceHeuristic, DistanceProduct } from '../constants/distances';
import type { FastFinish, Intensity, SessionDay } from '../types';

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
  ctx: QualityContext;
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
  /** Faktor ciklusa dugog trčanja po nedelji (samo maraton). */
  longRunCycle?(w: number, ctx: LongRunCycleContext): number;
}

export type { Intensity };
