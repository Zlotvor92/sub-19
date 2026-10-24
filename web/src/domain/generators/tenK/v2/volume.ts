/* D6 — cilj obima svake nedelje (jedini vlasnik; rast i vrh iz pravila plana — početnik D28); D5/D7/D8
   faktori cilja rasterećenja, tapera i trkačke nedelje; D22 poruka kapaciteta. Rad u desetinkama km. Izvodljivost proverava STVARNA konstrukcija
   nedelje (week.ts), koju ovaj modul dobija kao funkciju — kapacitet nije formula. */

import { buildEasyBounds10, longShareCap10, longTimeCap10 } from './lengths.ts';
import { isBuildPhase } from './periodize.ts';
import { daysForKm, type PlanRule, TEN_K_V2_POLICY as P } from './policy.ts';
import { deloadWeekOf } from './steps.ts';
import type { Paces, PlanWeek, WeekFrame } from './types.ts';

const EPS = 1e-9;
export const to10 = (km: number): number => Math.round(km * 10);

/** D22: šta je seklo spuštenu nedelju izgradnje — dugi na 105 min ('time') i/ili na udelu D17 ('share'). */
export type CapacityLimit = 'time' | 'share' | 'easy';

/**
 * D22: poruka CAPACITY_LIMITED — imenuje stvarno ograničenje i preporučuje više dana samo za brojeve dana iz tabele
 * D17 (početnik: D28) čiji red podržava trenutni obim (policy.ts `daysForKm`, ista funkcija kao ulaz; 10K-07) — bez
 * takvog broja nema preporuke.
 */
export function capacityMessage(
  runDays: number,
  currentWeeklyKm: number,
  rule: PlanRule,
  limits: readonly CapacityLimit[]
): string {
  const min = `${Math.round(rule.longMaxSec / 60)} min`;
  const share = `${Math.round(rule.longMaxShare * 100)} % nedelje`;
  const long = limits.filter((l) => l !== 'easy');
  const dugi =
    long.length === 2
      ? `dugi ≤ ${min} i ≤ ${share}`
      : long[0] === 'time'
        ? `dugi ≤ ${min}`
        : long[0] === 'share'
          ? `dugi ≤ ${share}`
          : '';
  // T1 (10K-08): lagan ≤ 0,8 × dugi.
  const easy = limits.includes('easy')
    ? `lagan ≤ ${Math.round(P.lengths.easyMaxLongShare * 100)} % dugog`
    : '';
  const what = dugi || easy ? ` uz ${[dugi, easy].filter(Boolean).join(', ')}` : '';
  const more = daysForKm(currentWeeklyKm, rule.beginner ? 'beginner' : 'regular').filter(
    (n) => n > runDays
  );
  const advice = more.length === 0 ? '' : `; preporuka ${daysText(more)} dana`;
  return `${runDays} dana ne nose ovaj obim${what}${advice}.`;
}

const daysText = (ns: readonly number[]): string =>
  ns.length === 1 ? `${ns[0]}` : `${ns[0]}–${ns[ns.length - 1]}`;

/**
 * D25: preporuka manje dana — brojevi dana manji od `runDays` čiji red tabele D17 (početnik: tabele D28)
 * podržava trenutni obim (policy.ts `daysForKm`, sirov obim — ista funkcija kao ulaz; 10K-07); prazno kad ih nema.
 */
export function fewerDaysAdvice(runDays: number, currentWeeklyKm: number, rule: PlanRule): string {
  const fewer = daysForKm(currentWeeklyKm, rule.beginner ? 'beginner' : 'regular').filter(
    (n) => n < runDays
  );
  if (fewer.length === 0) return '';
  return `; preporuka ${daysText(fewer)} dana (plan sa manje dana podržava obim ${String(currentWeeklyKm).replace('.', ',')} km, dugi dobija veći udeo)`;
}

/** D22: ograničenja spuštenih (fitted 'down') ne-rasteretnih nedelja izgradnje: dugi = plafon 105 min
    (početnik 90 min) sporim E → 'time'; dugi = udeo cilja (D17) → 'share'. */
