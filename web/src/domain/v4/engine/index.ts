/* V4 — JAVNI IZVOZ MOTORA. Motor ne zna za distance; podaci distance ulaze kao `DistanceData`. */
export * from './types';
export { buildState } from './state';
export { plan } from './plan';
export { mergeChanges, replan } from './replan';
export { deriveEvents, sortEvents } from './events';
export { guard, validate, warnings } from './guard';
export { raceNotes, renderPlan, type RenderOptions } from './render';
export { canonical, fingerprint, serializePlan } from './fingerprint';
export { summarize, type PaceCtx, type WorkoutSummary, paceCtxOf } from './load';
export { isMutable } from './build';
export { declaredForm } from './formFallback';
export { effortTimeSec, vdotAt, zoneVdot } from './vdot';
