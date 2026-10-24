/* Segment 04: koraci adaptacije (MarathonV2AdaptStep, izvedeni u assess.ts) → okviri nedelja (faze, rasterećenja i
   A17, test, ograničenja po datumima) i tempo po nedelji. JEDNO mesto odluke okvira (pouka 24): koriste ga
   konstruktor (generate.construct), adapt.ts (poruke) i validator; bez koraka sve je kao u generatoru. Kopija
   obrasca tenK/v2/steps.ts (ne uvoz). */

import { addDays, mustDay, weekdayOf } from './dates.ts';
import type { PaceInput } from './input.ts';
import { feelPaces, pacesFromVdot } from './paces.ts';
import { isBuildPhase, periodize, rePeriodize } from './periodize.ts';
import { MARATHON_V2_POLICY as P } from './policy.ts';
import { deloadSlot } from './quality.ts';
import type {
  DateRange,
  IsoDate,
  MarathonV2AdaptStep,
  PaceBasis,
  Paces,
  Pattern,
  PreStartRef,
  WeekFrame,
  WeekLimits,
  Weekday
} from './types.ts';

export const inRange = (d: IsoDate, r: DateRange | null): boolean =>
  r !== null && mustDay(d) >= mustDay(r.from) && mustDay(d) <= mustDay(r.to);

/** Pouka 36: nedelja prinudnog rasterećenja koraka (A5) — iz zapisa umora (`deloadWeek`), inače fromWeek. JEDNO
    mesto čitanja za okvire (framesFor), obim (volume.adaptVolume), traku (newLimits) i validator. */
export const deloadWeekOf = (s: { fromWeek: number; deloadWeek?: number }): number =>
  s.deloadWeek ?? s.fromWeek;

/** Datum dana `wd` u nedelji okvira. */
export function dateIn(f: { startDate: IsoDate }, wd: Weekday): IsoDate {
  for (let i = 0; i < 7; i++) {
    const d = addDays(f.startDate, i);
    if (weekdayOf(d) === wd) return d;
  }
  throw new Error(`Dan ${wd} nije u nedelji ${f.startDate}.`);
}

/** Tempo iz ulaza (isto kao generator: rezultat M2 ili plan po osećaju M16). */
export const basePaces = (pace: PaceInput, currentWeeklyKm: number): Paces =>
  pace.kind === 'feel'
    ? feelPaces(pace.easySecPerKm, currentWeeklyKm).paces
    : pacesFromVdot(pace.vdotRaw, currentWeeklyKm);

/** Pouka 34 (MAR-04b): referenca umora pre starta (poslednji korak koji je nosi) ili null. JEDNO mesto čitanja za
    konstruktor (stanje pre nedelje 1), obim (volume.adaptVolume) i validator. */
export function preStartOf(steps: readonly { preStart?: PreStartRef }[]): PreStartRef | null {
  let r: PreStartRef | null = null;
  for (const s of steps) if (s.preStart) r = s.preStart;
  return r;
}

/** Pouka 34 + MAR-08b (K3): početno stanje dugog i T doze (pre nedelje 1) — referenca umora pre starta ili referenca
    rasterećenja bez prethodne nedelje sa dugim (deloadRef). JEDNO mesto za konstruktor i validator. */
export function stateRefOf(
  steps: readonly { preStart?: PreStartRef; deloadRef?: PreStartRef }[]
): PreStartRef | null {
  let r: PreStartRef | null = preStartOf(steps);
  if (r) return r;
  for (const s of steps) if (s.deloadRef) r = s.deloadRef;
  return r;
}

/** M13a (pouka 34): skorašnji najduži trk kao dugi „nedelje 0" — iz ulaza, a posle umora pre starta i dugi
    reference (najveći); konstruktor i validator (plafon skoka). Napomene nedelje 1 (M13a) čitaju samo ulaz. */
export function jumpRecentKm(
  recentLongRunKm: number | null | undefined,
  steps: readonly { preStart?: PreStartRef }[]
): number | null {
  const r = recentLongRunKm ?? null;
  const pre = preStartOf(steps);
  return pre === null ? r : Math.max(r ?? 0, pre.longKm);
}

/** A1: VDOT poslednjeg koraka sa rezultatom čiji je fromWeek ≤ w; null = tempo iz ulaza. */
export function stepVdotAt(steps: readonly MarathonV2AdaptStep[], w: number): number | null {
  let v: number | null = null;
  for (const s of steps) if (s.vdot !== null && s.fromWeek <= w) v = s.vdot;
  return v;
}

/** A1 (pouka 16): tempo nedelje w — posle rezultata VDOT koraka, MP po korekciji obima M2 (pacesFromVdot). */
export function pacesAt(
  pace: PaceInput,
  steps: readonly MarathonV2AdaptStep[],
  w: number,
  currentWeeklyKm: number
): Paces {
  const v = stepVdotAt(steps, w);
  return v === null ? basePaces(pace, currentWeeklyKm) : pacesFromVdot(v, currentWeeklyKm);
}

