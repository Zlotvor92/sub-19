/* ============================================================
   TRENERSKA HEURISTIKA — kalibrisano, ne izmereno.

   Svaka vrednost ovde je inženjerski/trenerski izbor (kod starog generatora to
   i sam kaže u komentarima). Menja se samo uz test koji pomera otisak i uz
   zapis u docs/ENGINE_CHANGES.md. Pregled sa ocenama: docs/TRAINING_ENGINE_AUDIT.md §5.2.
   ============================================================ */

import type { Intensity, Zone } from '../types';

/** Udeo VO2max po zoni (E, LR, I, T, R). Zona M se NE računa iz procenta —
 *  ona je po definiciji tempo maratona za dati VDOT (v. `paceForZone`). `M`
 *  ostaje ovde samo zbog potpunosti tabele. */
export const ZONE_FRACTION: Readonly<Record<Zone, number>> = {
  I: 1.0,
  T: 0.88,
  M: 0.8,
  E: 0.7,
  LR: 0.68,
  R: 1.05
};

/** Rast VDOT-a po nedelji (poena). `agr` je kalibrisan na putanju jednog autora plana. */
export const VDOT_RAMP_PER_WEEK: Readonly<Record<Intensity, number>> = {
  kons: 0.15,
  std: 0.25,
  agr: 0.43
};

/** Najviše ovoliko nedelja neprekidnog linearnog rasta forme; dalje plato. */
export const RAMP_CAP_WEEKS = 20;

/** Dozvoljeni rast obima pri povratku posle pauze (`reentryPlan`). */
export const GROW_MAX = 1.08;

export const DELOAD_EVERY = 4;
export const DEFAULT_DELOAD_FACTOR = 0.73;
export const DEFAULT_TAPER_FACTOR = 0.65;
export const DEFAULT_RACE_WEEK_FACTOR = 0.3;

/** Najveće prihvatljivo odstupanje isporučenog rasta: korak × ovaj faktor. */
export const DELIVERED_GROWTH_FACTOR = 1.6;

/* ---------------------------------------------------------------------------------------------
   ADAPTACIJA FORME (lanac VDOT-a) — kako se veruje jednom merenju.
   Inženjerski izbor (NE izmerena konstanta); redosled prati koliko svaki oblik napora govori o VO2max.
   --------------------------------------------------------------------------------------------- */

/**
 * Težina jednog merenja (α) po tipu sesije; novi VDOT = prethodni + α·(izmereno − prethodni).
 *   test 0,60  maksimalna trka na 3 km (~11–13 min) — u prozoru gde je formula najtačnija;
 *   tempo 0,28 kontinuiran prag — submaksimalan, nosi pretpostavku o odnosu praga i VO2max;
 *   int 0,12   blizu VO2max, ali prepoznavanje radnih deonica ume da uvuče i kaskanje;
 *   rep 0,04   200–400 m sa punim odmorom — pretežno anaerobno, predikcija preko 12–25× duže distance;
 *   default 0,15 sve što nije prepoznato.
 */
export const VDOT_ALPHA = { test: 0.6, tempo: 0.28, int: 0.12, rep: 0.04, default: 0.15 } as const;
export type VdotSessionClass = keyof typeof VDOT_ALPHA;

/** Koliko sme da odstupi AUTOMATSKI izmeren tempo od trenutne forme (VDOT poeni) da bi mu se verovalo.
 *  Ručno unet tempo se uvek prihvata (osim van opsega tablice). */
export const AUTO_VDOT_TOLERANCE = 4;

/** Predlog novih tempa: forma i plan se moraju razilaziti bar ovoliko VDOT poena… */
export const VDOT_PROPOSAL_THRESHOLD = 1.5;
/** …iz bar ovoliko izmerenih sesija (jedna sesija je šum)… */
export const VDOT_PROPOSAL_MIN_MEASUREMENTS = 3;
/** …a dan se dira samo ako se tempo menja bar ovoliko sekundi po kilometru. */
export const VDOT_PROPOSAL_MIN_SEC_PER_KM = 3;
