/* M4 — faze; M5 — GDE su rasteretne nedelje (sadržaj: week.ts); M16 — nedelja testa 5 km. Jedino mesto ovih
   odluka. */

import { addDays, mustDay } from './dates.ts';
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
  return {
    ...buildCounts(weeks - q.taperWeeks - q.raceWeeks),
    taper: q.taperWeeks,
    race: q.raceWeeks
  };
}

/** M4: raspodela `build` nedelja izgradnje na bazu, razvoj i specifičnu fazu (i za nov start, A3/A12; ≤ 4
    nedelje izgradnje → sve specifično). */
function buildCounts(build: number): Omit<PhaseCounts, 'taper' | 'race'> {
  const q = P.phases;
  const specific = Math.min(build, q.specific.filter((r) => r.fromBuild <= build).pop()!.weeks);
  const base = Math.ceil((build - specific) / 2);
  return { base, development: build - specific - base, specific };
}

const buildSequence = (c: Omit<PhaseCounts, 'taper' | 'race'>): Phase[] => [
  ...Array<Phase>(c.base).fill('base'),
  ...Array<Phase>(c.development).fill('development'),
  ...Array<Phase>(c.specific).fill('specific')
];

/** Faze standardnog plana od `weeks` nedelja (M4). */
function standardPhases(weeks: number): Phase[] {
  const c = phaseCounts(weeks);
  return [
    ...buildSequence(c),
    ...Array<Phase>(c.taper).fill('taper'),
    ...Array<Phase>(c.race).fill('race')
  ];
}

/** W1-A: pomak rasporeda — nedelja `i` plana je nedelja `i − offset` standardnog rasporeda (kratak plan: raspored
    najkraćeg dozvoljenog plana `minWeeks` bez prvih minWeeks − N nedelja, offset < 0). JEDNO mesto za konstruktor,
    adaptaciju i validator (uvod početnika, ubrzanja). */
export function layoutOffset(weeks: number, minWeeks: number = P.input.weeksMin): number {
  return weeks < minWeeks ? weeks - minWeeks : prepWeeksOf(weeks);
}

/** W1-B: broj nedelja osnovne pripreme dugog plana (N > weeksMax): N − weeksMax; 0 inače. */
export function prepWeeksOf(weeks: number): number {
  return Math.max(0, weeks - P.input.weeksMax);
}

type IntroRule = { readonly introWeeks: number; readonly weeksMin: number };

/** M17 / W1-A: uvod početnika = nedelje 1..introWeeks standardnog rasporeda (kratak plan gubi uvod prvi). Vraća
    `{ first, count }` u nedeljama plana (count 0 = plan bez uvoda). */
export function introOf(weeks: number, rule: IntroRule): { first: number; count: number } {
  const off = layoutOffset(weeks, rule.weeksMin);
  const first = Math.max(1, off + 1);
  return { first, count: Math.max(0, off + rule.introWeeks - first + 1) };
}

/** M17 / W1-A: redni broj nedelje `index` u uvodu početnika (1..count); 0 = nedelja nije u uvodu. */
export function introPos(index: number, weeks: number, rule: IntroRule): number {
  const { first, count } = introOf(weeks, rule);
  return index >= first && index < first + count ? index - first + 1 : 0;
}

/** W1-A: kratak plan (N < najkraći dozvoljen plan tipa trkača). */
export const shortPlan = (weeks: number, rule: { readonly weeksMin: number }): boolean =>
  weeks < rule.weeksMin;

/** Broj nedelja plana iz datuma (start = prvi dan nedelje 1, trka = poslednji dan poslednje nedelje). */
export const planWeeks = (input: { startDate: IsoDate; raceDate: IsoDate }): number =>
  (mustDay(input.raceDate) - mustDay(input.startDate) + 1) / 7;

/** Faza svake nedelje (1-indeks u nizu na mestu i − 1). W1-A: kratak plan (N < minWeeks; minWeeks = najkraći
    dozvoljen plan tog tipa trkača) — poslednjih N nedelja rasporeda od minWeeks nedelja (baza i uvod otpadaju prvi,
    zatim razvoj, specifična, taper; trkačka nedelja uvek). */
export function phasesOf(weeks: number, minWeeks: number = P.input.weeksMin): Phase[] {
  if (weeks < minWeeks) return standardPhases(minWeeks).slice(minWeeks - weeks);
  // W1-B: dug plan — K = N − weeksMax nedelja osnovne pripreme (baza) + standardni plan od weeksMax nedelja.
  const k = prepWeeksOf(weeks);
  if (k > 0) return [...Array<Phase>(k).fill('base'), ...standardPhases(P.input.weeksMax)];
  return standardPhases(weeks);
}

