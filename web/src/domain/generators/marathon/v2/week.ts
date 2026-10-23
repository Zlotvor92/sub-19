/* Sastav nedelje: izgradnja, rasterećenje (M5 sadržaj), taper (M7, dve nedelje), trkačka nedelja (M8); test
   5 km (M16); uvod i T kontinuirano početnika (M17). Doze bira quality.ts, dužine lengths.ts, treninge
   workouts.ts; ovde se samo raspoređuju po danima šablona (M9). null = nedelja sa ovim ciljem nije izvodljiva
   po pravilima (volume.ts traži najbliži izvodljiv cilj). */

import { addDays, daysBetween, weekdayOf } from './dates.ts';
import {
  buildLengths,
  deloadLengths,
  deloadTop10,
  type Lengths,
  limitedEasy10,
  longCap10,
  painLong10,
  taperLengths,
  taperTop10
} from './lengths.ts';
import { MARATHON_V2_POLICY as P, type PlanRule } from './policy.ts';
import {
  type BuildLimit,
  capM,
  type DayFits,
  deloadSlot,
  ladderFor,
  pickBuild,
  pickDeload,
  pickTaper,
  type Picks,
  type QualityState,
  type SlotState,
  taperDoses,
  type TaperLimit,
  taperTFloor
} from './quality.ts';
import type {
  DayRole,
  Dose,
  LadderId,
  MarathonV2Input,
  Paces,
  Pattern,
  PlanDay,
  Structure,
  WeekFrame,
  WeekLimits,
  Weekday,
  Workout
} from './types.ts';
import {
  doseOf,
  easyTimeWorkout,
  easyWorkout,
  eveWorkout,
  fmtKm,
  ladderLevels,
  longWorkout,
  qualityDaySec,
  qualityWorkout,
  raceWorkout,
  sharpenerWorkout,
  structuresForDose,
  testWorkout,
  type WarmupCooldown,
  zoneOf
} from './workouts.ts';

export interface WeekContext {
  input: MarathonV2Input;
  paces: Paces;
  pattern: Pattern;
  /** Prognoza maratona [s] (trka, M2). */
  raceSec: number;
  /** M14: WU/CD po pojasu trenutnog obima (početnik 15/10, M17). */
  wc: WarmupCooldown;
  /** M15: red tabele za broj dana (početnik: M17). */
  rule: PlanRule;
  /** M16: plan po osećaju (kvalitet nosi RPE). */
  feel: boolean;
  /** Segment 04: nedelja posle smanjenja obima (A9, pouka 33: dugi rasterećenja sme da se skrati). */
  adapted?: boolean;
}

/** Režim kvaliteta nedelje: 'rule' po pravilu; 'relax' druga pretraga (M11 ispred M12 u izgradnji; u
    taperu T koji ne staje u plafon otpada, M11 ispred M7); segment 04 (A4/A9): 'one' jedan kvalitet doze
    rasterećenja (taper: samo MP; početnik N−1: samo T), 'none' bez kvaliteta. */
export type QualityMode = 'rule' | 'relax' | 'one' | 'none';

export interface BuiltWeek {
  days: PlanDay[];
  planned100: number;
  /** Dugi nedelje [0,1 km]; null u trkačkoj nedelji. */
  long10: number | null;
  /** Izbor doza nedelje izgradnje (stanje za sledeću nedelju; slot null = bez izbora); null van izgradnje. */
  picks: Picks | null;
  /** M13a: dugi na plafonu skoka. */
  jumpBound: boolean;
  notes: string[];
}

const HARD: readonly DayRole[] = ['q1', 'q2', 'long', 'sharpener', 'race', 'test'];
const km100 = (km: number): number => Math.round(km * 100);

function day(date: string, role: DayRole, workout: Workout, countsToWeek = true): PlanDay {
  return { date, weekday: weekdayOf(date), role, hard: HARD.includes(role), countsToWeek, workout };
}

function finish(
  days: PlanDay[],
  long10: number | null,
  picks: Picks | null,
  notes: string[],
  jumpBound = false
): BuiltWeek {
  days.sort((a, b) => a.date.localeCompare(b.date));
  const planned100 = days.reduce((a, d) => a + (d.countsToWeek ? km100(d.workout.km) : 0), 0);
  return { days, planned100, long10, picks, jumpBound, notes };
}

export const dateOf = (frame: WeekFrame, wd: Weekday): string => {
  for (let i = 0; i < 7; i++) {
    const d = addDays(frame.startDate, i);
    if (weekdayOf(d) === wd) return d;
  }
  throw new Error(`Dan ${wd} nije u nedelji ${frame.index}.`);
};

/** Napomena kad slot ponavlja trening: sledeći nivo ne staje u plafon zone, a druga struktura iste doze ne postoji
    (M10) ili bi bila duža od dugog (pouka 32; tekst kao HM-03b). */
const repeatNote = (slot: string, d: Dose): string =>
  `${slot}: ${d.zone} ${fmtKm(d.doseM / 1000)} km ponovljen — sledeći nivo ne staje u plafon, a druga struktura iste doze ${structuresForDose(d.ladder as LadderId, d.doseM).length > 1 ? 'bi bila duža od dugog (pouka 32)' : 'ne postoji (M10)'}.`;

/** M16: napomena nedelje testa. */
const testNote = `Test ${P.test.km} km (M16): kontrolisano maksimalno; računa se u obim nedelje, ne u dozu kvaliteta; rezultat koristi adaptacija (segment 04), do tada tempo ostaje procena.`;

/** Lagani dani: datumi rastuće (raniji dan dobija višak zaokruženja). */
const easyDates = (frame: WeekFrame, days: readonly Weekday[]): string[] =>
  days.map((wd) => dateOf(frame, wd)).sort();

const easyDays = (dates: readonly string[], easy10: readonly number[], p: Paces): PlanDay[] =>
  dates.map((d, i) => day(d, 'easy', easyWorkout(easy10[i]! / 10, p)));

/** A4: dani odmora se ne prave; na danima bola dugi ≤ 60 min, lagani × 0,7 (≥ 5 km, ne duži od planiranog),
    dan pred trku bez ubrzanja; svaki lagan ≤ dugi (pouka 2). Bez dana bola/odmora dani ostaju isti. Vraća i
    dugi posle ograničenja [0,1 km]. */
/** A4: dugi posle ograničenja koraka [0,1 km] — na danu odmora nema ga (null), na danu bola ≤ 60 min (painLong10).
    JEDNO mesto za limitDays i napomenu spuštene doze (MAR-09 t. 5). */
