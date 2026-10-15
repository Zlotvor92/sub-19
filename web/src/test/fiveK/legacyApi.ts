/* STARI ZAJEDNIČKI MEHANIZAM kao referentni API za 5K (pre izdvajanja). Koristi ga samo test: referentni rezultati se uzimaju
   ISKLJUČIVO odavde (nikad iz novog 5K modula), pa izmena 5K koda ne može da „popravi" sopstvena očekivanja. */
import { generatePlan } from '@/domain/training/generator/generatePlan';
import { assess } from '@/domain/training/generator/assess';
import { adaptGeneratedPlan } from '@/domain/plan/adapt';
import { resolvePlan } from '@/domain/plan/resolve';
import { buildExecutionAdjustment, executionModel } from '@/domain/plan/executionAdjustment';
import { buildRunWalkAdjustment } from '@/domain/plan/runWalkAdjustment';
import { assessRunWalkProgress } from '@/domain/training/runWalkProgress';
import { hasRecentMeasuredForm, qualityEntryGate } from '@/domain/training/qualityGate';
import {
  planRecalibrated,
  planWithNewGoal,
  recalibratedPlan,
  reentryPlan
} from '@/domain/plan/replan';
import { graftFuturePlan } from '@/domain/plan/future';
import { alignAutomaticOverlays } from '@/domain/plan/automaticAlts';
import { fitnessEvidence } from '@/domain/training/adaptation/evidence';
import {
  applyVdotProposal,
  planVdotNow,
  undoVdotAdjustments,
  vdotProposal
} from '@/domain/training/adaptation/proposal';
import { matchPlanRows } from '@/domain/training/adaptation/matching';
import { sessDesc, sessKm } from '@/domain/training/sessions/calc';
import { t3kVdot } from '@/domain/training/test3k';

export const legacyApi = {
  generatePlan,
  assess,
  adaptGeneratedPlan,
  resolvePlan,
  executionModel,
  buildExecutionAdjustment,
  buildRunWalkAdjustment,
  assessRunWalkProgress,
  qualityEntryGate,
  hasRecentMeasuredForm,
  planWithNewGoal,
  planRecalibrated,
  recalibratedPlan,
  reentryPlan,
  graftFuturePlan,
  alignAutomaticOverlays,
  vdotProposal,
  applyVdotProposal,
  undoVdotAdjustments,
  fitnessEvidence,
  planVdotNow,
  matchPlanRows,
  sessKm,
  sessDesc,
  t3kVdot
};

export type GeneratorApi = typeof legacyApi;
