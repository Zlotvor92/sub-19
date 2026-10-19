/* M6 — cilj obima svake nedelje (jedini vlasnik); M5/M7/M8 faktori cilja rasterećenja, tapera i trkačke
   nedelje; poruka kapaciteta. Rad u desetinkama km. Izvodljivost proverava STVARNA konstrukcija nedelje
   (week.ts), koju ovaj modul dobija kao funkciju — kapacitet nije formula (pouke 1 i 9). */

import { longCap10, longJumpCap10, longShareCap10, longTimeCap10 } from './lengths.ts';
import { isBuildPhase } from './periodize.ts';
import {
  BEGINNER_DAYS_COUNTS,
  type DayRule,
  MARATHON_V2_POLICY as P,
  type PlanRule,
  RUN_DAYS_COUNTS
} from './policy.ts';
import { deloadWeekOf, preStartOf } from './steps.ts';
import type { Paces, PlanWeek, PreStartRef, WeekFrame } from './types.ts';
import { fmtKm } from './workouts.ts';

const EPS = 1e-9;
export const to10 = (km: number): number => Math.round(km * 10);

/** Šta je seklo spuštenu nedelju izgradnje — dugi na 150 min ('time') i/ili na udelu M15 ('share'). */
export type CapacityLimit = 'time' | 'share';

/** M6: poruka CAPACITY_LIMITED — imenuje stvarno ograničenje; preporučuje više dana samo kad veći broj
    dana postoji u tabeli M15 (početnik: M17) (6 dana, početnik 5 → bez preporuke dana; preporuka kraće
    distance nije deo ove poruke). */
export function capacityMessage(
  runDays: number,
  rule: PlanRule,
  limits: readonly CapacityLimit[]
): string {
  const min = `${Math.round(P.lengths.longMaxSec / 60)} min`;
  const share = `${Math.round(rule.longMaxShare * 100)} % nedelje`;
  const what =
    limits.length === 2
      ? ` uz dugi ≤ ${min} i ≤ ${share}`
      : limits[0] === 'time'
        ? ` uz dugi ≤ ${min}`
        : limits[0] === 'share'
          ? ` uz dugi ≤ ${share}`
          : '';
  const more = (rule.beginner ? BEGINNER_DAYS_COUNTS : RUN_DAYS_COUNTS).filter((n) => n > runDays);
  const advice =
    more.length === 0
      ? ''
      : `; preporuka ${more.length === 1 ? more[0] : `${more[0]}–${more[more.length - 1]}`} dana`;
  return `${runDays} dana ne nose ovaj obim${what}${advice}.`;
}

/** Pouka 14 (N10.5, kao HM HI3): preporuka manje dana — brojevi dana manji od `runDays` čiji red tabele M15
    (početnik: tabela M17) podržava trenutni obim; prazno kad ih nema. */
export function fewerDaysAdvice(runDays: number, currentWeeklyKm: number, rule: PlanRule): string {
  const km10 = to10(currentWeeklyKm);
  const row = (n: number): { kmMin: number; kmMax: number } =>
    rule.beginner
      ? P.beginner.days[n as keyof typeof P.beginner.days]
      : P.days[n as keyof typeof P.days];
  const fewer = (rule.beginner ? BEGINNER_DAYS_COUNTS : RUN_DAYS_COUNTS).filter(
    (n) => n < runDays && to10(row(n).kmMin) <= km10 && km10 <= to10(row(n).kmMax)
  );
  if (fewer.length === 0) return '';
  const days = fewer.length === 1 ? `${fewer[0]}` : `${fewer[0]}–${fewer[fewer.length - 1]}`;
  return `; preporuka ${days} dana (red sa manje dana podržava obim ${currentWeeklyKm} km, dugi dobija veći udeo)`;
}

/** M6 (N11): napomena nedelje „Cilj po pravilu … nije izvodljiv u konstrukciji nedelje" je tehnička (validator je
    čita uz oznaku `fitted`), ne ide korisniku. Domen odlučuje, aplikacija samo prikazuje (app/plan.ts). */
export function fittedNote(nominal10: number, target10: number): string {
  return `Cilj po pravilu ${fmtKm(nominal10 / 10)} km nije izvodljiv u konstrukciji nedelje; nedelja ide na najbliži izvodljiv cilj ${fmtKm(target10 / 10)} km (M6).`;
}

/** N11: napomena nedelje koja ne ide korisniku (tehnička; fittedNote). */
export const technicalNote = (note: string): boolean =>
  note.startsWith('Cilj po pravilu ') && note.includes('nije izvodljiv u konstrukciji nedelje');

