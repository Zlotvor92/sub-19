/* Sastav nedelje: izgradnja, rasterećenje (M5 sadržaj), taper (M7, dve nedelje), trkačka nedelja (M8); test
   5 km (M16); uvod i T kontinuirano početnika (M17). Doze bira quality.ts, dužine lengths.ts, treninge
   workouts.ts; ovde se samo raspoređuju po danima šablona (M9). null = nedelja sa ovim ciljem nije izvodljiva
   po pravilima (volume.ts traži najbliži izvodljiv cilj). */

import { addDays, daysBetween, weekdayOf } from './dates.ts';
import { buildLengths, deloadLengths, longCap10, taperLengths } from './lengths.ts';
import { MARATHON_V2_POLICY as P, type PlanRule } from './policy.ts';
import {
  capM,
  deloadSlot,
  ladderFor,
  mpFitsLong,
  pickBuild,
  pickDeload,
  pickTaper,
  type Picks,
  type QualityState,
  type SlotState
} from './quality.ts';
import type {
  DayRole,
  Dose,
  MarathonV2Input,
  Paces,
  Pattern,
  PlanDay,
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
  qualityWorkout,
  raceWorkout,
  sharpenerWorkout,
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
}

/** Režim kvaliteta nedelje: 'rule' po pravilu; 'relax' druga pretraga (M11 ispred M12 u izgradnji; u
    taperu T koji ne staje u plafon otpada, M11 ispred M7). */
export type QualityMode = 'rule' | 'relax';

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

/** Napomena kad slot ponavlja trening jer druga struktura iste doze ne postoji (M10). */
const repeatNote = (slot: string, d: Dose): string =>
  `${slot}: ${d.zone} ${fmtKm(d.doseM / 1000)} km ponovljen — sledeći nivo ne staje u plafon, a druga struktura iste doze ne postoji (M10).`;

/** M16: napomena nedelje testa. */
const testNote = `Test ${P.test.km} km (M16): kontrolisano maksimalno; računa se u obim nedelje, ne u dozu kvaliteta; rezultat koristi adaptacija (segment 04), do tada tempo ostaje procena.`;

/** Lagani dani: datumi rastuće (raniji dan dobija višak zaokruženja). */
const easyDates = (frame: WeekFrame, days: readonly Weekday[]): string[] =>
  days.map((wd) => dateOf(frame, wd)).sort();