function limitedLong10(frame: WeekFrame, date: string, long10: number, p: Paces): number | null {
  const L = frame.limits;
  if (L?.rest?.includes(date)) return null;
  return L?.pain?.includes(date) ? painLong10(long10, p) : long10;
}

function limitDays(
  frame: WeekFrame,
  days: PlanDay[],
  long10: number | null,
  p: Paces
): { days: PlanDay[]; long10: number | null; notes: string[] } {
  const L = frame.limits;
  if (!L || (!L.rest && !L.pain)) return { days, long10, notes: [] };
  const rest = new Set(L.rest ?? []);
  const pain = new Set(L.pain ?? []);
  const long = days.find((d) => d.role === 'long');
  const l10 = long ? limitedLong10(frame, long.date, Math.round(long.workout.km * 10), p) : null;
  const out = days
    .filter((d) => !rest.has(d.date))
    .map((d) => {
      const km10 = Math.round(d.workout.km * 10);
      if (d.role === 'long')
        return l10 === km10 ? d : day(d.date, 'long', longWorkout(l10! / 10, p));
      if (d.role === 'easy') {
        const e10 = limitedEasy10(km10, pain.has(d.date), l10);
        return e10 === km10 && !pain.has(d.date)
          ? d
          : day(d.date, 'easy', easyWorkout(e10 / 10, p));
      }
      if (d.role === 'eve' && pain.has(d.date)) return day(d.date, 'eve', eveWorkout(p, false));
      return d;
    });
  return {
    days: out,
    long10: l10,
    notes: [
      `Adaptacija: ${rest.size > 0 ? `${rest.size} dan(a) odmora, ` : ''}${pain.size > 0 ? 'period bola (dugi ≤ 60 min, lagani × 0,7 ≥ 5 km, bez ubrzanja), ' : ''}planirano ≤ cilj obima (A4).`
    ]
  };
}

/* ---------- Pouka 32: drugi član plafona zone (trajanje dana ≤ dugi iste nedelje), kao HM-03b ---------- */

/** Šta drugi član čita iz nedelje (konstruktor iz WeekContext i okvira, validator iz plana). `longAfter`: dugi
    posle ograničenja dana koraka (A4: na danu bola ≤ 60 min; dugi na danu odmora ne postoji → null). */
export interface DayLimitContext {
  paces: Paces;
  wc: WarmupCooldown;
  rule: PlanRule;
  longAfter: (long10: number) => number | null;
}

/** Kontekst drugog člana za nedelju sa ograničenjima `limits` i danom dugog `longDate` (isto kao limitDays). */
export function dayLimitContext(
  paces: Paces,
  wc: WarmupCooldown,
  rule: PlanRule,
  limits: WeekLimits | undefined,
  longDate: () => string
): DayLimitContext {
  const days = limits?.rest || limits?.pain ? longDate() : null;
  const rest = days !== null && limits?.rest?.includes(days) === true;
  const pain = days !== null && limits?.pain?.includes(days) === true;
  return {
    paces,
    wc,
    rule,
    longAfter: (l10) => (rest ? null : pain ? painLong10(l10, paces) : l10)
  };
}

/** Dan kvaliteta (ili testa) koji je već u nedelji: km [0,01 km] i trajanje [s]; `sec` null = izuzet (najniža
    doza zone ili test — ne pomera dozu drugog dana). */
export interface FixedDay {
  km100: number;
  sec: number | null;
}

const doseFor = (ladder: LadderId, s: Structure): Dose => ({
  ladder,
  zone: zoneOf(ladder),
  doseM: doseOf(s),
  structure: s,
  step: 'next'
});

/** Km [0,01 km] i trajanje [s] dana kvaliteta (qualityWorkout, qualityDaySec) — keš po tempu (isti tempo nedelje
    u konstrukciji), samo brzina; ista vrednost kao bez keša. */
const dayCache = new WeakMap<Paces, Map<string, { km100: number; sec: number }>>();
function dayOf(c: DayLimitContext, ladder: LadderId, s: Structure): { km100: number; sec: number } {
  let m = dayCache.get(c.paces);
  if (!m) dayCache.set(c.paces, (m = new Map<string, { km100: number; sec: number }>()));
  const key = `${c.wc.warmupSec}/${c.wc.cooldownSec}/${ladder}/${JSON.stringify(s)}`;
  let v = m.get(key);
  if (!v) {
    const d = doseFor(ladder, s);
    v = { km100: km100(qualityWorkout(d, c.paces, c.wc).km), sec: qualityDaySec(d, c.paces, c.wc) };
    m.set(key, v);
  }
  return v;
}

/** Pouka 32: predikat drugog člana — dan sa strukturom `s` i već postavljen dan `other` traju ≤ dugi nedelje sa
    oba dana (`longOf`: dužine nedelje za zbir km dana kvaliteta). Kad nedelja sa tim danom nema izvodljive dužine,
    poređenje je sa najdužim dozvoljenim dugim nedelje `top10` (kao plafon MP MAR-03; izvodljivost odlučuje
    pretraga cilja). */
function dayLimit(
  c: DayLimitContext,
  longOf: (quality100: number) => Lengths | null,
  top10: number,
  other: FixedDay | null
): DayFits {
  return (ladder, s, exempt) => {
    const q = dayOf(c, ladder, s);
    const len = longOf(q.km100 + (other?.km100 ?? 0));
    const l10 = c.longAfter(len ? len.long10 : top10);
    const long = l10 === null ? Infinity : longWorkout(l10 / 10, c.paces).sec;
    return (exempt || q.sec <= long) && (other?.sec ?? 0) <= long;
  };
}

/** Pouka 32: dan kao FixedDay — `exempt` (najniža doza zone ili test) nema trajanje u poređenju. */
export function fixedDay(c: DayLimitContext, w: Workout, exempt: boolean): FixedDay {
  return {
    km100: km100(w.km),
    sec: exempt || !w.dose ? null : qualityDaySec(w.dose, c.paces, c.wc)
  };
}

/** Isto kao fixedDay(c, qualityWorkout(d, …), exempt), iz keša dana (dayOf). */
const fixedDose = (c: DayLimitContext, d: Dose, exempt: boolean): FixedDay => {
  const q = dayOf(c, d.ladder as LadderId, d.structure);
  return { km100: q.km100, sec: exempt ? null : q.sec };
};

/** Najniži nivo lestvice dana izgradnje (pouka 32 izuzetak; početnik: lestvica M17). */
export const lowestBuild = (d: Dose, beginner: boolean): boolean =>
  d.doseM <= doseOf(ladderLevels(d.ladder as LadderId, beginner)[0]!);