export function capacityLimits(
  weeks: readonly PlanWeek[],
  rule: PlanRule,
  p: Paces
): CapacityLimit[] {
  let time = false;
  let share = false;
  let easy = false;
  for (const w of weeks) {
    if (!isBuildPhase(w.phase) || w.deload || w.fitted !== 'down') continue;
    const long = w.days.find((d) => d.role === 'long');
    if (!long) continue;
    const l10 = to10(long.workout.km);
    if (l10 === longTimeCap10(p, rule.longMaxSec)) time = true;
    if (l10 === longShareCap10(to10(w.targetKm), rule.longMaxShare)) share = true;
    // T1 (10K-08): lagan na gornjoj granici 0,8 × dugi (lengths.buildEasyBounds10).
    const max10 = buildEasyBounds10(l10, p).max10;
    if (w.days.some((d) => d.role === 'easy' && to10(d.workout.km) === max10)) easy = true;
  }
  return [
    ...(time ? ['time' as const] : []),
    ...(share ? ['share' as const] : []),
    ...(easy ? ['easy' as const] : [])
  ];
}

/** Trenutni obim = cilj nedelje 1 [0,1 km]. */
export function startKm10(currentWeeklyKm: number): number {
  return to10(currentWeeklyKm);
}

/** D6: granica izgradnje min(start × 1,4; start + 15; max nedelje D17) [0,1 km] — početnik 1,3× / +10
    (D28); kapacitet konstrukcije je posebno. */
export function peakCap10(start10: number, rule: PlanRule): number {
  return Math.min(
    Math.floor(start10 * rule.peakFactor + EPS),
    start10 + to10(rule.peakAddKm),
    to10(rule.peakMaxKm)
  );
}

/** D6: +6 % poslednjeg ne-rasteretnog cilja (min 1,0, max 3,0 km; korak 0,1) — početnik +5 % (min 1,0,
    max 2,0 km, D28). */
export function growth10(last10: number, rule: PlanRule): number {
  return Math.min(
    to10(rule.growthMaxKm),
    Math.max(to10(rule.growthMinKm), Math.round(last10 * rule.growth))
  );
}

export interface VolumeHistory {
  /** Cilj poslednje ne-rasteretne nedelje izgradnje (stvarno dobijen). */
  lastBuild10: number | null;
  /** Najveći cilj izgradnje do sada (vrh). */
  peak10: number;
}

/** Cilj po pravilu (pre provere izvodljivosti). Trkačka nedelja: cilj = planirano (raceWeekTarget). */
export function nominal10(
  frame: WeekFrame,
  hist: VolumeHistory,
  start10: number,
  cap10: number,
  rule: PlanRule
): number {
  if (frame.phase === 'taper') return Math.round(P.taper.factor * hist.peak10);
  if (hist.lastBuild10 === null) return start10;
  if (frame.deload) return Math.round(P.deload.factor * hist.lastBuild10);
  return Math.min(hist.lastBuild10 + growth10(hist.lastBuild10, rule), cap10);
}

/** D8: cilj trkačke nedelje = planirano (trka se ne računa). */
export function raceWeekTarget10(planned100: number): number {
  return Math.round(planned100 / 10);
}

/**
 * D6: nominalni cilj ako ga konstrukcija ispunjava; inače SAMO ova nedelja na najbliži izvodljiv cilj
 * (pri jednakoj udaljenosti niži). Izgradnja sme naviše do granice izgradnje; rasterećenje i taper samo
 * naniže (smanjenje ne sme da poraste) — osim rasterećenja sa testom (D27, odstupanje): naviše najviše do
 * ispod poslednjeg cilja izgradnje `lastBuild10` (i dalje smanjenje). Donja granica je najmanji smislen
 * obim (D15, po broju dana D17). A8 (`downOnly`): cilj adaptacije i povratni rast samo naniže.
 */
