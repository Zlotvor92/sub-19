/* 2.4.0: kvalitet nedelje — JEDINO mesto odluke o dozi kvaliteta (dispečer):
   - rezultat (VDOT) i iskusan trkač → vdotWeekQuality (workouts.ts, kao 2.3.0 + Odluka 3);
   - plan po osećaju ili početnik → simpleWeekQuality (feel.ts).
   Isto važi za oštrenje trkačke nedelje. */

import { feelRaceSharpener, simpleWeekQuality } from './feel.ts';
import { FIVE_K_V2_POLICY as P, type Athlete } from './policy.ts';
import type { PaceModel, WeekFrame } from './types.ts';
import {
  qualitySession,
  vdotWeekQuality,
  type SessionResult,
  type WeekDose,
  type WeekQuality
} from './workouts.ts';

export function weekQuality(
  f: WeekFrame,
  targetKm: number,
  p: PaceModel,
  prev: WeekDose | null,
  a: Athlete,
  taperWeeks: number = P.phases.taperWeeks
): WeekQuality {
  if (a.feel || a.beginner || p.vdot === null) return simpleWeekQuality(f, targetKm, p, prev, a);
  return vdotWeekQuality(f, targetKm, p, prev, a.days, taperWeeks);
}

/** Oštrenje trkačke nedelje: sa rezultatom RP (i početnik), bez rezultata RP po osećaju. */
export function raceWeekSharpener(budgetKm: number, boundKm: number, p: PaceModel): SessionResult {
  if (p.vdot === null) return feelRaceSharpener(budgetKm, boundKm, p);
  return qualitySession('RP_sharpener', budgetKm, boundKm, p, 'race');
}