/**
 * Pouka 32 u nedelji izgradnje: Q1 se bira uz Q2 najniže doze lestvice faze (`q2Ladder`; null = jedan kvalitet)
 * u strukturi sa najviše km (svaki Q2 te doze tada ostavlja Q1 ≤ dugi), Q2 uz izabran Q1 (`test` — dan testa
 * M16 umesto Q1). `easyDays` = lagani dani nedelje sa oba dana kvaliteta; `jump10` = plafon skoka M13a. Jedna
 * funkcija za konstruktor i validator.
 */
export function buildDayLimit(
  c: DayLimitContext,
  target10: number,
  easyDays: number,
  jump10: number | null,
  q2Ladder: LadderId | null,
  test: Workout | null
): BuildLimit {
  const longOf = (q100: number) => buildLengths(target10, q100, easyDays, c.rule, c.paces, jump10);
  const top10 = Math.min(longCap10(target10, c.rule, c.paces), jump10 ?? Infinity);
  const q2Low = q2Ladder
    ? structuresForDose(q2Ladder, doseOf(ladderLevels(q2Ladder)[0]!))
        .map((s) => dayOf(c, q2Ladder, s).km100)
        .reduce((a, k) => Math.max(a, k))
    : null;
  return {
    q1: dayLimit(c, longOf, top10, q2Low !== null ? { km100: q2Low, sec: null } : null),
    q2: (q1) =>
      dayLimit(
        c,
        longOf,
        top10,
        test
          ? fixedDay(c, test, true)
          : q1
            ? fixedDose(c, q1, lowestBuild(q1, c.rule.beginner))
            : null
      )
  };
}

/** Pouka 32: jedini kvalitet doze rasterećenja u nedelji izgradnje (A4/A9 'one') — dan ≤ dugi nedelje
    (`easyDays` = lagani uz taj dan). */
export function oneDayLimit(
  c: DayLimitContext,
  target10: number,
  easyDays: number,
  jump10: number | null
): DayFits {
  return dayLimit(
    c,
    (q100) => buildLengths(target10, q100, easyDays, c.rule, c.paces, jump10),
    Math.min(longCap10(target10, c.rule, c.paces), jump10 ?? Infinity),
    null
  );
}

/** Pouka 32 u rasterećenju: jedini kvalitet (T) ≤ dugi rasterećenja (deloadLengths sa tim danom; `shorten` i
    `adapted` kao deloadLengths). */
export function deloadDayLimit(
  c: DayLimitContext,
  target10: number,
  easyDays: number,
  lastLong10: number,
  jump10: number | null,
  shorten: boolean,
  adapted: boolean
): DayFits {
  return dayLimit(
    c,
    (q100) =>
      deloadLengths(
        target10,
        q100,
        easyDays,
        lastLong10,
        c.rule,
        c.paces,
        jump10,
        shorten,
        adapted
      ),
    deloadTop10(target10, lastLong10, c.rule, c.paces, jump10, adapted),
    null
  );
}

/** Pouka 32 u taperu `step`: MP (početnik N−1: T) uz T na najmanjoj dozi kad T dan postoji (`withT`), pa T uz
    izabran MP (najmanja doza MP, 2 × 3000 m, izuzeta). `easyDays` = lagani dani sa svim danima kvaliteta. */
export function taperDayLimit(
  c: DayLimitContext,
  target10: number,
  easyDays: number,
  longest10: number,
  step: number,
  jump10: number | null,
  adapted: boolean,
  withT: boolean
): TaperLimit {
  const longOf = (q100: number) =>
    taperLengths(target10, q100, easyDays, longest10, step, c.rule, c.paces, jump10, adapted);
  const top10 = taperTop10(target10, longest10, step, c.rule, c.paces, jump10, adapted);
  const tLow = withT ? fixedDose(c, doseFor('T_cruise', taperTFloor()), true) : null;
  const mpMin = doseOf(P.taper.mpMin);
  return {
    q1: dayLimit(c, longOf, top10, tLow),
    q2: (mp) => dayLimit(c, longOf, top10, fixedDose(c, mp, mp.doseM <= mpMin))
  };
}

/** Pouka 32: drugi član tapera nedelje — T dan postoji kad ga doza po pravilu ima i staje u plafon M11 (bez T:
    'one' — samo glavni kvalitet, A4/A9); lagani = dani trčanja − dugi − dani kvaliteta. Jedna funkcija za
    konstruktor i validator. */
export function taperWeekLimit(
  c: DayLimitContext,
  state: QualityState,
  step: number,
  target10: number,
  runDays: number,
  longest10: number,
  jump10: number | null,
  adapted: boolean,
  one: boolean
): TaperLimit {
  const d0 = taperDoses(state, step, c.rule.quality, c.rule.beginner);
  const withT = !one && d0.mp !== null && d0.t !== null && doseOf(d0.t) <= capM('T', target10 / 10);
  return taperDayLimit(
    c,
    target10,
    runDays - 1 - (withT ? 2 : 1),
    longest10,
    step,
    jump10,
    adapted,
    withT
  );
}

/**
 * Pouka 35 (N5, JEDINO mesto odluke o broju dana kvaliteta nedelje izgradnje): u nedelji sa dva dana kvaliteta
 * (`q1`, `q2`; `easyDays` laganih uz oba) — kad bi neki dan kvaliteta (i najniži nivo, izuzet od drugog člana pouke
 * 32) trajao duže od dugog iste nedelje, drugi dan kvaliteta postaje lagan, prvi ostaje, a dužine (dugi raste)
 * određuje vlasnik dužina (buildLengths). Vraća dužine nedelje sa jednim kvalitetom; null = ostaju dva kvaliteta
 * (svi dani ≤ dugi, ili nedelja sa jednim kvalitetom nije izvodljiva — tada upozorenje pouke 14). Trajanje = trajanje
 * treninga (isto kao LONG_SHORTER_THAN_QUALITY). Taper i trkačka nedelja su izuzeti (M7). Konstruktor (buildWeek) i
 * validator (QUALITY_DAYS) čitaju istu funkciju.
 */
export function secondQualityEasy(
  target10: number,
  rule: PlanRule,
  p: Paces,
  jump10: number | null,
  easyDays: number,
  q1: Workout,
  q2: Workout
): Lengths | null {
  const len2 = buildLengths(target10, km100(q1.km) + km100(q2.km), easyDays, rule, p, jump10);
  if (!len2 || Math.max(q1.sec, q2.sec) <= longWorkout(len2.long10 / 10, p).sec) return null;
  return buildLengths(target10, km100(q1.km), easyDays + 1, rule, p, jump10);
}

