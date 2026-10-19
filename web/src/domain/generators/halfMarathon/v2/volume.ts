/* H6 — cilj obima svake nedelje (jedini vlasnik); H5/H7 faktori cilja rasterećenja i tapera; H8 cilj
   trkačke nedelje; poruka kapaciteta. Rad u desetinkama km. Izvodljivost proverava STVARNA konstrukcija
   nedelje (week.ts), koju ovaj modul dobija kao funkciju — kapacitet nije formula (pouke 1 i 9). */

import { longKmCap10, longShareCap10, longTimeCap10, rollingLongCap10 } from './lengths.ts';
import { isBuildPhase } from './periodize.ts';
import { HM_V2_POLICY as P, type PlanRule } from './policy.ts';
import type { Paces, PlanWeek, WeekFrame } from './types.ts';

const EPS = 1e-9;
export const to10 = (km: number): number => Math.round(km * 10);

/** Šta je seklo spuštenu nedelju izgradnje — dugi na 150 min ('time'), na udelu H15 ('share'), na 24 km
    ('km'; HI8) i/ili na kotrljajućoj granici pouke 28 ('rolling'; HI7). */
export type CapacityLimit = 'time' | 'share' | 'km' | 'rolling';

/** H6/HI8: poruka CAPACITY_LIMITED — imenuje stvarna ograničenja; preporučuje više dana samo kad veći broj
    dana postoji u tabeli H15 (HI9 a: 4 dana → 5–6 dana; početnik samo 4 → 5, H17). */
export function capacityMessage(
  runDays: number,
  rule: PlanRule,
  limits: readonly CapacityLimit[]
): string {
  const text: Record<CapacityLimit, string> = {
    time: `${Math.round(rule.longMaxSec / 60)} min`,
    share: `${Math.round(rule.longMaxShare * 100)} % nedelje`,
    km: `${P.lengths.longMaxKm} km`,
    rolling: 'max(1,1 × najduži, najduži + 1 km) prethodne 4 nedelje (pouka 28)'
  };
  const what = limits.length > 0 ? ` uz dugi ≤ ${limits.map((l) => text[l]).join(' i ≤ ')}` : '';
  const more = rule.dayCounts.filter((n) => n > runDays);
  const advice =
    more.length === 0
      ? ''
      : `; preporuka ${more.length === 1 ? more[0] : `${more[0]}–${more[more.length - 1]}`} dana`;
  return `${runDays} dana ne nose ovaj obim${what}${advice}.`;
}

/** HI3 (pouka 14): preporuka manje dana — brojevi dana manji od `runDays` čiji red tabele H15 (početnik:
    tabela H17) podržava trenutni obim; prazno kad ih nema. */
export function fewerDaysAdvice(runDays: number, currentWeeklyKm: number, rule: PlanRule): string {
  const km10 = to10(currentWeeklyKm);
  const row = (n: number): { kmMin: number; kmMax: number } =>
    rule.beginner
      ? P.beginner.days[n as keyof typeof P.beginner.days]
      : P.days[n as keyof typeof P.days];
  const fewer = rule.dayCounts.filter(
    (n) => n < runDays && to10(row(n).kmMin) <= km10 && km10 <= to10(row(n).kmMax)
  );
  if (fewer.length === 0) return '';
  const days = fewer.length === 1 ? `${fewer[0]}` : `${fewer[0]}–${fewer[fewer.length - 1]}`;
  return `; preporuka ${days} dana (red sa manje dana podržava obim ${currentWeeklyKm} km, dugi dobija veći udeo)`;
}

/** H6/HI8: ograničenja spuštenih (fitted 'down') ne-rasteretnih nedelja izgradnje: dugi = plafon 150 min
    sporim E → 'time'; = udeo cilja (H15) → 'share'; = 24 km → 'km'; = kotrljajuća granica pouke 28
    (skorašnji najduži `recentKm` u nedeljama 1–4) → 'rolling'. Redosled: time, share, km, rolling. */
