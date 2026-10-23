/* 10K v2 — javni API jezgra. Aplikacija ga ne uvozi: od segmenta 05 put iz aplikacije je samo adapter `./app/index.ts`
   (izvozi ga `tenK/index.ts` kao `tenKV2`, bira `select.ts`). */

export { adaptBanner, adaptTenKV2 } from './adapt.ts';
export { construct, generateTenKV2 } from './generate.ts';
export { validatePlan } from './validate.ts';
export { TEN_K_V2_POLICY } from './policy.ts';
export type {
  AdaptChange,
  AdaptCondition,
  AdaptReason,
  AdaptResult,
  BreakFact,
  DateRange,
  Experience,
  FactsCoverage,
  GenerateResult,
  GoalAssessment,
  PaceBasis,
  Paces,
  PlanDay,
  PlanWeek,
  Reason,
  ReasonCode,
  ResultFact,
  Rpe,
  TenKV2Adaptation,
  TenKV2AdaptStep,
  TenKV2Facts,
  TenKV2Input,
  TenKV2Plan,
  Violation,
  WeekLimits,
  Weekday,
  Workout,
  WorkoutFact
} from './types.ts';
