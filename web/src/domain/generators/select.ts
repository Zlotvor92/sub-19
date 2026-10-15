/* ============================================================
   IZBOR GENERATORA — aplikacioni sloj, bez trenerskih odluka.

   Jedina odluka ovde je KOJI generator odgovara za plan: po ciljnoj distanci ulaza (novi plan, regeneracija) ili po
   distanci perzistiranog plana (adaptacija nad sačuvanim planom). Sav proračun radi izabrani generator.

   Stanje izdvajanja (docs/generator-isolation/STATUS.md):
   - 5K → `./fiveK` (izdvojen, segment 1/5);
   - 10K → `./tenK` (izdvojen, segment 2/5);
   - polumaraton → `./halfMarathon` (izdvojen, segment 3/5), uključujući odluku o ograničenoj pripremi;
   - maraton → `./marathon` (izdvojen, segment 4/5), uključujući odluku o ograničenoj pripremi.
   Stari zajednički mehanizam (`domain/training` + `domain/plan`) ostaje samo za plan bez podržane distance (ugrađeni
   lični plan `null`, ručno uvezen plan sa drugom distancom) do segmenta 5.

   Pravilo za 5K: stari generator je distancu čitao kao `inp.raceDistM || 5000`, pa ulaz bez distance (ili sa 0) pripada 5K.
   Ugrađeni lični plan vlasnika (`genPlan === null`) je polumaraton i ostaje na starom mehanizmu.

   Predaja između generatora ide SAMO ovuda: HM opciju „kraća distanca" (10K/5K) i maratonsku (polumaraton/10K) pravi
   generator te distance, a HM/maraton je dobijaju kao argument (`ShorterDistanceHandoff` iz `./handoff.ts`), bez
   međusobnog uvoza generatora.
   ============================================================ */

import type { GenPlanState } from '../state';
import { profileFor } from '../training/distances';
import type { DistanceProduct } from '../training/constants/distances';
import { generatePlan as legacyGeneratePlan } from '../training/generator/generatePlan';
import { assess as legacyAssess } from '../training/generator/assess';
import { adaptGeneratedPlan as legacyAdapt } from '../plan/adapt';
import {
  buildExecutionAdjustment as legacyBuildExecutionAdjustment,
  executionBasis as legacyExecutionBasis,
  executionModel as legacyExecutionModel
} from '../plan/executionAdjustment';
import { buildRunWalkAdjustment as legacyBuildRunWalkAdjustment } from '../plan/runWalkAdjustment';
import { assessRunWalkProgress as legacyAssessRunWalkProgress } from '../training/runWalkProgress';
import {
  hasRecentMeasuredForm as legacyHasRecentMeasuredForm,
  qualityEntryGate as legacyQualityEntryGate
} from '../training/qualityGate';
import {
  planRecalibrated as legacyPlanRecalibrated,
  planWithNewGoal as legacyPlanWithNewGoal
} from '../plan/replan';
import { graftFuturePlan as legacyGraftFuturePlan } from '../plan/future';
import { alignAutomaticOverlays as legacyAlignAutomaticOverlays } from '../plan/automaticAlts';
import {
  applyVdotProposal as legacyApplyVdotProposal,
  planVdotNow as legacyPlanVdotNow,
  undoVdotAdjustments as legacyUndoVdotAdjustments,
  vdotProposal as legacyVdotProposal
} from '../training/adaptation/proposal';
import { fitnessEvidence as legacyFitnessEvidence } from '../training/adaptation/evidence';
import { matchPlanRows as legacyMatchPlanRows } from '../training/adaptation/matching';
import {
  basisFromPlan as legacyBasisFromPlan,
  buildPreparationChoice as legacyBuildPreparationChoice,
  isLimitedLongPreparation as legacyIsLimitedLongPreparation,
  preparationDecision as legacyPreparationDecision
} from '../plan/preparationDecision';
import * as fiveK from './fiveK';
import * as halfMarathon from './halfMarathon';
import { regeneratorForDistance } from './handoff';
import * as marathon from './marathon';
import * as tenK from './tenK';

export type GeneratorId = '5k' | '10k' | 'hm' | 'marathon' | 'legacy';

