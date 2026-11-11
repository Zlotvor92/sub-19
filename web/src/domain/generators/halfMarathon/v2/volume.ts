/* H6 — cilj obima svake nedelje (jedini vlasnik); H5/H7 faktori cilja rasterećenja i tapera; H8 cilj
   trkačke nedelje; poruka kapaciteta. Rad u desetinkama km. Izvodljivost proverava STVARNA konstrukcija
   nedelje (week.ts), koju ovaj modul dobija kao funkciju — kapacitet nije formula (pouke 1 i 9). */

import {
  buildEasyCap10,
  longKmCap10,
  longShareCap10,
  longsOf10,
  longTimeCap10,
  rollingLongCap10
} from './lengths.ts';
import { isBuildPhase } from './periodize.ts';
import { userText } from './userText.ts';
import { HM_V2_POLICY as P, type PlanRule } from './policy.ts';
import { preStartOf } from './steps.ts';
import type { Paces, PlanWeek, WeekFrame } from './types.ts';

const EPS = 1e-9;
export const to10 = (km: number): number => Math.round(km * 10);

/** Šta je seklo spuštenu nedelju izgradnje — dugi na 150 min ('time'), na udelu H15 ('share'), na 24 km
    ('km'; HI8) i/ili na kotrljajućoj granici pouke 28 ('rolling'; HI7); 'recent' — kotrljajuća granica u
    nedeljama 1–4 kad je dat skorašnji najduži (F1: stvarni razlog je skorašnji najduži). */
export type CapacityLimit = 'time' | 'share' | 'km' | 'rolling' | 'recent' | 'easy';

/** H6/HI8: poruka CAPACITY_LIMITED — imenuje stvarna ograničenja običnim rečima (F1); preporučuje više dana samo
    kad veći broj dana postoji u tabeli H15 (HI9 a: 4 dana → 5–6 dana; početnik samo 4 → 5, H17). */
export function capacityMessage(
  runDays: number,
  rule: PlanRule,
  limits: readonly CapacityLimit[],
  recentKm: number | null = null
): string {
  const text: Record<CapacityLimit, string> = {
    time: `najviše ${Math.round(rule.longMaxSec / 60)} min`,
    share: `najviše ${Math.round(rule.longMaxShare * 100)} % nedelje`,
    km: `najviše ${P.lengths.longMaxKm} km`,
    rolling: 'raste najviše 10 % ili 1 km iznad najdužeg u prethodne 4 nedelje',
    recent: `raste najviše 10 % ili 1 km nedeljno, počevši od skorašnjeg najdužeg trčanja (${fmt(to10(recentKm ?? 0))} km)`,
    easy: ''
  };
  const longL = limits.filter(
    (l) => l !== 'easy' && !(l === 'rolling' && limits.includes('recent'))
  );
  const parts = [
    ...(longL.length > 0 ? [`dugi ${longL.map((l) => text[l]).join(' i ')}`] : []),
    // T1 (krug T): lagan ≤ 0,8 × dugi.
    ...(limits.includes('easy')
      ? [`lagani najviše ${Math.round(rule.easyLongMaxShare * 100)} % dugog`]
      : [])
  ];
  const more = rule.dayCounts.filter((n) => n > runDays);
  const advice =
    more.length === 0
      ? ''
      : `; preporuka ${more.length === 1 ? more[0] : `${more[0]}–${more[more.length - 1]}`} dana`;
  return `Sa ${runDays} dana trčanja ne staje ceo planirani obim: ${parts.join(', a ')}${advice}.`;
}

/** H6: napomena nedelje spuštene/podignute na izvodljiv cilj — tehnička (validator je čita kao oznaku VOLUME_RULE);
    korisniku ide zbir WEEK_FITTED jednom po planu (Faza 4a N11). */
export const fittedNote = (nominal10: number, target10: number): string =>
  `Cilj po pravilu ${fmt(nominal10)} km nije izvodljiv u konstrukciji nedelje; nedelja ide na najbliži izvodljiv cilj ${fmt(target10)} km (H6).`;
const fmt = (k10: number): string => (k10 / 10).toFixed(1).replace('.', ',');

/** Faza 4a N11 (jedan vlasnik — domen): napomene nedelje za korisnika — bez tehničke napomene izvodljivog cilja
    (fittedNote). Aplikacija samo prikazuje ovo. */
