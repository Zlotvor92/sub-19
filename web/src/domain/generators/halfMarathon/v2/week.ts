/* Sastav nedelje: izgradnja, rasterećenje (H5 sadržaj), taper (H7), trkačka nedelja (H8); test 5 km (H16);
   uvod i T kontinuirano početnika (H17, HI10). Doze bira quality.ts, dužine lengths.ts, treninge workouts.ts;
   ovde se samo raspoređuju po danima šablona (H9). null = nedelja sa ovim ciljem nije izvodljiva po pravilima
   (volume.ts traži najbliži izvodljiv cilj). */

import { addDays, daysBetween, weekdayOf } from './dates.ts';
import {
  buildLengths,
  deloadEasyShort,
  deloadLengths,
  deloadLong10,
  type Lengths,
  longCap10,
  longFor10,
  taperLengths
} from './lengths.ts';
import { HM_V2_POLICY as P, type PlanRule } from './policy.ts';
import {
  beginnerTaperT,
  type BuildLimit,
  capM,
  type DayFits,
  deloadDose,
  deloadSlot,
  ladderFor,
  pickBuild,
  type QualityState,
  type SlotState,
  taperDoses,
  taperTFloor,
  type WeekPicks
} from './quality.ts';
import type {
  DayRole,
  Dose,
  HmV2Input,
  LadderId,
  Paces,
  Pattern,
  PlanDay,
  Structure,
  WeekFrame,
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
  structuresForDose,
  sharpenerWorkout,
  testWorkout,
  type WarmupCooldown,
  zoneOf
} from './workouts.ts';

export interface WeekContext {
  input: HmV2Input;
  paces: Paces;
  pattern: Pattern;
  /** Prognoza polumaratona [s] (trka). */
  raceSec: number;
  /** H14: WU/CD po pojasu trenutnog obima (početnik 15/10, H17). */
  wc: WarmupCooldown;
  /** H15/H17: pravilo plana (red tabele dana, iskustvo). */
  rule: PlanRule;
  /** H16: plan po osećaju (RPE na kvalitetu). */
  feel: boolean;
}

/** Režim kvaliteta nedelje: 'rule' po pravilu; 'relax' druga pretraga (HI2: H11 ispred H12, rasterećenje
    bez kvaliteta, taper samo RP / bez kvaliteta) — samo kad nijedan cilj nije izvodljiv po pravilu. */
export type QualityMode = 'rule' | 'relax';

export interface BuiltWeek {
  days: PlanDay[];
  planned100: number;
  /** Dugi nedelje [0,1 km]; null u trkačkoj nedelji. */
  long10: number | null;
  /** Izbor doza nedelje izgradnje (stanje za sledeću nedelju); null van ne-rasteretne izgradnje. */
  picks: WeekPicks | null;
  notes: string[];
}

export const HARD_ROLES: readonly DayRole[] = ['q1', 'q2', 'long', 'sharpener', 'race', 'test'];
const km100 = (km: number): number => Math.round(km * 100);

function day(date: string, role: DayRole, workout: Workout, countsToWeek = true): PlanDay {
  return {
    date,
    weekday: weekdayOf(date),
    role,
    hard: HARD_ROLES.includes(role),
    countsToWeek,
    workout
  };
}

function finish(
  days: PlanDay[],
  long10: number | null,
  picks: WeekPicks | null,
  notes: string[]
): BuiltWeek {
  days.sort((a, b) => a.date.localeCompare(b.date));
  const planned100 = days.reduce((a, d) => a + (d.countsToWeek ? km100(d.workout.km) : 0), 0);
  return { days, planned100, long10, picks, notes };
}

export const dateOf = (frame: { startDate: string; index: number }, wd: Weekday): string => {
  for (let i = 0; i < 7; i++) {
    const d = addDays(frame.startDate, i);
    if (weekdayOf(d) === wd) return d;
  }
  throw new Error(`Dan ${wd} nije u nedelji ${frame.index}.`);
};

