/* HM v3 — javni API: samo generisanje početnog plana (bez adaptacije, uvoza i veze sa aplikacijom). */
export { generate, POLICY_VERSION } from './build.ts';
export { renderText } from './text.ts';
export type { PlanDoc, V3Input, Week, Day, Session, Finding, Weekday } from './types.ts';
export { V3InputError } from './types.ts';
