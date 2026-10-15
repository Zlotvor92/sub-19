/* ============================================================
   POLUMARATON GENERATOR — javni API (segment 3/5 izdvajanja generatora).

   Sve što učestvuje u izračunavanju HM plana živi u ovom direktorijumu: normalizacija i validacija ulaza, procena
   sportiste i spremnosti (staza `first`/`performance`), kilometraža i progresija, periodizacija i raspored, prag i HM ritam
   (`training/distances/hmProgression.ts`), intervali, kontrolna trka, limiti i omotač brzog rada, dužine i srednje-dugo
   trčanje, rasterećenje, dvonedeljni taper i nedelja trke, kratka priprema i povratak, adaptacija (izvršenje, run/walk,
   promena cilja, rekalibracija, predlog tempa, vraćanje verzije), odluka o ograničenoj pripremi, opisi i upozorenja,
   datumi i matematika. Struktura poddirektorijuma je ogledalo izvornih putanja u `domain/` (npr.
   `training/generator/generatePlan.ts` ← `domain/training/generator/generatePlan.ts`). Izvor kopije je stari zajednički
   mehanizam, ne 5K/10K generator; razlike su popisane u docs/generator-isolation/STATUS.md.

   Spolja se uvoze SAMO tipovi formata razmene, i to jedino kroz `exchange.ts`. Nijedan drugi generator, stari zajednički
   mehanizam ni aplikacioni modul se ne uvozi (proverava `isolation.node.test.ts`). Opciju „kraća distanca" (10K/5K) pravi
   generator te distance; aplikacija ga predaje kao argument `handoff` (`ShorterDistanceHandoff`).
   ============================================================ */

import { PRODUCT_21K } from './training/constants/distances';

/** Distanca koju ovaj generator pravi [m]. */
export const HALF_MARATHON_DISTANCE_M = 21097.5;
/** Proizvodni podaci HM (ime, preporučeni broj nedelja…) za napomene čarobnjaka. */
export const HALF_MARATHON_PRODUCT = PRODUCT_21K;

/* --- generisanje i adapter prema aplikaciji --- */
export { generatePlan } from './training/generator/generatePlan';
export { assess } from './training/generator/assess';
export { adaptGeneratedPlan } from './plan/adapt';

/* --- adaptacija --- */
export {
  buildExecutionAdjustment,
  executionBasis,
  executionModel,
  type ExecutionAdjustmentOptions
} from './plan/executionAdjustment';
export { finalWarnings, regenerateFuture, type RegenerationOptions } from './plan/regenerate';
export { buildRunWalkAdjustment, type RunWalkAdjustmentOptions } from './plan/runWalkAdjustment';
export { assessRunWalkProgress } from './training/runWalkProgress';
export { hasRecentMeasuredForm, qualityEntryGate } from './training/qualityGate';
export {
  mergeOverrides,
  planRecalibrated,
  planWithNewGoal,
  recalibratedPlan,
  reentryPlan,
  RECALIBRATION_MIN_WEEKS_LEFT
} from './plan/replan';
export { graftFuturePlan, type ReplanContext } from './plan/future';
export { alignAutomaticOverlays } from './plan/automaticAlts';
export {
  applyVdotProposal,
  planVdotNow,
  undoVdotAdjustments,
  vdotProposal
} from './training/adaptation/proposal';
export { fitnessEvidence } from './training/adaptation/evidence';

/* --- odluka o ograničenoj pripremi (produženje, kraća distanca, povratni režim) --- */
export {
  basisFromPlan,
  buildPreparationChoice,
  buildReturnBase,
  isLimitedLongPreparation,
  preparationDecision,
  type DecisionBasis,
  type PreparationChoice,
  type PreparationDecision,
  type ShorterDistanceHandoff
} from './plan/preparationDecision';

/* --- pomoćne funkcije koje koriste testovi poređenja (lokalne kopije, ne deljene) --- */
export { resolvePlan } from './plan/resolve';
export { matchPlanRows } from './training/adaptation/matching';
export { sessDesc, sessKm } from './training/sessions/calc';
export { t3kVdot } from './training/test3k';