export const userWeekNotes = (w: { notes: readonly string[] }): string[] =>
  w.notes.filter((n) => !n.includes('nije izvodljiv u konstrukciji nedelje')).map(userText);

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
  recentKm: number | null | undefined = null,
  /** Kotrljajuća granica nedelje (validator: ista funkcija kao konstruktor, rollingCapRan10). */
  rollAt: (w: number) => number = (w) => rollingLongCap10(w, longsOf10(weeks), recentKm)
): CapacityLimit[] {
  const hit = new Set<CapacityLimit>();
  for (const w of weeks) {
    if (!isBuildPhase(w.phase) || w.deload || w.fitted !== 'down') continue;
    const long = w.days.find((d) => d.role === 'long');
    if (!long) continue;
    const l10 = to10(long.workout.km);
    if (l10 === longTimeCap10(p, rule.longMaxSec)) hit.add('time');
    if (l10 === longShareCap10(to10(w.targetKm), rule)) hit.add('share');
    if (l10 === longKmCap10()) hit.add('km');
    if (l10 === rollAt(w.index)) hit.add(recentKm != null && w.index <= 4 ? 'recent' : 'rolling');
    if (w.days.some((d) => d.role === 'easy' && to10(d.workout.km) === buildEasyCap10(l10, rule)))
      hit.add('easy');
  }
  return (['time', 'share', 'km', 'rolling', 'recent', 'easy'] as const).filter((l) => hit.has(l));
}

/** Trenutni obim = cilj nedelje 1 [0,1 km]. */
export function startKm10(currentWeeklyKm: number): number {
  return to10(currentWeeklyKm);
}

/** H6: granica izgradnje min(start × 1,4; start + 20; max nedelje H15) [0,1 km]; početnik min(1,4×; +15;
    max), H17. Kapacitet konstrukcije je posebno. */
export function peakCap10(start10: number, rule: PlanRule, prep?: PeakPrep): number {
  const base = Math.min(
    Math.floor(start10 * rule.peakFactor + EPS),
    start10 + to10(rule.peakAddKm),
    to10(rule.peakMaxKm)
  );
  if (!prep) return base;
  // G1 (P8): i ≤ start × faktor po dužini pripreme i ≤ satni plafon nedelje; start iznad plafona → vrh = start.
  const q = P.volume;
  const factor = q.peakFactorByWeeks.find((r) => prep.weeks <= r.maxWeeks)!.factor;
  return Math.max(
    start10,
    Math.min(base, Math.floor(start10 * factor + EPS), peakHoursCap10(prep.p))
  );
}

/** G1 (P8): dužina pripreme [ned] i tempo plana na startu (bez izmena tempa iz adaptacije) — ulaz plafona vrha. */
export interface PeakPrep {
  weeks: number;
  p: Paces;
}

/** G1 (P8): satni plafon nedelje [0,1 km] — najveći cilj čije trajanje srednjim laganim tempom ne prelazi sate
    pojasa VDOT-a (HM: < 40 7,5 h; 40–49,9 8,5 h; ≥ 50 9,5 h). */
export function peakHoursCap10(p: Paces): number {
  const hours = P.volume.peakHours.filter((b) => b.fromVdot <= p.vdot).pop()!.hours;
  return Math.floor(((hours * 3600) / ((p.E.fast + p.E.slow) / 2)) * 10 + EPS);
}

/** G1 (P8): broj ne-rasteretnih nedelja izgradnje od nedelje `index` do kraja faze razvoja, uključujući nju (u
    specifičnoj fazi 1: ostatak rasta ide redovnim korakom). Jedna funkcija za konstruktor i validator. */
export function growLeft(
  frames: readonly { index: number; phase: string; deload: boolean }[],
  index: number
): number {
  const n = frames.filter(
    (f) => f.index >= index && !f.deload && (f.phase === 'base' || f.phase === 'development')
  ).length;
  return Math.max(1, n);
}

/** G1 (P8): korak rasta ne-rasteretne nedelje izgradnje [0,1 km] — min(korak H6; (vrh − poslednji cilj) / preostale
    ne-rasteretne nedelje do kraja razvoja); korak manji od 3 % tekućeg cilja se ne primenjuje (0: nedelja zadržava
    cilj, rast se prenosi). Pravilo samo usporava rast. */
