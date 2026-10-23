/* 5K v2 — javni API jezgra. Aplikacija ga ne uvozi direktno: povezivanje (08a) ide samo kroz `./app/` (adapter), koji
   `fiveK/index.ts` izvozi za `select.ts`. */

export { generateFiveKV2 } from './generate.ts';
export { adaptFiveKV2 } from './adapt.ts';
export { checkInput, hasFreshResult } from './input.ts';
export { validatePlan } from './validate.ts';
export { runWalkSession, runWalkRace } from './runWalk.ts';
export { pacesFromVdot, vdotFromResult, raceTimeForVdot, assessGoal, feelPaces } from './paces.ts';
export { FIVE_K_V2_POLICY, DECISIONS, rulesOf } from './policy.ts';
export type * from './types.ts';
