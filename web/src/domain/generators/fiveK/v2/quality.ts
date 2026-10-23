/* 2.4.0: kvalitet nedelje — JEDINO mesto odluke o dozi kvaliteta (dispečer):
   - rezultat (VDOT) i iskusan trkač → vdotWeekQuality (workouts.ts, kao 2.3.0 + Odluka 3);
   - plan po osećaju ili početnik → simpleWeekQuality (feel.ts).
   Isto važi za oštrenje trkačke nedelje.
   2.5.0: ograničenja adaptacije (f.limits.quality) ulaze ovde, pre izbora: 'none' = nedelja bez
   kvaliteta i bez ubrzanja; 'one' = jedan kvalitet doze rasterećenja (izgradnja: kao rasteretna nedelja,
   taper: kao taper 2), bez progresije (dose null). */

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
  const limit = f.limits?.quality;
  if (limit === 'none')
    return {
      ok: true,
      q1: null,
      q2: null,
      easyStrides: false,
      stridesOnly: false,
      notes: ['Adaptacija: nedelja bez kvaliteta (samo lagano, bez ubrzanja na danima zabrane).'],
      dose: null
    };
  const g =
    limit !== 'one'
      ? f
      : f.phase === 'taper'
        ? { ...f, taperStep: 2 as const }
        : { ...f, deload: true };
  const s =
    a.feel || a.beginner || p.vdot === null
      ? simpleWeekQuality(g, targetKm, p, prev, a)
      : vdotWeekQuality(g, targetKm, p, prev, a.days, taperWeeks);
  if (limit !== 'one' || !s.ok) return s;
  return {
    ...s,
    dose: null,
    notes: ['Adaptacija: jedan kvalitet, doza rasterećenja.', ...s.notes]
  };
}

/** Oštrenje trkačke nedelje: sa rezultatom RP (i početnik), bez rezultata RP po osećaju. */
export function raceWeekSharpener(budgetKm: number, boundKm: number, p: PaceModel): SessionResult {
  if (p.vdot === null) return feelRaceSharpener(budgetKm, boundKm, p);
  return qualitySession('RP_sharpener', budgetKm, boundKm, p, 'race');
}