/** H16: napomena nedelje testa. */
export const TEST_NOTE = `Test ${P.test.km} km (H16): kontrolisano maksimalno; računa se u obim nedelje, ne u dozu kvaliteta; rezultat koristi adaptacija (segment 04), do tada tempo ostaje procena.`;

/** Napomena kad slot ponavlja trening jer druga struktura iste doze ne postoji (H10). */
const repeatNote = (slot: string, d: Dose): string =>
  `${slot}: ${d.zone} ${fmtKm(d.doseM / 1000)} km ponovljen — sledeći nivo ne staje u plafon, a druga struktura iste doze ${structuresForDose(d.ladder as LadderId, d.doseM).length > 1 ? 'bi bila duža od dugog (pouka 32)' : 'ne postoji (H10)'}.`;

/** Lagani dani: datumi rastuće (raniji dan dobija višak zaokruženja). */
const easyDates = (frame: WeekFrame, days: readonly Weekday[]): string[] =>
  days.map((wd) => dateOf(frame, wd)).sort();

const easyDays = (dates: readonly string[], easy10: readonly number[], p: Paces): PlanDay[] =>
  dates.map((d, i) => day(d, 'easy', easyWorkout(easy10[i]! / 10, p)));

/* ---------- Pouka 32: drugi član plafona zone (trajanje dana ≤ dugi iste nedelje) ---------- */

/** Šta drugi član čita iz nedelje (konstruktor iz WeekContext, validator iz plana). */
export interface DayLimitContext {
  paces: Paces;
  wc: WarmupCooldown;
  rule: PlanRule;
}

/** Dan kvaliteta (ili testa) koji je već u nedelji: km [0,01 km] i trajanje [s]; `sec` null = izuzet
    (najniži nivo zone ili test — upozorenje, ne pomera dozu). */
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

/** Pouka 32: predikat drugog člana — dan sa strukturom `s` i već postavljen dan `other` staju u trajanje
    dugog nedelje sa oba dana (`longOf`: dužine nedelje za zbir km dana kvaliteta; null = bez izvodljivih
    dužina — član ne poredi, izvodljivost odlučuje pretraga cilja). */
function dayLimit(
  c: DayLimitContext,
  longOf: (quality100: number) => Lengths | null,
  other: FixedDay | null
): DayFits {
  return (ladder, s, exempt) => {
    const d = doseFor(ladder, s);
    const len = longOf(km100(qualityWorkout(d, c.paces, c.wc).km) + (other?.km100 ?? 0));
    if (!len) return 'none';
    const long = longWorkout(len.long10 / 10, c.paces).sec;
    return (exempt || qualityDaySec(d, c.paces, c.wc) <= long) && (other?.sec ?? 0) <= long
      ? 'fits'
      : 'over';
  };
}

/** Pouka 32: dan kao FixedDay — `exempt` (najniži nivo zone ili test) nema trajanje u poređenju. */
export function fixedDay(c: DayLimitContext, w: Workout, exempt: boolean): FixedDay {
  return {
    km100: km100(w.km),
    sec: exempt || !w.dose ? null : qualityDaySec(w.dose, c.paces, c.wc)
  };
}

/** Najniži nivo lestvice dana izgradnje (pouka 32 izuzetak; početnik: lestvica HI10). */
export const lowestBuild = (d: Dose, beginner: boolean): boolean =>
  d.doseM <= doseOf(ladderLevels(d.ladder as LadderId, beginner)[0]!);

/**
 * Pouka 32 u nedelji izgradnje: Q1 se bira uz Q2 najniže doze lestvice faze (`q2Ladder`; null = jedan
 * kvalitet) u strukturi sa najviše km (svaki Q2 te doze tada ostavlja Q1 ≤ dugi), Q2 uz izabran Q1 (`test` —
 * dan testa H16 umesto Q1). `easyDays` = lagani dani nedelje sa oba dana kvaliteta. Jedna funkcija za
 * konstruktor i validator.
 */