export function capacityLimits(
  weeks: readonly PlanWeek[],
  rule: PlanRule,
  p: Paces,
  recentKm: number | null | undefined = null
): CapacityLimit[] {
  const hit = new Set<CapacityLimit>();
  const longs10 = weeks.map((w) => {
    const l = w.days.find((d) => d.role === 'long');
    return l ? to10(l.workout.km) : null;
  });
  for (const w of weeks) {
    if (!isBuildPhase(w.phase) || w.deload || w.fitted !== 'down') continue;
    const long = w.days.find((d) => d.role === 'long');
    if (!long) continue;
    const l10 = to10(long.workout.km);
    if (l10 === longTimeCap10(p, rule.longMaxSec)) hit.add('time');
    if (l10 === longShareCap10(to10(w.targetKm), rule)) hit.add('share');
    if (l10 === longKmCap10()) hit.add('km');
    if (l10 === rollingLongCap10(w.index, longs10, recentKm)) hit.add('rolling');
  }
  return (['time', 'share', 'km', 'rolling'] as const).filter((l) => hit.has(l));
}

/** Trenutni obim = cilj nedelje 1 [0,1 km]. */
export function startKm10(currentWeeklyKm: number): number {
  return to10(currentWeeklyKm);
}

/** H6: granica izgradnje min(start × 1,4; start + 20; max nedelje H15) [0,1 km]; početnik min(1,4×; +15;
    max), H17. Kapacitet konstrukcije je posebno. */
export function peakCap10(start10: number, rule: PlanRule): number {
  return Math.min(
    Math.floor(start10 * rule.peakFactor + EPS),
    start10 + to10(rule.peakAddKm),
    to10(rule.peakMaxKm)
  );
}

/** H6: +6 % poslednjeg ne-rasteretnog cilja (min 1,0, max 4,0 km; korak 0,1); početnik +5 % (1,0–2,0 km),
    H17. */
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

export const INITIAL_VOLUME: VolumeHistory = { lastBuild10: null, peak10: 0 };

/** Cilj po pravilu (pre provere izvodljivosti) — jedna funkcija za konstruktor i validator (pouka 24).
    Trkačka nedelja: cilj = planirano (raceWeekTarget10). */
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

/** Posle nedelje sa ciljem `target10`: osnov rasta i vrh menja samo ne-rasteretna izgradnja. */
export function leaveWeek(h: VolumeHistory, frame: WeekFrame, target10: number): VolumeHistory {
  if (!isBuildPhase(frame.phase) || frame.deload) return h;
  return { lastBuild10: target10, peak10: Math.max(h.peak10, target10) };
}

/** H8: cilj trkačke nedelje = planirano (trka se ne računa). */
export function raceWeekTarget10(planned100: number): number {
  return Math.round(planned100 / 10);
}

/** H15/Uslov 8: minimum nedelje [0,1 km] — donja granica pretrage cilja i provera validatora (pouka 24). */
export const weekMin10 = (rule: { weekMinKm: number }): number => to10(rule.weekMinKm);

/**
 * H6: nominalni cilj ako ga konstrukcija ispunjava; inače SAMO ova nedelja na najbliži izvodljiv cilj
 * (pri jednakoj udaljenosti niži). Izgradnja sme naviše do granice izgradnje; rasterećenje i taper samo
 * naniže (smanjenje ne sme da poraste). Donja granica je minimum nedelje (H15).
 */
export function fit10(
  nominal: number,
  frame: WeekFrame,
  cap10: number,
  rule: { weekMinKm: number },
  feasible: (target10: number) => boolean,
  downOnly = false
): { target10: number; fitted: 'down' | 'up' | null } | null {
  if (feasible(nominal)) return { target10: nominal, fitted: null };
  const lo = weekMin10(rule);
  // A8 (`downOnly`): cilj adaptacije i povratni rast samo naniže.
  const hi = downOnly || frame.deload || frame.phase === 'taper' ? nominal : cap10;
  for (let d = 1; nominal - d >= lo || nominal + d <= hi; d++) {
    if (nominal - d >= lo && feasible(nominal - d))
      return { target10: nominal - d, fitted: 'down' };
    if (nominal + d <= hi && feasible(nominal + d)) return { target10: nominal + d, fitted: 'up' };
  }
  return null;
}

/* ---------- Segment 04 (H18): obim adaptiranog plana (A2, A3, A4, A8, A9) — jedino mesto ---------- */

/** Deo koraka adaptacije koji određuje obim (HmV2AdaptStep iz types.ts). */
export interface VolumeStep {
  firstWeek: number;
  fromWeek: number;
  startKm: number | null;
  pauseRemainder: boolean;
  restart: boolean;
  levelKm: number | null;
  preStart?: { targetKm: number };
  returnFrom: { week: number; share: number } | null;
}

