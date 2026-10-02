/* Validacija ulaza generatora. Stari generator je prihvatao degenerisan ulaz bez greške
   (docs/TRAINING_ENGINE_AUDIT.md §11, G1–G8): nepoznat `intensity` je davao NaN u km/tempu/opisima,
   `pb.sec = Infinity` negativan VDOT, `goalSec = 1` racePace 0. Čarobnjak je to blokirao, ali
   `S.genPlan.ulaz` iz uvezenog backupa/servera ulazi u `planSaNovimCiljem` nevalidiran. */

import { MAX_PLAUSIBLE_PACE_SEC_PER_KM, MIN_PLAUSIBLE_PACE_SEC_PER_KM } from '../constants/product';
import type { PlanGenerationInput } from '../types';

const INTENSITIES: readonly string[] = ['kons', 'std', 'agr'];

const plausiblePace = (distM: number, sec: number): boolean => {
  const pace = sec / (distM / 1000);
  return pace >= MIN_PLAUSIBLE_PACE_SEC_PER_KM && pace <= MAX_PLAUSIBLE_PACE_SEC_PER_KM;
};

/** `null` = ulaz je upotrebljiv; inače poruka za korisnika (srpski, bez tehničkog žargona). */
export function validateInput(inp: PlanGenerationInput): string | null {
  if (typeof inp.raceDistM !== 'number' && inp.raceDistM !== undefined) {
    return 'Distanca trke mora biti broj (metri).';
  }
  if (!inp.pb || !(inp.pb.sec > 0) || !(inp.pb.distM > 0)) {
    return 'Neispravan skorašnji rezultat (distanca i vreme moraju biti veći od nule).';
  }
  if (!(inp.weeklyKm > 0) || !Number.isFinite(inp.weeklyKm)) {
    return 'Nedeljna kilometraža mora biti veća od nule.';
  }
  if (!INTENSITIES.includes(inp.intensity)) {
    return 'Nepoznat tempo napretka (očekuje se „kons", „std" ili „agr").';
  }
  if (inp.volIntensity !== undefined && !INTENSITIES.includes(inp.volIntensity)) {
    return 'Nepoznat tempo rasta obima (očekuje se „kons", „std" ili „agr").';
  }
  if (
    !Number.isFinite(inp.pb.sec) ||
    !Number.isFinite(inp.pb.distM) ||
    !plausiblePace(inp.pb.distM, inp.pb.sec)
  ) {
    return 'Skorašnji rezultat nije verodostojan (tempo van opsega 2:20–20:00 po kilometru).';
  }
  /* `goalSec` koji nije pozitivan broj se tretira kao „nema cilja" (kao i ranije: 0, NaN, null);
     ali ono što JESTE zadato mora da bude verodostojno. */
  const goal = inp.goalSec;
  if (goal && !(Number.isFinite(goal) && plausiblePace(inp.raceDistM ?? 5000, goal))) {
    return 'Ciljno vreme nije verodostojno (tempo van opsega 2:20–20:00 po kilometru).';
  }
  return null;
}
