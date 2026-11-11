/* H4 — faze; H5 — GDE su rasteretne nedelje (sadržaj: week.ts); H16 — GDE je test 5 km. Jedino mesto ovih
   odluka. */

import { addDays } from './dates.ts';
import { HM_V2_POLICY as P, type PlanRule } from './policy.ts';
import type { IsoDate, Phase, PlanLayoutFact, WeekFrame } from './types.ts';

export interface PhaseCounts {
  base: number;
  development: number;
  specific: number;
  taper: number;
  race: number;
}

/** H4: N nedelja → broj nedelja po fazi. B = N − taper − trka; specifično 3 (B ≤ 9) / 4 (B 10–13) / 5
    (B ≥ 14); baza = ceil((B − spec)/2); razvoj = ostatak. */
export function phaseCounts(weeks: number): PhaseCounts {
  const q = P.phases;
  return {
    ...buildCounts(weeks - q.taperWeeks - q.raceWeeks),
    taper: q.taperWeeks,
    race: q.raceWeeks
  };
}

/** H4: raspodela `build` nedelja izgradnje na bazu, razvoj i specifičnu fazu (i za nov start, A12: m ≤ 3
    nedelje — sve specifično). */
function buildCounts(build: number): Omit<PhaseCounts, 'taper' | 'race'> {
  const q = P.phases;
  const specific = Math.min(build, q.specific.find((r) => build <= r.maxBuild)!.weeks);
  const base = Math.ceil((build - specific) / 2);
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

/** H5 (pouka 4): rasterećenje je dozvoljeno samo u izgradnji, od nedelje 3, ne na prvoj nedelji faze, ne na
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

/** H5: posle `run` uzastopnih nedelja izgradnje, može li nedelja `week` biti još jedna izgradnja?
    Najviše 3; izuzetno 4 kad bi rasterećenje palo na prvu nedelju faze. */
export function buildAllowed(phases: readonly Phase[], week: number, run: number): boolean {
  const q = P.deload;
  return run + 1 <= q.maxBuildRun || (run + 1 === q.exceptionRun && firstOfPhase(phases, week));
}

/** H5: rasteretne nedelje. Deterministička pretraga: najmanje rasterećenja; pri istom broju izgradnja
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

/** H16/P5-F1: vrsta testa plana — 'feel' plan po osećaju koji nije početnik (H16); 'result' plan sa rezultatom koji
    nije početnik i ima ≥ test.resultMinWeeks nedelja (P5-F1); null bez testa. JEDNA odluka za konstruktor, validator,
    adaptaciju i invarijante. */
export type TestKind = 'feel' | 'result' | null;
export function testKindOf(
  paceKind: 'feel' | 'result',
  rule: { feelTest: boolean; beginner: boolean },
  weeks: number
): TestKind {
  if (rule.beginner) return null;
  if (paceKind === 'feel') return rule.feelTest ? 'feel' : null;
  return weeks >= P.test.resultMinWeeks ? 'result' : null;
}

/** H16: nedelja testa po osećaju = poslednja nedelja baze; P5-F1: test plana sa rezultatom = poslednja ne-rasteretna
    nedelja razvoja (1-indeks; 0 = nema takve nedelje). */
export function testWeekOf(
  frames: readonly { phase: Phase; deload: boolean }[],
  kind: Exclude<TestKind, null>
): number {
  // G7 (P8): test ne ide pre nedelje 4 — nedelja testa je poslednja svoje faze po pravilu, pa kasnije nedelje iste
  // faze nema: plan u kome bi test pao ranije nema test.
  const min = P.test.minWeek;
  const dev = frames
    .map((f, i) => (f.phase === 'development' && !f.deload ? i + 1 : 0))
    .filter((w) => w >= min);
  if (kind === 'feel') {
    // STOP S5 → O2: baza kraća od 4 nedelje (plan od 10–12 nedelja) — test u prvoj ne-rasteretnoj nedelji razvoja
    // (≥ 4), umesto I treninga te nedelje.
    const lastBase = frames.map((f) => f.phase).lastIndexOf('base') + 1;
    return lastBase >= min ? lastBase : (dev[0] ?? 0);
  }
  // STOP S4 → O2: kontrolni test u PRETPOSLEDNJOJ ne-rasteretnoj nedelji razvoja (poslednja nosi vrh obima po G1);
  // kad je pretposlednja pre nedelje 4 ili je nema — poslednja (≥ 4), inače bez testa.
  return dev.length >= 2 ? dev[dev.length - 2]! : (dev[0] ?? 0);
}

/** W1: raspored faza i rasterećenja plana — JEDNO mesto odluke (konstruktor, validator, adaptacija). `offset` = broj
    odsečenih nedelja virtuelnog plana od `fullWeeks` (kratak plan; `full` njegove faze), `prepWeeks` = nedelje osnovne
    pripreme (dug plan). */
export interface PlanLayout {
  phases: Phase[];
  deloads: number[];
  fact: PlanLayoutFact | null;
  full: Phase[];
  offset: number;
  prepWeeks: number;
}

/** W1: najkraći dozvoljeni plan istog tipa trkača (početnik: beginner.weeksMin). */
export const minWeeksOf = (beginner: boolean): number =>
  beginner ? P.beginner.weeksMin : P.input.weeksMin;

/** W1-A: uvod početnika kratkog plana — nedelje uvoda virtuelnog plana od MIN nedelja koje postoje (uvod otpada
    prvi): introWeeks − (MIN − N), najmanje 0. U planu ≥ MIN pravilo je isto kao pre. */
export function withIntro(rule: PlanRule, weeks: number): PlanRule {
  const off = Math.max(0, minWeeksOf(rule.beginner) - weeks);
  return off === 0 ? rule : { ...rule, introWeeks: Math.max(0, rule.introWeeks - off) };
}

/** W1-A: N < MIN — poslednjih N nedelja rasporeda od MIN nedelja (faze i rasterećenja po položaju). W1-B: N > MAX —
    (N − MAX) nedelja osnovne pripreme + standardni plan od MAX nedelja. Inače H4/H5 kao pre. `fact` (adaptacija) =
    činjenica upisanog plana; bez nje se određuje iz dužine. null kad H5 nema rešenja. */
export function layoutOf(
  weeks: number,
  beginner: boolean,
  fact?: PlanLayoutFact | null
): PlanLayout | null {
  const f: PlanLayoutFact | null =
    fact !== undefined
      ? fact
      : weeks < minWeeksOf(beginner)
        ? { kind: 'short', fullWeeks: minWeeksOf(beginner) }
        : null;
  if (f?.kind === 'short') {
    const full = phasesOf(f.fullWeeks);
    const d = deloadWeeks(full);
    if (!d) return null;
    // Rasterećenja po položaju u zadržanom rasporedu; H5 „od nedelje 3" važi za plan koji postoji (rasterećenje traži
    // prethodnu nedelju izgradnje).
    const offset = f.fullWeeks - weeks;
    return {
      phases: full.slice(offset),
      deloads: d.map((x) => x - offset).filter((x) => x >= P.deload.firstAllowedWeek),
      fact: f,
      full,
      offset,
      prepWeeks: 0
    };
  }
  // W1-B: N > MAX — (N − MAX) nedelja osnovne pripreme (faza baze, svaka četvrta rasterećenje) + standardni plan od
  // MAX nedelja (njegov raspored H4/H5, pomeren za K).
  const g: PlanLayoutFact | null =
    fact !== undefined
      ? fact
      : weeks > P.input.weeksMax
        ? { kind: 'long', prepWeeks: weeks - P.input.weeksMax }
        : null;
  if (g?.kind === 'long') {
    const K = g.prepWeeks;
    const std = phasesOf(weeks - K);
    const d = deloadWeeks(std);
    if (!d) return null;
    const every = P.prep.deloadEvery;
    const prepDeloads = Array.from({ length: Math.floor(K / every) }, (_, i) => every * (i + 1));
    return {
      phases: [...Array<Phase>(K).fill('base'), ...std],
      deloads: [...prepDeloads, ...d.map((x) => x + K)],
      fact: g,
      full: std,
      offset: 0,
      prepWeeks: K
    };
  }
  const phases = phasesOf(weeks);
  const deloads = deloadWeeks(phases);
  if (!deloads) return null;
  return { phases, deloads, fact: null, full: phases, offset: 0, prepWeeks: 0 };
}

/** Okviri nedelja: datumi, faza, rasterećenje; `test` (vrsta testa, testKindOf) označava nedelju testa. null kad H5
    nema rešenja. W1: raspored iz layoutOf (početnik: najkraći plan početnika; `fact` iz upisanog plana). */
export function periodize(
  startDate: IsoDate,
  weeks: number,
  test: TestKind = null,
  beginner = false,
  fact?: PlanLayoutFact | null
): WeekFrame[] | null {
  const lay = layoutOf(weeks, beginner, fact);
  if (!lay) return null;
  const { phases, deloads, prepWeeks } = lay;
  const flags = phases.map((phase, i) => ({ phase, deload: deloads.includes(i + 1) }));
  const tw = test ? testWeekOf(flags, test) : 0;
  return phases.map((phase, i) => ({
    index: i + 1,
    startDate: addDays(startDate, 7 * i),
    endDate: addDays(startDate, 7 * i + 6),
    phase,
    deload: deloads.includes(i + 1),
    ...(i + 1 === tw ? { test: true as const } : {}),
    ...(i < prepWeeks ? { prep: true as const } : {})
  }));
}

/**
 * A3/A12 (nov start, H18): faze i rasterećenja preostale izgradnje od nedelje `from` do tapera istim pravilima
 * kao periodize — raspodela H4 za m = broj preostalih nedelja izgradnje, rasterećenja iz iste pretrage H5
 * relativno od `from` (ne u prve 2 nedelje novog starta, ne na prvoj nedelji faze, ne pred taperom). Taper,
 * trkačka nedelja, datumi, oznaka testa i nedelje pre `from` se ne menjaju. null = H5 nema raspored za
 * preostalu izgradnju (odstupanje A3: faze ostaju).
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
    if (k < 0 || i >= tail) return f;
    // W1-B: nov start ukida osnovnu pripremu preostalih nedelja (nova raspodela H4).
    const { prep: _prep, ...rest } = f;
    return { ...rest, phase: seq[k]!, deload: deloads.includes(k + 1) };
  });
}
