/* M4 — faze; M5 — GDE su rasteretne nedelje (sadržaj: week.ts); M16 — nedelja testa 5 km. Jedino mesto ovih
   odluka. */

import { addDays } from './dates.ts';
import { MARATHON_V2_POLICY as P } from './policy.ts';
import type { IsoDate, Phase, WeekFrame } from './types.ts';

export interface PhaseCounts {
  base: number;
  development: number;
  specific: number;
  taper: number;
  race: number;
}

/** M4: N nedelja → broj nedelja po fazi. B = N − taper − trka; specifično po tabeli (4 / 5 / 6); baza =
    ceil((B − spec)/2); razvoj ostatak. */
export function phaseCounts(weeks: number): PhaseCounts {
  const q = P.phases;
  const build = weeks - q.taperWeeks - q.raceWeeks;
  const specific = Math.min(build, q.specific.filter((r) => r.fromBuild <= build).pop()!.weeks);
  const base = Math.ceil((build - specific) / 2);
  return {
    base,
    development: build - specific - base,
    specific,
    taper: q.taperWeeks,
    race: q.raceWeeks
  };
}

/** Faza svake nedelje (1-indeks u nizu na mestu i − 1). */
export function phasesOf(weeks: number): Phase[] {
  const c = phaseCounts(weeks);
  return [
    ...Array<Phase>(c.base).fill('base'),
    ...Array<Phase>(c.development).fill('development'),
    ...Array<Phase>(c.specific).fill('specific'),
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

/** M7: redni broj nedelje tapera (0 = N−2, 1 = N−1); null van tapera. */
export function taperStep(phases: readonly Phase[], week: number): number | null {
  if (phases[week - 1] !== 'taper') return null;
  return week - 1 - phases.indexOf('taper');
}

/** M5: rasterećenje je dozvoljeno samo u izgradnji, od nedelje 3, ne na prvoj nedelji faze, ne na
    poslednjoj nedelji pre tapera (pouka 4). */
export function deloadAllowed(phases: readonly Phase[], week: number): boolean {
  const build = phases.filter(isBuildPhase).length;
  return (
    isBuildPhase(phases[week - 1]!) &&
    week >= P.deload.firstAllowedWeek &&
    week !== build &&
    !firstOfPhase(phases, week)
  );
}

/** M5: posle `run` uzastopnih nedelja izgradnje, može li nedelja `week` biti još jedna izgradnja?
    Najviše 3; izuzetno 4 kad bi rasterećenje palo na prvu nedelju faze. */
export function buildAllowed(phases: readonly Phase[], week: number, run: number): boolean {
  const q = P.deload;
  return run + 1 <= q.maxBuildRun || (run + 1 === q.exceptionRun && firstOfPhase(phases, week));
}

/** M5: rasteretne nedelje. Deterministička pretraga: najmanje rasterećenja; pri istom broju izgradnja
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

/** M16: nedelja testa 5 km = poslednja nedelja baze (1-indeks). */
export function testWeekOf(phases: readonly Phase[]): number {
  return phases.lastIndexOf('base') + 1;
}

/** Okviri nedelja: datumi, faza, rasterećenje; `test` (plan po osećaju koji nije početnik, M16) označava
    nedelju testa. null kad M5 nema rešenja. */
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
