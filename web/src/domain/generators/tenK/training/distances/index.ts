import type { DistanceProfile } from './types';
import { PROFILE_10K } from './profile10k';

/** Profil 10K generatora. Drugi profili (5K, polumaraton, maraton) pripadaju svojim generatorima i ovde ne postoje;
 *  za drugu distancu `profileFor` vraća `undefined` (generator tada vraća grešku). */
export const DISTANCE_PROFILES: Readonly<Record<string, DistanceProfile>> = {
  10000: PROFILE_10K
};

export function profileFor(raceDistM: number): DistanceProfile | undefined {
  return DISTANCE_PROFILES[String(raceDistM)];
}

export type { DistanceProfile, Phase, QualityRequest } from './types';
