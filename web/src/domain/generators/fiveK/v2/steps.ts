/* 2.5.0: koraci adaptacije (AdaptStep, izvedeni u assess.ts) → okviri nedelja i tempo po nedelji.
   Koriste ga konstruktor (generate.construct) i validator; bez koraka sve je kao u generatoru. */

import { addDays, mustDay, weekdayIndex, weekdayOf } from './dates.ts';
import { hasFreshResult } from './input.ts';
import { feelPaces, pacesFromVdot, vdotFromResult } from './paces.ts';
import { periodize, rePeriodize } from './periodize.ts';
import { rulesOf, type Athlete, type RunDaysCount } from './policy.ts';
import type {
  AdaptStep,
  DateRange,
  FiveKV2Input,
  IsoDate,
  PaceModel,
  Pattern,
  WeekFrame,
  WeekLimits,
  Weekday
} from './types.ts';

const isBuild = (f: WeekFrame): boolean =>
  f.phase === 'base' || f.phase === 'peak' || f.phase === 'sharpen';

export const inRange = (d: IsoDate, r: DateRange | null): boolean =>
  r !== null && mustDay(d) >= mustDay(r.from) && mustDay(d) <= mustDay(r.to);

/** Trkač iz ulaza (isto kao generate): broj dana, početnik, plan po osećaju. */
export function baseAthlete(input: FiveKV2Input): Athlete {
  return {
    days: input.runDays.length as RunDaysCount,
    beginner: input.experience === 'beginner',
    feel: !hasFreshResult(input)
  };
}

/** VDOT ulaza (null = po osećaju), isto kao generate. */
export function baseVdot(input: FiveKV2Input): number | null {
  return hasFreshResult(input)
    ? Math.round(vdotFromResult(input.recentResult.distanceM, input.recentResult.timeSec) * 10) / 10
    : null;
}

/** VDOT koji važi u nedelji w (poslednji korak sa rezultatom čiji je fromWeek ≤ w). */
export function vdotAt(input: FiveKV2Input, steps: readonly AdaptStep[], w: number): number | null {
  let v = baseVdot(input);
  for (const s of steps) if (s.vdot !== null && s.fromWeek <= w) v = s.vdot;
  return v;
}

export function pacesAt(input: FiveKV2Input, steps: readonly AdaptStep[], w: number): PaceModel {
  const v = vdotAt(input, steps, w);
  return v === null ? feelPaces(input.typicalEasyPaceSecPerKm!) : pacesFromVdot(v);
}

export function athleteAt(input: FiveKV2Input, steps: readonly AdaptStep[], w: number): Athlete {
  return { ...baseAthlete(input), feel: vdotAt(input, steps, w) === null };
}

function dateOf(f: WeekFrame, w: Weekday): IsoDate {
  const offset = (((weekdayIndex(w) - weekdayIndex(weekdayOf(f.startDate))) % 7) + 7) % 7;
  return addDays(f.startDate, offset);
}

/**
 * Ograničenja nedelje iz datumskih opsega svih koraka (jedino mesto prevođenja datuma u nedelju):
 * zabrana kvaliteta = noQuality ∪ bol ∪ odmor; dani kvaliteta šablona (q1, q2) u zabrani → manje
 * kvaliteta ('none' / 'one', zamena q1 ↔ q2 kad je samo q1 u zabrani); dan u oneQuality → 'one'.
 * Trkačka nedelja: samo dani (oštrenje bira dan van zabrane, week.ts). Bez ograničenja → undefined.
 */
export function limitsOf(
  f: WeekFrame,
  pattern: Pattern,
  runDays: readonly Weekday[],
  raceDate: IsoDate,
  steps: readonly AdaptStep[]
): WeekLimits | undefined {
  if (steps.length === 0) return undefined;
  const dates = runDays.map((w) => dateOf(f, w)).filter((d) => d !== raceDate);
  const any = (d: IsoDate, pick: (s: AdaptStep) => readonly (DateRange | null)[]): boolean =>
    steps.some((s) => pick(s).some((r) => inRange(d, r)));
  const banned = (d: IsoDate): boolean => any(d, (s) => [...s.noQuality, s.pain, s.rest]);
  const out: WeekLimits = {};
  const noQuality = dates.filter(banned);
  const rest = dates.filter((d) => any(d, (s) => [s.rest]));
  const pain = dates.filter((d) => any(d, (s) => [s.pain]));
  if (f.phase !== 'race') {
    const qd = [pattern.q1, ...(pattern.q2 ? [pattern.q2] : [])].map((w) => dateOf(f, w));
    const allowed = qd.filter((d) => !banned(d));
    if (allowed.length === 0) out.quality = 'none';
    else if (allowed.length < qd.length || qd.some((d) => any(d, (s) => s.oneQuality)))
      out.quality = 'one';
    if (out.quality === 'one' && banned(qd[0]!)) out.swap = true;
  }
  if (noQuality.length > 0) out.noQuality = noQuality;
  if (rest.length > 0) out.rest = rest;
  if (pain.length > 0) out.pain = pain;
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Okviri nedelja posle koraka (redom): nov start → rePeriodize od fromWeek; umor → fromWeek je
 * rasterećenje (samo izgradnja; redovno rasterećenje odmah posle se ukida); novi rezultat → nema testa
 * od fromWeek; ograničenja po datumima (limitsOf). Kontrolno trčanje (po osećaju) u nedelji sa
 * ograničenjem kvaliteta, rasterećenjem ili van izgradnje, a posle asOf, premešta se na prvu sledeću
 * ne-rasteretnu nedelju izgradnje bez ograničenja; ako je nema — bez testa.
 */
export function framesFor(
  input: FiveKV2Input,
  steps: readonly AdaptStep[],
  pattern: Pattern,
  totalWeeks: number
): WeekFrame[] {
  const a = baseAthlete(input);
  const every = rulesOf(a).deloadEvery;
  let frames = periodize(input.startDate, totalWeeks, every, a.feel);
  if (steps.length === 0) return frames;
  for (const s of steps) {
    const n = s.fromWeek;
    if (s.restart) frames = rePeriodize(frames, n, every);
    frames = frames.map((f) => ({ ...f }));
    const fn = frames[n - 1];
    if (s.deload && fn && isBuild(fn)) {
      fn.deload = true;
      const next = frames[n];
      if (next && next.deload && isBuild(next)) next.deload = false;
    }
    if (s.vdot !== null) for (const f of frames) if (f.index >= n) f.test = false;
  }
  for (const f of frames) {
    const l = limitsOf(f, pattern, input.runDays, input.raceDate, steps);
    if (l) f.limits = l;
  }
  const last = steps[steps.length - 1]!.asOf;
  const t = frames.find((f) => f.test);
  const blocked = (f: WeekFrame): boolean =>
    !isBuild(f) || f.deload || f.limits?.quality !== undefined;
  if (t && blocked(t) && mustDay(dateOf(t, pattern.q1)) > mustDay(last)) {
    t.test = false;
    const next = frames.find(
      (f) => f.index > t.index && !blocked(f) && vdotAt(input, steps, f.index) === null
    );
    if (next) next.test = true;
  }
  return frames;
}

/** Nedelja od koje korak počinje novu progresiju doze (nov cilj obima ili nov start; pauza: već ostatak
    tekuće nedelje); null = korak ne menja progresiju. Isto u konstruktoru i validatoru. */
export function doseResetAt(s: AdaptStep): number | null {
  if (!s.restart && s.startKm === null) return null;
  return s.pauseRemainder && s.firstWeek < s.fromWeek ? s.firstWeek : s.fromWeek;
}
