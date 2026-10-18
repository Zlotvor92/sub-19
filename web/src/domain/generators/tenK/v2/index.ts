/* 10K v2 — javni API. Do segmenta 05 se NE izvozi iz tenK/index.ts (nema puta iz aplikacije). */

export { construct, generateTenKV2 } from './generate.ts';
export { validatePlan } from './validate.ts';
export { TEN_K_V2_POLICY } from './policy.ts';
export type {
  Experience,
  GenerateResult,
  GoalAssessment,
  PaceBasis,
  Paces,
  PlanDay,
  PlanWeek,
  Reason,
  ReasonCode,
  Rpe,
  TenKV2AdaptStep,
  TenKV2Input,
  TenKV2Plan,
  Violation,
  Weekday,
  Workout
} from './types.ts';