/** Pouka 35: napomena nedelje u kojoj je drugi dan kvaliteta lagan (validator je čita kao oznaku nedelje). */
export const secondEasyNote = (q2: Dose): string =>
  `Q2: dan kvaliteta je lagan — sa dva kvaliteta dan bi trajao duže od dugog; ${q2.zone} ${fmtKm(q2.doseM / 1000)} km otpada, dugi preuzima oslobođeni obim (pouka 35).`;

/** Pouka 35: nedelja izgradnje čiji je drugi dan kvaliteta lagan (napomena secondEasyNote). */
export const secondEasyWeek = (w: { notes: readonly string[] }): boolean =>
  w.notes.some((n) => n.startsWith('Q2: dan kvaliteta je lagan') && n.endsWith('(pouka 35).'));

/** Pouka 32: napomena nedelje kad drugi član spusti dozu rasterećenja/tapera ispod doze po pravilu. MAR-09 t. 5:
    `longer` = dan kvaliteta (sekunde) je i posle spuštanja duži od dugog nedelje (najniži nivo zone je izuzet) —
    tekst to kaže umesto tvrdnje da ne sme biti duži. */
const lowerNote = (what: string, rule: Dose, got: Dose, longer: boolean): string =>
  `${what}: ${got.zone} ${fmtKm(got.doseM / 1000)} km umesto ${fmtKm(rule.doseM / 1000)} km — ${longer ? 'najniža doza zone; dan kvaliteta ostaje duži od dugog (pouka 32, najniži nivo izuzet)' : 'dan kvaliteta ne sme biti duži od dugog (pouka 32, plafon zone)'}.`;
/** MAR-09 t. 5: trening `w` traje duže od dugog nedelje posle ograničenja koraka (limitedLong10; dan dugog
    `longDate`, dužina `long10` [0,1 km]); bez dugog (dan odmora) — ne. */
const longerThanLong = (
  w: Workout | null,
  frame: WeekFrame,
  longDate: string,
  long10: number,
  p: Paces
): boolean => {
  const l10 = limitedLong10(frame, longDate, long10, p);
  return w !== null && l10 !== null && w.sec > longWorkout(l10 / 10, p).sec;
};

/** A4/A9: dan jedinog kvaliteta — željeni dan šablona, a kad je u zabrani kvaliteta drugi dan kvaliteta. */
function oneQualityDay(frame: WeekFrame, pat: Pattern, pref: Weekday): Weekday | null {
  const banned = new Set(frame.limits?.noQuality ?? []);
  const order = [pref, ...[pat.q1, pat.q2].filter((x): x is Weekday => !!x && x !== pref)];
  return order.find((wd) => !banned.has(dateOf(frame, wd))) ?? null;
}

const limitNote = (mode: QualityMode, frame: WeekFrame, targetKm: number): string[] =>
  mode === 'one' || mode === 'none'
    ? [
        frame.limits?.quality === mode
          ? `Adaptacija: ${mode === 'one' ? 'jedan kvalitet doze rasterećenja' : 'nedelja bez kvaliteta'} (ograničenje koraka, A3/A4).`
          : `Adaptacija: kvalitet ne staje u obim ${fmtKm(targetKm)} km — ${mode === 'one' ? 'jedan kvalitet doze rasterećenja' : 'nedelja bez kvaliteta'} (A9).`
      ]
    : [];

/**
 * Izgradnja, rasterećenje ili taper sa ciljem `target10` [0,1 km]. `taper` = redni broj nedelje tapera (M7)
 * ili null. `mode` 'relax' = druga pretraga cilja, samo kad nijedan cilj nije izvodljiv po pravilu
 * (generate.ts): izgradnja — M11 ispred M12 (spuštanje doze); taper — T koji ne staje u plafon otpada (MP:
 * M7a). `jump10` = plafon skoka dugog M13a (null kad ga nema).
 */
