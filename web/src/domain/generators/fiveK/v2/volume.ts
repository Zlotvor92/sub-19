/* JEDINO mesto koje određuje ciljni km nedelje. */

import { FIVE_K_V2_POLICY as P } from './policy.ts';
import type { Paces, WeekFrame } from './types.ts';
import { warmupBand } from './workouts.ts';

const floor1 = (x: number): number => Math.floor(x * 10 + 1e-9) / 10;
const floorHalf = (x: number): number => Math.floor(x * 2 + 1e-9) / 2;
const round1 = (x: number): number => Math.round(x * 10) / 10;

export interface VolumePlan {
  startKm: number;
  peakKm: number;
  /** 2.2.0: najveći nedeljni cilj koji 4 dana nose (v. fourDayCapacityKm). */
  capacityKm: number;
  /** Trenutni obim je bio veći od kapaciteta, pa plan kreće od kapaciteta. */
  startCapped: boolean;
  targets: number[];
}

/**
 * Vrh obima (jedna funkcija, dva člana):
 * - peakCapFactor × start: rast obima u jednom ciklusu od 8–16 nedelja ograničen na +30% (heuristika
 *   konzervativnog rasta, da se uz +8% nedeljno ne stigne do obima za koji telo nije pripremljeno);
 * - fourDayMaxWeekKm: 4 dana trčanja; preko ~50 km dugi i lagan dan rastu preko smislene dužine
 *   (heuristika iz 2.0.1). Kapacitet 4 dana iz tempa (fourDayCapacityKm) ograničava SVAKI cilj posebno.
 */
export function peakKm(startKm: number): number {
  return Math.min(floor1(startKm * P.volume.peakCapFactor), P.volume.fourDayMaxWeekKm);
}

/** Dugi trk [km] za ciljni km nedelje: min(35% cilja, 90 min sporijom granicom E), na 0,5 km. */
export function longCapKm(targetKm: number, p: Paces): number {
  return Math.min(floorHalf(targetKm * P.long.maxShare), floorHalf(P.long.maxSec / p.E.slow));
}

/**
 * 2.2.0 kapacitet 4 dana [km]: najveći cilj T (korak 0,1 km) za koji q1 + q2 + dugi + lagan (≤ dugi)
 * ≥ T. Kvalitetni dani su procenjeni donjom granicom 2 × (zagrevanje + hlađenje za T) +
 * capacityQualityMinShare × T; dugi = longCapKm(T). Pretraga nejednačine od njene gornje granice
 * (najveće zagrevanje/hlađenje, dugi = 90 min) naniže — deterministično, ne skraćivanje plana.
 * Nezavisno od fourDayMaxWeekKm (taj član je u peakKm()).
 */
export function fourDayCapacityKm(p: Paces): number {
  const c = P.volume.capacityQualityMinShare;
  const wcMax = Math.max(...P.warmup.bands.map((b) => b.warmupKm + b.cooldownKm));
  const upper = (2 * wcMax + 2 * floorHalf(P.long.maxSec / p.E.slow)) / (1 - c);
  for (let k = Math.floor(upper * 10); k > 0; k--) {
    const t = k / 10;
    const band = warmupBand(t);
    if (2 * (band.warmupKm + band.cooldownKm) + c * t + 2 * longCapKm(t, p) + 1e-9 >= t) return t;
  }
  return 0;
}

/**
 * Start = min(trenutni obim, kapacitet). Izgradnja: +maxBuildGrowth od poslednje ne-rasteretne nedelje
 * izgradnje, do min(peakKm(start), kapacitet). Oštrenje drži obim. Rasterećenje ≈ deloadFactor ×
 * prethodna nedelja. Taper i trkačka nedelja su udeli vrha (vrh = najveći cilj izgradnje).
 */
export function planVolume(frames: readonly WeekFrame[], currentKm: number, p: Paces): VolumePlan {
  const capacityKm = fourDayCapacityKm(p);
  const startKm = Math.min(round1(currentKm), capacityKm);
  const cap = Math.min(peakKm(startKm), capacityKm);
  const targets: number[] = [];
  let lastBuild: number | null = null;
  for (const f of frames) {
    if (f.phase === 'taper' || f.phase === 'race') break;
    let t: number;
    if (f.deload) t = round1((targets[targets.length - 1] ?? startKm) * P.volume.deloadFactor);
    else if (lastBuild === null) t = startKm;
    else if (f.phase === 'sharpen') t = lastBuild;
    else t = Math.min(floor1(lastBuild * (1 + P.volume.maxBuildGrowth)), cap);
    if (!f.deload) lastBuild = t;
    targets.push(t);
  }
  const peak = Math.max(...targets);
  for (const f of frames) {
    if (f.phase === 'taper')
      targets.push(round1(peak * P.volume.taperFactors[(f.taperStep ?? 1) - 1]!));
    else if (f.phase === 'race') targets.push(round1(peak * P.volume.raceWeekFactor));
  }
  return {
    startKm,
    peakKm: peak,
    capacityKm,
    startCapped: round1(currentKm) > capacityKm,
    targets
  };
}