/** M5 / W1: rasteretne nedelje plana. Dug plan (W1-B): u osnovnoj pripremi svaka prep.deloadEvery-ta nedelja,
    standardni deo po M5 na svom rasporedu (pomeren za K). Kratak plan (W1-A): M5 na zadržanom rasporedu. */
export function planDeloads(weeks: number, minWeeks: number = P.input.weeksMin): number[] | null {
  const k = prepWeeksOf(weeks);
  if (k === 0) return deloadWeeks(phasesOf(weeks, minWeeks));
  const std = deloadWeeks(standardPhases(P.input.weeksMax));
  if (!std) return null;
  const e = P.prep.deloadEvery;
  return [
    ...Array.from({ length: Math.floor(k / e) }, (_, i) => (i + 1) * e),
    ...std.map((w) => w + k)
  ];
}

export const isBuildPhase = (p: Phase): boolean =>
  p === 'base' || p === 'development' || p === 'specific';

/** Prva nedelja faze (1-indeks). */
export function firstOfPhase(phases: readonly Phase[], week: number): boolean {
  return week === 1 || phases[week - 2] !== phases[week - 1];
}

/** M7: redni broj nedelje tapera (0 = N−2, 1 = N−1); null van tapera. W1-A: brojanje od kraja tapera (kratak plan
    sa jednom nedeljom tapera ima samo N−1). */