export function buildWeek(
  ctx: WeekContext,
  frame: WeekFrame,
  target10: number,
  quality: QualityState,
  lastLong10: number | null,
  longest10: number,
  taper: number | null,
  mode: QualityMode = 'rule',
  jump10: number | null = null
): BuiltWeek | null {
  const p = ctx.paces;
  const pat = ctx.pattern;
  const rule = ctx.rule;
  const targetKm = target10 / 10;
  const reduced = mode === 'one' || mode === 'none';
  if (frame.phase === 'race') return null;
  // A4: dani odmora/bola (limitDays) i napomena režima posle sastava; dugi na plafonu skoka samo dok ga dan bola
  // ne skrati.
  const done = (
    days: PlanDay[],
    long10: number | null,
    picks: Picks | null,
    notes: string[],
    jumpBound = false
  ): BuiltWeek => {
    const lim = limitDays(frame, days, long10, p);
    return finish(
      lim.days,
      lim.long10,
      picks,
      [...notes, ...limitNote(mode, frame, targetKm), ...lim.notes],
      jumpBound && lim.long10 === long10
    );
  };

  if (frame.deload) {
    // M5: jedan kvalitet (T) na danu Q2 (3 dana i početnik: Q1), dugi, ostali dani lagani. M16: u nedelji
    // testa test zamenjuje kvalitet rasterećenja (na njegovom danu; nije doza, bez plafona M11). Segment 04:
    // 'one' — T na dozvoljenom danu kvaliteta; 'none' — bez kvaliteta; A5/pouka 31: prinudno rasterećenje u
    // uvodu početnika ima sadržaj uvoda (bez kvaliteta).
    if (lastLong10 === null) return null;
    const test = frame.test === true && (mode === 'rule' || mode === 'relax');
    const slot = deloadSlot(rule.quality);
    const pref = slot === 'q1' ? pat.q1 : pat.q2!;
    const intro = frame.index <= rule.introWeeks;
    const qDay = intro || mode === 'none' ? null : test ? pref : oneQualityDay(frame, pat, pref);
    // Pouka 32: drugi član plafona zone — T rasterećenja ≤ dugi rasterećenja (najmanja doza izuzeta).
    const shorten = test || rule.beginner || ctx.adapted === true;
    const dLimit = deloadDayLimit(
      dayLimitContext(p, ctx.wc, rule, frame.limits, () => dateOf(frame, pat.long)),
      target10,
      (pat.q2 ? 2 : 1) + pat.easy.length - 1,
      lastLong10,
      jump10,
      shorten,
      ctx.adapted === true
    );
    const t0 = test || !qDay ? null : pickDeload(quality, frame.phase, targetKm, rule.beginner);
    const t = t0 ? pickDeload(quality, frame.phase, targetKm, rule.beginner, dLimit) : null;
    if (!test && !t && !intro && mode !== 'none') return null;
    const tw = test ? testWorkout(p, ctx.wc) : t ? qualityWorkout(t, p, ctx.wc, ctx.feel) : null;
    const dates = easyDates(
      frame,
      [pat.q1, ...(pat.q2 ? [pat.q2] : []), ...pat.easy].filter((wd) => !tw || wd !== qDay)
    );
    const len = deloadLengths(
      target10,
      tw ? km100(tw.km) : 0,
      dates.length,
      lastLong10,
      rule,
      p,
      jump10,
      shorten,
      ctx.adapted === true
    );
    if (!len) return null;
    const long0 = Math.min(Math.floor(P.deload.longFactor * lastLong10 + 1e-9), jump10 ?? Infinity);
    const lowered =
      t && t0 && t.doseM < t0.doseM
        ? [
            lowerNote(
              'Rasterećenje',
              t0,
              t,
              longerThanLong(tw, frame, dateOf(frame, pat.long), len.long10, p)
            )
          ]
        : [];
    const why = test ? 'M16' : rule.beginner ? 'M17' : 'A9, pouka 33';
    const longText = len.shortened
      ? `dugi ${fmtKm(len.long10 / 10)} km — skraćen sa 0,8 × poslednjeg ne-rasteretnog (${fmtKm(long0 / 10)} km) da lagani ostanu ≥ ${fmtKm(P.lengths.easyMinKm)} km (${why} ispred M5, odstupanje)`
      : len.raised
        ? `dugi ${fmtKm(len.long10 / 10)} km — 0,8 × poslednjeg ne-rasteretnog (${fmtKm(long0 / 10)} km) je kraći od najmanjeg laganog (A9: dugi ≥ lagan ≥ ${fmtKm(P.lengths.easyMinKm)} km, odstupanje)`
        : 'dugi 0,8 × poslednji ne-rasteretni (M5)';
    return done(
      [
        ...(tw && qDay
          ? [day(dateOf(frame, qDay), test ? 'test' : qDay === pat.q1 ? 'q1' : 'q2', tw)]
          : []),
        day(dateOf(frame, pat.long), 'long', longWorkout(len.long10 / 10, p)),
        ...easyDays(dates, len.easy10, p)
      ],
      len.long10,
      null,
      test
        ? [
            `Rasterećenje: cilj ${fmtKm(targetKm)} km, test ${P.test.km} km umesto kvaliteta rasterećenja (M16), ${longText}.`,
            testNote
          ]
        : intro
          ? [
              `Uvod (M17): nedelja ${frame.index} od ${rule.introWeeks} bez kvaliteta — dan kvaliteta je lagan; prinudno rasterećenje (A5): cilj ${fmtKm(targetKm)} km, nedelja bez kvaliteta, ${longText}.`
            ]
          : tw
            ? [
                `Rasterećenje: cilj ${fmtKm(targetKm)} km, jedan kvalitet (T), ${longText}.`,
                ...lowered
              ]
            : [`Rasterećenje: cilj ${fmtKm(targetKm)} km bez kvaliteta (adaptacija), ${longText}.`],
      len.jumpBound
    );
  }

  if (taper !== null) {
    // M7: MP doza tapera uvek (plafon M11 se na nju ne primenjuje, M7a); T u N−2 kad staje u plafon.
    // M17: početnik u N−1 bez MP — jedini kvalitet T kontinuirano na danu Q1. Segment 04: 'one' — samo glavni
    // kvalitet (MP; početnik N−1: T) na dozvoljenom danu kvaliteta; 'none' — bez kvaliteta.
    // Pouka 32: drugi član plafona zone — MP (početnik N−1: T) uz T na najmanjoj dozi kad T dan postoji, pa T uz
    // izabran MP; doza duža od dugog tapera se spušta po lestvici (najmanja doza izuzeta, MP 2 × 3000 m — M7a).
    const tLimit = taperWeekLimit(
      dayLimitContext(p, ctx.wc, rule, frame.limits, () => dateOf(frame, pat.long)),
      quality,
      taper,
      target10,
      ctx.input.runDays.length,
      longest10,
      jump10,
      ctx.adapted === true,
      mode === 'one'
    );
    const relaxT = mode === 'relax' || mode === 'one';
    const t =
      mode === 'none'
        ? null
        : pickTaper(quality, taper, targetKm, rule.quality, relaxT, rule.beginner, tLimit);
    const tRule =
      mode === 'none'
        ? null
        : pickTaper(quality, taper, targetKm, rule.quality, relaxT, rule.beginner);
    if (mode !== 'none' && !t) return null;
    const q1Dose = t ? (t.mp ?? t.t) : null;
    const d1 = !q1Dose ? null : mode === 'one' ? oneQualityDay(frame, pat, pat.q1) : pat.q1;
    if (q1Dose && !d1) return null;
    const w1 = q1Dose ? qualityWorkout(q1Dose, p, ctx.wc, ctx.feel) : null;
    const w2 = t && mode !== 'one' && t.mp && t.t ? qualityWorkout(t.t, p, ctx.wc, ctx.feel) : null;
    const q100 = (w1 ? km100(w1.km) : 0) + (w2 ? km100(w2.km) : 0);
    // Dani šablona bez zadržanog kvaliteta su lagani (N−1 bez T; odstupanje M11 ispred M7 za T; adaptacija).
    const kept = [...(w1 && d1 ? [d1] : []), ...(w2 && pat.q2 ? [pat.q2] : [])];
    const dates = easyDates(
      frame,
      [pat.q1, ...(pat.q2 ? [pat.q2] : []), ...pat.easy].filter((wd) => !kept.includes(wd))
    );
    const len = taperLengths(
      target10,
      q100,
      dates.length,
      longest10,
      taper,
      rule,
      p,
      jump10,
      ctx.adapted === true
    );
    if (!len) return null;
    const tw = P.taper.weeks[taper]!;
    const lf = len.raised
      ? `dugi ${fmtKm(len.long10 / 10)} km > ${fmtKm(tw.longFactor)} × najduži — najmanji lagan (A9: dugi ≥ lagan ≥ ${fmtKm(P.lengths.easyMinKm)} km, odstupanje)`
      : `dugi ≤ ${fmtKm(tw.longFactor)} × najduži`;
    const note =
      mode === 'none'
        ? `Taper (N−${2 - taper}) bez kvaliteta (adaptacija); ${lf} (M7).`
        : mode === 'one'
          ? `Taper (N−${2 - taper}): samo ${t!.mp ? 'MP' : 'T'} ≈ ${Math.round((t!.mp ? tw.mpShare : P.deload.tShare) * 100)} % poslednje doze (adaptacija); ${lf} (M7).`
          : !t!.mp
            ? `Taper (N−1, početnik M17): cilj ${fmtKm(tw.factor)} × vrh, jedan kvalitet T kontinuirano ≈ 60 % poslednje T doze (min ${fmtKm(P.beginner.tFirstKm)} km), bez MP — trkačka nedelja bez oštrenja (cilj: završiti); ${lf} (M7).`
            : rule.quality === 1
              ? `Taper (N−${2 - taper}): cilj ${fmtKm(tw.factor)} × vrh, jedan kvalitet MP ≈ ${Math.round(tw.mpShare * 100)} % poslednje doze (${rule.beginner ? 'početnik' : '3 dana'}), ${lf} (M7).`
              : tw.tShare !== null && !w2
                ? `Taper (N−${2 - taper}): T ${fmtKm(P.taper.tMinKm)} km po pravilu ne staje u plafon zone (M11 ispred M7, odstupanje) — dan je lagan; ${lf} (M7).`
                : taper === 0
                  ? `Taper (N−2): cilj ${fmtKm(tw.factor)} × vrh, MP i T ≈ 60 % poslednje doze, ${lf} (M7).`
                  : `Taper (N−1): cilj ${fmtKm(tw.factor)} × vrh, MP ≈ 50 % poslednje doze, bez T, ${lf} (M7).`;
    const lowered = [
      ...(w1 &&
      t &&
      tRule &&
      q1Dose &&
      (tRule.mp ?? tRule.t) &&
      q1Dose.doseM < (tRule.mp ?? tRule.t)!.doseM
        ? [
            lowerNote(
              `Taper (N−${2 - taper})`,
              (tRule.mp ?? tRule.t)!,
              q1Dose,
              longerThanLong(w1, frame, dateOf(frame, pat.long), len.long10, p)
            )
          ]
        : []),
      ...(w2 && t?.t && tRule?.t && t.t.doseM < tRule.t.doseM
        ? [
            lowerNote(
              `Taper (N−${2 - taper})`,
              tRule.t,
              t.t,
              longerThanLong(w2, frame, dateOf(frame, pat.long), len.long10, p)
            )
          ]
        : [])
    ];
    const mp = t?.mp ?? null;
    const overCap =
      mp && w1 && mp.doseM > capM('MP', targetKm)
        ? [
            `Taper (N−${2 - taper}): MP ${fmtKm(mp.doseM / 1000)} km je ${fmtKm((100 * mp.doseM) / 1000 / targetKm)} % cilja — minimum MP tapera (M7) ispred plafona 20 % (M11), samo u taperu (M7a).`
          ]
        : [];
    return done(
      [
        ...(w1 && d1 ? [day(dateOf(frame, d1), d1 === pat.q1 ? 'q1' : 'q2', w1)] : []),
        ...(w2 ? [day(dateOf(frame, pat.q2!), 'q2', w2)] : []),
        day(dateOf(frame, pat.long), 'long', longWorkout(len.long10 / 10, p)),
        ...easyDays(dates, len.easy10, p)
      ],
      len.long10,
      null,
      [note, ...lowered, ...overCap],
      len.jumpBound
    );
  }

  // M17: uvod bez kvaliteta; M16: test na danu Q1; početnik: T kontinuirano kad prvi nivo lestvice faze ne
  // staje u plafon, bez kvaliteta kad ni 1,5 km ne staje (odstupanje M17). Dan Q1 bez treninga kvaliteta (i
  // bez testa) je lagan. Segment 04: 'one' — jedan kvalitet doze rasterećenja na danu T slota (u zabrani: drugi
  // dan kvaliteta), bez testa; 'none' — bez kvaliteta i bez testa; stanje doze se tada ne menja (picks null).
  const intro = frame.index <= rule.introWeeks;
  const test = frame.test === true && (mode === 'rule' || mode === 'relax');
  let picks: Picks | null;
  let one: { dose: Dose; day: Weekday } | null = null;
  // Pouka 32: drugi član plafona zone (trajanje dana ≤ dugi iste nedelje; najniži nivo izuzet).
  const dlc = dayLimitContext(p, ctx.wc, rule, frame.limits, () => dateOf(frame, pat.long));
  let oneLow: [Dose, Dose] | null = null;
  if (intro) picks = { q1: null, q2: null };
  else if (reduced) {
    picks = null;
    if (mode === 'one') {
      const slot = deloadSlot(rule.quality);
      const wd = oneQualityDay(frame, pat, slot === 'q1' ? pat.q1 : pat.q2!);
      const d0 = wd ? pickDeload(quality, frame.phase, targetKm, rule.beginner) : null;
      const d = d0
        ? pickDeload(
            quality,
            frame.phase,
            targetKm,
            rule.beginner,
            oneDayLimit(dlc, target10, (pat.q2 ? 2 : 1) + pat.easy.length - 1, jump10)
          )
        : null;
      if (!d || !wd) return null;
      one = { dose: d, day: wd };
      if (d0 && d.doseM < d0.doseM) oneLow = [d0, d];
    }
  } else {
    picks = pickBuild(
      quality,
      frame.phase,
      targetKm,
      p,
      rule,
      mode === 'relax',
      test,
      buildDayLimit(
        dlc,
        target10,
        pat.easy.length,
        jump10,
        rule.quality === 2 ? ladderFor(frame.phase, 'q2') : null,
        test ? testWorkout(p, ctx.wc) : null
      )
    );
    if (!picks) return null;
  }
  const w1 = test
    ? testWorkout(p, ctx.wc)
    : picks?.q1
      ? qualityWorkout(picks.q1, p, ctx.wc, ctx.feel)
      : null;
  let w2 = picks?.q2 ? qualityWorkout(picks.q2, p, ctx.wc, ctx.feel) : null;
  const wo = one ? qualityWorkout(one.dose, p, ctx.wc, ctx.feel) : null;
  const busy = [
    ...(w1 ? [pat.q1] : []),
    ...(w2 && pat.q2 ? [pat.q2] : []),
    ...(one ? [one.day] : [])
  ];
  let dates = easyDates(
    frame,
    [pat.q1, ...(pat.q2 ? [pat.q2] : []), ...pat.easy].filter((wd) => !busy.includes(wd))
  );
  const q100 = (w1 ? km100(w1.km) : 0) + (w2 ? km100(w2.km) : 0) + (wo ? km100(wo.km) : 0);
  let len = buildLengths(target10, q100, dates.length, rule, p, jump10);
  if (!len) return null;
  const notes: string[] = oneLow
    ? [
        lowerNote(
          'Adaptacija',
          oneLow[0],
          oneLow[1],
          longerThanLong(wo, frame, dateOf(frame, pat.long), len.long10, p)
        )
      ]
    : [];
  // Pouka 35: dva dana kvaliteta samo kad dugi ostaje najduži — inače drugi dan kvaliteta je lagan (stanje slota Q2
  // se ne menja, picks.q2 = null), prvi ostaje.
  const easy35 =
    w1 && w2 && picks?.q1 && picks.q2 && !test
      ? secondQualityEasy(target10, rule, p, jump10, dates.length, w1, w2)
      : null;
  if (easy35 && picks?.q2) {
    notes.push(secondEasyNote(picks.q2));
    picks = { ...picks, q2: null };
    w2 = null;
    dates = easyDates(
      frame,
      [pat.q1, ...(pat.q2 ? [pat.q2] : []), ...pat.easy].filter((wd) => wd !== pat.q1)
    );
    len = easy35;
  }
  if (intro)
    notes.push(
      `Uvod (M17): nedelja ${frame.index} od ${rule.introWeeks} bez kvaliteta — dan kvaliteta je lagan.`
    );
  else if (test) notes.push(testNote);
  else if (reduced) {
    // Napomena režima (limitNote).
  } else if (!w1)
    notes.push(
      `Bez kvaliteta: ni T ${fmtKm(P.beginner.tFirstKm)} km kontinuirano ne staje u plafon ${P.caps.T * 100} % cilja ${fmtKm(targetKm)} km (M11 ispred M17, odstupanje).`
    );
  else if (picks?.q1 && picks.q1.ladder !== ladderFor(frame.phase, 'q1', rule.quality)) {
    const phaseLadder = ladderFor(frame.phase, 'q1', rule.quality);
    const first = doseOf(ladderLevels(phaseLadder)[0]!) / 1000;
    notes.push(
      `T kontinuirano (M17): prvi nivo ${phaseLadder} (${fmtKm(first)} km) ne staje u plafon ${P.caps[zoneOf(phaseLadder)] * 100} % cilja ${fmtKm(targetKm)} km.`
    );
  }
  const slots: [string, Dose, SlotState | null][] = [];
  if (picks?.q1) slots.push(['Q1', picks.q1, quality.q1]);
  if (picks?.q2) slots.push(['Q2', picks.q2, quality.q2]);
  for (const [slot, d] of slots) if (d.step === 'repeat') notes.push(repeatNote(slot, d));
  for (const [slot, d, prev] of slots)
    if (d.step === 'drop')
      notes.push(
        (prev?.doseM ?? 0) <= capM(d.zone, targetKm)
          ? `${slot}: ${d.zone} spušten sa ${fmtKm((prev?.doseM ?? 0) / 1000)} na ${fmtKm(d.doseM / 1000)} km — kvalitetni dan bi trajao duže od dugog (plafon ${d.zone === 'MP' ? 'MP, pouka 14' : 'zone, pouka 32'}).`
          : `${slot}: ${d.zone} spušten sa ${fmtKm((prev?.doseM ?? 0) / 1000)} na ${fmtKm(d.doseM / 1000)} km — nijedan cilj nedelje nije izvodljiv uz „doza ne pada" i plafon (M11 ispred M12).`
      );
  return done(
    [
      ...(w1 ? [day(dateOf(frame, pat.q1), test ? 'test' : 'q1', w1)] : []),
      ...(w2 ? [day(dateOf(frame, pat.q2!), 'q2', w2)] : []),
      ...(one && wo ? [day(dateOf(frame, one.day), one.day === pat.q1 ? 'q1' : 'q2', wo)] : []),
      day(dateOf(frame, pat.long), 'long', longWorkout(len.long10 / 10, p)),
      ...easyDays(dates, len.easy10, p)
    ],
    len.long10,
    picks,
    notes,
    len.jumpBound
  );
}

