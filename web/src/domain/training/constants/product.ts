/* ============================================================
   PROIZVODNE ODLUKE — vlasnik proizvoda ih bira, ne nauka ni trener.

   Granice, podrazumevane vrednosti i pragovi upozorenja. Menjaju se uz odluku
   o proizvodu (docs/TRAINING_ENGINE_AUDIT.md §5.3), ne uz kalibraciju.
   ============================================================ */

/** Raspon VDOT-a koji tablica poznaje; van njega tempo nije merenje nego omaška. */
export const VDOT_TABLE_MIN = 20;
export const VDOT_TABLE_MAX = 85;

/** Podrazumevani broj dana trčanja i kvalitetnih treninga. */
export const DEFAULT_RUN_DAYS = 4;
export const DEFAULT_QUALITY = 2;

/** Dugo trčanje je podrazumevano nedelja (dow 7). */
export const DEFAULT_LONG_RUN_DOW = 7;

/** Bezbednosni plafon dužine plana (2 godine) protiv pogrešno unetog datuma. */
export const MAX_PLAN_WEEKS = 104;

/** Obavezni „mesec dana" trčanja/hoda za početnika. */
export const RUN_WALK_WEEKS = 4;
export const RUN_WALK_LADDER = [
  { runSec: 60, walkSec: 60, label: '1 min trčanja / 1 min hoda' },
  { runSec: 120, walkSec: 60, label: '2 min trčanja / 1 min hoda' },
  { runSec: 180, walkSec: 60, label: '3 min trčanja / 1 min hoda' },
  { runSec: 300, walkSec: 60, label: '5 min trčanja / 1 min hoda' }
] as const;

/** Iznad ovog obima odgovor „tek počinjem" nije verodostojan (upozorenje, ne blokada). */
export const BEGINNER_MAX_WEEKLY_KM = 30;

/** Plan se pravi i ispod ovoga, ali se prijavljuje: minimum po treningu je 1,5 km. */
export const MIN_KM_PER_RUN = 1.5;

/** Prva puna nedelja sme da zaostane za unetim obimom najviše ovoliko pre upozorenja. */
export const FIRST_WEEK_SHORTFALL_WARN = 0.15;

/** Plan „ne stiže" do traženog obima ako vrhunac ostane ispod ovog udela. */
export const STRUCTURAL_CEILING_RATIO = 0.93;

/** Gornja granica unetog obima koju generator uopšte uvažava (degenerisan unos). */
export const MAX_INPUT_WEEKLY_KM = 120;
export const MIN_START_WEEKLY_KM = 8;

/**
 * Verodostojan tempo [s/km] za lični rekord i ciljno vreme. Granice su šire od svega što čarobnjak
 * dozvoljava (5K 12:00–99:59 je 2:24–20:00 po km) i uže od svega besmislenog (Infinity, 1 s, 0).
 * [P] — proizvodna odluka (v. docs/TRAINING_ENGINE_AUDIT.md D4).
 */
export const MIN_PLAUSIBLE_PACE_SEC_PER_KM = 140;
export const MAX_PLAUSIBLE_PACE_SEC_PER_KM = 1200;

/** Test na 3 km (v. domain/training/t3k): distanca, prefiks ID-ja i najbrže verodostojno vreme. */
export const T3K_DIST_M = 3000;
export const T3K_ID_PREFIX = 't3k-';
export const T3K_SEC_MIN = 440;
