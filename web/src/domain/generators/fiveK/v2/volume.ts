/* JEDINO mesto koje određuje ciljni km nedelje. */

import { FIVE_K_V2_POLICY as P } from './policy.ts';
import type { WeekFrame } from './types.ts';

const floor1 = (x: number): number => Math.floor(x * 10 + 1e-9) / 10;
const round1 = (x: number): number => Math.round(x * 10) / 10;

export interface VolumePlan {
  startKm: number;
  peakKm: number;
  targets: number[];
}

/**
 * Start = trenutni obim. Izgradnja: +maxBuildGrowth od poslednje ne-rasteretne nedelje izgradnje,
 * do min(peakCapFactor × start, fourDayMaxWeekKm). Oštrenje drži obim. Rasterećenje ≈ deloadFactor × prethodna nedelja.
 * Taper i trkačka nedelja su udeli vrha (vrh = najveći cilj izgradnje).
 */
export function planVolume(frames: readonly WeekFrame[], startKm: number): VolumePlan {
  const cap = Math.min(floor1(startKm * P.volume.peakCapFactor), P.volume.fourDayMaxWeekKm);
  const targets: number[] = [];
  let lastBuild: number | null = null;
  for (const f of frames) {
    if (f.phase === 'taper' || f.phase === 'race') break;
    let t: number;
    if (f.deload) t = round1((targets[targets.length - 1] ?? startKm) * P.volume.deloadFactor);
    else if (lastBuild === null) t = round1(startKm);
    else if (f.phase === 'sharpen') t = lastBuild;
    else t = Math.min(floor1(lastBuild * (1 + P.volume.maxBuildGrowth)), cap);
    if (!f.deload) lastBuild = t;
    targets.push(t);
  }
  const peakKm = Math.max(...targets);
  for (const f of frames) {
    if (f.phase === 'taper')
      targets.push(round1(peakKm * P.volume.taperFactors[(f.taperStep ?? 1) - 1]!));
    else if (f.phase === 'race') targets.push(round1(peakKm * P.volume.raceWeekFactor));
  }
  return { startKm: round1(startKm), peakKm, targets };
}
