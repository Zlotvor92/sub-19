/* HM v2 — javni API jezgra. Aplikacija ga ne uvozi do faze 2 (halfMarathon/index.ts je nepromenjen). */

export { generateHmV2 } from './generate.ts';
export { validatePlan } from './validate.ts';
export { HM_V2_POLICY } from './policy.ts';
export type {
  GenerateResult,
  GoalAssessment,
  HmV2Input,
  HmV2Plan,
  HmV2Result,
  Paces,
  PlanDay,
  PlanWeek,
  Reason,
  ReasonCode,
  Violation,
  Weekday,
  Workout
} from './types.ts';