/** Pouka 30 (N1, kao HM-04 t. 4; MAR-09 t. 1): trkačka nedelja samo sa trkom — dani trčanja pre trke su dani
    odmora koraka (A4) ili ih je pouka 30 pretvorila u odmor (`raceWeekRest`: taper N−1 skraćen do nule). Trkačka
    nedelja nikad nije prazna (EMPTY_WEEK) — ima trku; ovo je skraćena trkačka nedelja (upozorenje
    RACE_WEEK_SHORT). Koji dani smeju da otpadnu proverava RACE_WEEK (raceWeekRuns + raceWeekRest, isti podatak kao
    konstrukcija). JEDINO mesto izuzetka; validator ga čita. */
export function raceOnlyWeek(w: { phase: string; days: readonly { role: DayRole }[] }): boolean {
  return w.phase === 'race' && w.days.length === 1 && w.days[0]!.role === 'race';
}

/** MAR-08b (K3, kao N1): nedelja (ne trkačka) bez ijednog treninga jer su SVI dani trčanja dani odmora bola (A4) —
    upozorenje WEEK_ALL_REST, ne EMPTY_WEEK. `runDates` = datumi dana trčanja nedelje po šablonu. */
export function allRestWeek(
  w: { phase: string; days: readonly { countsToWeek: boolean }[]; limits?: WeekLimits },
  runDates: readonly string[]
): boolean {
  const rest = new Set(w.limits?.rest ?? []);
  return (
    w.phase !== 'race' &&
    w.days.every((d) => !d.countsToWeek) &&
    runDates.length > 0 &&
    runDates.every((d) => rest.has(d))
  );
}