/** Pravila obima iz koraka po nedelji (konstruktor i validator čitaju isto). */
export interface AdaptVolume {
  /** Prva nedelja pod koracima: od nje važi donja granica A9. */
  first: number;
  /** Prva nedelja posle smanjenja obima (A9: test koji ne staje otpada); Infinity = bez smanjenja. */
  reducedFrom: number;
  /** Cilj koraka u nedelji fromWeek [0,1 km] (poslednji korak za tu nedelju). */
  reset: Map<number, number>;
  /** A3: ostatak tekuće nedelje posle pauze — firstWeek → granica [0,1 km]. */
  remainder: Map<number, number>;
  /** A3: nov start — nedelja → start [0,1 km] (granica izgradnje H6 od nje). */
  restart: Map<number, number>;
  /** Pouka 18 (A4): nedelja sidra r → osnova povratka pre min sa ciljem nedelje r. */
  anchors: Map<number, ReturnAnchor>;
  /** A8: nivo pre smanjenja koji važi u nedelji w (najveći nivo koraka sa fromWeek ≤ w) [0,1 km]. */
  levelAt: (w: number) => number | null;
  /** Pouka 34: umor pre starta — nedelja 2 = cilj planirane nedelje 1 bez rasta [0,1 km]. */
  preStart10: number | null;
}

/** Pouka 18: osnova povratka posle nedelje sidra (udeo i nivo koraka). */
export interface ReturnAnchor {
  share: number;
  base10: number | null;
}

/** Pouka 18 (A4/A8): osnova povratka posle nedelje sidra sa ciljem `target10` [0,1 km] — min(round(udeo ×
    nivo pre bola), cilj nedelje sidra); nivo nepoznat → round(udeo × cilj nedelje sidra). JEDNA funkcija za
    konstruktor, validator i poruku. */
export function returnBase10(a: ReturnAnchor, target10: number): number {
  return a.base10 === null ? Math.round(a.share * target10) : Math.min(a.base10, target10);
}

/** Pouka 18: sidro koraka sa povratkom (osnova iz udela i nivoa koraka, A8: najveći nivo koraka). */
export const returnAnchor = (share: number, levelKm: number | null): ReturnAnchor => ({
  share,
  base10: levelKm === null ? null : Math.round(share * to10(levelKm))
});

export function adaptVolume(steps: readonly VolumeStep[]): AdaptVolume {
  const reset = new Map<number, number>();
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
    preStart10: (() => {
      const ps = [...steps].reverse().find((s) => s.preStart)?.preStart;
      return ps ? to10(ps.targetKm) : null;
    })(),
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

/** A8: cilj nedelje izgradnje posle `last10` — redovno H6 (do granice `cap10`; iznad granice drži) ili,
    dok je ispod nivoa pre smanjenja, povratni rast do nivoa (i iznad granice novog starta) — veće od dva. */
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
  /** Granica izgradnje (H6; od novog starta, A3). */
  cap10: number;
  /** A8/H18: najveći cilj izgradnje posle poslednjeg smanjenja (osnov tapera). */
  peakRef10: number;
  /** Korak čija je sledeća nedelja taper: taper ≤ cilj koraka. */
  tailCap10: number | null;
}

export const initialAdaptHistory = (
  cap10: number,
  lastBuild10: number | null = null
): AdaptHistory => ({
  lastBuild10,
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
 * A8/A9: cilj po pravilu adaptirane nedelje — isti rekurent kao nominal10 (H6) uz korake: cilj koraka u
 * nedelji fromWeek (i kad je rasteretna), ostatak tekuće nedelje ≤ cilj pauze, rast nextBuild10,
 * rasterećenje 0,8 × poslednja ne-rasteretna, taper 0,7 × vrh posle poslednjeg smanjenja (≤ cilj koraka u
 * taperu); od prve nedelje pod koracima ne ispod minimuma nedelje (H15). `downOnly` = izvodljiv cilj samo
 * naniže. Bez dejstva koraka = nominal10.
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
  else if (h.lastBuild10 === null) t = start10;
  else if (frame.deload) t = Math.round(P.deload.factor * h.lastBuild10);
  else if (i === 2 && av.preStart10 !== null) [t, downOnly] = [av.preStart10, true];
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

/** Posle nedelje `frame` sa ciljem `target10`: osnov rasta (ne-rasteretna izgradnja; cilj koraka i kad
    je rasteretna, A8), vrh, sidro bola (pouka 18: returnBase10). */
export function leaveAdaptWeek(
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
