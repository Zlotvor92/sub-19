/* ============================================================
   IZBOR GENERATORA — aplikacioni sloj, bez trenerskih odluka.

   Jedina odluka ovde je KOJI generator odgovara za plan: po ciljnoj distanci ulaza (novi plan, regeneracija) ili po
   distanci perzistiranog plana (adaptacija nad sačuvanim planom). Sav proračun radi izabrani generator.

   Stanje izdvajanja (docs/generator-isolation/STATUS.md):
   - 5K → `./fiveK` (izdvojen, segment 1/5);
   - 10K → `./tenK` (izdvojen, segment 2/5);
   - polumaraton, maraton → stari zajednički mehanizam (`domain/training` + `domain/plan`) do svojih segmenata.

   Pravilo za 5K: stari generator je distancu čitao kao `inp.raceDistM || 5000`, pa ulaz bez distance (ili sa 0) pripada 5K.
   Ugrađeni lični plan vlasnika (`genPlan === null`) je polumaraton i ostaje na starom mehanizmu.
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
import * as fiveK from './fiveK';
import * as tenK from './tenK';

export type GeneratorId = '5k' | '10k' | 'legacy';

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

/** Generator za ciljnu distancu ulaza. `undefined`/0 je 5K (stari generator: `raceDistM || 5000`). */
export function generatorIdFor(raceDistM: unknown): GeneratorId {
  const dist = (raceDistM as number) || 5000;
  if (dist === fiveK.FIVE_K_DISTANCE_M) return '5k';
  if (dist === tenK.TEN_K_DISTANCE_M) return '10k';
  return 'legacy';
}

const GENERATORS: Readonly<Record<GeneratorId, PlanGenerator>> = {
  '5k': FIVE_K_GENERATOR,
  '10k': TEN_K_GENERATOR,
  legacy: LEGACY_GENERATOR
};

export function generatorForDistance(raceDistM: unknown): PlanGenerator {
  return GENERATORS[generatorIdFor(raceDistM)];
}

/**
 * Generator koji odgovara za sačuvan plan: distanca iz `meta`, pa iz sačuvanog ulaza. Za zamenu plana drugim (vraćanje
 * verzije, regeneracija na drugoj distanci) bira se po planu KOJI SE UPISUJE, jer njegova trenerska obrada pripada njemu.
 * `null` (ugrađeni lični plan, polumaraton) ostaje na starom mehanizmu.
 */
export function generatorForPlan(plan: GenPlanState | null | undefined): PlanGenerator {
  if (!plan) return LEGACY_GENERATOR;
  const ulaz = plan.ulaz as { raceDistM?: unknown } | null | undefined;
  return generatorForDistance(plan.meta?.raceDistM ?? ulaz?.raceDistM);
}

/** Proizvodni podaci (ime, preporučene nedelje) za napomene čarobnjaka. */
export const productFor = (raceDistM: number): DistanceProduct | undefined =>
  generatorForDistance(raceDistM).product(raceDistM);