export function taperStep(phases: readonly Phase[], week: number): number | null {
  if (phases[week - 1] !== 'taper') return null;
  return P.phases.taperWeeks - 1 - (phases.lastIndexOf('taper') - (week - 1));
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

/** M16 / P5-F1: vrsta testa plana — 'feel' (plan po osećaju koji nije početnik, M16), 'result' (plan sa rezultatom,
    nije početnik, ≥ test.resultMinWeeks nedelja; P5-F1), null = bez testa (početnik M17, kraći plan). JEDNA funkcija
    za konstruktor, adaptaciju i validator. */
export type TestKind = 'feel' | 'result';
export function testKindOf(
  rule: { readonly beginner: boolean; readonly feelTest: boolean },
  feel: boolean,
  weeks: number
): TestKind | null {
  if (feel) return rule.feelTest ? 'feel' : null;
  return !rule.beginner && weeks >= P.test.resultMinWeeks ? 'result' : null;
}

/** M16: nedelja testa 5 km = poslednja nedelja baze (1-indeks). P5-F1 (plan sa rezultatom): poslednja ne-rasteretna
    nedelja razvoja (0 = nema je). */
export function testWeekOf(
  phases: readonly Phase[],
  kind: TestKind = 'feel',
  deloads: readonly number[] = []
): number {
  const byRule = (): number => {
    if (kind === 'feel') return phases.lastIndexOf('base') + 1;
    for (let i = phases.length; i >= 1; i--)
      if (phases[i - 1] === 'development' && !deloads.includes(i)) return i;
    return 0;
  };
  const tw = byRule();
  // P8-G7: ne pre nedelje minWeek — prva ne-rasteretna nedelja ≥ minWeek iste faze, inače bez testa.
  const min = P.test.minWeek;
  if (tw === 0 || tw >= min) return tw;
  for (let i = min; i <= phases.length; i++)
    if (phases[i - 1] === phases[tw - 1] && !deloads.includes(i)) return i;
  // P8-S4 (marathon-v2.12.0, odluka organizatora): plan po osećaju čija baza nema nedelju ≥ minWeek (12–13 nedelja) —
  // test u prvoj ne-rasteretnoj nedelji ≥ minWeek sledeće faze (razvoj).
  if (kind === 'feel')
    for (let i = min; i <= phases.length; i++)
      if (phases[i - 1] === 'development' && !deloads.includes(i)) return i;
  return 0;
}

/**
 * A3/A12 (nov start): faze i rasterećenja preostale izgradnje od nedelje `from` do tapera istim pravilima kao
 * periodize — raspodela M4 za m = broj preostalih nedelja izgradnje, rasterećenja iz iste pretrage M5 relativno od
 * `from` (ne u prve 2 nedelje novog starta, ne na prvoj nedelji faze, ne pred taperom). Taper, trkačka nedelja,
 * datumi, oznaka testa i nedelje pre `from` se ne menjaju. null = M5 nema raspored (odstupanje A3: faze ostaju).
 */
export function rePeriodize(frames: readonly WeekFrame[], from: number): WeekFrame[] | null {
  const tail = frames.findIndex((f) => !isBuildPhase(f.phase));
  const m = tail - (from - 1);
  if (m <= 0) return [...frames];
  // W1-B: preostalo do trke duže od weeksMax — prvih (preostalo − weeksMax) nedelja je osnovna priprema (prep,
  // rasterećenje svake prep.deloadEvery-te), ostatak izgradnje po M4/M5 kao standardni plan.
  const prep = Math.min(m, prepWeeksOf(frames.length - from + 1));
  const seq = buildSequence(buildCounts(m - prep));
  const std = deloadWeeks(seq);
  if (!std) return null;
  const e = P.prep.deloadEvery;
  return frames.map((f, i) => {
    const k = i - (from - 1);
    if (k < 0 || i >= tail) return f;
    const { prep: _p, ...g } = f;
    return k < prep
      ? { ...g, phase: 'base' as const, deload: (k + 1) % e === 0, prep: true as const }
      : { ...g, phase: seq[k - prep]!, deload: std.includes(k - prep + 1) };
  });
}

/** Okviri nedelja: datumi, faza, rasterećenje; `test` (vrsta testa, testKindOf; true = 'feel') označava
    nedelju testa. null kad M5 nema rešenja. */
export function periodize(
  startDate: IsoDate,
  weeks: number,
  test: boolean | TestKind | null = false,
  /** W1-A: najkraći dozvoljen plan tipa trkača (PlanRule.weeksMin). */
  minWeeks: number = P.input.weeksMin
): WeekFrame[] | null {
  // W1-A: rasterećenja kratkog plana po pravilu M5 na zadržanom rasporedu; W1-B: osnovna priprema (prep) + standardni
  // deo (isto pravilo za validator).
  const phases = phasesOf(weeks, minWeeks);
  const deloads = planDeloads(weeks, minWeeks);
  if (!deloads) return null;
  const kind: TestKind | null = test === true ? 'feel' : test === false ? null : test;
  const tw = kind ? testWeekOf(phases, kind, deloads) : 0;
  const k = prepWeeksOf(weeks);
  return phases.map((phase, i) => ({
    index: i + 1,
    startDate: addDays(startDate, 7 * i),
    endDate: addDays(startDate, 7 * i + 6),
    phase,
    deload: deloads.includes(i + 1),
    ...(i + 1 === tw ? { test: true as const } : {}),
    ...(i < k ? { prep: true as const } : {})
  }));
}

/** Padež imenice „nedelja" uz broj (1 nedelja / 2–4 nedelje / 5+ nedelja; 21, 22–24 …). `acc` = akuzativ jednine
    („plan ima 1 nedelju"). */
function weeksWord(n: number, acc = false): string {
  const d = n % 10;
  const dd = n % 100;
  if (d === 1 && dd !== 11) return acc ? 'nedelju' : 'nedelja';
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return 'nedelje';
  return 'nedelja';
}

/** W1-C: jedno upozorenje plana van preporučene dužine (kratak W1-A / dug W1-B); null u opsegu. JEDAN tekst za
    napomenu plana (konstruktor) i upozorenje PLAN_LENGTH (validator). */
export function lengthWarningOf(weeks: number, rule: { readonly weeksMin: number }): string | null {
  if (weeks < rule.weeksMin)
    return `Skraćena priprema: plan ima ${weeks} ${weeksWord(weeks, true)}, a za pun ciklus za maraton preporučuje se najmanje ${rule.weeksMin} ${weeksWord(rule.weeksMin)}. Plan je napravljen za izabrani datum, ali nema vremena za sve faze pripreme i ne garantuje spremnost ni ciljno vreme. Ne nadoknađuj kraći rok naglim povećanjem obima ili intenziteta.`;
  const k = prepWeeksOf(weeks);
  if (k === 0) return null;
  const max = P.input.weeksMax;
  const d = k % 10;
  const dd = k % 100;
  const first =
    d === 1 && dd !== 11
      ? `${k === 1 ? 'prva nedelja' : `prva ${k} nedelja`} je`
      : d >= 2 && d <= 4 && (dd < 12 || dd > 14)
        ? `prve ${k} nedelje su`
        : `prvih ${k} nedelja je`;
  return `Plan je duži od preporučenih ${max} ${weeksWord(max)}: ${first} osnovna priprema na sadašnjem obimu, a puna priprema za maraton počinje u nedelji ${k + 1}.`;
}