/** Spuštene (fitted 'down') ne-rasteretne nedelje izgradnje koje seče kapacitet broja dana. Nedelja čiji je
    dugi na plafonu skoka M13a (niži od plafona M13) nije ograničenje kapaciteta (pouka 28). Jedna funkcija za
    konstruktor i validator (pouka 24). */
export function capacityWeeks(
  weeks: readonly PlanWeek[],
  rule: DayRule,
  p: Paces,
  recentLongRunKm: number | null | undefined
): PlanWeek[] {
  const longs10 = weeks.map((w) => {
    const l = w.days.find((d) => d.role === 'long');
    return l ? to10(l.workout.km) : null;
  });
  return weeks.filter((w, i) => {
    if (!isBuildPhase(w.phase) || w.deload || w.fitted !== 'down') return false;
    const jump = longJumpCap10(longs10.slice(0, i), w.index, recentLongRunKm);
    const l = longs10[i];
    return !(jump !== null && l === jump && jump < longCap10(to10(w.targetKm), rule, p));
  });
}

/** Ograničenja nedelja kapaciteta (capacityWeeks): dugi = plafon 150 min sporim E → 'time'; dugi = udeo
    cilja (M15) → 'share'. */
export function capacityLimits(
  weeks: readonly PlanWeek[],
  rule: DayRule,
  p: Paces,
  recentLongRunKm: number | null | undefined
): CapacityLimit[] {
  let time = false;
  let share = false;
  for (const w of capacityWeeks(weeks, rule, p, recentLongRunKm)) {
    const long = w.days.find((d) => d.role === 'long');
    if (!long) continue;
    const l10 = to10(long.workout.km);
    if (l10 === longTimeCap10(p)) time = true;
    if (l10 === longShareCap10(to10(w.targetKm), rule)) share = true;
  }
  return [...(time ? ['time' as const] : []), ...(share ? ['share' as const] : [])];
}

/** M15 (Uslov 8, pouka 24): minimum nedelje [0,1 km] — JEDNA definicija za pretragu cilja (fit10), donju granicu
    adaptacije (adaptNominal10, A9) i validator (TARGET_FLOOR, WEEK_MIN_VOLUME); poređenje uvek u 0,1 km. */
export function weekMin10(rule: DayRule): number {
  return to10(rule.weekMinKm);
}

/** Trenutni obim = cilj nedelje 1 [0,1 km]. */
export function startKm10(currentWeeklyKm: number): number {
  return to10(currentWeeklyKm);
}

/** M6: granica izgradnje min(start × 1,5; start + 30; max nedelje M15) [0,1 km] (početnik M17: 1,5× / +25);
    kapacitet je posebno. */
export function peakCap10(start10: number, rule: PlanRule): number {
  return Math.min(
    Math.floor(start10 * rule.peakFactor + EPS),
    start10 + to10(rule.peakAddKm),
    to10(rule.peakMaxKm)
  );
}

/** M6: +6 % poslednjeg ne-rasteretnog cilja (min 1,0, max 5,0 km; korak 0,1); početnik M17: +5 % (1,0–2,5). */
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

/** Cilj po pravilu (pre provere izvodljivosti). `taper` = redni broj nedelje tapera (M7: 0,8 / 0,6 × vrh).
    Trkačka nedelja: cilj = planirano (raceWeekTarget10). */
export function nominal10(
  frame: WeekFrame,
  hist: VolumeHistory,
  start10: number,
  cap10: number,
  taper: number | null,
  rule: PlanRule
): number {
  if (taper !== null) return Math.round(P.taper.weeks[taper]!.factor * hist.peak10);
  if (hist.lastBuild10 === null) return start10;
  if (frame.deload) return Math.round(P.deload.factor * hist.lastBuild10);
  return Math.min(hist.lastBuild10 + growth10(hist.lastBuild10, rule), cap10);
}

/** M8: cilj trkačke nedelje = planirano (trka se ne računa). */
export function raceWeekTarget10(planned100: number): number {
  return Math.round(planned100 / 10);
}

/**
 * M6: nominalni cilj ako ga konstrukcija ispunjava; inače SAMO ova nedelja na najbliži izvodljiv cilj (pri
 * jednakoj udaljenosti niži). Izgradnja sme naviše do granice izgradnje; ned 1, rasterećenje i taper samo
 * naniže (ned 1 = trenutni obim, ispod samo uz dugi na plafonu: 150 min ili M13a; smanjenje ne sme da poraste). Donja granica je najmanji smislen obim (M15, Uslov 8).
 */