export function buildDayLimit(
  c: DayLimitContext,
  target10: number,
  easyDays: number,
  roll10: number,
  q2Ladder: LadderId | null,
  test: Workout | null
): BuildLimit {
  const longOf = (q100: number) => buildLengths(target10, q100, easyDays, c.rule, c.paces, roll10);
  const q2Low = q2Ladder
    ? structuresForDose(q2Ladder, doseOf(ladderLevels(q2Ladder)[0]!))
        .map((s) => qualityWorkout(doseFor(q2Ladder, s), c.paces, c.wc))
        .reduce((a, w) => (km100(w.km) > km100(a.km) ? w : a))
    : null;
  return {
    q1: dayLimit(c, longOf, q2Low ? fixedDay(c, q2Low, true) : null),
    q2: (q1) =>
      dayLimit(
        c,
        longOf,
        test
          ? fixedDay(c, test, true)
          : q1
            ? fixedDay(c, qualityWorkout(q1, c.paces, c.wc), lowestBuild(q1, c.rule.beginner))
            : null
      )
  };
}

/** Pouka 32 u rasterećenju: jedini kvalitet (T) ≤ dugi rasterećenja (deloadLengths sa tim danom). */
export function deloadDayLimit(
  c: DayLimitContext,
  target10: number,
  easyDays: number,
  lastLong10: number,
  roll10: number
): DayFits {
  return dayLimit(
    c,
    (q100) => deloadLengths(target10, q100, easyDays, lastLong10, c.rule, c.paces, roll10),
    null
  );
}

/** Pouka 32 u taperu: RP uz T na najmanjoj dozi, pa T uz izabran RP (najmanja doza RP izuzeta);
    početnik — jedini dan (T kontinuirano, HI10). `easyDays` = lagani dani sa svim danima kvaliteta. */
export function taperDayLimit(
  c: DayLimitContext,
  target10: number,
  easyDays: number,
  longest10: number,
  roll10: number,
  quality: 1 | 2
): { q1: DayFits; q2: (q1: Dose) => DayFits } {
  const longOf = (q100: number) =>
    taperLengths(target10, q100, easyDays, longest10, c.rule, c.paces, roll10);
  const tLow =
    quality === 2 ? fixedDay(c, qualityWorkout(taperTFloor(), c.paces, c.wc), true) : null;
  const rpMin = P.taper.rpMin.reps * P.taper.rpMin.repM;
  return {
    q1: dayLimit(c, longOf, tLow),
    q2: (rp) =>
      dayLimit(c, longOf, fixedDay(c, qualityWorkout(rp, c.paces, c.wc), rp.doseM <= rpMin))
  };
}

/**
 * Izgradnja, rasterećenje ili taper sa ciljem `target10` [0,1 km]. `mode` 'relax' = druga pretraga cilja,
 * samo kad nijedan cilj nije izvodljiv po pravilu (generate.ts): izgradnja — H11 ispred H12 (spuštanje
 * doze); rasterećenje — bez kvaliteta kad ni najmanja T doza ne staje u plafon H11; taper — samo RP, a kad
 * ni RP 2 × 2000 m ne staje u plafon, bez kvaliteta. `roll10`: kotrljajuća granica dugog nedelje (pouka 28,
 * HI7; lengths.rollingLongCap10).
 */
