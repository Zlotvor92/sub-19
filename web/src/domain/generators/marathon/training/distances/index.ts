import type { DistanceProfile } from './types';
import { PROFILE_42K } from './profile42k';

/** Jedini profil ovog generatora: maraton. Profili 5K/10K/HM pripadaju svojim generatorima. */
export const DISTANCE_PROFILES: Readonly<Record<string, DistanceProfile>> = {
  42195: PROFILE_42K
};

export function profileFor(raceDistM: number): DistanceProfile | undefined {
  return DISTANCE_PROFILES[String(raceDistM)];
}

export type { DistanceProfile, Phase, QualityRequest } from './types';
