/* 5K v2 → APLIKACIJA (segment 08a) — jedini kod v2 koji zna za format aplikacije. Izvršno uvozi samo iz `fiveK/v2/`;
   format razmene samo tipovima (`fiveK/exchange.ts`). `select.ts` od ovoga sastavlja `FIVE_K_V2_GENERATOR`
   (`satisfies PlanGenerator`) i bira ga po oznaci politike plana (`5k-v2`).

   Raspodela ugovora: (a) v2 implementira sam — generisanje, oznake i faza, procena za čarobnjak, proizvod, tempo po
   zoni, prag, napor dana, izvoz na sat iz strukture; (b) adaptacija i predlog — 08b: kroz činjenice (`./facts.ts`) i
   `adaptFiveKV2` (`./adapt.ts`, `./members.ts`), uz pregled pre upisa; (c) prikaz stanja (bol, opterećenje, spremnost,
   vreme) — sopstvena kopija sa istim vrednostima kao fiveK (`./state/`, `./weather.ts`). */

import * as adapt from './adapt.ts';
import * as facts from './facts.ts';
import * as form from './form.ts';
import * as gen from './generate.ts';
import * as target from './handoffTarget.ts';
import * as plan from './plan.ts';
import * as paces from './paces.ts';
import * as state from './state/index.ts';
import * as readiness from './state/readiness.ts';
import * as b from './members.ts';
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
  /* (b) adaptacija i predlog (08b): pregled, primena, vraćanje, cilj, forma iz rezultata */
  adaptPreview: adapt.adaptPreview,
  goalChange: adapt.goalChange,
  isV2Plan: (p: Parameters<typeof adapt.v2Of>[0]): boolean => adapt.v2Of(p) !== null,
  sourceOf: b.sourceOf,
  coverageText: facts.coverageText,
  formHistory: form.formHistory,
  classifyMeasurement: b.classifyMeasurement,
  recomputeVdotChain: b.recomputeVdotChain,
  sessionClassFor: b.sessionClassFor,
  currentVdot: b.currentVdot,
  executionModel: b.executionModel,
  executionBasis: b.executionBasis,
  buildExecutionAdjustment: b.buildExecutionAdjustment,
  buildRunWalkAdjustment: b.buildRunWalkAdjustment,
  assessRunWalkProgress: b.assessRunWalkProgress,
  qualityEntryGate: b.qualityEntryGate,
  hasRecentMeasuredForm: b.hasRecentMeasuredForm,
  planWithNewGoal: b.planWithNewGoal,
  planRecalibrated: b.planRecalibrated,
  graftFuturePlan: b.graftFuturePlan,
  alignAutomaticOverlays: b.alignAutomaticOverlays,
  vdotProposal: b.vdotProposal,
  applyVdotProposal: b.applyVdotProposal,
  undoVdotAdjustments: b.undoVdotAdjustments,
  fitnessEvidence: b.fitnessEvidence,
  planVdotNow: b.planVdotNow,
  matchPlanRows: b.matchPlanRows,
  RECALIBRATION_MIN_MEASUREMENTS: b.RECALIBRATION_MIN_MEASUREMENTS,
  RECALIBRATION_THRESHOLD: b.RECALIBRATION_THRESHOLD,
  injuryProposal: b.injuryProposal,
  applyInjuryProposal: b.applyInjuryProposal,
  realignPlan: b.realignPlan,
  /* faza 3 (3d): 5K v2 kao CILJ predaje „kraća distanca" (izvor HM v2) */
  handoffFuture: target.handoffFuture,
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
