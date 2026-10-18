/* Sastav nedelje: izgradnja, rasterećenje (D5 sadržaj), taper (D7), trkačka nedelja (D8, D20, D23), za 1
   ili 2 kvaliteta i 1–3 lagana dana (D17–D19). Doze bira quality.ts, dužine lengths.ts, treninge
   workouts.ts; ovde se samo raspoređuju po danima šablona (D9). null = nedelja sa ovim ciljem nije
   izvodljiva po pravilima (volume.ts traži najbliži izvodljiv cilj). */

import { addDays, daysBetween, weekdayOf } from './dates.ts';
import { buildLengths, deloadLengths, taperLengths } from './lengths.ts';
import { type DayRule, TEN_K_V2_POLICY as P } from './policy.ts';
import {
  deloadSlot,
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
  Paces,
  Pattern,
  PlanDay,
  TenKV2Input,
  WeekFrame,
  Weekday,
  Workout
} from './types.ts';
import {
  easyTimeWorkout,
  easyWorkout,
  eveWorkout,
  fmtKm,
  longWorkout,
  qualityWorkout,
  raceWorkout,
  sharpenerWorkout,
  type WarmupCooldown
} from './workouts.ts';

export interface WeekContext {
  input: TenKV2Input;
  paces: Paces;
  pattern: Pattern;
  /** Prognoza 10K [s] (trka). */
  raceSec: number;
  /** D14: WU/CD po pojasu trenutnog obima (workouts.ts). */
  wc: WarmupCooldown;
  /** D17: red tabele za broj dana trčanja. */
  rule: DayRule;
}

export interface BuiltWeek {
  days: PlanDay[];
  planned100: number;
  /** Dugi nedelje [0,1 km]; null u trkačkoj nedelji. */
  long10: number | null;
  /** Izbor doza nedelje izgradnje (stanje za sledeću nedelju); null van izgradnje. */
  picks: Picks | null;
  notes: string[];
}

const HARD: readonly DayRole[] = ['q1', 'q2', 'long', 'sharpener', 'race'];
const km100 = (km: number): number => Math.round(km * 100);

function day(date: string, role: DayRole, workout: Workout, countsToWeek = true): PlanDay {
  return { date, weekday: weekdayOf(date), role, hard: HARD.includes(role), countsToWeek, workout };
}

function finish(
  days: PlanDay[],
  long10: number | null,
  picks: BuiltWeek['picks'],
  notes: string[]
): BuiltWeek {
  days.sort((a, b) => a.date.localeCompare(b.date));
  const planned100 = days.reduce((a, d) => a + (d.countsToWeek ? km100(d.workout.km) : 0), 0);
  return { days, planned100, long10, picks, notes };
}

const dateOf = (frame: WeekFrame, wd: Weekday): string => {
  for (let i = 0; i < 7; i++) {
    const d = addDays(frame.startDate, i);
    if (weekdayOf(d) === wd) return d;
  }
  throw new Error(`Dan ${wd} nije u nedelji ${frame.index}.`);
};

/** Napomena kad slot ponavlja trening jer druga struktura iste doze ne postoji (D10). */
const repeatNote = (slot: string, d: Dose): string =>
  `${slot}: ${d.zone} ${fmtKm(d.doseM / 1000)} km ponovljen — sledeći nivo ne staje u plafon, a druga struktura iste doze ne postoji (D10).`;

/** Lagani dani: datumi rastuće (raniji dan dobija višak zaokruženja, D19). */
const easyDates = (frame: WeekFrame, days: readonly Weekday[]): string[] =>
  days.map((wd) => dateOf(frame, wd)).sort();

const easyDays = (dates: readonly string[], easy10: readonly number[], p: Paces): PlanDay[] =>
  dates.map((d, i) => day(d, 'easy', easyWorkout(easy10[i]! / 10, p)));

/**
 * Izgradnja, rasterećenje ili taper sa ciljem `target10` [0,1 km]. `relax` = druga pretraga cilja, samo
 * kad nijedan cilj nije izvodljiv po pravilu (generate.ts): izgradnja — D11 ispred D12 (spuštanje doze);
 * rasterećenje — bez kvaliteta kad ni najmanja T doza ne staje u plafon D11 (odstupanje D5); taper 4–6
 * dana — samo RP, kao kod 3 dana (odstupanje D7).
 */
