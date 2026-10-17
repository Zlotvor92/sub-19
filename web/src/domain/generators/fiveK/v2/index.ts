/* 5K v2 — javni API. Nije povezan sa select.ts, UI-jem ni store-om. */

export { generateFiveKV2 } from './generate.ts';
export { adaptFiveKV2 } from './adapt.ts';
export { checkInput, hasFreshResult } from './input.ts';
export { validatePlan } from './validate.ts';
export { pacesFromVdot, vdotFromResult, raceTimeForVdot, assessGoal, feelPaces } from './paces.ts';
export { FIVE_K_V2_POLICY, DECISIONS, rulesOf } from './policy.ts';
export type * from './types.ts';