export function buildWeek(
  ctx: WeekContext,
  frame: WeekFrame,
  target10: number,
  quality: QualityState,
  lastLong10: number | null,
  longest10: number,
  mode: QualityMode = 'rule',
  roll10 = Infinity
): BuiltWeek | null {
  const p = ctx.paces;
  const pat = ctx.pattern;
  const rule = ctx.rule;
  const targetKm = target10 / 10;
  const relax = mode === 'relax';
  if (frame.phase === 'race') return null;

  const qDays = [pat.q1, ...(pat.q2 ? [pat.q2] : [])];
  // H17: nedelje uvoda bez kvaliteta; HI13 (pouka 31): i kad je nedelja uvoda rasteretna.
  const intro = frame.index <= rule.introWeeks;
  // H16: nedelja testa 5 km (plan po osećaju koji nije početnik).
  const test = frame.test === true;
  if (frame.deload) {
    // H5: jedan kvalitet (T) na danu T slota (Q2; 3 dana Q1, HI6), dugi 0,8 ×, ostali dani lagani. H16: u
    // nedelji testa test zamenjuje kvalitet rasterećenja (na njegovom danu; nije doza, bez plafona H11).
    if (lastLong10 === null) return null;
    // H11 proverava dozu po pravilu (≈ 60 %); drugi član plafona (pouka 32) je spušta kad bi dan bio duži od
    // dugog rasterećenja.
    const d0 = deloadDose(quality, frame.phase, rule);
    const fits = !intro && !test && d0.doseM <= capM('T', targetKm);
    if (!fits && !relax && !intro && !test) return null;
    const dl: DayLimitContext = { paces: p, wc: ctx.wc, rule };
    const nEasy = qDays.length - 1 + pat.easy.length;
    const d = fits
      ? deloadDose(
          quality,
          frame.phase,
          rule,
          deloadDayLimit(dl, target10, nEasy, lastLong10, roll10)
        )
      : d0;
    const slot = deloadSlot(rule.quality);
    const tDay = slot === 'q1' ? pat.q1 : pat.q2!;
    // Pouka 32 (nedelja testa): dugi naviše do trajanja dana testa, u granicama (deloadLengths).
    const minLong10 = test ? longFor10(testWorkout(p, ctx.wc).sec, p) : 0;
    const lengthsWith = (w: Workout | null) => {
      const ds = easyDates(
        frame,
        [...qDays, ...pat.easy].filter((wd) => !w || wd !== tDay)
      );
      return {
        w,
        dates: ds,
        len: deloadLengths(
          target10,
          w ? km100(w.km) : 0,
          ds.length,
          lastLong10,
          rule,
          p,
          roll10,
          minLong10
        )
      };
    };
    // HI14: kvalitet otpada samo kad ni sa skraćenim dugim lagani ne ostaju ≥ 4 km (cilj nedelje ostaje).
    let c = lengthsWith(
      test ? testWorkout(p, ctx.wc) : fits ? qualityWorkout(d, p, ctx.wc, ctx.feel) : null
    );
    const qualityDropped =
      !c.len &&
      fits &&
      deloadEasyShort(target10, km100(c.w!.km), c.dates.length, lastLong10, rule, p, roll10);
    if (qualityDropped) c = lengthsWith(null);
    const { w: tw, dates, len } = c;
    if (!len) return null;
    const long0 = Math.min(deloadLong10(lastLong10), longCap10(target10, rule, p, roll10));
    const shortNote =
      len.long10 < long0
        ? [
            `Dugi skraćen na ${fmtKm(len.long10 / 10)} km da lagani ostanu ≥ ${fmtKm(P.lengths.easyMinKm)} km (rasterećenje, najmanji obim; 0,8 × poslednji = ${fmtKm(long0 / 10)} km; HI14).`
          ]
        : len.long10 > long0
          ? [
              `Dugi podignut na ${fmtKm(len.long10 / 10)} km (0,8 × poslednji = ${fmtKm(long0 / 10)} km) da dan testa ne bude duži od dugog (pouka 32).`
            ]
          : [];
    const doseNote =
      tw && !test && d.doseM < d0.doseM
        ? [
            `T ${fmtKm(d.doseM / 1000)} km umesto ${fmtKm(d0.doseM / 1000)} km (≈ 60 %): dan kvaliteta ne sme biti duži od dugog rasterećenja (pouka 32).`
          ]
        : [];
    const longText =
      len.long10 < long0 ? 'dugi skraćen (HI14)' : 'dugi 0,8 × poslednji ne-rasteretni';
    return finish(
      [
        ...(tw ? [day(dateOf(frame, tDay), test ? 'test' : slot, tw)] : []),
        day(dateOf(frame, pat.long), 'long', longWorkout(len.long10 / 10, p)),
        ...easyDays(dates, len.easy10, p)
      ],
      len.long10,
      null,
      test
        ? [
            `Rasterećenje: cilj ${fmtKm(targetKm)} km, test ${P.test.km} km umesto kvaliteta rasterećenja (H16), dugi ${len.long10 < long0 ? `${fmtKm(len.long10 / 10)} km — skraćen sa 0,8 × poslednjeg ne-rasteretnog (${fmtKm(long0 / 10)} km) da lagani ostanu ≥ ${fmtKm(P.lengths.easyMinKm)} km (H16 ispred H5, odstupanje, HI11)` : len.long10 > long0 ? `${fmtKm(len.long10 / 10)} km — podignut sa 0,8 × poslednjeg ne-rasteretnog (${fmtKm(long0 / 10)} km) da dan testa ne bude duži od dugog (pouka 32)` : '0,8 × poslednji ne-rasteretni (H5)'}.`,
            TEST_NOTE
          ]
        : [
            intro
              ? `Rasterećenje u uvodu (HI13, pouka 31): cilj ${fmtKm(targetKm)} km bez kvaliteta — sadržaj uvoda; ${longText}.`
              : tw
                ? `Rasterećenje: cilj ${fmtKm(targetKm)} km, jedan kvalitet (T ${fmtKm(d.doseM / 1000)} km), ${longText} (H5).`
                : qualityDropped
                  ? `Rasterećenje: cilj ${fmtKm(targetKm)} km bez kvaliteta — ni uz skraćen dugi T ${fmtKm(d.doseM / 1000)} km ne ostavlja lagane ≥ ${fmtKm(P.lengths.easyMinKm)} km (HI14, odstupanje); ${longText}.`
                  : `Rasterećenje: cilj ${fmtKm(targetKm)} km bez kvaliteta — T ${fmtKm(d.doseM / 1000)} km ne staje u plafon ${P.caps.T * 100} % (H11 ispred H5, odstupanje); ${longText}.`,
            ...doseNote,
            ...shortNote
          ]
    );
  }

  if (frame.phase === 'taper') {
    // H7: RP (Q1) i T (Q2) ≈ 60 % poslednje doze (3 dana samo RP, HI6); druga pretraga: samo RP, pa bez
    // kvaliteta.
    // H11 proverava doze po pravilu (≈ 60 %); drugi član plafona (pouka 32) ih spušta kad bi dan bio duži od
    // dugog tapera.
    const t0 = taperDoses(quality, rule.quality);
    const tl = taperDayLimit(
      { paces: p, wc: ctx.wc, rule },
      target10,
      pat.easy.length,
      longest10,
      roll10,
      rule.quality
    );
    const t = taperDoses(quality, rule.quality, tl);
    const rpFits = t0.q1.doseM <= capM('RP', targetKm);
    // HI10: početnik — RP ne staje u plafon → T kontinuirano ≈ 60 % poslednje T doze (min 1,5 km).
    const bt0 = rule.beginner && !rpFits ? beginnerTaperT(quality) : null;
    const btFits = bt0 !== null && bt0.doseM <= capM('T', targetKm);
    const bt = btFits ? beginnerTaperT(quality, tl.q1) : bt0;
    const tFits = t0.q2 !== null && t0.q2.doseM <= capM('T', targetKm);
    if (!relax && (!(rpFits || btFits) || (t.q2 !== null && !tFits))) return null;
    const q1d = rpFits ? t.q1 : btFits ? bt : null;
    const w1 = q1d ? qualityWorkout(q1d, p, ctx.wc, ctx.feel) : null;
    const w2 = !relax && t.q2 && tFits ? qualityWorkout(t.q2, p, ctx.wc, ctx.feel) : null;
    const q100 = (w1 ? km100(w1.km) : 0) + (w2 ? km100(w2.km) : 0);
    const kept = [...(w1 ? [pat.q1] : []), ...(w2 && pat.q2 ? [pat.q2] : [])];
    const dates = easyDates(
      frame,
      [...qDays, ...pat.easy].filter((wd) => !kept.includes(wd))
    );
    const len = taperLengths(target10, q100, dates.length, longest10, rule, p, roll10);
    if (!len) return null;
    const rpMin = `RP ${P.taper.rpMin.reps} × ${P.taper.rpMin.repM} m`;
    const lowered = [
      ...(w1 && q1d === t.q1 && t.q1.doseM < t0.q1.doseM ? [['RP', t0.q1, t.q1]] : []),
      ...(w1 && q1d === bt && bt && bt0 && bt.doseM < bt0.doseM ? [['T', bt0, bt]] : []),
      ...(w2 && t.q2 && t0.q2 && t.q2.doseM < t0.q2.doseM ? [['T', t0.q2, t.q2]] : [])
    ] as [string, Dose, Dose][];
    const doseNotes = lowered.map(
      ([z, a, b]) =>
        `Taper: ${z} ${fmtKm(b.doseM / 1000)} km umesto ${fmtKm(a.doseM / 1000)} km (≈ 60 %): dan kvaliteta ne sme biti duži od dugog tapera (pouka 32).`
    );
    const note = !w1
      ? rule.beginner
        ? `Taper bez kvaliteta — ni ${rpMin} ni T ${fmtKm(P.beginner.tFirstKm)} km ne staju u plafon cilja (H11 ispred H7/HI10, odstupanje); dugi ≤ 0,6 × najduži.`
        : `Taper bez kvaliteta — ni ${rpMin} ne staje u plafon ${P.caps.RP * 100} % cilja (H11 ispred H7, odstupanje); dugi ≤ 0,6 × najduži.`
      : q1d === bt
        ? `Taper (HI10): ${rpMin} ne staje u plafon ${P.caps.RP * 100} % cilja — T kontinuirano ≈ 60 % poslednje T doze (min ${fmtKm(P.beginner.tFirstKm)} km); dugi ≤ 0,6 × najduži.`
        : t.q2 === null
          ? 'Taper: RP ≈ 60 % poslednje doze (jedan kvalitetni dan, HI6), dugi ≤ 0,6 × najduži (H7).'
          : !w2
            ? 'Taper: samo RP ≈ 60 % poslednje doze — sa RP i T nijedan cilj ≤ 0,7 × vrh nije izvodljiv (H7, odstupanje); dugi ≤ 0,6 × najduži.'
            : 'Taper: RP i T ≈ 60 % poslednje doze, dugi ≤ 0,6 × najduži (H7).';
    return finish(
      [
        ...(w1 ? [day(dateOf(frame, pat.q1), 'q1', w1)] : []),
        ...(w2 && pat.q2 ? [day(dateOf(frame, pat.q2), 'q2', w2)] : []),
        day(dateOf(frame, pat.long), 'long', longWorkout(len.long10 / 10, p)),
        ...easyDays(dates, len.easy10, p)
      ],
      len.long10,
      null,
      [note, ...doseNotes]
    );
  }

  // Izgradnja (H10, H12): Q1 i Q2 po fazi (3 dana i početnik samo Q1), dugi i lagani (H13; kotrljajuća
  // granica pouke 28, HI7). H17: uvod bez kvaliteta; H16: test na danu Q1; HI10: početnik T kontinuirano kad
  // prvi nivo lestvice faze ne staje u plafon, bez kvaliteta kad ni 1,5 km ne staje. Dan Q1 bez treninga
  // kvaliteta (i bez testa) je lagan.
  const picks: WeekPicks | null = intro
    ? { q1: null, q2: null }
    : pickBuild(
        quality,
        frame.phase,
        targetKm,
        p,
        rule,
        relax,
        test,
        buildDayLimit(
          { paces: p, wc: ctx.wc, rule },
          target10,
          pat.easy.length,
          roll10,
          rule.quality === 2 ? ladderFor(frame.phase, 'q2') : null,
          test ? testWorkout(p, ctx.wc) : null
        )
      );
  if (!picks) return null;
  const w1 = test
    ? testWorkout(p, ctx.wc)
    : picks.q1
      ? qualityWorkout(picks.q1, p, ctx.wc, ctx.feel)
      : null;
  const w2 = picks.q2 ? qualityWorkout(picks.q2, p, ctx.wc, ctx.feel) : null;
  const busy = [...(w1 ? [pat.q1] : []), ...(w2 && pat.q2 ? [pat.q2] : [])];
  const dates = easyDates(
    frame,
    [...qDays, ...pat.easy].filter((wd) => !busy.includes(wd))
  );
  const q100 = (w1 ? km100(w1.km) : 0) + (w2 ? km100(w2.km) : 0);
  const len = buildLengths(target10, q100, dates.length, rule, p, roll10);
  if (!len) return null;
  const notes: string[] = [];
  if (intro)
    notes.push(
      `Uvod (H17): nedelja ${frame.index} od ${rule.introWeeks} bez kvaliteta — dan kvaliteta je lagan.`
    );
  else if (test) notes.push(TEST_NOTE);
  else if (!w1)
    notes.push(
      `Bez kvaliteta: ni T ${fmtKm(P.beginner.tFirstKm)} km kontinuirano ne staje u plafon ${P.caps.T * 100} % cilja ${fmtKm(targetKm)} km (H11 ispred H17, odstupanje).`
    );
  else if (picks.q1 && picks.q1.ladder !== ladderFor(frame.phase, 'q1', rule.quality)) {
    const phaseLadder = ladderFor(frame.phase, 'q1', rule.quality);
    const first = doseOf(ladderLevels(phaseLadder)[0]!) / 1000;
    notes.push(
      `T kontinuirano (HI10): prvi nivo ${phaseLadder} (${fmtKm(first)} km) ne staje u plafon ${P.caps[zoneOf(phaseLadder)] * 100} % cilja ${fmtKm(targetKm)} km.`
    );
  }
  const slots: [string, Dose, SlotState | null][] = [];
  if (picks.q1) slots.push(['Q1', picks.q1, quality.q1]);
  if (picks.q2) slots.push(['Q2', picks.q2, quality.q2]);
  for (const [slot, d] of slots) if (d.step === 'repeat') notes.push(repeatNote(slot, d));
  for (const [slot, d, prev] of slots)
    if (d.step === 'drop')
      notes.push(
        prev && prev.doseM > capM(d.zone, targetKm)
          ? `${slot}: ${d.zone} spušten sa ${fmtKm(prev.doseM / 1000)} na ${fmtKm(d.doseM / 1000)} km — nijedan cilj nedelje nije izvodljiv uz „doza ne pada" i plafon (H11 ispred H12).`
          : `${slot}: ${d.zone} ${fmtKm(d.doseM / 1000)} km — viša doza bi dan kvaliteta učinila dužim od dugog (pouka 32, plafon zone; pad doze kao kapacitet, pouka 12).`
      );
  return finish(
    [
      ...(w1 ? [day(dateOf(frame, pat.q1), test ? 'test' : 'q1', w1)] : []),
      ...(w2 && pat.q2 ? [day(dateOf(frame, pat.q2), 'q2', w2)] : []),
      day(dateOf(frame, pat.long), 'long', longWorkout(len.long10 / 10, p)),
      ...easyDays(dates, len.easy10, p)
    ],
    len.long10,
    picks,
    notes
  );
}

