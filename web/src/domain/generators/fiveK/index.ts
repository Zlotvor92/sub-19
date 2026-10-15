/* ============================================================
   5K GENERATOR — javni API (segment 1/5 izdvajanja generatora).

   Sve što učestvuje u izračunavanju 5K plana živi u ovom direktorijumu: normalizacija i validacija ulaza, procena sportiste,
   kilometraža i progresija, periodizacija i raspored, izbor i doziranje kvaliteta, tempa i zone, dužine, oporavak, deload,
   taper, kratka priprema i povratak, adaptacija (izvršenje, run/walk, promena cilja, rekalibracija, predlog tempa,
   vraćanje verzije), opisi i upozorenja, datumi i matematika. Struktura poddirektorijuma je ogledalo izvornih putanja u
   `domain/` (npr. `training/generator/generatePlan.ts` ← `domain/training/generator/generatePlan.ts`), da bi razlika
   prema izvoru bila čitljiva; razlike su popisane u docs/generator-isolation/STATUS.md.

   Spolja se uvoze SAMO tipovi formata razmene, i to jedino kroz `exchange.ts`. Nijedan drugi generator, stari zajednički
   mehanizam ni aplikacioni modul se ne uvozi (proverava `isolation.node.test.ts`).
   ============================================================ */

import { PRODUCT_5K } from './training/constants/distances';

/** Distanca koju ovaj generator pravi [m]. */
export const FIVE_K_DISTANCE_M = 5000;
/** Proizvodni podaci 5K (ime, preporučeni broj nedelja…) za napomene čarobnjaka. */
export const FIVE_K_PRODUCT = PRODUCT_5K;

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

/* --- pomoćne funkcije koje koriste testovi poređenja (lokalne kopije, ne deljene) --- */
export { resolvePlan } from './plan/resolve';
export { matchPlanRows } from './training/adaptation/matching';
export { sessDesc, sessKm } from './training/sessions/calc';
export { t3kVdot } from './training/test3k';