export function fit10(
  nominal: number,
  frame: WeekFrame,
  cap10: number,
  rule: PlanRule,
  feasible: (target10: number) => boolean,
  lastBuild10: number | null = null,
  downOnly = false
): { target10: number; fitted: 'down' | 'up' | null } | null {
  if (feasible(nominal)) return { target10: nominal, fitted: null };
  const lo = to10(rule.weekMinKm);
  const hi = downOnly
    ? nominal
    : frame.deload && frame.test && lastBuild10 !== null
      ? lastBuild10 - 1
      : frame.deload || frame.phase === 'taper'
        ? nominal
        : cap10;
  for (let d = 1; nominal - d >= lo || nominal + d <= hi; d++) {
    if (nominal - d >= lo && feasible(nominal - d))
      return { target10: nominal - d, fitted: 'down' };
    if (nominal + d <= hi && feasible(nominal + d)) return { target10: nominal + d, fitted: 'up' };
  }
  return null;
}

/* ---------- Segment 04: obim adaptiranog plana (A2, A3, A4, A8, A9) — jedino mesto ---------- */

/** Deo koraka adaptacije koji određuje obim (TenKV2AdaptStep iz types.ts). */
export interface VolumeStep {
  firstWeek: number;
  fromWeek: number;
  startKm: number | null;
  pauseRemainder: boolean;
  restart: boolean;
  levelKm: number | null;
  returnFrom: { week: number; share: number } | null;
  /** A5 (10k-v2.5.2): umor pre starta — referenca prinudnog rasterećenja nedelje 1 (steps.deloadWeekOf). */
  preStart?: { buildKm: number };
  /** Pouka 36 (10k-v2.6.0): nedelja prinudnog rasterećenja iz zapisa umora (asOf u njoj: < fromWeek). */
  deloadWeek?: number;
}

/** Pravila obima iz koraka po nedelji (konstruktor i validator čitaju isto). */
export interface AdaptVolume {
  /** Prva nedelja pod koracima: od nje važi donja granica A9. */
  first: number;
  /** Prva nedelja posle smanjenja obima (cilj koraka; pauza: ostatak tekuće nedelje; sidro bola): od nje
      važe odstupanja A9 za mali obim (test koji ne staje, dugi rasterećenja); Infinity = bez smanjenja. */
  reducedFrom: number;
  /** Cilj koraka u nedelji fromWeek [0,1 km] (poslednji korak za tu nedelju). */
  reset: Map<number, number>;
  /** A3: ostatak tekuće nedelje posle pauze — firstWeek → granica [0,1 km]. */
  remainder: Map<number, number>;
  /** A3: nov start — nedelja → start [0,1 km] (granica izgradnje D6 od nje). */
  restart: Map<number, number>;
  /** A4 (10k-v2.4.1): nedelja sidra r (sadrži asOf + 1) → osnova povratka pre min sa ciljem nedelje r:
      `base10` = round(udeo × nivo pre bola) [0,1 km]; null = nivo nepoznat (stariji korak) → udeo × cilj r. */
  anchors: Map<number, ReturnAnchor>;
  /** A8: nivo pre smanjenja koji važi u nedelji w (najveći nivo koraka sa fromWeek ≤ w) [0,1 km]. */
  levelAt: (w: number) => number | null;
  /** A5 (10k-v2.5.2, pouka 34): umor pre starta — nedelja prinudnog rasterećenja → cilj nedelje 1 generatora
      bez činjenica [0,1 km] (poslednja izgradnja; nema prethodne u planu). */
  preStart: Map<number, number>;
}

/** A4: osnova povratka posle nedelje sidra (udeo i nivo koraka). */
export interface ReturnAnchor {
  share: number;
  base10: number | null;
}

/** A4/A8: osnova povratka posle nedelje sidra sa ciljem `target10` [0,1 km] — min(round(udeo × nivo pre
    bola), cilj nedelje sidra); nivo nepoznat → round(udeo × cilj nedelje sidra) (10k-v2.4.0). */
export function returnBase10(a: ReturnAnchor, target10: number): number {
  return a.base10 === null ? Math.round(a.share * target10) : Math.min(a.base10, target10);
}

