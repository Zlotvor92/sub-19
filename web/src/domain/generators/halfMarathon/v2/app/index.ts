/* HM v2 → APLIKACIJA (segment HM-05) — jedini kod v2 koji zna za format aplikacije. Izvršno uvozi samo iz
   `halfMarathon/v2/`; ni tipom ne izlazi iz `halfMarathon/v2/` (strogi test izolacije HM v2): oblici formata su lokalni
   strukturni (`./types.ts`), a `select.ts` od ovoga sastavlja `HALF_MARATHON_V2_GENERATOR` (`satisfies PlanGenerator`) i
   bira ga po oznaci politike (`hm-v2`).

   Raspodela ugovora: (a) v2 implementira sam — generisanje, oznake i faza, procena za čarobnjak, proizvod, tempo po zoni,
   prag, napor dana, izvoz na sat iz strukture; (b) adaptacija i predlog — eksplicitno nepodržano do segmenta HM-06, sa
   razlogom po članu (`./members.ts`); (c) prikaz stanja (bol, opterećenje, spremnost, vreme) — sopstvena kopija sa istim
   vrednostima kao HM v1 (`./state/`, `./weather.ts`). */

import * as gen from './generate.ts';
import * as b from './members.ts';
import * as plan from './plan.ts';
import * as paces from './paces.ts';
import * as state from './state/index.ts';
import * as readiness from './state/readiness.ts';
import * as watch from './watch.ts';
import * as weather from './weather.ts';

export const hmV2 = {
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
  /** Plan HM v2 (nosi izlaz v2 i tekuću oznaku politike). */
  isV2Plan: (p: { meta?: unknown; hmV2?: unknown } | null | undefined): boolean =>
    !!p && p.hmV2 != null && plan.planPolicy(p).status === 'current',
  /* (b) adaptacija i predlog — nepodržano do HM-06 (razlog po članu: `UNSUPPORTED`) */
  ADAPTATION_UNSUPPORTED: b.ADAPTATION_UNSUPPORTED,
  UNSUPPORTED: b.UNSUPPORTED,
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