const easyDays = (dates: readonly string[], easy10: readonly number[], p: Paces): PlanDay[] =>
  dates.map((d, i) => day(d, 'easy', easyWorkout(easy10[i]! / 10, p)));

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
  if (frame.phase === 'race') return null;

  if (frame.deload) {
    // M5: jedan kvalitet (T) na danu Q2 (3 dana i početnik: Q1), dugi, ostali dani lagani. M16: u nedelji
    // testa test zamenjuje kvalitet rasterećenja (na njegovom danu; nije doza, bez plafona M11).
    if (lastLong10 === null) return null;
    const test = frame.test === true;
    const t = test ? null : pickDeload(quality, frame.phase, targetKm, rule.beginner);
    if (!test && !t) return null;
    const tw = t ? qualityWorkout(t, p, ctx.wc, ctx.feel) : testWorkout(p, ctx.wc);
    const slot = deloadSlot(rule.quality);
    const tDay = slot === 'q1' ? pat.q1 : pat.q2!;
    const dates = easyDates(frame, [...(slot === 'q1' ? [] : [pat.q1]), ...pat.easy]);
    const len = deloadLengths(
      target10,
      km100(tw.km),
      dates.length,
      lastLong10,
      rule,
      p,
      jump10,
      test || rule.beginner
    );
    if (!len) return null;
    const long0 = Math.min(Math.floor(P.deload.longFactor * lastLong10 + 1e-9), jump10 ?? Infinity);
    const longText = len.shortened
      ? `dugi ${fmtKm(len.long10 / 10)} km — skraćen sa 0,8 × poslednjeg ne-rasteretnog (${fmtKm(long0 / 10)} km) da lagani ostanu ≥ ${fmtKm(P.lengths.easyMinKm)} km (${test ? 'M16' : 'M17'} ispred M5, odstupanje)`
      : 'dugi 0,8 × poslednji ne-rasteretni (M5)';
    return finish(
      [
        day(dateOf(frame, tDay), test ? 'test' : slot, tw),
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
        : [`Rasterećenje: cilj ${fmtKm(targetKm)} km, jedan kvalitet (T), ${longText}.`],
      len.jumpBound
    );
  }

  if (taper !== null) {
    // M7: MP doza tapera uvek (plafon M11 se na nju ne primenjuje, M7a); T u N−2 kad staje u plafon.
    // M17: početnik u N−1 bez MP — jedini kvalitet T kontinuirano na danu Q1.
    const t = pickTaper(quality, taper, targetKm, rule.quality, mode === 'relax', rule.beginner);
    if (!t) return null;
    const q1Dose = t.mp ?? t.t!;
    const w1 = qualityWorkout(q1Dose, p, ctx.wc, ctx.feel);
    const w2 = t.mp && t.t ? qualityWorkout(t.t, p, ctx.wc, ctx.feel) : null;
    const q100 = km100(w1.km) + (w2 ? km100(w2.km) : 0);
    // Dani šablona bez zadržanog kvaliteta su lagani (N−1 bez T; odstupanje M11 ispred M7 za T).
    const dates = easyDates(frame, [...(w2 || !pat.q2 ? [] : [pat.q2]), ...pat.easy]);
    const len = taperLengths(target10, q100, dates.length, longest10, taper, rule, p, jump10);
    if (!len) return null;
    const tw = P.taper.weeks[taper]!;
    const lf = `dugi ≤ ${fmtKm(tw.longFactor)} × najduži`;
    const note = !t.mp
      ? `Taper (N−1, početnik M17): cilj ${fmtKm(tw.factor)} × vrh, jedan kvalitet T kontinuirano ≈ 60 % poslednje T doze (min ${fmtKm(P.beginner.tFirstKm)} km), bez MP — trkačka nedelja bez oštrenja (cilj: završiti); ${lf} (M7).`
      : rule.quality === 1
        ? `Taper (N−${2 - taper}): cilj ${fmtKm(tw.factor)} × vrh, jedan kvalitet MP ≈ ${Math.round(tw.mpShare * 100)} % poslednje doze (${rule.beginner ? 'početnik' : '3 dana'}), ${lf} (M7).`
        : tw.tShare !== null && !w2
          ? `Taper (N−${2 - taper}): T ${fmtKm(P.taper.tMinKm)} km po pravilu ne staje u plafon zone (M11 ispred M7, odstupanje) — dan je lagan; ${lf} (M7).`
          : taper === 0
            ? `Taper (N−2): cilj ${fmtKm(tw.factor)} × vrh, MP i T ≈ 60 % poslednje doze, ${lf} (M7).`
            : `Taper (N−1): cilj ${fmtKm(tw.factor)} × vrh, MP ≈ 50 % poslednje doze, bez T, ${lf} (M7).`;
    const overCap =
      t.mp && t.mp.doseM > capM('MP', targetKm)
        ? [
            `Taper (N−${2 - taper}): MP ${fmtKm(t.mp.doseM / 1000)} km je ${fmtKm((100 * t.mp.doseM) / 1000 / targetKm)} % cilja — minimum MP tapera (M7) ispred plafona 20 % (M11), samo u taperu (M7a).`
          ]
        : [];
    return finish(
      [
        day(dateOf(frame, pat.q1), 'q1', w1),
        ...(w2 ? [day(dateOf(frame, pat.q2!), 'q2', w2)] : []),
        day(dateOf(frame, pat.long), 'long', longWorkout(len.long10 / 10, p)),
        ...easyDays(dates, len.easy10, p)
      ],
      len.long10,
      null,
      [note, ...overCap],
      len.jumpBound
    );
  }

  // M17: uvod bez kvaliteta; M16: test na danu Q1; početnik: T kontinuirano kad prvi nivo lestvice faze ne
  // staje u plafon, bez kvaliteta kad ni 1,5 km ne staje (odstupanje M17). Dan Q1 bez treninga kvaliteta (i
  // bez testa) je lagan.
  const intro = frame.index <= rule.introWeeks;
  const test = frame.test === true;
  const picks: Picks | null = intro
    ? { q1: null, q2: null }
    : pickBuild(quality, frame.phase, targetKm, p, rule, mode === 'relax', test, {
        long10: Math.min(longCap10(target10, rule, p), jump10 ?? Infinity),
        wc: ctx.wc
      });
  if (!picks) return null;
  const w1 = test
    ? testWorkout(p, ctx.wc)
    : picks.q1
      ? qualityWorkout(picks.q1, p, ctx.wc, ctx.feel)
      : null;
  const w2 = picks.q2 ? qualityWorkout(picks.q2, p, ctx.wc, ctx.feel) : null;
  const dates = easyDates(frame, [...(w1 ? [] : [pat.q1]), ...pat.easy]);
  const q100 = (w1 ? km100(w1.km) : 0) + (w2 ? km100(w2.km) : 0);
  const len = buildLengths(target10, q100, dates.length, rule, p, jump10);
  if (!len) return null;
  // Pouka 14: MP dan nikad duži od dugog (plafon MP računat prema najdužem dozvoljenom dugom; kad su lagani
  // skratili dugi, nedelja sa ovim ciljem nije izvodljiva).
  if (
    [w1, w2].some(
      (w) => w?.dose?.zone === 'MP' && !mpFitsLong(w.dose.structure, len.long10, p, ctx.wc)
    )
  )
    return null;
  const notes: string[] = [];
  if (intro)
    notes.push(
      `Uvod (M17): nedelja ${frame.index} od ${rule.introWeeks} bez kvaliteta — dan kvaliteta je lagan.`
    );
  else if (test) notes.push(testNote);
  else if (!w1)
    notes.push(
      `Bez kvaliteta: ni T ${fmtKm(P.beginner.tFirstKm)} km kontinuirano ne staje u plafon ${P.caps.T * 100} % cilja ${fmtKm(targetKm)} km (M11 ispred M17, odstupanje).`
    );
  else if (picks.q1 && picks.q1.ladder !== ladderFor(frame.phase, 'q1', rule.quality)) {
    const phaseLadder = ladderFor(frame.phase, 'q1', rule.quality);
    const first = doseOf(ladderLevels(phaseLadder)[0]!) / 1000;
    notes.push(
      `T kontinuirano (M17): prvi nivo ${phaseLadder} (${fmtKm(first)} km) ne staje u plafon ${P.caps[zoneOf(phaseLadder)] * 100} % cilja ${fmtKm(targetKm)} km.`
    );
  }
  const slots: [string, Dose, SlotState | null][] = [];
  if (picks.q1) slots.push(['Q1', picks.q1, quality.q1]);
  if (picks.q2) slots.push(['Q2', picks.q2, quality.q2]);
  for (const [slot, d] of slots) if (d.step === 'repeat') notes.push(repeatNote(slot, d));
  for (const [slot, d, prev] of slots)
    if (d.step === 'drop')
      notes.push(
        d.zone === 'MP' && (prev?.doseM ?? 0) <= capM('MP', targetKm)
          ? `${slot}: MP spušten sa ${fmtKm((prev?.doseM ?? 0) / 1000)} na ${fmtKm(d.doseM / 1000)} km — kvalitetni dan bi trajao duže od dugog (plafon MP, pouka 14).`
          : `${slot}: ${d.zone} spušten sa ${fmtKm((prev?.doseM ?? 0) / 1000)} na ${fmtKm(d.doseM / 1000)} km — nijedan cilj nedelje nije izvodljiv uz „doza ne pada" i plafon (M11 ispred M12).`
      );
  return finish(
    [
      ...(w1 ? [day(dateOf(frame, pat.q1), test ? 'test' : 'q1', w1)] : []),
      ...(w2 ? [day(dateOf(frame, pat.q2!), 'q2', w2)] : []),
      day(dateOf(frame, pat.long), 'long', longWorkout(len.long10 / 10, p)),
      ...easyDays(dates, len.easy10, p)
    ],
    len.long10,
    picks,
    notes,
    len.jumpBound
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
 * M8: trkačka nedelja. Trka zamenjuje dugi. Oštrenje (≤ MP doza N−1) na najkasnijem danu ≥ 3 dana pre trke
 * koji nije susedan poslednjem zahtevnom danu tapera `prevHard` (M9); nema takvog dana → bez oštrenja
 * (odstupanje). Dan pred trku 20 min E + ubrzanja; ostali min(30 min E, najkraći lagan N−1). Trka (sa WU) se
 * ne računa u obim.
 */
export function raceWeek(
  ctx: WeekContext,
  frame: WeekFrame,
  taperMpM: number,
  prevHard: string | null,
  taperEasy10: number
): BuiltWeek {
  const q = P.raceWeek;
  const p = ctx.paces;
  const race = ctx.input.raceDate;
  const runs = raceWeekRuns(ctx.input.runDays, ctx.pattern, frame, race);
  const sharpen = hasSharpener(taperMpM);
  const cands = sharpen
    ? [...runs]
        .reverse()
        .filter(
          (d) =>
            daysBetween(d, race) >= q.sharpenerMinGapDays &&
            (prevHard === null || daysBetween(prevHard, d) >= 2)
        )
    : [];
  const sharpenDate = cands[0] ?? null;
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
  return finish(days, null, null, [
    sharpenDate
      ? `Trkačka nedelja: oštrenje ${s.reps} × ${s.repM} m MP (≤ MP doza poslednje nedelje tapera ${fmtKm(taperMpM / 1000)} km); maraton ${fmtKm(q.raceKm)} km se ne računa u obim (M8).`
      : !sharpen
        ? `Trkačka nedelja: poslednja nedelja tapera bez MP — bez oštrenja (oštrenje ≤ MP doza tapera, M8); maraton ${fmtKm(q.raceKm)} km se ne računa u obim.`
        : `Trkačka nedelja: nijedan dan trčanja nije ≥ ${q.sharpenerMinGapDays} dana pre trke i nesusedan poslednjem zahtevnom danu tapera — bez oštrenja (M8, odstupanje); maraton ${fmtKm(q.raceKm)} km se ne računa u obim.`,
    ...shortened
  ]);
}
