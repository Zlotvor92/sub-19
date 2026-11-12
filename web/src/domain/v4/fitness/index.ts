/* V4 — FORMA IZ TRČANJA: javni ulaz (SPEC § 7). */
import type { EstimateFormFn } from '../engine/types';
import { estimateForm } from './estimate';

export {
  estimateForm,
  resultEvidence,
  qualityEvidence,
  hrTrend,
  pauseSpans,
  tenureOf
} from './estimate';
export { plural, clock, shortDate } from './explain';
export type {
  FitnessFacts,
  FitnessRun,
  PlannedWork,
  Tenure,
  ResultEvidence,
  PauseSpan
} from './types';

/** Provera ugovora: `estimateForm` odgovara `EstimateFormFn` iz motora (§ 7.1). */
export const estimateFormContract: EstimateFormFn = estimateForm;
