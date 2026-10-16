/* JEDINO mesto koje određuje ciljni km nedelje (trkačka nedelja: gornja granica, v. generate.ts). */

import { daysRule, FIVE_K_V2_POLICY as P, type RunDaysCount } from './policy.ts';
import type { Paces, WeekFrame } from './types.ts';
import { warmupBand } from './workouts.ts';

const floor1 = (x: number): number => Math.floor(x * 10 + 1e-9) / 10;
const floorHalf = (x: number): number => Math.floor(x * 2 + 1e-9) / 2;
const round1 = (x: number): number => Math.round(x * 10) / 10;

export interface VolumePlan {
  startKm: number;
  peakKm: number;
  /** 2.2.0: najveći nedeljni cilj koji izabrani broj dana nosi (v. capacityKm). */
  capacityKm: number;
  /** Trenutni obim je bio veći od kapaciteta, pa plan kreće od kapaciteta. */
  startCapped: boolean;
  /** Ciljevi po nedelji; za trkačku nedelju GORNJA GRANICA (2.3.0: cilj = zbir planiranih dana). */
  targets: number[];
}

/**
 * Vrh obima (jedna funkcija, 2.3.0: tri člana):
 * - peakCapFactor × start: rast obima u jednom ciklusu ograničen na +30% (heuristika konzervativnog
 *   rasta, da se uz +8% nedeljno ne stigne do obima za koji telo nije pripremljeno);
 * - kapacitet izabranog broja dana iz tempa (capacityKm);
 * - apsolutni vrh po broju dana (days[n].maxWeekKm: 3 → 40, 4 → 50, 5 → 65; heuristika).
 */
export function peakKm(startKm: number, capacity: number, days: RunDaysCount): number {
  return Math.min(floor1(startKm * P.volume.peakCapFactor), capacity, daysRule(days).maxWeekKm);
}

/** Dugi trk [km] za ciljni km nedelje: min(udeo dana × cilj naniže na longStepKm, 90 min sporijom granicom E na 0,5 km). */
export function longCapKm(targetKm: number, p: Paces, days: RunDaysCount): number {
  const { longMaxShare, longStepKm } = daysRule(days);
  const share = Math.floor((targetKm * longMaxShare) / longStepKm + 1e-9) * longStepKm;
  return Math.min(Math.round(share * 10) / 10, floorHalf(P.long.maxSec / p.E.slow));
}

/**
 * Kapacitet [km] za n dana (2.2.0 za 4 dana; 2.3.0 ista formula parametrizovana tabelom `days`):
 * najveći cilj T (korak 0,1 km) za koji kvaliteti + dugi + lagani (svaki ≤ dugi) ≥ T. Kvalitetni dani
 * su procenjeni donjom granicom qualityDays × (zagrevanje + hlađenje za T) + capacityQualityMinShare
 * × T; dugi = longCapKm(T). Pretraga nejednačine od njene gornje granice (najveće zagrevanje/hlađenje,
 * dugi = 90 min) naniže — deterministično, ne skraćivanje plana. Apsolutni vrh je u peakKm().
 */
export function capacityKm(p: Paces, days: RunDaysCount): number {
  const { qualityDays, easyDays } = daysRule(days);
  const c = P.volume.capacityQualityMinShare;
  const wcMax = Math.max(...P.warmup.bands.map((b) => b.warmupKm + b.cooldownKm));
  const longMax = floorHalf(P.long.maxSec / p.E.slow);
  const upper = (qualityDays * wcMax + (1 + easyDays) * longMax) / (1 - c);
  for (let k = Math.floor(upper * 10); k > 0; k--) {
    const t = k / 10;
    const band = warmupBand(t);
    const carried =
      qualityDays * (band.warmupKm + band.cooldownKm) +
      c * t +
      (1 + easyDays) * longCapKm(t, p, days);
    if (carried + 1e-9 >= t) return t;
  }
  return 0;
}

/**
 * Start = min(trenutni obim, kapacitet). Izgradnja: +maxBuildGrowth od poslednje ne-rasteretne nedelje
 * izgradnje, do peakKm(start). Oštrenje drži obim. Rasterećenje ≈ deloadFactor × prethodna nedelja.
 * Taper je udeo vrha (vrh = najveći cilj izgradnje); trkačka nedelja: gornja granica = udeo vrha.
 */
export function planVolume(
  frames: readonly WeekFrame[],
  currentKm: number,
  p: Paces,
  days: RunDaysCount
): VolumePlan {
  const capacity = capacityKm(p, days);
  const startKm = Math.min(round1(currentKm), capacity);
  const cap = peakKm(startKm, capacity, days);
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
    capacityKm: capacity,
    startCapped: round1(currentKm) > capacity,
    targets
  };
}
