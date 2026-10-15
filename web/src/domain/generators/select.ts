/* ============================================================
   IZBOR GENERATORA — aplikacioni sloj, bez trenerskih odluka.

   Jedina odluka ovde je KOJI od četiri nezavisna generatora odgovara za plan: po ciljnoj distanci ulaza (novi plan,
   regeneracija) ili po distanci aktivnog plana (adaptacija nad sačuvanim ili ugrađenim planom). Sav proračun radi
   izabrani generator; ovde nema podrazumevanog generatora ni zamene jednog drugim.

   - 5K → `./fiveK`; 10K → `./tenK`; polumaraton → `./halfMarathon`; maraton → `./marathon` (tačne vrednosti distance).
   - Ulaz bez distance (ili sa 0) je 5K — isto pravilo kao stari generator (`raceDistM || 5000`); to nije zamena
     generatora, već čitanje ulaza koji distancu ne navodi.
   - Svaka druga distanca nema generator: `generatorForDistance`/`generatorForPlan` vraćaju `null`, a pozivalac to
     EKSPLICITNO prikazuje (`UNSUPPORTED_DISTANCE`). Stari zajednički mehanizam više ne postoji kao rezerva (segment 5/5).
   - Ugrađeni lični plan vlasnika (u store-u `genPlan === null`) bira se po aktivnom planu (`activeGenPlan()`), čija
     je distanca polumaraton → HM generator (dokaz istog ponašanja: `personalPlan.node.test.ts`).

   Predaja između generatora ide SAMO ovuda: HM opciju „kraća distanca" (10K/5K) i maratonsku (polumaraton/10K) pravi
   generator te distance, a HM/maraton je dobijaju kao argument (`ShorterDistanceHandoff` iz `./handoff.ts`), bez
   međusobnog uvoza generatora.
   ============================================================ */

import type { GenPlanState } from '../state';
import * as fiveK from './fiveK';
import * as halfMarathon from './halfMarathon';
import { regeneratorForDistance } from './handoff';
import * as marathon from './marathon';
import * as tenK from './tenK';

export type GeneratorId = '5k' | '10k' | 'hm' | 'marathon';

/** Poruka za plan čija distanca nema generator (ručno uvezen ili oštećen plan). */
export const UNSUPPORTED_DISTANCE =
  'Plan nema podržanu distancu (5K, 10K, polumaraton ili maraton), pa ga nijedan generator ne može da prilagodi. Napravi novi plan.';

/* Ugovor generatora prema aplikaciji: oblik objekta polumaratonskog generatora (najširi rezultat — prilagođavanje može
   da nosi i odluku o pripremi). TypeScript proverava da se svaki od četiri generatora uklapa; tipovi su tipovi razmene
   podataka, a interni modeli i politika pripadaju svakom generatoru posebno. */
export type PlanGenerator = typeof halfMarathonGenerator;
export type DistanceProduct = typeof halfMarathon.HALF_MARATHON_PRODUCT;

