/* 10K v2 — javni API. Do segmenta 05 se NE izvozi iz tenK/index.ts (nema puta iz aplikacije). */

export { adaptTenKV2 } from './adapt.ts';
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
