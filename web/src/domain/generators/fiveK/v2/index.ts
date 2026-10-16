/* 5K v2 — javni API. Nije povezan sa select.ts, UI-jem ni store-om. */

export { generateFiveKV2 } from './generate.ts';
export { checkInput } from './input.ts';
export { validatePlan } from './validate.ts';
export { pacesFromVdot, vdotFromResult, raceTimeForVdot, assessGoal } from './paces.ts';
export { FIVE_K_V2_POLICY, DECISIONS } from './policy.ts';
export type * from './types.ts';