export function step10(last10: number, cap10: number, rule: PlanRule, left: number): number {
  const room = cap10 - last10;
  if (room <= 0) return 0;
  const step = Math.min(growth10(last10, rule), room, Math.round(room / Math.max(1, left)));
  return step < P.volume.minStepShare * last10 - EPS ? 0 : step;
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

/** K3-A (jedno mesto): početnik, ne-rasteretna nedelja specifične faze — dugi ne sme ispod najdužeg dugog
    izgradnje do tada (baza, razvoj i ranije nedelje specifične faze; `longs10` = dugi prethodnih nedelja redom, `frames` njihovi okviri). Vraća taj donji prag [0,1 km] ili null
    kad pravilo ne važi. Konstruktor ga traži kao uslov izvodljivosti (cilj naviše do holdCap10), validator čita istu
    funkciju za granicu izgradnje; kad ni tako ne staje — nedelja po H6 kao pre (bez praga). */
export function specHold10(
  frame: { phase: string; deload: boolean },
  rule: { beginner: boolean },
  frames: readonly { phase: string }[],
  longs10: readonly (number | null)[]
): number | null {
  if (!rule.beginner || frame.deload || frame.phase !== 'specific') return null;
  let m = 0;
  longs10.forEach((l, i) => {
    const ph = frames[i]?.phase;
    if (l !== null && (ph === 'base' || ph === 'development' || ph === 'specific'))
      m = Math.max(m, l);
  });
  return m > 0 ? m : null;
}

/** K3-A: granica izgradnje nedelje sa pragom dugog (specHold10) [0,1 km]. */
export const holdCap10 = (cap10: number): number =>
  Math.floor(cap10 * (1 + P.beginner.specHoldOverPeak) + EPS);

/** Cilj po pravilu (pre provere izvodljivosti) — jedna funkcija za konstruktor i validator (pouka 24).
    Trkačka nedelja: cilj = planirano (raceWeekTarget10). */
export function nominal10(
  frame: WeekFrame,
  hist: VolumeHistory,
  start10: number,
  cap10: number,
  rule: PlanRule,
  /** G1 (P8): preostale ne-rasteretne nedelje do kraja razvoja (growLeft). */
  left = 1
): number {
  // W1-A: kratak plan bez nedelje izgradnje pre tapera — osnova je trenutni obim; taper ne pada ispod minimuma
  // nedelje (H15) — oba slučaja su ranije bila odbijanje (cilj 0 / ispod minimuma), pa plan ≥ MIN ostaje isti.
  if (frame.phase === 'taper')
    return Math.max(
      weekMin10(rule),
      Math.round(P.taper.factor * (hist.peak10 > 0 ? hist.peak10 : start10))
    );
  if (hist.lastBuild10 === null) return start10;
  if (frame.deload) return Math.round(P.deload.factor * hist.lastBuild10);
  return hist.lastBuild10 + step10(hist.lastBuild10, cap10, rule, left);
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
      const ps = preStartOf(steps);
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
  level10: number | null,
  left = 1
): number {
  const normal = last10 + step10(last10, cap10, rule, left);
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
  rule: PlanRule,
  prep?: PeakPrep
): AdaptHistory {
  const i = frame.index;
  const out = { ...h };
  const r = av.restart.get(i);
  if (r !== undefined) out.cap10 = peakCap10(r, rule, prep);
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
  av: AdaptVolume,
  left = 1
): { nominal: number; downOnly: boolean } {
  const i = frame.index;
  let t: number;
  let downOnly = false;
  const reset = av.reset.get(i);
  if (frame.phase === 'taper') {
    // HM-09 (C7): posle smanjenja nijedna ne-rasteretna nedelja izgradnje (npr. sidro bola, pa prinudno
    // rasterećenje pred taper) → osnova tapera je osnova kojom se računalo i rasterećenje (lastBuild10), ne 0
    // (inače taper pada na minimum nedelje: svi dani 4 km).
    t = Math.round(P.taper.factor * (h.peakRef10 > 0 ? h.peakRef10 : (h.lastBuild10 ?? 0)));
    if (h.tailCap10 !== null && h.tailCap10 < t) [t, downOnly] = [h.tailCap10, true];
  } else if (reset !== undefined) [t, downOnly] = [reset, true];
  else if (h.lastBuild10 === null) t = start10;
  else if (frame.deload) t = Math.round(P.deload.factor * h.lastBuild10);
  else if (i === 2 && av.preStart10 !== null) [t, downOnly] = [av.preStart10, true];
  else {
    const level = av.levelAt(i);
    t = nextBuild10(h.lastBuild10, h.cap10, rule, level, left);
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
