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

/** 2.4.0: nedelja kontrolnog trčanja (plan po osećaju): prva od feel.test.weeks koja je ne-rasteretna
    nedelja izgradnje; inače null. */
export function testWeekOf(frames: readonly Omit<WeekFrame, 'test'>[]): number | null {
  for (const n of P.feel.test.weeks) {
    const f = frames[n - 1];
    if (f && !f.deload && (f.phase === 'base' || f.phase === 'peak' || f.phase === 'sharpen'))
      return n;
  }
  return null;
}

/**
 * Rasterećenje (jedino mesto): svaka N-ta nedelja izgradnje (redni broj u nizu `sequence`, od 1). 2.2.0: ako
 * bi to bila prva nedelja vrhunca ili oštrenja, pomera se na poslednju nedelju prethodne faze; izostavlja
 * se ako bi bila poslednja nedelja izgradnje (uzastopno sa taperom, koji ionako smanjuje obim), ili
 * ako bi pomereno palo na prvu nedelju vrhunca/oštrenja (2.5.0, faza od jedne nedelje).
 * 2.3.0: kratka priprema nema rasterećenja (every = Infinity).
 */
function deloadWeeks(sequence: readonly Phase[], lastBuild: number, every: number): Set<number> {
  const deloads = new Set<number>();
  for (let n = every; n <= lastBuild; n += every) {
    const phaseStart = sequence[n - 1] !== sequence[n - 2];
    const at = phaseStart && sequence[n - 1] !== 'base' ? n - 1 : n;
    // 2.5.0: pomeranje ne sme pasti na početak druge faze (faza od 1 nedelje, rePeriodize).
    const startsPhase =
      at !== n && sequence[at - 1] !== sequence[at - 2] && sequence[at - 1] !== 'base';
    if (at !== lastBuild && !startsPhase) deloads.add(at);
  }
  return deloads;
}

/** `deloadEvery`: 2.4.0 početnik 3 (rulesOf); `feel`: plan po osećaju dobija nedelju kontrolnog trčanja. */
export function periodize(
  startDate: IsoDate,
  totalWeeks: number,
  deloadEvery: number = P.volume.deloadEvery,
  feel = false
): WeekFrame[] {
  const c = phaseCounts(totalWeeks);
  const sequence: Phase[] = [
    ...Array<Phase>(c.base).fill('base'),
    ...Array<Phase>(c.peak).fill('peak'),
    ...Array<Phase>(c.sharpen).fill('sharpen'),
    ...Array<Phase>(c.taper).fill('taper'),
    ...Array<Phase>(c.race).fill('race')
  ];
  const lastBuild = c.base + c.peak + c.sharpen;
  const deloads = deloadWeeks(
    sequence,
    lastBuild,
    isShortPrep(totalWeeks) ? Infinity : deloadEvery
  );
  let taperSeen = 0;
  const frames = sequence.map((phase, i) => {
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
  const test = feel ? testWeekOf(frames) : null;
  return frames.map((f) => ({ ...f, test: f.index === test }));
}

/**
 * 2.5.0 (Odluka 3, nov start): faze i rasterećenja preostale izgradnje od nedelje `from` do tapera, istim
 * pravilima kao periodize (raspodela izgradnje iz phaseCounts: oštrenje 2 od 7 nedelja izgradnje, vrhunac
 * ≤ peakMaxWeeks, višak u bazu; rasterećenje deloadWeeks od nedelje `from`). Taper, trkačka nedelja, datumi
 * i nedelje pre `from` se ne menjaju. Oznaka testa ostaje (steps.ts je premešta ako treba).
 */
export function rePeriodize(
  frames: readonly WeekFrame[],
  from: number,
  deloadEvery: number = P.volume.deloadEvery
): WeekFrame[] {
  const tail = frames.findIndex((f) => f.phase === 'taper' || f.phase === 'race');
  const m = tail - (from - 1);
  if (m <= 0) return [...frames];
  const sharpen =
    m >= P.phases.sharpenLongFromBuildWeeks
      ? P.phases.sharpenWeeksLong
      : P.phases.sharpenWeeksShort;
  const peak = Math.min(Math.floor((m - sharpen) / 2), P.phases.peakMaxWeeks);
  const sequence: Phase[] = [
    ...Array<Phase>(m - sharpen - peak).fill('base'),
    ...Array<Phase>(peak).fill('peak'),
    ...Array<Phase>(sharpen).fill('sharpen')
  ];
  const deloads = deloadWeeks(sequence, m, isShortPrep(frames.length) ? Infinity : deloadEvery);
  return frames.map((f, i) => {
    const k = i - (from - 1);
    return k < 0 || i >= tail ? f : { ...f, phase: sequence[k]!, deload: deloads.has(k + 1) };
  });
}
