/* Segment 04: koraci adaptacije (TenKV2AdaptStep, izvedeni u assess.ts) → okviri nedelja (faze,
   rasterećenja, test, ograničenja po datumima) i tempo po nedelji. Koriste ga konstruktor
   (generate.construct), adapt.ts i validator; bez koraka sve je kao u generatoru. */

import { addDays, mustDay, weekdayOf } from './dates.ts';
import type { PaceInput } from './input.ts';
import { feelPaces, pacesFromVdot } from './paces.ts';
import { isBuildPhase, periodize, rePeriodize } from './periodize.ts';
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

/** A3: nedelje novog starta (početak nove progresije doze, D16; granica izgradnje D6 od novog starta). */
export const restartWeeks = (steps: readonly TenKV2AdaptStep[]): Set<number> =>
  new Set(steps.filter((s) => s.restart).map((s) => s.fromWeek));

/**
 * Okviri nedelja posle koraka (redom): nov start → rePeriodize od fromWeek (A12; nema rasporeda po D5 →
 * faze ostaju, odstupanje A3); umor → fromWeek je rasterećenje (samo izgradnja; redovno rasterećenje
 * odmah posle se ukida, A5); novi rezultat → nema testa posle asOf (A13); ograničenja po datumima
 * (limitsOf). A13: test posle poslednjeg asOf u nedelji sa ograničenjem kvaliteta, prinudnim
 * rasterećenjem ili van izgradnje → prva sledeća ne-rasteretna nedelja izgradnje bez ograničenja dok je
 * plan po osećaju; nema je → bez testa. `base` = okviri generatora.
 */
export function framesFor(
  base: readonly WeekFrame[],
  pattern: Pattern,
  runDays: readonly Weekday[],
  raceDate: IsoDate,
  pace: PaceInput,
  steps: readonly TenKV2AdaptStep[]
): WeekFrame[] {
  let frames: WeekFrame[] = base.map((f) => ({ ...f }));
  if (steps.length === 0) return frames;
  for (const s of steps) {
    const n = s.fromWeek;
    if (s.restart) frames = (rePeriodize(frames, n) ?? frames).map((f) => ({ ...f }));
    const fn = frames[n - 1];
    if (s.deload && fn && isBuildPhase(fn.phase) && !fn.deload) {
      fn.deload = true;
      const next = frames[n];
      if (next && next.deload && isBuildPhase(next.phase)) next.deload = false;
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
  const i = frames.findIndex((f) => f.test);
  const t = frames[i];
  const blocked = (f: WeekFrame, k: number): boolean =>
    !isBuildPhase(f.phase) || f.limits?.quality !== undefined || (f.deload && !base[k]!.deload);
  if (t && blocked(t, i) && mustDay(testDateOf(t, pattern)) > mustDay(last)) {
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
  return frames;
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
