export { resolvePlan, weekOf, InvalidPlanError, type Overlay } from './resolve';
export { swapDays, undoWeekMoves, setAlt, clearAlt, type AltInput, type EditResult } from './edit';
export {
  TAG_LABELS,
  tagName,
  safeTag,
  sessKind,
  dayLabel,
  weekPhase,
  type WeekPhase
} from './describe';
export type { DayOrigin, ResolvedDay, ResolvedPlan, ResolvedWeek } from './types';
export { planBaselineVdot } from './baseline';
export { hasGenPlanData, isGenId, purgeGenPlanData } from './purge';
export { headerSubtitle } from './header';
export * from './altEditor';