/** A4: sidro koraka sa povratkom (osnova iz udela i nivoa koraka, A8: najveći nivo koraka). */
export const returnAnchor = (share: number, levelKm: number | null): ReturnAnchor => ({
  share,
  base10: levelKm === null ? null : Math.round(share * to10(levelKm))
});

export function adaptVolume(steps: readonly VolumeStep[]): AdaptVolume {
  const reset = new Map<number, number>();
  const remainder = new Map<number, number>();
  const restart = new Map<number, number>();
  const anchors = new Map<number, ReturnAnchor>();
  const preStart = new Map<number, number>();
  for (const s of steps) {
    // 10k-v2.6.2 (pouka 23): referenca važi za nedelju rasterećenja (asOf = start: ned 1 < fromWeek 2).
    if (s.preStart) preStart.set(deloadWeekOf(s), to10(s.preStart.buildKm));
    if (s.startKm !== null) {
      reset.set(s.fromWeek, to10(s.startKm));
      if (s.restart) restart.set(s.fromWeek, to10(s.startKm));
      if (s.pauseRemainder && s.firstWeek < s.fromWeek) remainder.set(s.firstWeek, to10(s.startKm));
    }
    if (s.returnFrom) anchors.set(s.returnFrom.week, returnAnchor(s.returnFrom.share, s.levelKm));
  }
  const reducedFrom = Math.min(
    ...steps
      .filter((s) => s.startKm !== null || s.returnFrom !== null)
      .map((s) => (s.pauseRemainder ? s.firstWeek : s.fromWeek))
  );
  return {
    first: Math.min(...steps.map((s) => s.firstWeek)),
    reducedFrom,
    reset,
    remainder,
    restart,
    anchors,
    preStart,
    levelAt: (w) => {
      let level: number | null = null;
      for (const s of steps)
        if (s.fromWeek <= w && s.levelKm !== null) level = Math.max(level ?? 0, to10(s.levelKm));
      return level;
    }
  };
}

/** A8: korak povratnog rasta +10 % (min 1,0 km) [0,1 km]. */
export function returnGrowth10(last10: number): number {
  const a = P.adapt;
  return Math.max(to10(a.returnGrowthMinKm), Math.round(last10 * a.returnGrowth));
}

/** A8: cilj nedelje izgradnje posle `last10` — redovno D6 (do granice `cap10`; iznad granice drži) ili,
    dok je ispod nivoa pre smanjenja, povratni rast do nivoa (i iznad granice novog starta, A3) — veće od
    dva (povratak ne usporava D6). */
export function nextBuild10(
  last10: number,
  cap10: number,
  rule: PlanRule,
  level10: number | null
): number {
  const normal = Math.min(last10 + growth10(last10, rule), Math.max(cap10, last10));
  if (level10 === null || last10 >= level10) return normal;
  return Math.max(normal, Math.min(last10 + returnGrowth10(last10), level10));
}

/** Stanje obima adaptiranog plana kroz nedelje (konstruktor i validator ga vode istim redom). */
export interface AdaptHistory extends VolumeHistory {
  /** Granica izgradnje (D6; od novog starta, A3). */
  cap10: number;
  /** A8: najveći cilj izgradnje posle poslednjeg smanjenja (osnov tapera). */
  peakRef10: number;
  /** Korak čija je sledeća nedelja taper: taper ≤ cilj koraka. */
  tailCap10: number | null;
}

export const initialAdaptHistory = (cap10: number): AdaptHistory => ({
  lastBuild10: null,
  peak10: 0,
  cap10,
  peakRef10: 0,
  tailCap10: null
});