/** Ugovor generatora prema aplikaciji (isti oblik za svaki generator; interni modeli su njihovi). */
export const LEGACY_GENERATOR = {
  id: 'legacy' as GeneratorId,
  generatePlan: legacyGeneratePlan,
  adaptGeneratedPlan: legacyAdapt,
  assess: legacyAssess,
  product: (raceDistM: number): DistanceProduct | undefined => profileFor(raceDistM)?.product,
  executionModel: legacyExecutionModel,
  executionBasis: legacyExecutionBasis,
  buildExecutionAdjustment: legacyBuildExecutionAdjustment,
  buildRunWalkAdjustment: legacyBuildRunWalkAdjustment,
  assessRunWalkProgress: legacyAssessRunWalkProgress,
  qualityEntryGate: legacyQualityEntryGate,
  hasRecentMeasuredForm: legacyHasRecentMeasuredForm,
  planWithNewGoal: legacyPlanWithNewGoal,
  planRecalibrated: legacyPlanRecalibrated,
  graftFuturePlan: legacyGraftFuturePlan,
  alignAutomaticOverlays: legacyAlignAutomaticOverlays,
  vdotProposal: legacyVdotProposal,
  applyVdotProposal: legacyApplyVdotProposal,
  undoVdotAdjustments: legacyUndoVdotAdjustments,
  fitnessEvidence: legacyFitnessEvidence,
  planVdotNow: legacyPlanVdotNow,
  matchPlanRows: legacyMatchPlanRows
};
export type PlanGenerator = typeof LEGACY_GENERATOR;

export const FIVE_K_GENERATOR: PlanGenerator = {
  id: '5k',
  generatePlan: fiveK.generatePlan,
  adaptGeneratedPlan: fiveK.adaptGeneratedPlan,
  assess: fiveK.assess,
  product: (raceDistM) =>
    raceDistM === fiveK.FIVE_K_DISTANCE_M ? fiveK.FIVE_K_PRODUCT : undefined,
  executionModel: fiveK.executionModel,
  executionBasis: fiveK.executionBasis,
  buildExecutionAdjustment: fiveK.buildExecutionAdjustment,
  buildRunWalkAdjustment: fiveK.buildRunWalkAdjustment,
  assessRunWalkProgress: fiveK.assessRunWalkProgress,
  qualityEntryGate: fiveK.qualityEntryGate,
  hasRecentMeasuredForm: fiveK.hasRecentMeasuredForm,
  planWithNewGoal: fiveK.planWithNewGoal,
  planRecalibrated: fiveK.planRecalibrated,
  graftFuturePlan: fiveK.graftFuturePlan,
  alignAutomaticOverlays: fiveK.alignAutomaticOverlays,
  vdotProposal: fiveK.vdotProposal,
  applyVdotProposal: fiveK.applyVdotProposal,
  undoVdotAdjustments: fiveK.undoVdotAdjustments,
  fitnessEvidence: fiveK.fitnessEvidence,
  planVdotNow: fiveK.planVdotNow,
  matchPlanRows: fiveK.matchPlanRows
};

export const TEN_K_GENERATOR: PlanGenerator = {
  id: '10k',
  generatePlan: tenK.generatePlan,
  adaptGeneratedPlan: tenK.adaptGeneratedPlan,
  assess: tenK.assess,
  product: (raceDistM) => (raceDistM === tenK.TEN_K_DISTANCE_M ? tenK.TEN_K_PRODUCT : undefined),
  executionModel: tenK.executionModel,
  executionBasis: tenK.executionBasis,
  buildExecutionAdjustment: tenK.buildExecutionAdjustment,
  buildRunWalkAdjustment: tenK.buildRunWalkAdjustment,
  assessRunWalkProgress: tenK.assessRunWalkProgress,
  qualityEntryGate: tenK.qualityEntryGate,
  hasRecentMeasuredForm: tenK.hasRecentMeasuredForm,
  planWithNewGoal: tenK.planWithNewGoal,
  planRecalibrated: tenK.planRecalibrated,
  graftFuturePlan: tenK.graftFuturePlan,
  alignAutomaticOverlays: tenK.alignAutomaticOverlays,
  vdotProposal: tenK.vdotProposal,
  applyVdotProposal: tenK.applyVdotProposal,
  undoVdotAdjustments: tenK.undoVdotAdjustments,
  fitnessEvidence: tenK.fitnessEvidence,
  planVdotNow: tenK.planVdotNow,
  matchPlanRows: tenK.matchPlanRows
};