/* Tipovi razmene za ekrane (oblik je isti u sva četiri generatora; ekrani ne uvoze generatore direktno). */
export type InjuryProposal = NonNullable<ReturnType<PlanGenerator['injuryProposal']>>;
export type RecoveryContext = Parameters<PlanGenerator['injuryProposal']>[0];
export type RpeTarget = NonNullable<ReturnType<PlanGenerator['rpeTarget']>>;
export type WatchBatch = ReturnType<PlanGenerator['workoutsForWatch']>;
export type WeatherCardInput = Parameters<PlanGenerator['weatherCard']>[0];
export type WeatherCardModel = NonNullable<ReturnType<PlanGenerator['weatherCard']>>;
export type RealignInput = Parameters<PlanGenerator['realignPlan']>[0];

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
  matchPlanRows: fiveK.matchPlanRows,
  recalibrationMinMeasurements: fiveK.VDOT_PROPOSAL_MIN_MEASUREMENTS,
  recalibrationThreshold: fiveK.VDOT_PROPOSAL_THRESHOLD,
  injuryProposal: fiveK.injuryProposal,
  applyInjuryProposal: fiveK.applyInjuryProposal,
  realignPlan: fiveK.realignPlan,
  workoutsForWatch: fiveK.workoutsForWatch,
  thresholdPace: fiveK.thresholdPace,
  weatherCard: fiveK.weatherCard,
  rpeTarget: fiveK.rpeTarget,
  paceForZone: fiveK.paceForZone
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
  matchPlanRows: tenK.matchPlanRows,
  recalibrationMinMeasurements: tenK.VDOT_PROPOSAL_MIN_MEASUREMENTS,
  recalibrationThreshold: tenK.VDOT_PROPOSAL_THRESHOLD,
  injuryProposal: tenK.injuryProposal,
  applyInjuryProposal: tenK.applyInjuryProposal,
  realignPlan: tenK.realignPlan,
  workoutsForWatch: tenK.workoutsForWatch,
  thresholdPace: tenK.thresholdPace,
  weatherCard: tenK.weatherCard,
  rpeTarget: tenK.rpeTarget,
  paceForZone: tenK.paceForZone
};

/** Kraća distanca iz HM odluke o pripremi → generator te distance (aplikaciona predaja, v. `handoff.ts`). */
const HM_SHORTER_HANDOFF = regeneratorForDistance as halfMarathon.ShorterDistanceHandoff;

const halfMarathonGenerator = {
  id: 'hm' as GeneratorId,
  generatePlan: halfMarathon.generatePlan,
  adaptGeneratedPlan: halfMarathon.adaptGeneratedPlan,
  assess: halfMarathon.assess,
  product: (raceDistM: number): typeof halfMarathon.HALF_MARATHON_PRODUCT | undefined =>
    raceDistM === halfMarathon.HALF_MARATHON_DISTANCE_M
      ? halfMarathon.HALF_MARATHON_PRODUCT
      : undefined,
  executionModel: halfMarathon.executionModel,
  executionBasis: halfMarathon.executionBasis,
  buildExecutionAdjustment: (
    ...a: Parameters<typeof halfMarathon.buildExecutionAdjustment> extends [...infer P, unknown]
      ? P
      : never
  ) => halfMarathon.buildExecutionAdjustment(...a, HM_SHORTER_HANDOFF),
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
  matchPlanRows: halfMarathon.matchPlanRows,
  recalibrationMinMeasurements: halfMarathon.VDOT_PROPOSAL_MIN_MEASUREMENTS,
  recalibrationThreshold: halfMarathon.VDOT_PROPOSAL_THRESHOLD,
  injuryProposal: halfMarathon.injuryProposal,
  applyInjuryProposal: halfMarathon.applyInjuryProposal,
  realignPlan: halfMarathon.realignPlan,
  workoutsForWatch: halfMarathon.workoutsForWatch,
  thresholdPace: halfMarathon.thresholdPace,
  weatherCard: halfMarathon.weatherCard,
  rpeTarget: halfMarathon.rpeTarget,
  paceForZone: halfMarathon.paceForZone
};
export const HALF_MARATHON_GENERATOR: PlanGenerator = halfMarathonGenerator;

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
  matchPlanRows: marathon.matchPlanRows,
  recalibrationMinMeasurements: marathon.VDOT_PROPOSAL_MIN_MEASUREMENTS,
  recalibrationThreshold: marathon.VDOT_PROPOSAL_THRESHOLD,
  injuryProposal: marathon.injuryProposal,
  applyInjuryProposal: marathon.applyInjuryProposal,
  realignPlan: marathon.realignPlan,
  workoutsForWatch: marathon.workoutsForWatch,
  thresholdPace: marathon.thresholdPace,
  weatherCard: marathon.weatherCard,
  rpeTarget: marathon.rpeTarget,
  paceForZone: marathon.paceForZone
};

