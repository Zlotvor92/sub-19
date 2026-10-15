/* ============================================================
   MARATONSKI GENERATOR — javni API (segment 4/5 izdvajanja generatora).

   Sve što učestvuje u izračunavanju maratonskog plana živi u ovom direktorijumu: normalizacija i validacija ulaza,
   procena sportiste i spremnosti (pravilo dužine 26 km), tempo i zone, kilometraža i progresija, periodizacija
   (izdržljivost → prag → specifično) i raspored, maratonski tempo, prag, intervali i repeticije, limiti i omotač brzog rada,
   dužine sa sopstvenim ciklusom i konsolidacijom, srednje-dugo trčanje, brz završetak duge na maratonskom tempu, gorivo,
   rasterećenje, dvonedeljni taper i nedelja trke, kratka priprema i povratak, adaptacija (izvršenje, run/walk, promena
   cilja, rekalibracija, predlog tempa, vraćanje verzije), odluka o ograničenoj pripremi, opisi i upozorenja, datumi i
   matematika. Struktura poddirektorijuma je ogledalo izvornih putanja u `domain/` (npr.
   `training/generator/generatePlan.ts` ← `domain/training/generator/generatePlan.ts`). Izvor kopije je stari zajednički
   mehanizam, ne 5K/10K/HM generator; razlike su popisane u docs/generator-isolation/STATUS.md.

   Spolja se uvoze SAMO tipovi formata razmene, i to jedino kroz `exchange.ts`. Nijedan drugi generator, stari zajednički
   mehanizam ni aplikacioni modul se ne uvozi (proverava `isolation.node.test.ts`). Opciju „kraća distanca" (polumaraton,
   10K) pravi generator te distance; aplikacija ga predaje kao argument `handoff` (`ShorterDistanceHandoff`).
   ============================================================ */

import { PRODUCT_42K } from './training/constants/distances';

/** Distanca koju ovaj generator pravi [m]. */
export const MARATHON_DISTANCE_M = 42195;
/** Proizvodni podaci maratona (ime, preporučeni broj nedelja…) za napomene čarobnjaka. */
export const MARATHON_PRODUCT = PRODUCT_42K;

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
/* Kapija rekalibracije (koliko merenja i kolika razlika forme i plana opravdavaju preračunavanje) pripada generatoru;
   aplikacija je čita odavde umesto iz starog zajedničkog mehanizma. */
export {
  VDOT_PROPOSAL_MIN_MEASUREMENTS,
  VDOT_PROPOSAL_THRESHOLD
} from './training/constants/heuristics';
/* Zajednička trenerska logika preneta u generator (posle segmenta 5/5): predlog izmene plana zbog bola i prekida,
   automatska zamena dana posle uvoza, izvoz treninga na sat, tempo uz vrućinu, ciljni napor i tempo po zoni. */
export {
  applyInjuryProposal,
  injuryProposal,
  runWalkForPain,
  type InjuryChange,
  type InjuryLevel,
  type InjuryProposal,
  type RecoveryContext
} from './recovery/proposal';
export { realignPlan, type RealignInput, type RealignResult } from './activities/realign';
export {
  dayWorkoutText,
  sessionFromDescription,
  thresholdPace,
  workoutsForWatch,
  type WatchBatch,
  type WatchEvent
} from './watch/icuWorkouts';
export {
  heatAdjustedPace,
  heatAdvice,
  heatFor,
  targetPace,
  weatherCard,
  type WeatherCardInput,
  type WeatherCardModel
} from './weather';
export { rpeTarget, type RpeTarget } from './plan/describe';
export { paceForZone } from './training/vdot/paceForZone';
/* Procena stanja trkača (status bola, opterećenje i pojasevi, prekid, ostvarenost, spremnost „danas"). */
export {
  ACWR_HIGH,
  ACWR_MAX,
  ACWR_RETURN,
  ACWR_SCALE,
  acuteKm,
  acwrBand,
  acwrNow,
  acwrPlan,
  acwrPosition,
  acwrText,
  breakInfo,
  chronicKm,
  completion,
  daysWithoutRunning,
  largestWeeklyKm,
  painStatus,
  plannedKm7,
  returnToRunPhase,
  type Acwr,
  type AcwrBand,
  type PainStatus
} from './recovery';
export {
  loadMeaning,
  readinessModel,
  wellnessSignals,
  type Readiness,
  type Signal
} from './recovery/readiness';
