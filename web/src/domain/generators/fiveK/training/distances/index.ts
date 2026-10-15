import type { DistanceProfile } from './types';
import { PROFILE_5K } from './profile5k';

/** 5K generator poznaje samo svoj profil. Druga distanca nije njegov ulaz (bira je aplikacioni izbor generatora). */
export function profileFor(raceDistM: number): DistanceProfile | undefined {
  return raceDistM === 5000 ? PROFILE_5K : undefined;
}

export type { DistanceProfile, Phase, PaceStrategy, QualityRequest } from './types';