export function fit10(
  nominal: number,
  frame: WeekFrame,
  cap10: number,
  rule: DayRule,
  feasible: (target10: number) => boolean,
  downOnly = false
): { target10: number; fitted: 'down' | 'up' | null } | null {
  if (feasible(nominal)) return { target10: nominal, fitted: null };
  const lo = weekMin10(rule);
  // Ned 1 = trenutni obim (samo naniže, pouka 9); rasterećenje i taper samo naniže; A8 (`downOnly`): cilj
  // adaptacije i povratni rast samo naniže.
  const hi =
    downOnly || frame.index === 1 || frame.deload || frame.phase === 'taper' ? nominal : cap10;
  for (let d = 1; nominal - d >= lo || nominal + d <= hi; d++) {
    if (nominal - d >= lo && feasible(nominal - d))
      return { target10: nominal - d, fitted: 'down' };
    if (nominal + d <= hi && feasible(nominal + d)) return { target10: nominal + d, fitted: 'up' };
  }
  return null;
}

/* ---------- Segment 04: obim adaptiranog plana (A2, A3, A4, A8, A9; M18) — jedino mesto ---------- */

/** Deo koraka adaptacije koji određuje obim (MarathonV2AdaptStep iz types.ts). */
export interface VolumeStep {
  /** Pouka 34: referenca umora pre starta (steps.preStartOf). */
  preStart?: PreStartRef;
  firstWeek: number;
  /** A5: prinudno rasterećenje u nedelji steps.deloadWeekOf (smanjenje obima za odstupanja A9). */
  deload: boolean;
  /** Pouka 36: nedelja prinudnog rasterećenja iz zapisa umora (bez polja = fromWeek). */
  deloadWeek?: number;
  fromWeek: number;
  startKm: number | null;
  pauseRemainder: boolean;
  restart: boolean;
  levelKm: number | null;
  returnFrom: { week: number; share: number } | null;
}

/** A4: osnova povratka posle nedelje sidra (udeo i nivo koraka). */
export interface ReturnAnchor {
  share: number;
  base10: number | null;
}

/** Pravila obima iz koraka po nedelji (konstruktor i validator čitaju isto). */
export interface AdaptVolume {
  /** Prva nedelja pod koracima: od nje važi donja granica A9. */
  first: number;
  /** Prva nedelja posle smanjenja obima (cilj koraka; pauza: ostatak tekuće nedelje; sidro bola; prinudno
      rasterećenje A5): od nje važe odstupanja A9 / pouka 33 (dugi rasterećenja i tapera ≥ 5 km, skraćen dugi);
      Infinity = bez smanjenja. */
  reducedFrom: number;
  /** Cilj koraka u nedelji fromWeek [0,1 km]. */
  reset: Map<number, number>;
  /** A3: ostatak tekuće nedelje posle pauze — firstWeek → granica [0,1 km]. */
  remainder: Map<number, number>;
  /** A3: nov start — nedelja → start [0,1 km] (granica izgradnje M6 od nje). */
  restart: Map<number, number>;
  /** A4 (pouka 18): nedelja sidra r → osnova povratka pre min sa ciljem nedelje r. */
  anchors: Map<number, ReturnAnchor>;
  /** Pouka 34: cilj reference umora pre starta [0,1 km] — poslednja izgradnja pre nedelje 1 (ned 1 = 0,8 ×);
      null bez umora pre starta. */
  pre10: number | null;
  /** A8: nivo pre smanjenja koji važi u nedelji w (najveći nivo koraka sa fromWeek ≤ w) [0,1 km]. */
  levelAt: (w: number) => number | null;
}

/** A4/A8 (pouka 18, JEDNA funkcija za konstruktor, validator i poruku): osnova povratka posle nedelje sidra sa
    ciljem `target10` [0,1 km] — min(round(0,7 × nivo pre bola), cilj nedelje sidra); nivo nepoznat →
    round(0,7 × cilj nedelje sidra). */
export function returnBase10(a: ReturnAnchor, target10: number): number {
  return a.base10 === null ? Math.round(a.share * target10) : Math.min(a.base10, target10);
}

/** A4: sidro koraka sa povratkom (osnova iz udela i nivoa koraka, A8: najveći nivo koraka). */
export const returnAnchor = (share: number, levelKm: number | null): ReturnAnchor => ({
  share,
  base10: levelKm === null ? null : Math.round(share * to10(levelKm))
});

