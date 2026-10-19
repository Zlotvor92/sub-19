/* Maraton v2 — javni API jezgra. Aplikacija ga ne uvozi: od segmenta MAR-05 put iz aplikacije je samo adapter
   `./app/index.ts` (izvozi ga `marathon/index.ts` kao `marathonV2`, bira `select.ts`). */

export { adaptBanner, adaptMarathonV2 } from './adapt.ts';
export { generateMarathonV2 } from './generate.ts';
export { validatePlan } from './validate.ts';
export { MARATHON_V2_POLICY } from './policy.ts';
export type {
  AdaptResult,
  GenerateResult,
  GoalAssessment,
  MarathonV2Facts,
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