/** Kraća distanca iz HM odluke o pripremi → generator te distance (aplikaciona predaja, v. `handoff.ts`). */
const HM_SHORTER_HANDOFF = regeneratorForDistance as halfMarathon.ShorterDistanceHandoff;

export const HALF_MARATHON_GENERATOR: PlanGenerator = {
  id: 'hm',
  generatePlan: halfMarathon.generatePlan,
  adaptGeneratedPlan: halfMarathon.adaptGeneratedPlan,
  assess: halfMarathon.assess,
  product: (raceDistM) =>
    raceDistM === halfMarathon.HALF_MARATHON_DISTANCE_M
      ? halfMarathon.HALF_MARATHON_PRODUCT
      : undefined,
  executionModel: halfMarathon.executionModel,
  executionBasis: halfMarathon.executionBasis,
  buildExecutionAdjustment: (current, today, analysis, options, context) =>
    halfMarathon.buildExecutionAdjustment(
      current,
      today,
      analysis,
      options,
      context,
      HM_SHORTER_HANDOFF
    ),
  buildRunWalkAdjustment: halfMarathon.buildRunWalkAdjustment,
  assessRunWalkProgress: halfMarathon.assessRunWalkProgress,
  qualityEntryGate: halfMarathon.qualityEntryGate,
  hasRecentMeasuredForm: halfMarathon.hasRecentMeasuredForm,
  planWithNewGoal: halfMarathon.planWithNewGoal,
  planRecalibrated: halfMarathon.planRecalibrated,
  graftFuturePlan: halfMarathon.graftFuturePlan,
  alignAutomaticOverlays: halfMarathon.alignAutomaticOverlays,
  vdotProposal: halfMarathon.vdotProposal,
  applyVdotProposal: halfMarathon.applyVdotProposal,
  undoVdotAdjustments: halfMarathon.undoVdotAdjustments,
  fitnessEvidence: halfMarathon.fitnessEvidence,
  planVdotNow: halfMarathon.planVdotNow,
  matchPlanRows: halfMarathon.matchPlanRows
};

/** Kraća distanca iz maratonske odluke o pripremi → generator te distance (aplikaciona predaja, v. `handoff.ts`). */
const MARATHON_SHORTER_HANDOFF = regeneratorForDistance as marathon.ShorterDistanceHandoff;

export const MARATHON_GENERATOR: PlanGenerator = {
  id: 'marathon',
  generatePlan: marathon.generatePlan,
  adaptGeneratedPlan: marathon.adaptGeneratedPlan,
  assess: marathon.assess,
  product: (raceDistM) =>
    raceDistM === marathon.MARATHON_DISTANCE_M ? marathon.MARATHON_PRODUCT : undefined,
  executionModel: marathon.executionModel,
  executionBasis: marathon.executionBasis,
  buildExecutionAdjustment: (current, today, analysis, options, context) =>
    marathon.buildExecutionAdjustment(
      current,
      today,
      analysis,
      options,
      context,
      MARATHON_SHORTER_HANDOFF
    ),
  buildRunWalkAdjustment: marathon.buildRunWalkAdjustment,
  assessRunWalkProgress: marathon.assessRunWalkProgress,
  qualityEntryGate: marathon.qualityEntryGate,
  hasRecentMeasuredForm: marathon.hasRecentMeasuredForm,
  planWithNewGoal: marathon.planWithNewGoal,
  planRecalibrated: marathon.planRecalibrated,
  graftFuturePlan: marathon.graftFuturePlan,
  alignAutomaticOverlays: marathon.alignAutomaticOverlays,
  vdotProposal: marathon.vdotProposal,
  applyVdotProposal: marathon.applyVdotProposal,
  undoVdotAdjustments: marathon.undoVdotAdjustments,
  fitnessEvidence: marathon.fitnessEvidence,
  planVdotNow: marathon.planVdotNow,
  matchPlanRows: marathon.matchPlanRows
};

