/* Segment 04: koraci adaptacije (TenKV2AdaptStep, izvedeni u assess.ts) → okviri nedelja (faze,
   rasterećenja — i A17, 10k-v2.5.0 —, test, ograničenja po datumima) i tempo po nedelji. Koriste ga
   konstruktor (generate.construct), adapt.ts i validator; bez koraka sve je kao u generatoru. */

import { addDays, mustDay, weekdayOf } from './dates.ts';
import type { PaceInput } from './input.ts';
import { feelPaces, pacesFromVdot } from './paces.ts';
import { isBuildPhase, periodize, rePeriodize } from './periodize.ts';
import { TEN_K_V2_POLICY as P } from './policy.ts';
import { deloadSlot } from './quality.ts';
import type {
  DateRange,
  IsoDate,
  PaceBasis,
  Paces,
  Pattern,
  TenKV2AdaptStep,
  WeekFrame,
  WeekLimits,
  Weekday
} from './types.ts';

export const inRange = (d: IsoDate, r: DateRange | null): boolean =>
  r !== null && mustDay(d) >= mustDay(r.from) && mustDay(d) <= mustDay(r.to);

/** Datum dana `wd` u nedelji okvira. */
export function dateIn(f: { startDate: IsoDate }, wd: Weekday): IsoDate {
  for (let i = 0; i < 7; i++) {
    const d = addDays(f.startDate, i);
    if (weekdayOf(d) === wd) return d;
  }
  throw new Error(`Dan ${wd} nije u nedelji ${f.startDate}.`);
}

/** Tempo iz ulaza (isto kao generate: rezultat ili plan po osećaju, D26). */
export const basePaces = (pace: PaceInput): Paces =>
  pace.kind === 'feel' ? feelPaces(pace.easySecPerKm).paces : pacesFromVdot(pace.vdotRaw);

/** A1: VDOT poslednjeg koraka sa rezultatom čiji je fromWeek ≤ w; null = tempo iz ulaza. */
export function stepVdotAt(steps: readonly TenKV2AdaptStep[], w: number): number | null {
  let v: number | null = null;
  for (const s of steps) if (s.vdot !== null && s.fromWeek <= w) v = s.vdot;
  return v;
}

/** A1: tempo nedelje w. */
export function pacesAt(pace: PaceInput, steps: readonly TenKV2AdaptStep[], w: number): Paces {
  const v = stepVdotAt(steps, w);
  return v === null ? basePaces(pace) : pacesFromVdot(v);
}

/** A1: osnova tempa nedelje w (plan po osećaju prelazi na rezultat od nedelje rezultata). */
export function basisAt(pace: PaceInput, steps: readonly TenKV2AdaptStep[], w: number): PaceBasis {
  return stepVdotAt(steps, w) !== null ? 'result' : pace.kind;
}

/** Dan testa (D27): dan Q1, u rasterećenju dan slota rasterećenja. */
export function testDateOf(f: WeekFrame, pattern: Pattern): IsoDate {
  const slot = deloadSlot(pattern.q2 ? 2 : 1);
  return dateIn(f, f.deload && slot === 'q2' ? pattern.q2! : pattern.q1);
}

const withoutTest = (f: WeekFrame): WeekFrame => {
  const { test: _test, ...rest } = f;
  return rest;
};

/**
 * Ograničenja nedelje iz datumskih opsega svih koraka (jedino mesto prevođenja datuma u nedelju, A3/A4):
 * zabrana kvaliteta = noQuality ∪ bol ∪ odmor; nijedan dan kvaliteta šablona van zabrane → 'none'; deo
 * dana kvaliteta u zabrani, dan kvaliteta u oneQuality ili nedelja sa danom bola/odmora → 'one' (A4: doza
 * ne raste u nedelji sa ograničenjem). Trkačka nedelja: samo dani. Bez ograničenja → undefined.
 */