/** H8: oštrenje (2 × 2000 m RP) samo kad je ≤ RP doza tapera; taper bez RP → bez oštrenja. */
export function sharpenerAllowed(taperRpM: number): boolean {
  const s = P.raceWeek.sharpener;
  return taperRpM > 0 && s.reps * s.repM <= taperRpM;
}

/** H8: dani trčanja trkačke nedelje osim trke — ukupno sa trkom najviše min(broj dana, 5); otpada prvo
    dan dugog, pa najraniji lagan dan šablona. Datumi rastuće. */
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

/** H8 (pouka 5): lagan dan trkačke nedelje = min(35 min E, najkraći lagan tapera `taperEasy10` [0,1 km]);
    kad je lagan tapera kraći, dan se zadaje u km. */
export function raceEasyWorkout(taperEasy10: number, p: Paces): Workout {
  const timed = easyTimeWorkout(P.raceWeek.otherEasySec, p);
  return taperEasy10 * 10 < km100(timed.km) ? easyWorkout(taperEasy10 / 10, p) : timed;
}

/** H8: dan oštrenja — najkasniji dan ≥ 3 dana pre trke, nesusedan poslednjem zahtevnom danu tapera
    `prevHard` (H9); null = nema takvog dana. Jedna funkcija za konstruktor i validator (pouka 24). */
