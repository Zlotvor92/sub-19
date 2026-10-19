/* Segment 04: koraci adaptacije (HmV2AdaptStep, izvedeni u assess.ts) → okviri nedelja (faze,
   rasterećenja — i A17, 10k-v2.5.0 —, test, ograničenja po datumima) i tempo po nedelji. Koriste ga
   konstruktor (generate.construct), adapt.ts i validator; bez koraka sve je kao u generatoru. */

import { addDays, mustDay, weekdayOf } from './dates.ts';
import type { PaceInput } from './input.ts';
import { feelPaces, pacesFromVdot } from './paces.ts';
import { isBuildPhase, periodize, rePeriodize } from './periodize.ts';
import { HM_V2_POLICY as P } from './policy.ts';
import { advance, deloadSlot, INITIAL_QUALITY, type QualityState } from './quality.ts';
import type {
  DateRange,
  IsoDate,
  PaceBasis,
  Paces,
  Pattern,
  HmV2AdaptStep,
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
  pace.kind === 'feel' ? feelPaces(pace.easySecPerKm) : pacesFromVdot(pace.vdotRaw);

/** A1: VDOT poslednjeg koraka sa rezultatom čiji je fromWeek ≤ w; null = tempo iz ulaza. */
export function stepVdotAt(steps: readonly HmV2AdaptStep[], w: number): number | null {
  let v: number | null = null;
  for (const s of steps) if (s.vdot !== null && s.fromWeek <= w) v = s.vdot;
  return v;
}

/** A1: tempo nedelje w. */
export function pacesAt(pace: PaceInput, steps: readonly HmV2AdaptStep[], w: number): Paces {
  const v = stepVdotAt(steps, w);
  return v === null ? basePaces(pace) : pacesFromVdot(v);
}

/** A1: osnova tempa nedelje w (plan po osećaju prelazi na rezultat od nedelje rezultata). */
export function basisAt(pace: PaceInput, steps: readonly HmV2AdaptStep[], w: number): PaceBasis {
  return stepVdotAt(steps, w) !== null ? 'result' : pace.kind;
}

/** Dan testa (H16): dan Q1, u rasterećenju dan slota rasterećenja. */
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
  steps: readonly HmV2AdaptStep[]
): WeekLimits | undefined {
  if (steps.length === 0) return undefined;
  const dates = runDays.map((w) => dateIn(f, w)).filter((d) => d !== raceDate);
  const any = (d: IsoDate, pick: (s: HmV2AdaptStep) => readonly (DateRange | null)[]): boolean =>
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

/** Nedelje u kojima progresija doze kreće iznova (stanje doze se briše): A3 nov start (fromWeek), pouka 18 —
    posle sidra bola r (nedelja r + 1) i pouka 34 (dopuna N7) — posle umora pre starta nedelja 2 (doza = doza
    planirane nedelje 1: ponavljanje, bez rasta; referenca ostaje stanje samo za rasterećenje nedelje 1). Jedna funkcija za konstruktor i validator. */
export const restartWeeks = (steps: readonly HmV2AdaptStep[]): Set<number> =>
  new Set(
    steps.flatMap((s) => [
      ...(s.restart ? [s.fromWeek] : []),
      ...(s.returnFrom ? [s.returnFrom.week + 1] : []),
      ...(s.preStart ? [2] : [])
    ])
  );

/** A17 (pouka 22): najviše uzastopnih nedelja izgradnje od ukinutog rasterećenja (uključujući ukinutu
    nedelju) do sledećeg redovnog rasterećenja — H5 izuzetak 4 + ukinuta nedelja. framesFor i validator. */
export const A17_MAX_RUN = P.deload.exceptionRun + 1;

/** A17 (a): nedelja smanjenja iz cilja koraka — reduced (A2/A3; A6 false). null = korak nema cilj
    smanjenja. */
export function targetReducedWeek(s: HmV2AdaptStep): number | null {
  if (s.restart) return null;
  return s.reduced === true ? s.fromWeek : null;
}

/**
 * A17: nedelje smanjenja koraka — (a) cilj koraka (targetReducedWeek) → fromWeek; (b) bol sa povratkom →
 * nedelja sidra r; (c) nov start se ne računa (rePeriodize gradi raspored od novog starta).
 */
export function reducedWeeks(s: HmV2AdaptStep): number[] {
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
export function framesFor(
  base: readonly WeekFrame[],
  pattern: Pattern,
  runDays: readonly Weekday[],
  raceDate: IsoDate,
  pace: PaceInput,
  steps: readonly HmV2AdaptStep[],
  dropped: Map<number, number> | null = null
): WeekFrame[] {
  let frames: WeekFrame[] = base.map((f) => ({ ...f }));
  if (steps.length === 0) return frames;
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
    const fn = frames[n - 1];
    if (s.deload && fn && isBuildPhase(fn.phase) && !fn.deload) {
      fn.deload = true;
      forced.add(n);
      const next = frames[n];
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
  steps: readonly HmV2AdaptStep[]
): Set<number> {
  return new Set(
    steps.filter((s) => s.restart && rePeriodize(base, s.fromWeek) !== null).map((s) => s.fromWeek)
  );
}

/** Okviri generatora (periodize) — ulaz za framesFor i validator. */
export const baseFrames = (startDate: IsoDate, weeks: number, test: boolean): WeekFrame[] | null =>
  periodize(startDate, weeks, test);

/**
 * Pouka 20: traka „Plan treba prilagoditi" samo za NOVO ograničenje — datumi poslednjeg koraka sa
 * ograničenjem (zabrana kvaliteta, jedan kvalitet, odmor, bol) kojih nema u ograničenjima prethodnih
 * koraka, i prinudno rasterećenje / nov start koga ranije nije bilo. Posledica drugog uslova (premeštanje
 * testa, ukinuto rasterećenje) nije ograničenje. Aplikacija (faza 2) čita ovo polje; prazno = bez trake.
 */
export function newLimits(steps: readonly HmV2AdaptStep[]): string[] {
  const last = steps[steps.length - 1];
  if (!last) return [];
  const prev = steps.slice(0, -1);
  const days = (s: HmV2AdaptStep, pick: (x: HmV2AdaptStep) => readonly (DateRange | null)[]) =>
    pick(s).flatMap((r) => {
      if (!r) return [];
      const out: string[] = [];
      for (let d = r.from; mustDay(d) <= mustDay(r.to); d = addDays(d, 1)) out.push(d);
      return out;
    });
  const kinds: [string, (x: HmV2AdaptStep) => readonly (DateRange | null)[]][] = [
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
  if (last.deload && !prev.some((s) => s.deload && s.fromWeek === last.fromWeek))
    out.push(`deload:${last.fromWeek}`);
  if (last.restart) out.push(`restart:${last.fromWeek}`);
  return out;
}

/** Pouka 34 (pouka 24): referenca umora pre starta (poslednji korak koji je nosi) ili null — JEDNO mesto čitanja
    za konstruktor (initialState), obim (volume.adaptVolume) i validator. */
export function preStartOf<T>(steps: readonly { preStart?: T }[]): T | null {
  let r: T | null = null;
  for (const s of steps) if (s.preStart) r = s.preStart;
  return r;
}

/** Pouka 28/34 (Faza 4a N10.3, oblik maratona): skorašnji najduži trk kao dugi „nedelje 0" kotrljajuće granice —
    iz ulaza, a posle umora pre starta i dugi reference (najveći). Konstruktor i validator (LONG_ROLLING); napomena i
    pouka 9 nedelje 1 (week1LongCap10, recentLongNote) čitaju samo ulaz. */
export function jumpRecentKm(
  recentLongRunKm: number | null | undefined,
  steps: readonly { preStart?: { longKm: number | null } }[]
): number | null {
  const r = recentLongRunKm ?? null;
  const ref = preStartOf(steps)?.longKm ?? null;
  return ref === null ? r : Math.max(r ?? 0, ref);
}

/** Pouka 34: početno stanje konstrukcije — bez umora pre starta prazno; sa njim referenca (nedelja 1 generatora):
    stanje doze, poslednji dugi i poslednja izgradnja [0,1 km]. Jedna funkcija za konstruktor i validator. */
export function initialState(steps: readonly HmV2AdaptStep[]): {
  quality: QualityState;
  lastLong10: number | null;
  lastBuild10: number | null;
} {
  const ref = preStartOf(steps);
  if (!ref) return { quality: INITIAL_QUALITY, lastLong10: null, lastBuild10: null };
  return {
    quality: advance({ q1: ref.q1, q2: ref.q2 }, INITIAL_QUALITY),
    lastLong10: ref.longKm === null ? null : Math.round(ref.longKm * 10),
    lastBuild10: Math.round(ref.targetKm * 10)
  };
}
