/* Sastav nedelje: izgradnja, rasterećenje (D5 sadržaj), taper (D7), trkačka nedelja (D8). Doze bira
   quality.ts, dužine lengths.ts, treninge workouts.ts; ovde se samo raspoređuju po danima šablona (D9).
   null = nedelja sa ovim ciljem nije izvodljiva po pravilima (volume.ts traži najbliži izvodljiv cilj). */

import { addDays, daysBetween, weekdayOf } from './dates.ts';
import { TEN_K_V2_POLICY as P } from './policy.ts';
import { pickBuild, pickDeload, pickTaper, type QualityState } from './quality.ts';
import { buildLengths, deloadLengths, taperLengths } from './lengths.ts';
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
  sharpenerWorkout
} from './workouts.ts';

export interface WeekContext {
  input: TenKV2Input;
  paces: Paces;
  pattern: Pattern;
  /** Prognoza 10K [s] (trka). */
  raceSec: number;
}

export interface BuiltWeek {
  days: PlanDay[];
  planned100: number;
  /** Dugi nedelje [0,1 km]; null u trkačkoj nedelji. */
  long10: number | null;
  /** Izbor doza nedelje izgradnje (stanje za sledeću nedelju); null van izgradnje. */
  picks: { q1: Dose; q2: Dose } | null;
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

/** Izgradnja, rasterećenje ili taper sa ciljem `target10` [0,1 km]. */
export function buildWeek(
  ctx: WeekContext,
  frame: WeekFrame,
  target10: number,
  quality: QualityState,
  lastLong10: number | null,
  longest10: number,
  allowDrop = false
): BuiltWeek | null {
  const p = ctx.paces;
  const pat = ctx.pattern;
  const targetKm = target10 / 10;
  if (frame.phase === 'race') return null;

  if (frame.deload) {
    const t = pickDeload(quality, frame.phase, targetKm);
    if (!t || lastLong10 === null) return null;
    const tw = qualityWorkout(t, p);
    const len = deloadLengths(target10, km100(tw.km), lastLong10, p);
    if (!len) return null;
    const easyDays = [pat.q1, ...pat.easy].map((wd) => dateOf(frame, wd)).sort();
    const days = [
      day(dateOf(frame, pat.q2), 'q2', tw),
      day(dateOf(frame, pat.long), 'long', longWorkout(len.long10 / 10, p)),
      ...easyDays.map((d, i) => day(d, 'easy', easyWorkout(len.easy10[i]! / 10, p)))
    ];
    return finish(days, len.long10, null, [
      `Rasterećenje: cilj ${fmtKm(targetKm)} km, jedan kvalitet (T), dugi 0,8 × poslednji ne-rasteretni (D5).`
    ]);
  }

  if (frame.phase === 'taper') {
    const t = pickTaper(quality, targetKm);
    if (!t) return null;
    const w1 = qualityWorkout(t.q1, p);
    const w2 = qualityWorkout(t.q2, p);
    const len = taperLengths(target10, km100(w1.km) + km100(w2.km), longest10, p);
    if (!len) return null;
    return finish(
      [
        day(dateOf(frame, pat.q1), 'q1', w1),
        day(dateOf(frame, pat.q2), 'q2', w2),
        day(dateOf(frame, pat.long), 'long', longWorkout(len.long10 / 10, p)),
        day(dateOf(frame, pat.easy[0]!), 'easy', easyWorkout(len.easy10[0]! / 10, p))
      ],
      len.long10,
      null,
      ['Taper: RP i T ≈ 60 % poslednje doze, dugi ≤ 0,75 × najduži (D7).']
    );
  }

  const picks = pickBuild(quality, frame.phase, targetKm, p, allowDrop);
  if (!picks) return null;
  const w1 = qualityWorkout(picks.q1, p);
  const w2 = qualityWorkout(picks.q2, p);
  const len = buildLengths(target10, km100(w1.km) + km100(w2.km), p);
  if (!len) return null;
  const notes: string[] = [];
  if (picks.q1.step === 'repeat') notes.push(repeatNote('Q1', picks.q1));
  if (picks.q2.step === 'repeat') notes.push(repeatNote('Q2', picks.q2));
  for (const [slot, d, prev] of [
    ['Q1', picks.q1, quality.q1],
    ['Q2', picks.q2, quality.q2]
  ] as const)
    if (d.step === 'drop')
      notes.push(
        `${slot}: ${d.zone} spušten sa ${fmtKm((prev?.doseM ?? 0) / 1000)} na ${fmtKm(d.doseM / 1000)} km — nijedan cilj nedelje nije izvodljiv uz „doza ne pada" i plafon (odstupanje: D11 ispred D12, opreznije).`
      );
  return finish(
    [
      day(dateOf(frame, pat.q1), 'q1', w1),
      day(dateOf(frame, pat.q2), 'q2', w2),
      day(dateOf(frame, pat.long), 'long', longWorkout(len.long10 / 10, p)),
      day(dateOf(frame, pat.easy[0]!), 'easy', easyWorkout(len.easy10[0]! / 10, p))
    ],
    len.long10,
    picks,
    notes
  );
}

/**
 * D8: trkačka nedelja. Najviše 4 dana trčanja uključujući trku; trka zamenjuje dugi (kad bi bilo 5 dana,
 * otpada dan dugog). Oštrenje na najkasnijem danu ≥ 3 dana pre trke; dan pred trku 20 min E + ubrzanja;
 * ostali 35 min E. Trka (sa WU/CD) se ne računa u obim.
 */
export function raceWeek(ctx: WeekContext, frame: WeekFrame, peak10: number): BuiltWeek {
  const q = P.raceWeek;
  const p = ctx.paces;
  const race = ctx.input.raceDate;
  let runs = ctx.input.runDays
    .map((wd) => dateOf(frame, wd))
    .filter((d) => d !== race)
    .sort();
  if (runs.length + 1 > q.maxRunDays)
    runs = runs.filter((d) => d !== dateOf(frame, ctx.pattern.long));
  const sharpenDate = [...runs]
    .reverse()
    .find((d) => daysBetween(d, race) >= q.sharpenerMinGapDays)!;
  const reps =
    peak10 < Math.round(q.sharpenerSmallPeakKm * 10) ? q.sharpenerSmallReps : q.sharpener.reps;
  const days: PlanDay[] = [day(race, 'race', raceWorkout(p, ctx.raceSec), false)];
  for (const d of runs) {
    if (d === sharpenDate) days.push(day(d, 'sharpener', sharpenerWorkout(reps, p)));
    else if (daysBetween(d, race) === 1) days.push(day(d, 'eve', eveWorkout(p)));
    else days.push(day(d, 'easy', easyTimeWorkout(q.otherEasySec, p)));
  }
  return finish(days, null, null, [
    `Trkačka nedelja: oštrenje ${reps} × ${q.sharpener.repM} m RP, trka ${q.raceKm} km se ne računa u obim (D8).`
  ]);
}
