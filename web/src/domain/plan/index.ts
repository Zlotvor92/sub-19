export { adaptGeneratedPlan } from './adapt';
export { resolvePlan, weekOf, InvalidPlanError, type Overlay } from './resolve';
export { swapDays, undoWeekMoves, setAlt, clearAlt, type AltInput, type EditResult } from './edit';
export {
  TAG_LABELS,
  tagName,
  safeTag,
  sessKind,
  dayLabel,
  weekPhase,
  rpeTarget,
  type WeekPhase,
  type RpeTarget
} from './describe';
export type { DayOrigin, ResolvedDay, ResolvedPlan, ResolvedWeek } from './types';
export {
  mergeOverrides,
  planWithNewGoal,
  recalibratedPlan,
  reentryPlan,
  type GoalChangeResult,
  type RecalibrationResult,
  type ReentryResult,
  type ReplanError
} from './replan';
export { hasGenPlanData, isGenId, purgeGenPlanData } from './purge';
export { headerSubtitle } from './header';
export * from './altEditor';