export function adaptVolume(steps: readonly VolumeStep[]): AdaptVolume {
  const pre = preStartOf(steps);
  const pre10 = pre === null ? null : to10(pre.targetKm);
  const reset = new Map<number, number>();
  // Pouka 34: posle prinudnog rasterećenja nedelje 1 (umor pre starta) nedelja 2 = cilj reference, bez rasta.
  if (pre10 !== null) reset.set(2, pre10);
  const remainder = new Map<number, number>();
  const restart = new Map<number, number>();
  const anchors = new Map<number, ReturnAnchor>();
  for (const s of steps) {
    if (s.startKm !== null) {
      reset.set(s.fromWeek, to10(s.startKm));
      if (s.restart) restart.set(s.fromWeek, to10(s.startKm));
      if (s.pauseRemainder && s.firstWeek < s.fromWeek) remainder.set(s.firstWeek, to10(s.startKm));
    }
    if (s.returnFrom) anchors.set(s.returnFrom.week, returnAnchor(s.returnFrom.share, s.levelKm));
  }
  const reducedFrom = Math.min(
    ...steps
      .filter((s) => s.startKm !== null || s.returnFrom !== null || s.deload)
      .map((s) =>
        Math.min(s.pauseRemainder ? s.firstWeek : s.fromWeek, s.deload ? deloadWeekOf(s) : Infinity)
      )
  );
  return {
    first: Math.min(...steps.map((s) => s.firstWeek)),
    reducedFrom,
    reset,
    remainder,
    restart,
    anchors,
    pre10,
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

/** A8: cilj nedelje izgradnje posle `last10` — redovno M6 (do granice `cap10`; iznad granice drži) ili, dok je
    ispod nivoa pre smanjenja, povratni rast do nivoa — veće od dva (povratak ne usporava M6). */
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
  /** Granica izgradnje (M6; od novog starta, A3). */
  cap10: number;
  /** A8: najveći cilj izgradnje posle poslednjeg smanjenja (osnov tapera, M18). */
  peakRef10: number;
  /** Korak čija je nedelja taper: taper ≤ cilj koraka. */
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
  // Pouka 34: umor pre starta — poslednja izgradnja pre nedelje 1 = cilj reference (ned 1 generatora).
  if (i === 1 && av.pre10 !== null) out.lastBuild10 = av.pre10;
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
 * A8/A9 (M18): cilj po pravilu adaptirane nedelje — isti rekurent kao nominal10 uz korake: cilj koraka u nedelji
 * fromWeek (i kad je rasteretna), ostatak tekuće nedelje ≤ cilj pauze, rast nextBuild10, rasterećenje 0,8 ×
 * poslednja ne-rasteretna, taper (`taper` = redni broj, M7) 0,8 / 0,6 × najveći cilj izgradnje posle poslednjeg
 * smanjenja (≤ cilj koraka u taperu); od prve nedelje pod koracima ne ispod minimuma nedelje (M15). `downOnly` =
 * izvodljiv cilj samo naniže.
 */
export function adaptNominal10(
  frame: WeekFrame,
  h: AdaptHistory,
  start10: number,
  taper: number | null,
  rule: PlanRule,
  av: AdaptVolume
): { nominal: number; downOnly: boolean } {
  const i = frame.index;
  let t: number;
  let downOnly = false;
  const reset = av.reset.get(i);
  if (taper !== null) {
    t = Math.round(P.taper.weeks[taper]!.factor * h.peakRef10);
    if (h.tailCap10 !== null && h.tailCap10 < t) [t, downOnly] = [h.tailCap10, true];
  } else if (reset !== undefined) [t, downOnly] = [reset, true];
  else if (h.lastBuild10 === null) t = start10;
  else if (frame.deload) t = Math.round(P.deload.factor * h.lastBuild10);
  else {
    const level = av.levelAt(i);
    t = nextBuild10(h.lastBuild10, h.cap10, rule, level);
    downOnly = level !== null && h.lastBuild10 < level;
  }
  const rem = av.remainder.get(i);
  if (rem !== undefined && rem < t) [t, downOnly] = [rem, true];
  const floor = weekMin10(rule);
  if (i >= av.first && t < floor) [t, downOnly] = [floor, true];
  return { nominal: t, downOnly };
}

/** Posle nedelje `frame` sa ciljem `target10`: osnov rasta (ne-rasteretna izgradnja; cilj koraka i kad je
    rasteretna, A8), vrh, sidro bola (A4: osnova povratka returnBase10). */
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
