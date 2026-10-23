/* 2.5.0: koraci adaptacije (AdaptStep, izvedeni u assess.ts) → okviri nedelja i tempo po nedelji.
   Koriste ga konstruktor (generate.construct) i validator; bez koraka sve je kao u generatoru.
   2.7.0 (Odluka 9): ukidanje redovnog rasterećenja odmah posle nedelje smanjenja (framesFor). */

import { addDays, mustDay, weekdayIndex, weekdayOf } from './dates.ts';
import { hasFreshResult } from './input.ts';
import { feelPaces, pacesFromVdot, vdotFromResult } from './paces.ts';
import { controlTest, isShortPrep, periodize, rePeriodize } from './periodize.ts';
import { FIVE_K_V2_POLICY as P, rulesOf, type Athlete, type RunDaysCount } from './policy.ts';
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
import type { Written } from './written.ts';

const isBuild = (f: Pick<WeekFrame, 'phase'>): boolean =>
  f.phase === 'base' || f.phase === 'peak' || f.phase === 'sharpen';

export const inRange = (d: IsoDate, r: DateRange | null): boolean =>
  r !== null && mustDay(d) >= mustDay(r.from) && mustDay(d) <= mustDay(r.to);

/** Trkač iz ulaza (isto kao generate): broj dana, početnik, plan po osećaju. */
export function baseAthlete(input: FiveKV2Input): Athlete {
  return {
    days: input.runDays.length as RunDaysCount,
    beginner: input.experience === 'beginner',
    feel: !hasFreshResult(input),
    ...(input.weekOffset ? { weekOffset: input.weekOffset } : {})
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

/** 2.7.0 (Odluka 9): najviše uzastopnih nedelja izgradnje od ukinutog rasterećenja (uključujući ukinutu
    nedelju) do sledećeg rasterećenja ili kraja izgradnje = najduži niz izgradnje bez rasterećenja koji generator
    sam pravi u osnovnom rasporedu (periodize, svi planovi sa rasterećenjem: input.planWeeks bez kratke pripreme;
    deloadEvery 4: 5 nedelja, plan od 11; početnik 3: 3) + 1. Izvedeno iz periodize — bez novog broja. */
const maxRuns = new Map<number, number>();
export function reliefMaxRun(deloadEvery: number): number {
  const known = maxRuns.get(deloadEvery);
  if (known !== undefined) return known;
  let longest = 0;
  for (let n = P.input.planWeeks.min; n <= P.input.planWeeks.max; n++) {
    if (isShortPrep(n)) continue;
    let run = 0;
    // Datum ne utiče na raspored (periodize: faze i rasterećenja zavise samo od broja nedelja).
    for (const f of periodize('2026-01-05', n, deloadEvery)) {
      run = isBuild(f) && !f.deload ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
  }
  maxRuns.set(deloadEvery, longest + 1);
  return longest + 1;
}

/** Odluka 9 (a): nedelja smanjenja iz cilja koraka — reduced (pauza, manjak; višak false); korak sačuvan
    pre 5k-v2.7.0 (bez polja): cilj koraka uz nivo pre smanjenja (pauza i manjak ga postavljaju; višak bez
    bola ne). Nov start se ne računa. null = korak nema cilj smanjenja. */
export function targetReducedWeek(s: AdaptStep): number | null {
  if (s.restart) return null;
  const reduced = s.reduced ?? (s.startKm !== null && (s.levelKm ?? null) !== null);
  return reduced ? s.fromWeek : null;
}

/** Odluka 9: nedelje smanjenja koraka — (a) cilj koraka (targetReducedWeek) → fromWeek; (b) bol sa
    povratkom → nedelja sidra r (returnFrom.week); (c) nov start se ne računa (rePeriodize gradi raspored). */
export function reducedWeeks(s: AdaptStep): number[] {
  if (s.restart) return [];
  const a = targetReducedWeek(s);
  const out = a === null ? [] : [a];
  const back = s.returnFrom ?? null;
  if (back !== null && !out.includes(back.week)) out.push(back.week);
  return out;
}

/**
 * Okviri nedelja posle koraka (redom): nov start → rePeriodize od fromWeek; umor → fromWeek je
 * rasterećenje (samo izgradnja; redovno rasterećenje odmah posle se ukida); 2.7.0 (Odluka 9): redovno
 * rasterećenje odmah posle nedelje smanjenja (reducedWeeks) se ukida — prinudno (umor) nikad, a ni kad bi
 * od ukinute nedelje do sledećeg rasterećenja ili kraja izgradnje bilo više od reliefMaxRun nedelja
 * (raspored se ne pomera, ništa se ne ubacuje); novi rezultat → nema testa od fromWeek; ograničenja po
 * datumima (limitsOf). Kontrolno trčanje (po osećaju) u nedelji sa ograničenjem kvaliteta, rasterećenjem
 * ili van izgradnje, a posle asOf, premešta se na prvu sledeću ne-rasteretnu nedelju izgradnje bez
 * ograničenja; ako je nema ili je njen dan testa zaštićen (zaključan; 2.10.1, izlaz `testLost`) — bez testa. `dropped` (izlaz, Odluka 9): ukinuta rasterećenja — nedelja →
 * indeks koraka (JEDINO mesto odluke; isti podatak čitaju validator i poruka koraka u adapt.ts).
 */
export function framesFor(
  input: FiveKV2Input,
  steps: readonly AdaptStep[],
  pattern: Pattern,
  totalWeeks: number,
  dropped: Map<number, number> | null = null,
  prior: Written | null = null,
  testLost: Map<number, string> | null = null
): WeekFrame[] {
  const a = baseAthlete(input);
  const every = rulesOf(a).deloadEvery;
  let frames = periodize(input.startDate, totalWeeks, every, controlTest(a));
  if (steps.length === 0) return frames;
  // 2.8.0 (pouka 29, N2a): kontrolno trčanje iz prethodnog (upisanog) plana — test u zaštićenom danu je urađen
  // (ostaje u svojoj nedelji, ne premešta se); inače nedelja testa prethodnog plana (premeštanje iz ranijeg
  // koraka se ne gubi). Bez prethodnog plana: raspored periodize.
  const written = prior ? writtenTest(prior) : null;
  if (written) frames = frames.map((f) => ({ ...f, test: f.index === written.week }));
  const forced = new Set<number>();
  const maxRun = reliefMaxRun(every);
  /** Uzastopne nedelje izgradnje od nedelje w + 1 do prvog rasterećenja ili kraja izgradnje. */
  const runFrom = (w: number): number => {
    let k = w + 1;
    while (k < frames.length && isBuild(frames[k]!) && !frames[k]!.deload) k++;
    return k - w;
  };
  for (const [k, s] of steps.entries()) {
    const n = s.fromWeek;
    if (s.restart) {
      frames = rePeriodize(frames, n, every);
      // Nov raspored od fromWeek zamenjuje i prinudna i ukinuta rasterećenja od te nedelje.
      for (const w of [...forced]) if (w >= n) forced.delete(w);
      if (dropped) for (const w of [...dropped.keys()]) if (w >= n) dropped.delete(w);
    }
    frames = frames.map((f) => ({ ...f }));
    const dw = s.deloadWeek ?? n;
    const fn = frames[dw - 1];
    if (s.deload && fn && isBuild(fn)) {
      fn.deload = true;
      forced.add(dw);
      const next = frames[dw];
      if (next && next.deload && isBuild(next)) next.deload = false;
    }
    for (const w of reducedWeeks(s)) {
      const next = frames[w];
      if (next && next.deload && isBuild(next) && !forced.has(next.index) && runFrom(w) <= maxRun) {
        next.deload = false;
        dropped?.set(next.index, k);
      }
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
  if (t && !written?.done && blocked(t) && mustDay(dateOf(t, pattern.q1)) > mustDay(last)) {
    t.test = false;
    const next = frames.find(
      (f) => f.index > t.index && !blocked(f) && vdotAt(input, steps, f.index) === null
    );
    // 2.10.1 (pouka 23, kao maraton A13/A13b): test se ne stavlja na zaštićen (zaključan) dan prethodnog plana — tada
    // otpada (bez drugog testa), uz napomenu nedelje.
    const day = next ? dateOf(next, pattern.q1) : null;
    const kept =
      next && day && prior
        ? prior.weeks[next.index - 1]?.days.find((d) => d.date === day && prior.keep(d))
        : undefined;
    if (next && kept) testLost?.set(next.index, day!);
    else if (next) next.test = true;
  }
  return frames;
}

/** 2.8.0 (pouka 29): kontrolno trčanje prethodnog plana — nedelja i da li je u zaštićenom (upisanom) danu.
    Nedelja = dan TEST_3K, inače oznaka testa; null nedelja = plan nema test. */
export function writtenTest(prior: Written): { week: number | null; done: boolean } {
  for (const w of prior.weeks)
    for (const d of w.days)
      if (d.workout.qualityType === 'TEST_3K') return { week: w.index, done: prior.keep(d) };
  return { week: prior.weeks.find((w) => w.test)?.index ?? null, done: false };
}

/** Nedelja od koje korak počinje novu progresiju doze (nov cilj obima ili nov start; pauza: već ostatak
    tekuće nedelje); null = korak ne menja progresiju. Isto u konstruktoru i validatoru.
    2.6.1 (Odluka 1 dopuna, sudar 08d): korak bola sa povratkom (returnFrom, bez cilja koraka) → nedelja posle
    sidra (week + 1), ako je nedelja izgradnje u `weeks` (okviri konstruktora ili nedelje plana); inače bez
    novog starta doze. Korak sa ciljem (pauza + bol) zadržava svoj start (≤ r + 1). */
export function doseResetAt(
  s: AdaptStep,
  weeks: readonly Pick<WeekFrame, 'phase'>[]
): number | null {
  if (s.restart || s.startKm !== null)
    return s.pauseRemainder && s.firstWeek < s.fromWeek ? s.firstWeek : s.fromWeek;
  const back = s.returnFrom ?? null;
  const next = back !== null ? weeks[back.week] : undefined;
  return back !== null && next !== undefined && isBuild(next) ? back.week + 1 : null;
}

/** 2.8.0 (pouka 29, N4): DATUM od kog korak počinje novu progresiju doze — početak nedelje doseResetAt, ali ne pre
    asOf + 1 (pauza usred nedelje: upisani dani do asOf pripadaju prethodnom segmentu). null = bez novog starta
    doze (ili nedelja van plana). Isto u konstruktoru i validatoru. */
export function doseResetDate(
  s: AdaptStep,
  weeks: readonly Pick<WeekFrame, 'phase' | 'startDate'>[]
): IsoDate | null {
  const r = doseResetAt(s, weeks);
  const start = r === null ? undefined : weeks[r - 1]?.startDate;
  if (start === undefined) return null;
  const next = addDays(s.asOf, 1);
  return mustDay(start) > mustDay(next) ? start : next;
}
