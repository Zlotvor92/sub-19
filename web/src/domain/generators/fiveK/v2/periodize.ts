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

/** Kratka priprema (2.3.0): 6–7 nedelja, fiksna raspodela iz policy.ts, bez rasterećenja. */
export const isShortPrep = (totalWeeks: number): boolean => totalWeeks in P.phases.short;

/** Raspodela nedelja po fazama. Izgradnja = ukupno − taper − trka; vrhunac ≤ peakMaxWeeks, višak u bazu.
    2.3.0: 6–7 nedelja iz tabele P.phases.short. */
export function phaseCounts(totalWeeks: number): PhaseCounts {
  const short = P.phases.short[totalWeeks];
  if (short) return { ...short };
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
  // Rasterećenje (jedino mesto): svaka N-ta nedelja izgradnje. 2.2.0: ako bi to bila prva nedelja
  // vrhunca ili oštrenja, pomera se na poslednju nedelju prethodne faze; izostavlja se ako bi bila
  // poslednja nedelja izgradnje (uzastopno sa taperom, koji ionako smanjuje obim).
  // 2.3.0: kratka priprema nema rasterećenja.
  const deloads = new Set<number>();
  const every = isShortPrep(totalWeeks) ? Infinity : P.volume.deloadEvery;
  for (let n = every; n <= lastBuild; n += every) {
    const phaseStart = sequence[n - 1] !== sequence[n - 2];
    const at = phaseStart && sequence[n - 1] !== 'base' ? n - 1 : n;
    if (at !== lastBuild) deloads.add(at);
  }
  let taperSeen = 0;
  return sequence.map((phase, i) => {
    const index = i + 1;
    const taperStep = phase === 'taper' ? (++taperSeen as 1 | 2) : null;
    return {
      index,
      startDate: addDays(startDate, i * 7),
      endDate: addDays(startDate, i * 7 + 6),
      phase,
      deload: deloads.has(index),
      taperStep
    };
  });
}