export function buildWeek(
  ctx: WeekContext,
  frame: WeekFrame,
  target10: number,
  quality: QualityState,
  lastLong10: number | null,
  longest10: number,
  relax = false
): BuiltWeek | null {
  const p = ctx.paces;
  const pat = ctx.pattern;
  const rule = ctx.rule;
  const targetKm = target10 / 10;
  if (frame.phase === 'race') return null;

  if (frame.deload) {
    // D5/D19: jedan kvalitet (T) na danu T slota, dugi, ostali dani lagani (3 dana: D18).
    if (lastLong10 === null) return null;
    const t = pickDeload(quality, frame.phase, targetKm, rule.quality);
    if (!t && !relax) return null;
    const tw = t ? qualityWorkout(t, p, ctx.wc) : null;
    const slot = deloadSlot(rule.quality);
    const qDay = slot === 'q1' ? pat.q1 : pat.q2!;
    const dates = easyDates(
      frame,
      [pat.q1, ...(pat.q2 ? [pat.q2] : []), ...pat.easy].filter((wd) => !tw || wd !== qDay)
    );
    const len = deloadLengths(
      target10,
      tw ? km100(tw.km) : 0,
      dates.length,
      lastLong10,
      rule.longMaxShare,
      p
    );
    if (!len) return null;
    const days = [
      ...(tw ? [day(dateOf(frame, qDay), slot, tw)] : []),
      day(dateOf(frame, pat.long), 'long', longWorkout(len.long10 / 10, p)),
      ...easyDays(dates, len.easy10, p)
    ];
    return finish(days, len.long10, null, [
      tw
        ? `Rasterećenje: cilj ${fmtKm(targetKm)} km, jedan kvalitet (T), dugi 0,8 × poslednji ne-rasteretni (D5).`
        : `Rasterećenje: cilj ${fmtKm(targetKm)} km bez kvaliteta — ni T ${fmtKm(P.deload.tMinKm)} km ne staje u plafon ${P.caps.T * 100} % (D11 ispred D5, odstupanje); dugi 0,8 × poslednji ne-rasteretni.`
    ]);
  }

  const qualityDays = (w1: Workout, w2: Workout | null): PlanDay[] => [
    day(dateOf(frame, pat.q1), 'q1', w1),
    ...(w2 && pat.q2 ? [day(dateOf(frame, pat.q2), 'q2', w2)] : [])
  ];

  if (frame.phase === 'taper') {
    const t = pickTaper(quality, targetKm, rule.quality, relax);
    if (!t) return null;
    const w1 = t === 'none' ? null : qualityWorkout(t.q1, p, ctx.wc);
    const w2 = t !== 'none' && t.q2 ? qualityWorkout(t.q2, p, ctx.wc) : null;
    const q100 = (w1 ? km100(w1.km) : 0) + (w2 ? km100(w2.km) : 0);
    // Dani šablona bez zadržanog kvaliteta su lagani (odstupanje D7 „samo RP" / „bez kvaliteta").
    const kept = [...(w1 ? [pat.q1] : []), ...(w2 && pat.q2 ? [pat.q2] : [])];
    const dates = easyDates(
      frame,
      [pat.q1, ...(pat.q2 ? [pat.q2] : []), ...pat.easy].filter((wd) => !kept.includes(wd))
    );
    const len = taperLengths(target10, q100, dates.length, longest10, rule.longMaxShare, p);
    if (!len) return null;
    const note = !w1
      ? `Taper bez kvaliteta — ni RP ${P.taper.rpMin.reps} × ${P.taper.rpMin.repM} m ne staje u plafon ${P.caps.RP * 100} % cilja (D11 ispred D7, odstupanje); dugi ≤ 0,75 × najduži.`
      : rule.quality === 2 && !w2
        ? 'Taper: samo RP ≈ 60 % poslednje doze — sa RP i T nijedan cilj ≤ 0,75 × vrh nije izvodljiv (D7, odstupanje); dugi ≤ 0,75 × najduži.'
        : rule.quality === 1
          ? 'Taper: RP ≈ 60 % poslednje doze, dugi ≤ 0,75 × najduži (D7, D18).'
          : 'Taper: RP i T ≈ 60 % poslednje doze, dugi ≤ 0,75 × najduži (D7).';
    return finish(
      [
        ...(w1 ? qualityDays(w1, w2) : []),
        day(dateOf(frame, pat.long), 'long', longWorkout(len.long10 / 10, p)),
        ...easyDays(dates, len.easy10, p)
      ],
      len.long10,
      null,
      [note]
    );
  }

  const dates = easyDates(frame, pat.easy);
  const picks = pickBuild(quality, frame.phase, targetKm, p, rule.quality, relax);
  if (!picks) return null;
  const w1 = qualityWorkout(picks.q1, p, ctx.wc);
  const w2 = picks.q2 ? qualityWorkout(picks.q2, p, ctx.wc) : null;
  const q100 = km100(w1.km) + (w2 ? km100(w2.km) : 0);
  const len = buildLengths(target10, q100, dates.length, rule.longMaxShare, p);
  if (!len) return null;
  const notes: string[] = [];
  const slots: [string, Dose, SlotState | null][] = [['Q1', picks.q1, quality.q1]];
  if (picks.q2) slots.push(['Q2', picks.q2, quality.q2]);
  for (const [slot, d] of slots) if (d.step === 'repeat') notes.push(repeatNote(slot, d));
  for (const [slot, d, prev] of slots)
    if (d.step === 'drop')
      notes.push(
        `${slot}: ${d.zone} spušten sa ${fmtKm((prev?.doseM ?? 0) / 1000)} na ${fmtKm(d.doseM / 1000)} km — nijedan cilj nedelje nije izvodljiv uz „doza ne pada" i plafon (D11 ispred D12).`
      );
  return finish(
    [
      ...qualityDays(w1, w2),
      day(dateOf(frame, pat.long), 'long', longWorkout(len.long10 / 10, p)),
      ...easyDays(dates, len.easy10, p)
    ],
    len.long10,
    picks,
    notes
  );
}

