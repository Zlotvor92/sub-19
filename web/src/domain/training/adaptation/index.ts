export {
  smoothVdot,
  sessionClassFor,
  zoneForPredLabel,
  recomputeVdotChain,
  currentVdot
} from './chain';
export {
  classifyMeasurement,
  type MeasureInput,
  type MeasureOutcome,
  type RejectReason
} from './measure';
export {
  matchWeekRows,
  matchPlanRows,
  predRowsForDay,
  dayZone,
  type StoredPredRow
} from './matching';
/* Predlog/primena/poništavanje tempa i dokaz forme (`./proposal`, `./evidence`) su izvršne funkcije adaptacije: aplikacija
   ih zove samo kroz generator distance plana (`domain/generators/select.ts`). Odavde se izvozi samo prikazni `effectivePace`
   i tipovi razmene podataka. */
export { effectivePace } from './effectivePace';
export {
  type ProposalContext,
  type FormVsPlan,
  type VdotProposal,
  type ProposalChange,
  type ApplyResult
} from './proposal';
export { alignVdotDates } from './dates';
export type { FitnessEvidence, FitnessEvidenceContext, EvidenceExclusion } from './evidence';