/** M8: oštrenje (2 × 2000 m MP) samo kad je ≤ MP doza poslednje nedelje tapera `taperMpM`. */
export function hasSharpener(taperMpM: number): boolean {
  const s = P.raceWeek.sharpener;
  return taperMpM >= s.reps * s.repM;
}

/** M8: dani trčanja trkačke nedelje osim trke — ukupno sa trkom najviše min(broj dana, 5); otpada prvo dan
    dugog, pa najraniji lagan dan šablona. Datumi rastuće. */
export function raceWeekRuns(
  runDays: readonly Weekday[],
  pattern: Pattern,
  frame: WeekFrame,
  race: string
): string[] {
  const runs = runDays
    .map((wd) => dateOf(frame, wd))
    .filter((d) => d !== race)
    .sort();
  const keep = Math.min(runDays.length, P.raceWeek.maxRunDays) - 1;
  const order = [dateOf(frame, pattern.long), ...easyDates(frame, pattern.easy)];
  const drop = order.filter((d) => runs.includes(d)).slice(0, Math.max(0, runs.length - keep));
  return runs.filter((d) => !drop.includes(d));
}

/** M8: lagan dan trkačke nedelje = min(30 min E, najkraći lagan N−1 `taperEasy10` [0,1 km]); kad je lagan
    tapera kraći, dan se zadaje u km. */
