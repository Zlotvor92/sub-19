/* D4 — faze; D5 — GDE su rasteretne nedelje (sadržaj: week.ts); D27 — GDE je test 5 km. Jedino mesto
   ovih odluka. */

import { addDays } from './dates.ts';
import { TEN_K_V2_POLICY as P } from './policy.ts';
import type { IsoDate, Phase, WeekFrame } from './types.ts';

export interface PhaseCounts {
  base: number;
  development: number;
  specific: number;
  taper: number;
  race: number;
}

/** D4: N nedelja → broj nedelja po fazi. B = N − taper − trka. D21 (B ≤ 7): specifično 2, razvoj =
    ceil((B − 2)/2), baza ostatak. */
export function phaseCounts(weeks: number): PhaseCounts {
  const q = P.phases;
  return {
    ...buildCounts(weeks - q.taperWeeks - q.raceWeeks),
    taper: q.taperWeeks,
    race: q.raceWeeks
  };
}

/** D4/D21: raspodela `build` nedelja izgradnje na bazu, razvoj i specifičnu fazu (i za nov start, A12). */
function buildCounts(build: number): Omit<PhaseCounts, 'taper' | 'race'> {
  const q = P.phases;
  const short = build <= q.shortPrepMaxBuild;
  // Nov start sa ≤ 2 nedelje izgradnje (A12): sve specifično.
  const specific = Math.min(
    build,
    short
      ? q.shortPrepSpecific
      : build <= q.specificShortMaxBuild
        ? q.specificShort
        : q.specificLong
  );
  const rest = build - specific;
  // D4: veća polovina ostatka je baza; D21 (kratka priprema): veća polovina je razvoj.
  const base = short ? rest - Math.ceil(rest / 2) : Math.ceil(rest / 2);
  return { base, development: build - specific - base, specific };
}

const buildSequence = (c: Omit<PhaseCounts, 'taper' | 'race'>): Phase[] => [
  ...Array<Phase>(c.base).fill('base'),
  ...Array<Phase>(c.development).fill('development'),
  ...Array<Phase>(c.specific).fill('specific')
];

/** Faza svake nedelje (1-indeks u nizu na mestu i − 1). */
export function phasesOf(weeks: number): Phase[] {
  const c = phaseCounts(weeks);
  return [
    ...buildSequence(c),
    ...Array<Phase>(c.taper).fill('taper'),
    ...Array<Phase>(c.race).fill('race')
  ];
}

export const isBuildPhase = (p: Phase): boolean =>
  p === 'base' || p === 'development' || p === 'specific';

/** Prva nedelja faze (1-indeks). */
export function firstOfPhase(phases: readonly Phase[], week: number): boolean {
  return week === 1 || phases[week - 2] !== phases[week - 1];
}

/** D5: rasterećenje je dozvoljeno samo u izgradnji, od nedelje 3, ne na prvoj nedelji faze, ne na
    poslednjoj nedelji pre tapera. */
export function deloadAllowed(phases: readonly Phase[], week: number): boolean {
  const build = phases.filter(isBuildPhase).length;
  return (
    isBuildPhase(phases[week - 1]!) &&
    week >= P.deload.firstAllowedWeek &&
    week !== build &&
    !firstOfPhase(phases, week)
  );
}

/** D5: posle `run` uzastopnih nedelja izgradnje, može li nedelja `week` biti još jedna izgradnja?
    Najviše 3; izuzetno 4 kad bi rasterećenje palo na prvu nedelju faze. */
export function buildAllowed(phases: readonly Phase[], week: number, run: number): boolean {
  const q = P.deload;
  return run + 1 <= q.maxBuildRun || (run + 1 === q.exceptionRun && firstOfPhase(phases, week));
}

/** D5: rasteretne nedelje. Deterministička pretraga: najmanje rasterećenja; pri istom broju izgradnja
    što ranije. null = nema rasporeda koji poštuje pravila. */
export function deloadWeeks(phases: readonly Phase[]): number[] | null {
  const build = phases.filter(isBuildPhase).length;
  const memo = new Map<string, number>();
  // Najmanji broj rasterećenja za nedelje week..build, uz `run` uzastopnih izgradnji pre `week`.
  const cost = (week: number, run: number): number => {
    if (week > build) return 0;
    const key = `${week}:${run}`;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    let best = Infinity;
    if (buildAllowed(phases, week, run)) best = cost(week + 1, run + 1);
    if (deloadAllowed(phases, week)) best = Math.min(best, 1 + cost(week + 1, 0));
    memo.set(key, best);
    return best;
  };
  if (!Number.isFinite(cost(1, 0))) return null;
  const out: number[] = [];
  let run = 0;
  for (let w = 1; w <= build; w++) {
    const b = buildAllowed(phases, w, run) ? cost(w + 1, run + 1) : Infinity;
    const d = deloadAllowed(phases, w) ? 1 + cost(w + 1, 0) : Infinity;
    if (b <= d) run++;
    else {
      out.push(w);
      run = 0;
    }
  }
  return out;
}

/** D27: nedelja testa 5 km = poslednja nedelja baze (1-indeks). */
export function testWeekOf(phases: readonly Phase[]): number {
  return phases.lastIndexOf('base') + 1;
}

/**
 * A3/A12 (nov start): faze i rasterećenja preostale izgradnje od nedelje `from` do tapera istim pravilima
 * kao periodize — raspodela D4/D21 za m = broj preostalih nedelja izgradnje, rasterećenja iz iste pretrage
 * D5 relativno od `from` (ne u prve 2 nedelje novog starta, ne na prvoj nedelji faze, ne pred taperom).
 * Taper, trkačka nedelja, datumi, oznaka testa i nedelje pre `from` se ne menjaju. null = D5 nema
 * raspored za preostalu izgradnju (odstupanje A3: faze ostaju).
 */
export function rePeriodize(frames: readonly WeekFrame[], from: number): WeekFrame[] | null {
  const tail = frames.findIndex((f) => !isBuildPhase(f.phase));
  const m = tail - (from - 1);
  if (m <= 0) return [...frames];
  const seq = buildSequence(buildCounts(m));
  const deloads = deloadWeeks(seq);
  if (!deloads) return null;
  return frames.map((f, i) => {
    const k = i - (from - 1);
    return k < 0 || i >= tail ? f : { ...f, phase: seq[k]!, deload: deloads.includes(k + 1) };
  });
}

/** Okviri nedelja: datumi, faza, rasterećenje; `test` (plan po osećaju, D27) označava nedelju testa.
    null kad D5 nema rešenja. */
export function periodize(startDate: IsoDate, weeks: number, test = false): WeekFrame[] | null {
  const phases = phasesOf(weeks);
  const deloads = deloadWeeks(phases);
  if (!deloads) return null;
  const tw = test ? testWeekOf(phases) : 0;
  return phases.map((phase, i) => ({
    index: i + 1,
    startDate: addDays(startDate, 7 * i),
    endDate: addDays(startDate, 7 * i + 6),
    phase,
    deload: deloads.includes(i + 1),
    ...(i + 1 === tw ? { test: true as const } : {})
  }));
}