/** A1 (pouka 17): osnova tempa nedelje w (plan po osećaju prelazi na rezultat od nedelje rezultata). */
export function basisAt(
  pace: PaceInput,
  steps: readonly MarathonV2AdaptStep[],
  w: number
): PaceBasis {
  return stepVdotAt(steps, w) !== null ? 'result' : pace.kind;
}

/** Dan testa (M16): dan Q1, u rasterećenju dan T slota. */
export function testDateOf(f: WeekFrame, pattern: Pattern): IsoDate {
  const slot = deloadSlot(pattern.q2 ? 2 : 1);
  return dateIn(f, f.deload && slot === 'q2' ? pattern.q2! : pattern.q1);
}

const withoutTest = (f: WeekFrame): WeekFrame => {
  const { test: _test, ...rest } = f;
  return rest;
};

/**
 * Ograničenja nedelje iz datumskih opsega svih koraka (jedino mesto prevođenja datuma u nedelju, A3/A4): zabrana
 * kvaliteta = noQuality ∪ bol ∪ odmor; nijedan dan kvaliteta šablona van zabrane → 'none'; deo dana kvaliteta u
 * zabrani, dan kvaliteta u oneQuality ili nedelja sa danom bola/odmora → 'one'. Trkačka nedelja: samo dani. Bez
 * ograničenja → undefined.
 */
