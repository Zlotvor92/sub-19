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
/* Stare izvršne funkcije promene cilja/rekalibracije (`./replan`) se više ne izvoze odavde: aplikacija ih zove samo kroz
   generator distance plana (`domain/generators/select.ts`). Ostaju samo tipovi razmene podataka. */
export type {
  GoalChangeResult,
  RecalibratedStoredPlan,
  RecalibrationResult,
  ReentryResult,
  ReplanError
} from './replan';
export { planBaselineVdot } from './baseline';
export { hasGenPlanData, isGenId, purgeGenPlanData } from './purge';
export { headerSubtitle } from './header';
export * from './altEditor';