export function sharpenerDate(
  runs: readonly string[],
  race: string,
  prevHard: string | null
): string | null {
  return (
    [...runs]
      .sort()
      .reverse()
      .find(
        (d) =>
          daysBetween(d, race) >= P.raceWeek.sharpenerMinGapDays &&
          (prevHard === null || daysBetween(prevHard, d) >= 2)
      ) ?? null
  );
}

/**
 * H8: trkačka nedelja. Dani po H8; trka zamenjuje dugi. Oštrenje (≤ RP doza tapera) na najkasnijem danu
 * ≥ 3 dana pre trke, nesusednom poslednjem zahtevnom danu tapera; nema takvog dana → bez oštrenja
 * (napomena). Dan pred trku 20 min E + ubrzanja; ostali min(35 min E, najkraći lagan tapera). Trka (sa
 * WU/CD) se ne računa u obim.
 */
export function raceWeek(
  ctx: WeekContext,
  frame: WeekFrame,
  taperRpM: number,
  prevHard: string | null,
  taperEasy10: number
): BuiltWeek {
  const q = P.raceWeek;
  const p = ctx.paces;
  const race = ctx.input.raceDate;
  const runs = raceWeekRuns(ctx.input.runDays, ctx.pattern, frame, race);
  const allowed = sharpenerAllowed(taperRpM);
  const sharpen = allowed ? sharpenerDate(runs, race, prevHard) : null;
  const days: PlanDay[] = [day(race, 'race', raceWorkout(p, ctx.raceSec), false)];
  const easy = raceEasyWorkout(taperEasy10, p);
  for (const d of runs) {
    if (d === sharpen) days.push(day(d, 'sharpener', sharpenerWorkout(p, ctx.wc, ctx.feel)));
    else if (daysBetween(d, race) === 1) days.push(day(d, 'eve', eveWorkout(p)));
    else days.push(day(d, 'easy', easy));
  }
  const shortened =
    easy.blocks[0]?.kind === 'easy' && days.some((d) => d.role === 'easy')
      ? [
          `Trkačka nedelja: lagan ${fmtKm(easy.km)} km = najkraći lagan tapera (kraći od ${Math.round(q.otherEasySec / 60)} min E; trkačka ≤ taper, H8).`
        ]
      : [];
  const s = q.sharpener;
  return finish(days, null, null, [
    sharpen
      ? `Trkačka nedelja: oštrenje ${s.reps} × ${s.repM} m RP (≤ RP doza tapera ${fmtKm(taperRpM / 1000)} km), trka ${fmtKm(q.raceKm)} km se ne računa u obim (H8).`
      : !allowed
        ? `Trkačka nedelja: taper bez RP ${s.reps} × ${s.repM} m — bez oštrenja (oštrenje ≤ RP doza tapera, H8); trka ${fmtKm(q.raceKm)} km se ne računa u obim.`
        : `Trkačka nedelja: nijedan dan trčanja nije ≥ ${q.sharpenerMinGapDays} dana pre trke i nesusedan poslednjem zahtevnom danu tapera — bez oštrenja (H8, odstupanje); trka ${fmtKm(q.raceKm)} km se ne računa u obim.`,
    ...shortened
  ]);
}