export function limitsOf(
  f: WeekFrame,
  pattern: Pattern,
  runDays: readonly Weekday[],
  raceDate: IsoDate,
  steps: readonly TenKV2AdaptStep[]
): WeekLimits | undefined {
  if (steps.length === 0) return undefined;
  const dates = runDays.map((w) => dateIn(f, w)).filter((d) => d !== raceDate);
  const any = (d: IsoDate, pick: (s: TenKV2AdaptStep) => readonly (DateRange | null)[]): boolean =>
    steps.some((s) => pick(s).some((r) => inRange(d, r)));
  const banned = (d: IsoDate): boolean => any(d, (s) => [...s.noQuality, s.pain, s.rest]);
  const out: WeekLimits = {};
  const rest = dates.filter((d) => any(d, (s) => [s.rest]));
  const pain = dates.filter((d) => any(d, (s) => [s.pain]));
  if (f.phase !== 'race') {
    const qd = [pattern.q1, ...(pattern.q2 ? [pattern.q2] : [])].map((w) => dateIn(f, w));
    const allowed = qd.filter((d) => !banned(d));
    if (allowed.length === 0) out.quality = 'none';
    else if (
      allowed.length < qd.length ||
      qd.some((d) => any(d, (s) => s.oneQuality)) ||
      rest.length > 0 ||
      pain.length > 0
    )
      out.quality = 'one';
  }
  const noQuality = dates.filter(banned);
  if (noQuality.length > 0) out.noQuality = noQuality;
  if (rest.length > 0) out.rest = rest;
  if (pain.length > 0) out.pain = pain;
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Pouka 36 (10k-v2.6.0): nedelja prinudnog rasterećenja koraka (A5) — iz zapisa umora (`deloadWeek`), inače
    fromWeek. Jedina definicija (framesFor, newLimits, validator, adaptInvariants). Kopija maraton v2. */
export const deloadWeekOf = (s: { fromWeek: number; deloadWeek?: number }): number =>
  s.deloadWeek ?? s.fromWeek;

/** A3: nedelje novog starta (početak nove progresije doze, D16; granica izgradnje D6 od novog starta). */
export const restartWeeks = (steps: readonly TenKV2AdaptStep[]): Set<number> =>
  new Set(steps.filter((s) => s.restart).map((s) => s.fromWeek));

/** A17: najviše uzastopnih nedelja izgradnje od ukinutog rasterećenja (uključujući ukinutu nedelju) do
    sledećeg redovnog rasterećenja — D5 izuzetak 4 + ukinuta nedelja. framesFor i validator (D5). */
export const A17_MAX_RUN = P.deload.exceptionRun + 1;

/** A17 (a): nedelja smanjenja iz cilja koraka — reduced (A2/A3; A6 false); korak sačuvan pre
    10k-v2.5.0 (bez polja, A14): cilj koraka uz nivo pre smanjenja. null = korak nema cilj smanjenja. */
export function targetReducedWeek(s: TenKV2AdaptStep): number | null {
  if (s.restart) return null;
  const reduced = s.reduced ?? (s.startKm !== null && s.levelKm !== null);
  return reduced ? s.fromWeek : null;
}

/**
 * A17: nedelje smanjenja koraka — (a) cilj koraka (targetReducedWeek) → fromWeek; (b) bol sa povratkom →
 * nedelja sidra r; (c) nov start se ne računa (rePeriodize gradi raspored od novog starta).
 */
export function reducedWeeks(s: TenKV2AdaptStep): number[] {
  if (s.restart) return [];
  const a = targetReducedWeek(s);
  const out = a === null ? [] : [a];
  if (s.returnFrom !== null && !out.includes(s.returnFrom.week)) out.push(s.returnFrom.week);
  return out;
}

/**
 * Okviri nedelja posle koraka (redom): nov start → rePeriodize od fromWeek (A12; nema rasporeda po D5 →
 * faze ostaju, odstupanje A3); umor → fromWeek je rasterećenje (samo izgradnja; redovno rasterećenje
 * odmah posle se ukida, A5); A17: redovno rasterećenje odmah posle nedelje smanjenja (reducedWeeks) se
 * ukida — prinudno (A5) nikad, a ni kad bi od ukinute nedelje do sledećeg rasterećenja bilo više od
 * A17_MAX_RUN nedelja izgradnje (raspored se ne pomera); novi rezultat → nema testa posle asOf (A13);
 * ograničenja po datumima (limitsOf). A13: test posle poslednjeg asOf u nedelji sa ograničenjem kvaliteta,
 * prinudnim rasterećenjem ili van izgradnje → prva sledeća ne-rasteretna nedelja izgradnje bez ograničenja
 * dok je plan po osećaju; nema je → bez testa. `base` = okviri generatora. `dropped` (izlaz, A17): ukinuta
 * rasterećenja — nedelja → indeks koraka (isti podatak za validator D5 i poruku koraka, adapt.ts).
 */
function framesAndTest(
  base: readonly WeekFrame[],
  pattern: Pattern,
  runDays: readonly Weekday[],
  raceDate: IsoDate,
  pace: PaceInput,
  steps: readonly TenKV2AdaptStep[],
  dropped: Map<number, number> | null = null,
  locked: ReadonlySet<string> = new Set()
): { frames: WeekFrame[]; test: IsoDate | null } {
  let frames: WeekFrame[] = base.map((f) => ({ ...f }));
  if (steps.length === 0) return { frames, test: baseTest(base, pattern) };
  // A13b (10k-v2.8.0, organizator K1; obrazac maraton A13b): dan testa iz plana pre koraka. C3 (10K-07): zaštićen test
  // ranijeg koraka (upisan, okvir ga ne nosi) ostaje test i za sledeći korak — isti skup zaštićenih dana.
  const prevTest =
    steps.length > 1
      ? framesAndTest(base, pattern, runDays, raceDate, pace, steps.slice(0, -1), null, locked).test
      : baseTest(base, pattern);
  const forced = new Set<number>();
  /** Uzastopne nedelje izgradnje od nedelje i (indeks u nizu) do prvog rasterećenja ili kraja izgradnje. */
  const runFrom = (i: number): number => {
    let k = i + 1;
    while (k < frames.length && isBuildPhase(frames[k]!.phase) && !frames[k]!.deload) k++;
    return k - i;
  };
  for (const [k, s] of steps.entries()) {
    const n = s.fromWeek;
    if (s.restart) {
      const re = rePeriodize(frames, n);
      frames = (re ?? frames).map((f) => ({ ...f }));
      // Nov raspored od fromWeek (A12) zamenjuje i prinudna i ukinuta rasterećenja od te nedelje.
      if (re) for (const w of [...forced]) if (w >= n) forced.delete(w);
      if (re && dropped) for (const w of [...dropped.keys()]) if (w >= n) dropped.delete(w);
    }
    const dw = deloadWeekOf(s);
    const fn = frames[dw - 1];
    if (s.deload && fn && isBuildPhase(fn.phase) && !fn.deload) {
      // Pouka 36: prinudno rasterećenje tekuće nedelje (dw < fromWeek) čiji je test već prošao (≤ asOf, upisan) —
      // rasterećenje bez novog testa.
      const done = fn.test === true && mustDay(testDateOf(fn, pattern)) <= mustDay(s.asOf);
      fn.deload = true;
      if (done) frames[dw - 1] = withoutTest(fn);
      forced.add(dw);
      const next = frames[dw];
      if (next && next.deload && isBuildPhase(next.phase)) next.deload = false;
    }
    for (const w of reducedWeeks(s)) {
      const next = frames[w];
      if (
        next &&
        next.deload &&
        isBuildPhase(next.phase) &&
        !forced.has(next.index) &&
        runFrom(w) <= A17_MAX_RUN
      ) {
        next.deload = false;
        dropped?.set(next.index, k);
      }
    }
    if (s.vdot !== null)
      frames = frames.map((f) =>
        f.test && mustDay(testDateOf(f, pattern)) > mustDay(s.asOf) ? withoutTest(f) : f
      );
  }
  frames = frames.map((f) => {
    const l = limitsOf(f, pattern, runDays, raceDate, steps);
    return l ? { ...f, limits: l } : f;
  });
  const last = steps[steps.length - 1]!.asOf;
  // A13b: zaštićen test (dan upisan) — okvir ga nosi samo na istom danu (prinudno rasterećenje pomera dan testa Q1 →
  // slot rasterećenja; rePeriodize premešta nedelju), inače okvir bez testa; test se ne premešta (ispod).
  if (protectedTest(prevTest, last, locked))
    frames = frames.map((f) =>
      f.test && testDateOf(f, pattern) !== prevTest ? withoutTest(f) : f
    );
  const i = frames.findIndex((f) => f.test);
  const t = frames[i];
  const blocked = (f: WeekFrame, k: number): boolean =>
    !isBuildPhase(f.phase) || f.limits?.quality !== undefined || (f.deload && !base[k]!.deload);
  if (
    t &&
    blocked(t, i) &&
    mustDay(testDateOf(t, pattern)) > mustDay(last) &&
    !protectedTest(prevTest, last, locked)
  ) {
    frames[i] = withoutTest(t);
    const j = frames.findIndex(
      (f, k) =>
        k > i &&
        isBuildPhase(f.phase) &&
        !f.deload &&
        f.limits?.quality === undefined &&
        basisAt(pace, steps, f.index) === 'feel'
    );
    if (j >= 0) frames[j] = { ...frames[j]!, test: true };
  }
  const own = frames.find((f) => f.test);
  return {
    frames,
    test: protectedTest(prevTest, last, locked) ? prevTest : own ? testDateOf(own, pattern) : null
  };
}

const baseTest = (base: readonly WeekFrame[], pattern: Pattern): IsoDate | null => {
  const f = base.find((x) => x.test);
  return f ? testDateOf(f, pattern) : null;
};

export function framesFor(
  base: readonly WeekFrame[],
  pattern: Pattern,
  runDays: readonly Weekday[],
  raceDate: IsoDate,
  pace: PaceInput,
  steps: readonly TenKV2AdaptStep[],
  dropped: Map<number, number> | null = null,
  locked: ReadonlySet<string> = new Set()
): WeekFrame[] {
  return framesAndTest(base, pattern, runDays, raceDate, pace, steps, dropped, locked).frames;
}

/**
 * A13b (10k-v2.8.0, organizator K1; obrazac maraton A13b) — JEDNA funkcija „zaštićen test": test čiji je dan u planu
 * pre koraka zaštićen (≤ asOf, zaključan ili urađen — `locked` = lockedDayIds ∪ doneDayIds) ostaje upisan (A11);
 * framesFor ga ne premešta i nijedan drugi okvir ne dobija test. Konstruktor, validator i adapt.ts zovu framesFor sa
 * istim skupom.
 */
export function protectedTest(
  testDate: IsoDate | null,
  asOf: IsoDate,
  locked: ReadonlySet<string>
): boolean {
  return testDate !== null && (mustDay(testDate) <= mustDay(asOf) || locked.has(testDate));
}

/** A3: nedelje novog starta u kojima je rePeriodize primenjen (D5 ima raspored preostale izgradnje). */
export function appliedRestarts(
  base: readonly WeekFrame[],
  steps: readonly TenKV2AdaptStep[]
): Set<number> {
  return new Set(
    steps.filter((s) => s.restart && rePeriodize(base, s.fromWeek) !== null).map((s) => s.fromWeek)
  );
}

/** Okviri generatora (periodize) — ulaz za framesFor i validator. */
export const baseFrames = (startDate: IsoDate, weeks: number, test: boolean): WeekFrame[] | null =>
  periodize(startDate, weeks, test);

/**
 * Pouka 20 (10K 06f): traka „Plan treba prilagoditi" samo za NOVO ograničenje — datumi poslednjeg koraka sa
 * ograničenjem (zabrana kvaliteta, jedan kvalitet, odmor, bol) kojih nema u ograničenjima prethodnih koraka, i
 * prinudno rasterećenje / nov start koga ranije nije bilo. Posledica drugog uslova (premeštanje testa, ukinuto
 * rasterećenje) nije ograničenje. Čita ga adaptBanner (adapt.ts); prazno = bez trake. Kopija maraton v2
 * steps.newLimits (ne uvoz, Uslov 7).
 */
export function newLimits(steps: readonly TenKV2AdaptStep[]): string[] {
  const last = steps[steps.length - 1];
  if (!last) return [];
  const prev = steps.slice(0, -1);
  const days = (s: TenKV2AdaptStep, pick: (x: TenKV2AdaptStep) => readonly (DateRange | null)[]) =>
    pick(s).flatMap((r) => {
      if (!r) return [];
      const out: string[] = [];
      for (let d = r.from; mustDay(d) <= mustDay(r.to); d = addDays(d, 1)) out.push(d);
      return out;
    });
  const kinds: [string, (x: TenKV2AdaptStep) => readonly (DateRange | null)[]][] = [
    ['noQuality', (x) => x.noQuality],
    ['oneQuality', (x) => x.oneQuality],
    ['rest', (x) => [x.rest]],
    ['pain', (x) => [x.pain]]
  ];
  const out: string[] = [];
  for (const [k, pick] of kinds) {
    const old = new Set(prev.flatMap((s) => days(s, pick)));
    for (const d of days(last, pick)) if (!old.has(d)) out.push(`${k}:${d}`);
  }
  if (last.deload && !prev.some((s) => s.deload && deloadWeekOf(s) === deloadWeekOf(last)))
    out.push(`deload:${deloadWeekOf(last)}`);
  if (last.restart) out.push(`restart:${last.fromWeek}`);
  return out;
}
