/* V4 ADAPTERI — JAVNI IZVOZ (SPEC § 9, AGENTS t. 8). Jedino mesto koje zna stari oblik plana i stanja. */
export { adopt, distanceOf, type AdoptResult } from './detect';
export { fingerprintLegacy } from './fingerprintLegacy';
export type { AdoptOk } from './shared';
export type { AdoptErrorCode, ReadError } from './read';
export { STIMULUS_TABLE, DISTANCE_BY_METERS, type Cue } from './stimuli';
