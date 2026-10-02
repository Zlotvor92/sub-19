import type { DistanceProfile } from './types';
import { PROFILE_10K } from './profile10k';
import { PROFILE_21K } from './profile21k';
import { PROFILE_42K } from './profile42k';
import { PROFILE_5K } from './profile5k';

/** Profil po ciljnoj distanci [m]. Nova distanca = novi profil; nijedan postojeći se ne dira. */
export const DISTANCE_PROFILES: Readonly<Record<string, DistanceProfile>> = {
  5000: PROFILE_5K,
  10000: PROFILE_10K,
  21097.5: PROFILE_21K,
  42195: PROFILE_42K
};

export function profileFor(raceDistM: number): DistanceProfile | undefined {
  return DISTANCE_PROFILES[String(raceDistM)];
}

export type { DistanceProfile, Phase, PaceStrategy, QualityRequest } from './types';
