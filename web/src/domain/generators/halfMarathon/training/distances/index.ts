import type { DistanceProfile } from './types';
import { PROFILE_21K } from './profile21k';

/** Profil HM generatora. Drugi profili (5K, 10K, maraton) pripadaju svojim generatorima i ovde ne postoje;
 *  za drugu distancu `profileFor` vraća `undefined` (generator tada vraća grešku). */
export const DISTANCE_PROFILES: Readonly<Record<string, DistanceProfile>> = {
  21097.5: PROFILE_21K
};

export function profileFor(raceDistM: number): DistanceProfile | undefined {
  return DISTANCE_PROFILES[String(raceDistM)];
}

export type { DistanceProfile, Phase, PaceStrategy, QualityRequest } from './types';
