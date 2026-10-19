/* Maraton v2 — javni API jezgra. Aplikacija ga ne uvozi do faze 2 (MAR-05: adapter `./app/`, izbor u
   `select.ts`); `marathon/index.ts` se do tada ne menja. */

export { generateMarathonV2 } from './generate.ts';
export { validatePlan } from './validate.ts';
export { MARATHON_V2_POLICY } from './policy.ts';
export type {
  GenerateResult,
  GoalAssessment,
  MarathonV2Input,
  MarathonV2Plan,
  MarathonV2Result,
  Paces,
  PlanDay,
  PlanWeek,
  Reason,
  ReasonCode,
  Violation,
  Weekday,
  Workout
} from './types.ts';
