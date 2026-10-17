/* 5K v2 → APLIKACIJA (segment 08a) — jedini kod v2 koji zna za format aplikacije. Izvršno uvozi samo iz `fiveK/v2/`;
   format razmene samo tipovima (`fiveK/exchange.ts`). `select.ts` od ovoga sastavlja `FIVE_K_V2_GENERATOR`
   (`satisfies PlanGenerator`) i bira ga po oznaci politike plana (`5k-v2`).

   Raspodela ugovora: (a) v2 implementira sam — generisanje, oznake i faza, procena za čarobnjak, proizvod, tempo po
   zoni, prag, napor dana, izvoz na sat iz strukture; (b) adaptacija i predlog — eksplicitno nepodržano do 08b
   (`./unsupported.ts`); (c) prikaz stanja (bol, opterećenje, spremnost, vreme) — sopstvena kopija sa istim vrednostima
   kao fiveK (`./state/`, `./weather.ts`). */

import * as gen from './generate.ts';
import * as plan from './plan.ts';
import * as paces from './paces.ts';
import * as state from './state/index.ts';
import * as readiness from './state/readiness.ts';
import * as no from './unsupported.ts';
import * as watch from './watch.ts';
import * as weather from './weather.ts';

export const fiveKV2 = {
  /* (a) politika plana i faza */
  POLICY_ID: plan.POLICY_ID,
  POLICY_VERSION: plan.POLICY_VERSION,
  LEGACY_POLICY_ID: plan.LEGACY_POLICY_ID,
  KNOWN_VERSIONS: plan.KNOWN_VERSIONS,
  planPolicy: plan.planPolicy,
  stampPlan: plan.stampPlan,
  phaseOfWeek: plan.phaseOfWeek,
  /* (a) generisanje, procena, proizvod */
  generateStructured: gen.generateStructured,
  alignedStart: gen.alignedStart,
  generatePlan: gen.generatePlan,
  adaptGeneratedPlan: gen.adaptGeneratedPlan,
  assess: gen.assess,
  product: gen.product,
  /* (a) smernice prikaza i sat */
  paceForZone: paces.paceForZone,
  thresholdPace: paces.thresholdPace,
  rpeTarget: gen.rpeTarget,
  workoutsForWatch: watch.workoutsForWatch,
  /* (b) adaptacija i predlog — 08b */
  ADAPTATION_UNSUPPORTED: no.ADAPTATION_UNSUPPORTED,
  classifyMeasurement: no.classifyMeasurement,
  recomputeVdotChain: no.recomputeVdotChain,
  sessionClassFor: no.sessionClassFor,
  currentVdot: no.currentVdot,
  executionModel: no.executionModel,
  executionBasis: no.executionBasis,
  buildExecutionAdjustment: no.buildExecutionAdjustment,
  buildRunWalkAdjustment: no.buildRunWalkAdjustment,
  assessRunWalkProgress: no.assessRunWalkProgress,
  qualityEntryGate: no.qualityEntryGate,
  hasRecentMeasuredForm: no.hasRecentMeasuredForm,
  planWithNewGoal: no.planWithNewGoal,
  planRecalibrated: no.planRecalibrated,
  graftFuturePlan: no.graftFuturePlan,
  alignAutomaticOverlays: no.alignAutomaticOverlays,
  vdotProposal: no.vdotProposal,
  applyVdotProposal: no.applyVdotProposal,
  undoVdotAdjustments: no.undoVdotAdjustments,
  fitnessEvidence: no.fitnessEvidence,
  planVdotNow: no.planVdotNow,
  matchPlanRows: no.matchPlanRows,
  RECALIBRATION_MIN_MEASUREMENTS: no.RECALIBRATION_MIN_MEASUREMENTS,
  RECALIBRATION_THRESHOLD: no.RECALIBRATION_THRESHOLD,
  injuryProposal: no.injuryProposal,
  applyInjuryProposal: no.applyInjuryProposal,
  realignPlan: no.realignPlan,
  /* (c) prikaz stanja — sopstvena kopija */
  weatherCard: weather.weatherCard,
  painStatus: state.painStatus,
  acwrNow: state.acwrNow,
  acwrPlan: state.acwrPlan,
  readinessModel: readiness.readinessModel,
  loadMeaning: readiness.loadMeaning,
  wellnessSignals: readiness.wellnessSignals,
  acwrBand: state.acwrBand,
  acwrText: state.acwrText,
  acwrPosition: state.acwrPosition,
  ACWR_MAX: state.ACWR_MAX,
  ACWR_RETURN: state.ACWR_RETURN,
  ACWR_HIGH: state.ACWR_HIGH,
  ACWR_SCALE: state.ACWR_SCALE
};
