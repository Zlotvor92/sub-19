/* Nedelje → faze. Faza i rasterećenje su podatak svake nedelje (ne računaju se naknadno). */

import { addDays } from './dates.ts';
import { FIVE_K_V2_POLICY as P } from './policy.ts';
import type { IsoDate, Phase, WeekFrame } from './types.ts';

export interface PhaseCounts {
  base: number;
  peak: number;
  sharpen: number;
  taper: number;
  race: number;
}

/** Raspodela nedelja po fazama. Izgradnja = ukupno − taper − trka; vrhunac ≤ peakMaxWeeks, višak u bazu. */
export function phaseCounts(totalWeeks: number): PhaseCounts {
  const taper = P.phases.taperWeeks;
  const race = P.phases.raceWeeks;
  const build = totalWeeks - taper - race;
  const sharpen =
    build >= P.phases.sharpenLongFromBuildWeeks
      ? P.phases.sharpenWeeksLong
      : P.phases.sharpenWeeksShort;
  const rest = build - sharpen;
  const peak = Math.min(Math.floor(rest / 2), P.phases.peakMaxWeeks);
  const base = rest - peak;
  return { base, peak, sharpen, taper, race };
}

export function periodize(startDate: IsoDate, totalWeeks: number): WeekFrame[] {
  const c = phaseCounts(totalWeeks);
  const sequence: Phase[] = [
    ...Array<Phase>(c.base).fill('base'),
    ...Array<Phase>(c.peak).fill('peak'),
    ...Array<Phase>(c.sharpen).fill('sharpen'),
    ...Array<Phase>(c.taper).fill('taper'),
    ...Array<Phase>(c.race).fill('race')
  ];
  const lastBuild = c.base + c.peak + c.sharpen;
  let taperSeen = 0;
  return sequence.map((phase, i) => {
    const index = i + 1;
    const isBuild = index <= lastBuild;
    // Rasterećenje: svaka N-ta nedelja izgradnje, osim poslednje (posle nje taper ionako smanjuje obim).
    const deload = isBuild && index % P.volume.deloadEvery === 0 && index !== lastBuild;
    const taperStep = phase === 'taper' ? (++taperSeen as 1 | 2) : null;
    return {
      index,
      startDate: addDays(startDate, i * 7),
      endDate: addDays(startDate, i * 7 + 6),
      phase,
      deload,
      taperStep
    };
  });
}