export function raceEasyWorkout(taperEasy10: number, p: Paces): Workout {
  const timed = easyTimeWorkout(P.raceWeek.otherEasySec, p);
  return taperEasy10 * 10 < km100(timed.km) ? easyWorkout(taperEasy10 / 10, p) : timed;
}

/**
 * Pouka 30 (jedino mesto): datumi trkačke nedelje koji postaju odmor kad trkačka nedelja bez trke ne bi bila ≤
 * planirano poslednje nedelje tapera `cap100` [0,01 km] (taper skraćen danima odmora/bola) — prvo dani bola, pa
 * najraniji lagani, najmanje koliko treba; dan pred trku i trka nikad. `runs` = dani trčanja bez trke (M8, bez
 * dana odmora koraka), bez oštrenja (A9 ga ukida pre ovoga). Konstrukcija (raceWeek) ga primenjuje, validator ga
 * čita (isti podatak). Prazno kad staje.
 */
export function raceWeekRest(
  runs: readonly string[],
  race: string,
  pain: ReadonlySet<string>,
  taperEasy10: number,
  p: Paces,
  cap100: number
): string[] {
  // Isti dani kao raceWeek + limitDays: lagan min(30 min E, lagan N−1), na danu bola × 0,7 (A4).
  const easyKm = raceEasyWorkout(taperEasy10, p).km;
  const km = new Map(
    runs.map((d) => [
      d,
      daysBetween(d, race) === 1
        ? km100(eveWorkout(p, !pain.has(d)).km)
        : pain.has(d)
          ? limitedEasy10(Math.round(easyKm * 10), true, null) * 10
          : km100(easyKm)
    ])
  );
  let total = [...km.values()].reduce((a, x) => a + x, 0);
  const order = [
    ...runs.filter((d) => pain.has(d) && daysBetween(d, race) !== 1),
    ...runs.filter((d) => !pain.has(d) && daysBetween(d, race) !== 1)
  ];
  const out: string[] = [];
  for (const d of order) {
    if (total <= cap100) break;
    out.push(d);
    total -= km.get(d)!;
  }
  return total <= cap100 ? out.sort() : [];
}

/**
 * M8: trkačka nedelja. Trka zamenjuje dugi. Oštrenje (≤ MP doza N−1) na najkasnijem danu ≥ 3 dana pre trke
 * koji nije susedan poslednjem zahtevnom danu tapera `prevHard` (M9); nema takvog dana → bez oštrenja
 * (odstupanje). Dan pred trku 20 min E + ubrzanja; ostali min(30 min E, najkraći lagan N−1). Trka (sa WU) se
 * ne računa u obim. Segment 04: oštrenje ne pada na dan zabrane kvaliteta i otpada kad trkačka sa njim ne bi
 * bila ≤ taper (`noSharpener`, A9); `cap100` (pouka 30): višak laganih dana postaje odmor (raceWeekRest);
 * dani odmora/bola koraka (limitDays).
 */
export function raceWeek(
  ctx: WeekContext,
  frame: WeekFrame,
  taperMpM: number,
  prevHard: string | null,
  taperEasy10: number,
  noSharpener = false,
  cap100: number | null = null
): BuiltWeek {
  const q = P.raceWeek;
  const p = ctx.paces;
  const race = ctx.input.raceDate;
  const runs0 = raceWeekRuns(ctx.input.runDays, ctx.pattern, frame, race);
  const restK = new Set(frame.limits?.rest ?? []);
  const rested =
    cap100 === null
      ? []
      : raceWeekRest(
          runs0.filter((d) => !restK.has(d)),
          race,
          new Set(frame.limits?.pain ?? []),
          taperEasy10,
          p,
          cap100
        );
  const runs = runs0.filter((d) => !rested.includes(d));
  const sharpen = hasSharpener(taperMpM);
  const banned = new Set(frame.limits?.noQuality ?? []);
  const cands = sharpen
    ? [...runs]
        .reverse()
        .filter(
          (d) =>
            daysBetween(d, race) >= q.sharpenerMinGapDays &&
            (prevHard === null || daysBetween(prevHard, d) >= 2)
        )
    : [];
  const sharpenDate = noSharpener ? null : (cands.find((d) => !banned.has(d)) ?? null);
  const days: PlanDay[] = [day(race, 'race', raceWorkout(p, ctx.raceSec), false)];
  const easy = raceEasyWorkout(taperEasy10, p);
  for (const d of runs) {
    if (d === sharpenDate) days.push(day(d, 'sharpener', sharpenerWorkout(p, ctx.wc, ctx.feel)));
    else if (daysBetween(d, race) === 1) days.push(day(d, 'eve', eveWorkout(p)));
    else days.push(day(d, 'easy', easy));
  }
  const s = q.sharpener;
  const shortened =
    easy.blocks[0]?.kind === 'easy' && days.some((d) => d.role === 'easy')
      ? [
          `Trkačka nedelja: lagan ${fmtKm(easy.km)} km = najkraći lagan tapera (kraći od ${Math.round(q.otherEasySec / 60)} min E; trkačka ≤ taper, M8).`
        ]
      : [];
  const lim = limitDays(frame, days, null, p);
  return finish(lim.days, null, null, [
    sharpenDate
      ? `Trkačka nedelja: oštrenje ${s.reps} × ${s.repM} m MP (≤ MP doza poslednje nedelje tapera ${fmtKm(taperMpM / 1000)} km); maraton ${fmtKm(q.raceKm)} km se ne računa u obim (M8).`
      : !sharpen
        ? `Trkačka nedelja: poslednja nedelja tapera bez MP — bez oštrenja (oštrenje ≤ MP doza tapera, M8); maraton ${fmtKm(q.raceKm)} km se ne računa u obim.`
        : cands.length > 0
          ? noSharpener
            ? `Trkačka nedelja: bez oštrenja — sa njim bi trkačka nedelja bila veća od poslednje nedelje tapera (A9, M8); maraton ${fmtKm(q.raceKm)} km se ne računa u obim.`
            : `Trkačka nedelja: bez oštrenja — dan oštrenja je u zabrani kvaliteta (adaptacija); maraton ${fmtKm(q.raceKm)} km se ne računa u obim.`
          : `Trkačka nedelja: nijedan dan trčanja nije ≥ ${q.sharpenerMinGapDays} dana pre trke i nesusedan poslednjem zahtevnom danu tapera — bez oštrenja (M8, odstupanje); maraton ${fmtKm(q.raceKm)} km se ne računa u obim.`,
    ...shortened,
    ...(rested.length > 0
      ? ['Trkačka nedelja skraćena: taper je imao dane odmora/bola (pouka 30).']
      : []),
    ...lim.notes
  ]);
}
