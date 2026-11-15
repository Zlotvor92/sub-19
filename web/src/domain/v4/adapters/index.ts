/* V4 ADAPTERI — JAVNI IZVOZ (SPEC § 9, AGENTS t. 8). Jedino mesto koje zna stari oblik plana i stanja. */
export { adopt, distanceOf, type AdoptResult } from './detect';
export { fingerprintLegacy } from './fingerprintLegacy';
/* Drugo puštanje, korak 1: prepoznavanje formata za pravilo „zadržava se / briše se" (`stores/detect.ts`) */
export { isV2 } from './v2';
export { isPersonal } from './personal';
export type { AdoptOk } from './shared';
/* R24 (7c): zapisi bola starog formata → `PainFlag` (sloj aplikacije ih čita bez sopstvenog prevoda) */
export { painOf } from './shared';
export type { AdoptErrorCode, ReadError } from './read';
export { STIMULUS_TABLE, DISTANCE_BY_METERS, type Cue } from './stimuli';