export function limitsOf(
  f: WeekFrame,
  pattern: Pattern,
  runDays: readonly Weekday[],
  raceDate: IsoDate,
  steps: readonly MarathonV2AdaptStep[]
): WeekLimits | undefined {
  if (steps.length === 0) return undefined;
  const dates = runDays.map((w) => dateIn(f, w)).filter((d) => d !== raceDate);
  const any = (
    d: IsoDate,
    pick: (s: MarathonV2AdaptStep) => readonly (DateRange | null)[]
  ): boolean => steps.some((s) => pick(s).some((r) => inRange(d, r)));
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

/** A3: nedelje novog starta (početak nove progresije doze, M12; granica izgradnje M6 od novog starta). */
export const restartWeeks = (steps: readonly MarathonV2AdaptStep[]): Set<number> =>
  new Set(steps.filter((s) => s.restart).map((s) => s.fromWeek));

/** Pouka 18 (MAR-11, T6 C6; kao HM): nedelje od kojih progresija doze kreće ispočetka (M12) — nov start (A3) i
    nedelja posle sidra povratka bola (r + 1). JEDNA funkcija za konstruktor (generate.ts) i validator. */
export const doseRestartWeeks = (steps: readonly MarathonV2AdaptStep[]): Set<number> =>
  new Set(
    steps.flatMap((s) => [
      ...(s.restart ? [s.fromWeek] : []),
      ...(s.returnFrom ? [s.returnFrom.week + 1] : [])
    ])
  );

/** A17 (pouka 22): najviše uzastopnih nedelja izgradnje od ukinutog rasterećenja (uključujući ukinutu nedelju)
    do sledećeg redovnog rasterećenja — izuzetak M5 4 + ukinuta nedelja. framesFor i validator (M5). */
export const A17_MAX_RUN = P.deload.exceptionRun + 1;

/** A17 (a): nedelja smanjenja iz cilja koraka — reduced (A2/A3 true; A6 false). null = korak nema cilj
    smanjenja. */
export function targetReducedWeek(s: MarathonV2AdaptStep): number | null {
  if (s.restart) return null;
  return s.reduced === true ? s.fromWeek : null;
}

/**
 * A17: nedelje smanjenja koraka — (a) cilj koraka (targetReducedWeek) → fromWeek; (b) bol sa povratkom → nedelja
 * sidra r; (c) nov start se ne računa (rePeriodize gradi raspored od novog starta).
 */
export function reducedWeeks(s: MarathonV2AdaptStep): number[] {
  if (s.restart) return [];
  const a = targetReducedWeek(s);
  const out = a === null ? [] : [a];
  if (s.returnFrom !== null && !out.includes(s.returnFrom.week)) out.push(s.returnFrom.week);
  return out;
}

/**
 * Okviri nedelja posle koraka (redom): nov start → rePeriodize od fromWeek (A12; nema rasporeda po M5 → faze
 * ostaju, odstupanje A3); umor → fromWeek je rasterećenje (samo izgradnja; redovno rasterećenje odmah posle se
 * ukida, A5); A17: redovno rasterećenje odmah posle nedelje smanjenja (reducedWeeks) se ukida — prinudno nikad, a
 * ni kad bi od ukinute nedelje do sledećeg rasterećenja bilo više od A17_MAX_RUN nedelja izgradnje; novi rezultat
 * → nema testa posle asOf (A13); ograničenja po datumima (limitsOf). A13: test posle poslednjeg asOf u nedelji sa
 * ograničenjem kvaliteta, prinudnim rasterećenjem ili van izgradnje → prva sledeća ne-rasteretna nedelja izgradnje
 * bez ograničenja dok je plan po osećaju; nema je → bez testa. `dropped` (izlaz, A17): ukinuta rasterećenja —
 * nedelja → indeks koraka (isti podatak za validator M5 i poruku koraka, adapt.ts).
 */
export function framesFor(
  base: readonly WeekFrame[],
  pattern: Pattern,
  runDays: readonly Weekday[],
  raceDate: IsoDate,
  pace: PaceInput,
  steps: readonly MarathonV2AdaptStep[],
  dropped: Map<number, number> | null = null,
  kept: ReadonlySet<string> = new Set()
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
      if (re) for (const w of [...forced]) if (w >= n) forced.delete(w);
      if (re && dropped) for (const w of [...dropped.keys()]) if (w >= n) dropped.delete(w);
    }
    const dw = deloadWeekOf(s);
    const fn = frames[dw - 1];
    if (s.deload && fn && isBuildPhase(fn.phase) && !fn.deload) {
      fn.deload = true;
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
  // MAR-07c (pouke 23, 36): dan testa plana pre ovog koraka ≤ asOf → test je zaštićen (upisan); rasterećenje koje
  // ovaj korak stavi na nedelju testa pomera dan testa okvira (Q1 → T slot) posle asOf, a to bi bio drugi test.
  // Okvir tada nema test; nema ni premeštanja.
  // MAR-11 (C3, pouka 38): okviri pre ovog koraka sa istim zaštićenim danima — zaštićen test iz ranijeg koraka se
  // ni tamo ne premešta (inače ponovljen korak vidi premešten test kao drugi).
  const before = framesFor(base, pattern, runDays, raceDate, pace, steps.slice(0, -1), null, kept);
  const tw = before.find((f) => f.test);
  if (tw && mustDay(testDateOf(tw, pattern)) <= mustDay(last))
    frames = frames.map((f) =>
      f.test && mustDay(testDateOf(f, pattern)) > mustDay(last) ? withoutTest(f) : f
    );
  // MAR-08b (pouka 38): test čiji je dan zaključan ili urađen (posle asOf) je takođe zaštićen — ostaje gde jeste
  // (upisan, A11), ne premešta se (pauza, umor, bol, rasterećenje — A13) i nijedan okvir nema drugi test.
  else if (tw && kept.has(testDateOf(tw, pattern))) {
    // Zaključan dan testa nosi test sam (spajanje A11), bez premeštanja. Okvir koji i dalje ima test na tom danu
    // ostaje kakav jeste; inače (rasterećenje bi dan testa okvira pomerilo na T slot, pa bi to bio drugi test,
    // ili pravilo premeštanja) nijedan okvir nema test.
    const cur = frames.filter((f) => f.test);
    if (
      cur.length === 1 &&
      cur[0]!.index === tw.index &&
      testDateOf(cur[0]!, pattern) === testDateOf(tw, pattern)
    )
      return frames;
    return frames.map((f) => (f.test ? withoutTest(f) : f));
  }
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

/** A3: nedelje novog starta u kojima je rePeriodize primenjen (M5 ima raspored preostale izgradnje). */
export function appliedRestarts(
  base: readonly WeekFrame[],
  steps: readonly MarathonV2AdaptStep[]
): Set<number> {
  return new Set(
    steps.filter((s) => s.restart && rePeriodize(base, s.fromWeek) !== null).map((s) => s.fromWeek)
  );
}

/** Okviri generatora (periodize) — ulaz za framesFor i validator. */
export const baseFrames = (startDate: IsoDate, weeks: number, test: boolean): WeekFrame[] | null =>
  periodize(startDate, weeks, test);

/**
 * Pouka 20: traka „Plan treba prilagoditi" samo za NOVO ograničenje — datumi poslednjeg koraka sa ograničenjem
 * (zabrana kvaliteta, jedan kvalitet, odmor, bol) kojih nema u ograničenjima prethodnih koraka, i prinudno
 * rasterećenje / nov start koga ranije nije bilo. Posledica drugog uslova (premeštanje testa, ukinuto rasterećenje)
 * nije ograničenje. Čita ga adaptBanner (adapt.ts); prazno = bez trake. Kopija HM v2 steps.newLimits (ne uvoz).
 */
export function newLimits(steps: readonly MarathonV2AdaptStep[]): string[] {
  const last = steps[steps.length - 1];
  if (!last) return [];
  const prev = steps.slice(0, -1);
  const days = (
    s: MarathonV2AdaptStep,
    pick: (x: MarathonV2AdaptStep) => readonly (DateRange | null)[]
  ) =>
    pick(s).flatMap((r) => {
      if (!r) return [];
      const out: string[] = [];
      for (let d = r.from; mustDay(d) <= mustDay(r.to); d = addDays(d, 1)) out.push(d);
      return out;
    });
  const kinds: [string, (x: MarathonV2AdaptStep) => readonly (DateRange | null)[]][] = [
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