/** Generator za ciljnu distancu ulaza. `undefined`/0 je 5K (stari generator: `raceDistM || 5000`). */
export function generatorIdFor(raceDistM: unknown): GeneratorId {
  const dist = (raceDistM as number) || 5000;
  if (dist === fiveK.FIVE_K_DISTANCE_M) return '5k';
  if (dist === tenK.TEN_K_DISTANCE_M) return '10k';
  if (dist === halfMarathon.HALF_MARATHON_DISTANCE_M) return 'hm';
  if (dist === marathon.MARATHON_DISTANCE_M) return 'marathon';
  return 'legacy';
}

const GENERATORS: Readonly<Record<GeneratorId, PlanGenerator>> = {
  '5k': FIVE_K_GENERATOR,
  '10k': TEN_K_GENERATOR,
  hm: HALF_MARATHON_GENERATOR,
  marathon: MARATHON_GENERATOR,
  legacy: LEGACY_GENERATOR
};

export function generatorForDistance(raceDistM: unknown): PlanGenerator {
  return GENERATORS[generatorIdFor(raceDistM)];
}

/**
 * Generator koji odgovara za sačuvan plan: distanca iz `meta`, pa iz sačuvanog ulaza. Za zamenu plana drugim (vraćanje
 * verzije, regeneracija na drugoj distanci) bira se po planu KOJI SE UPISUJE, jer njegova trenerska obrada pripada njemu.
 * `null` (ugrađeni lični plan, polumaraton) i plan bez podržane distance ostaju na starom mehanizmu.
 */
export function generatorForPlan(plan: GenPlanState | null | undefined): PlanGenerator {
  if (!plan) return LEGACY_GENERATOR;
  const ulaz = plan.ulaz as { raceDistM?: unknown } | null | undefined;
  return generatorForDistance(plan.meta?.raceDistM ?? ulaz?.raceDistM);
}

/** Proizvodni podaci (ime, preporučene nedelje) za napomene čarobnjaka. */
export const productFor = (raceDistM: number): DistanceProduct | undefined =>
  generatorForDistance(raceDistM).product(raceDistM);

/* ODLUKA O OGRANIČENOJ PRIPREMI (produženje, kraća distanca, povratni režim) nad sačuvanim planom. Postoji samo za
   polumaraton i maraton (`isLimitedLongPreparation`); HM plan je obrađuje HM generator, maratonski plan maratonski generator,
   ostali planovi stari mehanizam (za 5K/10K plan ona nikad nije ograničena dugačka priprema, pa je put isti kao pre
   izdvajanja). */
export const LEGACY_PREPARATION = {
  basisFromPlan: legacyBasisFromPlan,
  preparationDecision: legacyPreparationDecision,
  buildPreparationChoice: legacyBuildPreparationChoice,
  isLimitedLongPreparation: legacyIsLimitedLongPreparation
};
export type PreparationApi = typeof LEGACY_PREPARATION;

export const HALF_MARATHON_PREPARATION: PreparationApi = {
  basisFromPlan: halfMarathon.basisFromPlan,
  preparationDecision: (current, today, basis, context, status, delivered) =>
    halfMarathon.preparationDecision(
      current,
      today,
      basis,
      context,
      status,
      delivered,
      HM_SHORTER_HANDOFF
    ),
  buildPreparationChoice: (current, today, basis, choice, context) =>
    halfMarathon.buildPreparationChoice(current, today, basis, choice, context, HM_SHORTER_HANDOFF),
  isLimitedLongPreparation: halfMarathon.isLimitedLongPreparation
};

export const MARATHON_PREPARATION: PreparationApi = {
  basisFromPlan: marathon.basisFromPlan,
  preparationDecision: (current, today, basis, context, status, delivered) =>
    marathon.preparationDecision(
      current,
      today,
      basis,
      context,
      status,
      delivered,
      MARATHON_SHORTER_HANDOFF
    ),
  buildPreparationChoice: (current, today, basis, choice, context) =>
    marathon.buildPreparationChoice(
      current,
      today,
      basis,
      choice,
      context,
      MARATHON_SHORTER_HANDOFF
    ),
  isLimitedLongPreparation: marathon.isLimitedLongPreparation
};

export function preparationForPlan(plan: GenPlanState | null | undefined): PreparationApi {
  const generator = generatorForPlan(plan);
  if (generator === HALF_MARATHON_GENERATOR) return HALF_MARATHON_PREPARATION;
  if (generator === MARATHON_GENERATOR) return MARATHON_PREPARATION;
  return LEGACY_PREPARATION;
}
