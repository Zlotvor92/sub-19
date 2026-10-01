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