/** D8: oštrenje ≤ RP doza tapera — puno (3 × 1000 m) ako ga RP doza tapera nosi, inače 2 × 1000 m; taper
    bez RP (odstupanje D7) → 0 (bez oštrenja). */
export function sharpenerReps(taperRpM: number): number {
  const s = P.raceWeek.sharpener;
  if (taperRpM >= s.reps * s.repM) return s.reps;
  return taperRpM >= P.raceWeek.sharpenerSmallReps * s.repM ? P.raceWeek.sharpenerSmallReps : 0;
}

/** D20: dani trčanja trkačke nedelje osim trke — ukupno sa trkom najviše min(broj dana, 5); otpada prvo
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

/** D23: lagan dan trkačke nedelje = min(35 min E, najkraći lagan tapera `taperEasy10` [0,1 km]); kad je
    lagan tapera kraći, dan se zadaje u km. */
export function raceEasyWorkout(taperEasy10: number, p: Paces): Workout {
  const timed = easyTimeWorkout(P.raceWeek.otherEasySec, p);
  return taperEasy10 * 10 < km100(timed.km) ? easyWorkout(taperEasy10 / 10, p) : timed;
}

/**
 * D8 + D20: trkačka nedelja. Dani po D20; trka zamenjuje dugi. Oštrenje (≤ RP doza tapera) na najkasnijem
 * danu ≥ 3 dana pre trke koji nije susedan poslednjem zahtevnom danu tapera `prevHard` (D9); nema takvog
 * dana → bez oštrenja (odstupanje D8). Dan pred trku 20 min E + ubrzanja; ostali 35 min E, ali ne duže od
 * najkraćeg laganog dana tapera `taperEasy10` (D23). Trka (sa WU/CD) se ne računa u obim.
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
  const reps = sharpenerReps(taperRpM);
  const sharpenDate =
    reps === 0
      ? null
      : ([...runs]
          .reverse()
          .find(
            (d) =>
              daysBetween(d, race) >= q.sharpenerMinGapDays &&
              (prevHard === null || daysBetween(prevHard, d) >= 2)
          ) ?? null);
  const days: PlanDay[] = [day(race, 'race', raceWorkout(p, ctx.raceSec), false)];
  const easy = raceEasyWorkout(taperEasy10, p);
  for (const d of runs) {
    if (d === sharpenDate) days.push(day(d, 'sharpener', sharpenerWorkout(reps, p, ctx.wc)));
    else if (daysBetween(d, race) === 1) days.push(day(d, 'eve', eveWorkout(p)));
    else days.push(day(d, 'easy', easy));
  }
  const shortened =
    easy.blocks[0]?.kind === 'easy' && days.some((d) => d.role === 'easy')
      ? [
          `Trkačka nedelja: lagan ${fmtKm(easy.km)} km = najkraći lagan tapera (kraći od ${Math.round(q.otherEasySec / 60)} min E; trkačka ≤ taper, D23).`
        ]
      : [];
  return finish(days, null, null, [
    sharpenDate
      ? `Trkačka nedelja: oštrenje ${reps} × ${q.sharpener.repM} m RP (≤ RP doza tapera ${fmtKm(taperRpM / 1000)} km), trka ${q.raceKm} km se ne računa u obim (D8).`
      : reps === 0
        ? `Trkačka nedelja: taper bez RP — bez oštrenja (oštrenje ≤ RP doza tapera, D8); trka ${q.raceKm} km se ne računa u obim (D20).`
        : `Trkačka nedelja: nijedan dan trčanja nije ≥ ${q.sharpenerMinGapDays} dana pre trke i nesusedan poslednjem zahtevnom danu tapera — bez oštrenja (D8, odstupanje); trka ${q.raceKm} km se ne računa u obim (D20).`,
    ...shortened
  ]);
}