/** Pre nedelje `frame`: nov start (granica izgradnje), početak nove osnove vrha (smanjenje u izgradnji). */
export function enterWeek(
  h: AdaptHistory,
  frame: WeekFrame,
  av: AdaptVolume,
  rule: PlanRule
): AdaptHistory {
  const i = frame.index;
  const out = { ...h };
  const r = av.restart.get(i);
  if (r !== undefined) out.cap10 = peakCap10(r, rule);
  const reset = av.reset.get(i);
  if (reset !== undefined) {
    if (isBuildPhase(frame.phase)) [out.peakRef10, out.tailCap10] = [0, null];
    else if (frame.phase === 'taper') out.tailCap10 = reset;
  } else if (av.anchors.has(i - 1) && isBuildPhase(frame.phase))
    [out.peakRef10, out.tailCap10] = [0, null];
  return out;
}

/**
 * A8/A9: cilj po pravilu adaptirane nedelje — isti rekurent kao nominal10 (D6) uz korake: cilj koraka u
 * nedelji fromWeek (i kad je rasteretna), ostatak tekuće nedelje ≤ cilj pauze, rast nextBuild10,
 * rasterećenje 0,8 × poslednja ne-rasteretna (umor pre starta, A5 10k-v2.5.2: 0,8 × cilj nedelje 1 generatora;
 * sledeća nedelja bez prethodne izgradnje = start, tj. cilj planirane nedelje 1 bez rasta), taper 0,75 × vrh posle poslednjeg smanjenja (≤ cilj
 * koraka u taperu); od prve nedelje pod koracima ne ispod minimuma nedelje (D17). `downOnly` = izvodljiv
 * cilj samo naniže (cilj koraka, ostatak, povratak, donja granica). Bez dejstva koraka = nominal10.
 */
export function adaptNominal10(
  frame: WeekFrame,
  h: AdaptHistory,
  start10: number,
  rule: PlanRule,
  av: AdaptVolume
): { nominal: number; downOnly: boolean } {
  const i = frame.index;
  let t: number;
  let downOnly = false;
  const reset = av.reset.get(i);
  if (frame.phase === 'taper') {
    t = Math.round(P.taper.factor * h.peakRef10);
    if (h.tailCap10 !== null && h.tailCap10 < t) [t, downOnly] = [h.tailCap10, true];
  } else if (reset !== undefined) [t, downOnly] = [reset, true];
  else if (frame.deload && h.lastBuild10 === null && av.preStart.has(i))
    t = Math.round(P.deload.factor * av.preStart.get(i)!);
  // A5 (10k-v2.5.2): posle prinudnog rasterećenja pre starta — cilj planirane nedelje 1 (bez rasta).
  else if (h.lastBuild10 === null) t = av.preStart.get(i - 1) ?? start10;
  else if (frame.deload) t = Math.round(P.deload.factor * h.lastBuild10);
  else {
    const level = av.levelAt(i);
    t = nextBuild10(h.lastBuild10, h.cap10, rule, level);
    downOnly = level !== null && h.lastBuild10 < level;
  }
  const rem = av.remainder.get(i);
  if (rem !== undefined && rem < t) [t, downOnly] = [rem, true];
  const floor = to10(rule.weekMinKm);
  if (i >= av.first && t < floor) [t, downOnly] = [floor, true];
  return { nominal: t, downOnly };
}

/** Posle nedelje `frame` sa ciljem `target10`: osnov rasta (ne-rasteretna izgradnja; cilj koraka i kad
    je rasteretna, A8), vrh, sidro bola (A4, 10k-v2.4.1: osnova povratka returnBase10 — min(0,7 × nivo pre
    bola, cilj nedelje sidra)). */
export function leaveWeek(
  h: AdaptHistory,
  frame: WeekFrame,
  target10: number,
  av: AdaptVolume
): AdaptHistory {
  const out = { ...h };
  if (!isBuildPhase(frame.phase)) return out;
  const i = frame.index;
  if (!frame.deload || av.reset.has(i)) {
    out.lastBuild10 = target10;
    out.peakRef10 = Math.max(out.peakRef10, target10);
  }
  if (!frame.deload) out.peak10 = Math.max(out.peak10, target10);
  const anchor = av.anchors.get(i);
  if (anchor !== undefined) out.lastBuild10 = returnBase10(anchor, target10);
  return out;
}