/** Generator za ciljnu distancu ulaza; `undefined`/0 je 5K (stari ulaz: `raceDistM || 5000`); ostalo `null`. */
export function generatorIdFor(raceDistM: unknown): GeneratorId | null {
  const dist = (raceDistM as number) || 5000;
  if (dist === fiveK.FIVE_K_DISTANCE_M) return '5k';
  if (dist === tenK.TEN_K_DISTANCE_M) return '10k';
  if (dist === halfMarathon.HALF_MARATHON_DISTANCE_M) return 'hm';
  if (dist === marathon.MARATHON_DISTANCE_M) return 'marathon';
  return null;
}

const GENERATORS: Readonly<Record<GeneratorId, PlanGenerator>> = {
  '5k': FIVE_K_GENERATOR,
  '10k': TEN_K_GENERATOR,
  hm: HALF_MARATHON_GENERATOR,
  marathon: MARATHON_GENERATOR
};

/** Generator ciljne distance ili `null` kad distanca nije podržana (pozivalac to prikazuje, bez zamene). */
export function generatorForDistance(raceDistM: unknown): PlanGenerator | null {
  const id = generatorIdFor(raceDistM);
  return id ? GENERATORS[id] : null;
}

/**
 * Generator koji odgovara za plan: distanca iz `meta`, pa iz sačuvanog ulaza. Za zamenu plana drugim (vraćanje verzije,
 * regeneracija na drugoj distanci) bira se po planu KOJI SE UPISUJE, jer njegova trenerska obrada pripada njemu. Za plan u
 * prikazu prosleđuje se AKTIVNI plan (uključujući ugrađeni lični plan). `null`: nema plana ili distanca nije podržana.
 */
export function generatorForPlan(plan: GenPlanState | null | undefined): PlanGenerator | null {
  if (!plan) return null;
  const ulaz = plan.ulaz as { raceDistM?: unknown } | null | undefined;
  return generatorForDistance(plan.meta?.raceDistM ?? ulaz?.raceDistM);
}

/** Proizvodni podaci (ime, preporučene nedelje) generatora te distance; `undefined` kad distanca nije podržana. */
export const productFor = (raceDistM: number): DistanceProduct | undefined =>
  generatorForDistance(raceDistM)?.product(raceDistM);

/* ODLUKA O OGRANIČENOJ PRIPREMI (produženje, kraća distanca, povratni režim) nad sačuvanim planom. Postoji samo u
   polumaratonskom i maratonskom generatoru; 5K i 10K je nemaju (njihova priprema nikad nije „ograničena dugačka
   priprema"), pa za njih `preparationForPlan` vraća `null` — isto što je stari mehanizam za njih uvek odlučivao. */
const halfMarathonPreparation = {
  basisFromPlan: halfMarathon.basisFromPlan,
  preparationDecision: (
    ...a: Parameters<typeof halfMarathon.preparationDecision> extends [...infer P, unknown]
      ? P
      : never
  ) => halfMarathon.preparationDecision(...a, HM_SHORTER_HANDOFF),
  buildPreparationChoice: (
    ...a: Parameters<typeof halfMarathon.buildPreparationChoice> extends [...infer P, unknown]
      ? P
      : never
  ) => halfMarathon.buildPreparationChoice(...a, HM_SHORTER_HANDOFF),
  isLimitedLongPreparation: halfMarathon.isLimitedLongPreparation
};
export type PreparationApi = typeof halfMarathonPreparation;

export const HALF_MARATHON_PREPARATION: PreparationApi = halfMarathonPreparation;

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

export function preparationForPlan(plan: GenPlanState | null | undefined): PreparationApi | null {
  const generator = generatorForPlan(plan);
  if (generator === HALF_MARATHON_GENERATOR) return HALF_MARATHON_PREPARATION;
  if (generator === MARATHON_GENERATOR) return MARATHON_PREPARATION;
  return null;
}
