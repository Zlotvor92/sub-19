/* V4 — ČUVAR (SPEC § 8): odbija samo neispravan unos; sve ostalo prijavljuje (nalazi) ili upozorava (tri rečenice
   sa predlogom u brojevima). Ništa ne menja — ni generisan ni lični plan. */
import {
  BASE_UNDER_DECLARED_SHARE,
  PEAK_BELOW_BASE_KM,
  EASY_DISTANCE_STEP_M,
  EASY_DURATION_STEP_SEC,
  EASY_FLOOR_MIN_RUN_DAYS,
  LEVEL_VOLUME_LOST_MIN_WEEKS,
  LEVEL_VOLUME_LOST_SHARE,
  PAIN_LEVEL_MAX,
  RACE_EVE_MAX_SEC,
  RACE_NO_LONG_DAYS,
  RAMP_MIN_DURATION_SEC,
  GUARD_DOSE_TOLERANCE_SEC,
  GUARD_TAPER_KM_SLACK,
  RESTORE_PEAK_AFTER_DAYS,
  GUARD_FAST_SHARE_TOLERANCE,
  GUARD_JUMP_TOLERANCE,
  GUARD_LONG_STEP_TOLERANCE_SEC,
  GUARD_MIN_WEEK_SHARE,
  GUARD_MIN_WEEK_WORKOUTS,
  GUARD_MIN_WORKOUT_SEC,
  GUARD_TAPER_WORK_SHARE,
  GUARD_UNDER_TARGET,
  NEAR_ENOUGH,
  PREP_PROBE_MAX_EXTRA_WEEKS,
  RETURN_LONG_JUMP_SEC
} from './constants';
import { buildCtx, plannedEffort } from './build';
import { addDays, diffDays, isValidDate, mondayOf, weekdayOf } from './dates';
import {
  levelMinEasy,
  longReaches,
  longStepOf,
  maxWorkOf,
  minEasyOf,
  runStreak,
  minRampOf,
  ranGoalDistance
} from './decide';
import {
  count,
  DAYS,
  fmtClock,
  fmtDate,
  fmtDistance,
  fmtMinutes,
  fmtNumber,
  fmtPace,
  pluralForm,
  WEEKS,
  WORKOUTS
} from './format';
import { type PaceCtx, paceCtxOf, summarize, type WorkoutSummary } from './load';
import {
  adjustmentWindow,
  effortRampDays,
  pauseLength,
  pauseRampDays,
  rampOf,
  underRamp
} from './readiness';
import { byDistance, candidates } from './select';
import { countWeeks, weekMinus2Share } from './template';
import type {
  AdequatePrep,
  Adjustment,
  Decisions,
  DistanceData,
  Finding,
  Goal,
  GuardFn,
  InputError,
  InputErrorCode,
  IsoDate,
  PlanDay,
  PlanDoc,
  PlanWeek,
  RunnerFacts,
  RunnerState,
  Seconds,
  Step,
  Warning,
  Weekday,
  Workout
} from './types';

/** R20 B6: dodatni dan tek posle ovoliko nedelja staža. */
const EXTRA_DAY_MIN_TENURE_WEEKS = 13;
/** R20 B6: predlog kraće distance kad najduži dugi ostaje ispod ovog udela potrebnog. */
const SHORTER_DISTANCE_LONG_SHARE = 0.8;

/* ------------------------------------------------------------------ § 8.1 neispravan unos */

const positive = (value: number): boolean => Number.isFinite(value) && value > 0;

/** Jedino što se odbija (§ 8.1). Prima činjenice ili već izgrađeno stanje. */
export function validate(
  input: RunnerFacts | RunnerState,
  goal: Goal,
  data: DistanceData
): InputError[] {
  const errors: InputError[] = [];
  const fail = (code: InputErrorCode, field: string, message: string): void => {
    errors.push({ code, field, message });
  };
  const dateOk = (value: unknown, field: string): boolean => {
    if (isValidDate(value)) return true;
    fail('datum-neispravan', field, 'Datum ne postoji ili nije u obliku GGGG-MM-DD.');
    return false;
  };
  const todayOk = dateOk(input.today, 'today');
  const raceOk = dateOk(goal.raceDate, 'goal.raceDate');
  const startOk = goal.startDate === undefined || dateOk(goal.startDate, 'goal.startDate');
  if (todayOk && raceOk && goal.raceDate <= input.today) {
    fail('trka-u-proslosti', 'goal.raceDate', 'Trka mora biti najranije sutra.');
  }
  if (raceOk && startOk && goal.startDate !== undefined && goal.startDate > goal.raceDate) {
    fail('datum-neispravan', 'goal.startDate', 'Početak plana je posle dana trke.');
  }
  const days = input.availability.runDays;
  const validDays = days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  if (validDays.length === 0) {
    fail('nema-dana', 'availability.runDays', 'Izaberi bar jedan dan za trčanje.');
  } else if (!validDays.includes(input.availability.longDay)) {
    fail(
      'dugi-van-dana',
      'availability.longDay',
      'Dan dugog trčanja mora biti jedan od dana trčanja.'
    );
  }
  const number = (value: number | undefined, field: string): void => {
    if (value !== undefined && !positive(value)) {
      fail('broj-neispravan', field, 'Vrednost mora biti broj veći od nule.');
    }
  };
  const p = input.profile;
  number(p.weeklyKm, 'profile.weeklyKm');
  number(p.easyPaceSecPerKm, 'profile.easyPaceSecPerKm');
  number(p.longestRecentKm, 'profile.longestRecentKm');
  number(p.recentResult?.distanceM, 'profile.recentResult.distanceM');
  number(p.recentResult?.timeSec, 'profile.recentResult.timeSec');
  if (p.yearsRunning !== undefined && !(Number.isFinite(p.yearsRunning) && p.yearsRunning >= 0)) {
    fail(
      'broj-neispravan',
      'profile.yearsRunning',
      'Vrednost mora biti broj koji nije manji od nule.'
    );
  }
  if (p.recentResult?.date !== undefined) dateOk(p.recentResult.date, 'profile.recentResult.date');
  number(goal.targetTimeSec, 'goal.targetTimeSec');
  /* O5: pauze i bol — datumi i nivo (neispravan zapis se odbija, ne ruši). */
  input.pauses.forEach((pause, i) => {
    const fromOk = dateOk(pause.from, `pauses[${String(i)}].from`);
    const toOk = dateOk(pause.to, `pauses[${String(i)}].to`);
    if (fromOk && toOk && pause.from > pause.to) {
      fail('datum-neispravan', `pauses[${String(i)}].to`, 'Kraj pauze je pre njenog početka.');
    }
  });
  input.pain.forEach((pain, i) => {
    dateOk(pain.date, `pain[${String(i)}].date`);
    if (pain.resolvedOn !== undefined) dateOk(pain.resolvedOn, `pain[${String(i)}].resolvedOn`);
    if (!(Number.isFinite(pain.level) && pain.level >= 1 && pain.level <= PAIN_LEVEL_MAX)) {
      fail('broj-neispravan', `pain[${String(i)}].level`, 'Nivo bola je broj od 1 do 10.');
    }
  });
  input.runs.forEach((run, i) => {
    dateOk(run.date, `runs[${String(i)}].date`);
    number(run.durationSec, `runs[${String(i)}].durationSec`);
    if (!(Number.isFinite(run.distanceM) && run.distanceM >= 0)) {
      fail(
        'broj-neispravan',
        `runs[${String(i)}].distanceM`,
        'Dužina mora biti broj koji nije manji od nule.'
      );
    }
  });
  if (goal.distanceId !== data.id) {
    fail('nepoznata-distanca', 'goal.distanceId', 'Cilj i podaci distance se ne slažu.');
  }
  return errors;
}

/* ------------------------------------------------------------------ pomoćno: zbirovi nedelje */

interface DayCost {
  day: PlanDay;
  cost: WorkoutSummary;
}

export interface WeekCost {
  week: PlanWeek;
  days: DayCost[];
  /** Bez dana trke. */
  load: number;
  durationSec: number;
  workSec: number;
  /** Brz rad (S1): rad kvaliteta i bloka u dugom — test i trka se ne broje. */
  fastSec: number;
  km: number;
  longSec: number;
  longKm: number;
  workouts: number;
}

/** Brz rad treninga (S1): prag, intervali, brze deonice, tempo trke i blok u dugom; trka i test ne ulaze. */
export function fastWorkSec(workout: Workout | null): Seconds {
  if (workout === null) return 0;
  return workout.kind === 'quality' || workout.kind === 'long' ? workout.workSec : 0;
}

export function weekCost(week: PlanWeek, raceDate: IsoDate, ctx: PaceCtx): WeekCost {
  const out: WeekCost = {
    week,
    days: [],
    load: 0,
    durationSec: 0,
    workSec: 0,
    fastSec: 0,
    km: 0,
    longSec: 0,
    longKm: 0,
    workouts: 0
  };
  for (const day of week.days) {
    const cost = summarize(day.workout, ctx);
    out.days.push({ day, cost });
    if (day.workout === null) continue;
    out.workouts += 1;
    if (day.workout.kind === 'race' && day.date === raceDate) continue;
    out.load += cost.load;
    out.durationSec += cost.durationSec;
    out.workSec += day.workout.workSec;
    out.fastSec += fastWorkSec(day.workout);
    out.km += cost.km;
    if (day.workout.kind === 'long') {
      out.longSec = Math.max(out.longSec, cost.durationSec);
      out.longKm = Math.max(out.longKm, cost.km);
    }
  }
  out.km = Math.round(out.km * 10) / 10;
  return out;
}

function inAnyWindow(week: PlanWeek, adjustments: readonly Adjustment[], afterDays = 0): boolean {
  const end = addDays(week.start, 6);
  return adjustments.some((adj) => {
    const w = adjustmentWindow(adj);
    return (
      w !== null &&
      w.from <= end &&
      (w.rampEnd >= week.start || (afterDays > 0 && addDays(w.rampEnd, afterDays) > week.start))
    );
  });
}

/* ------------------------------------------------------------------ § 8.2 provere */

export const guard: GuardFn = (doc, _state, data) => {
  const { header } = doc;
  const ctx = paceCtxOf(header);
  const build = buildCtx(header, data);
  const s = data.safety;
  const d = header.decisions;
  const findings: Finding[] = [];
  const costs = doc.weeks.map((w) => weekCost(w, header.goal.raceDate, ctx));
  /* Dugi raste od nezaokružene vrednosti, pa ostvareni korak sme da bude veći za jedno zaokruživanje (0,5 km / 5 min). */
  const roundingSlack = Math.max(
    EASY_DURATION_STEP_SEC,
    (EASY_DISTANCE_STEP_M * ctx.paces.easy) / 1000
  );
  /* O2: nijedan trening nije kraći od najkraćeg smislenog trčanja (lagano, dan pred trku, dan u rampi), uz jedno
     zaokruživanje; nikad ispod 15 min. */
  const unitSlack = byDistance(build)
    ? (EASY_DISTANCE_STEP_M * ctx.paces.easy) / 1000
    : EASY_DURATION_STEP_SEC;
  const shortest = Math.max(
    GUARD_MIN_WORKOUT_SEC,
    /* Dan zadat dužinom traje kraće kad se tempa ubrzaju posle rezultata: dozvoljeno još 10 %. */
    0.9 * (Math.min(s.minEasySec, RACE_EVE_MAX_SEC, RAMP_MIN_DURATION_SEC) - unitSlack)
  );
  const eve = addDays(header.goal.raceDate, -1);
  const noLongFrom = addDays(header.goal.raceDate, -RACE_NO_LONG_DAYS);
  const adjustments = header.adjustments ?? [];
  /* Pun napor iz plana (provera forme, pripremna trka) skraćuje dane posle sebe isto kao u gradnji — čuvar ga
     vidi kao i ostale uzroke, da ne prijavi lažno `ispod-cilja`. */
  const explicit = new Set(adjustments.flatMap((x) => (x.kind === 'effort' ? [x.date] : [])));
  const causes: Adjustment[] = [
    ...adjustments,
    ...doc.weeks
      .flatMap((w) => w.days)
      .filter((day) => day.workout?.kind === 'test' && !explicit.has(day.date))
      .map(plannedEffort)
  ];
  const report = (check: string, week: PlanWeek, day: PlanDay | null, message: string): void => {
    const foreign =
      day !== null
        ? day.origin !== 'template'
        : week.intent.source === 'inferred' || week.days.some((x) => x.origin !== 'template');
    findings.push({
      check: foreign ? 'rucno' : check,
      weekIndex: week.index,
      dayId: day?.id ?? null,
      message: foreign ? `${check}: ${message}` : message
    });
  };

  const races: PlanDay[] = [];
  let lastWorkout: PlanDay | null = null;
  let previous: PlanDay | null = null;
  /* R8 t. 1: udeo brzog rada sužavanja je podatak distance (`safety.taper.weekBeforeMaxOfPeak`) */
  const taperShare = data.safety.taper?.weekBeforeMaxOfPeak ?? GUARD_TAPER_WORK_SHARE;
  /* Vršna nedelja pod rampom (skraćen brz rad) nije merilo za sužavanje. */
  const peakWork = Math.max(
    0,
    ...costs
      /* M9 (krug 5): ni vršna nedelja u 21 dan posle rampe (skraćena zbog povratka) */
      .filter(
        (c) =>
          c.week.intent.kind === 'peak' && !inAnyWindow(c.week, causes, RESTORE_PEAK_AFTER_DAYS)
      )
      .map((c) => c.fastSec)
  );

  /* M7 (krug 5): silazak obima po KALENDARSKOJ nedelji (km prema vršnoj nedelji, broj brzih treninga) */
  const peakKm = Math.max(
    0,
    /* vrh skraćen povratkom (21 dan posle rampe) nije merilo silaska — isto kao za brz rad (M9) */
    ...costs
      .filter(
        (c) =>
          c.week.intent.kind === 'peak' && !inAnyWindow(c.week, causes, RESTORE_PEAK_AFTER_DAYS)
      )
      .map((c) => c.km)
  );
  const raceMonday = mondayOf(header.goal.raceDate);

  costs.forEach((c, i) => {
    const { week } = c;
    const taper = s.taper;
    if (taper !== undefined && peakKm > 0 && week.start >= header.startDate) {
      if (week.start === addDays(raceMonday, -14)) {
        const fastDays = week.days.filter((d) => fastWorkSec(d.workout) > 0).length;
        if (
          taper.calendarMinus2MaxQuality !== undefined &&
          fastDays > taper.calendarMinus2MaxQuality
        ) {
          report(
            'silazak',
            week,
            null,
            'Dve nedelje pred nedeljom trke ima više brzih treninga od dozvoljenog.'
          );
        }
        const m2 = weekMinus2Share(taper, header.startDate, header.goal.raceDate);
        if (m2 !== undefined && c.km > m2 * peakKm + GUARD_TAPER_KM_SLACK) {
          report(
            'silazak',
            week,
            null,
            'Obim dve nedelje pred nedeljom trke nije spušten prema vršnoj nedelji.'
          );
        }
      }
      if (
        week.start === addDays(raceMonday, -7) &&
        taper.weekMinus1MaxOfPeak !== undefined &&
        c.km > taper.weekMinus1MaxOfPeak * peakKm + GUARD_TAPER_KM_SLACK
      ) {
        report(
          'silazak',
          week,
          null,
          'Obim nedelje pred nedeljom trke nije spušten prema vršnoj nedelji.'
        );
      }
      if (
        week.start === raceMonday &&
        taper.raceWeekMaxOfPeak !== undefined &&
        c.km > taper.raceWeekMaxOfPeak * peakKm + GUARD_TAPER_KM_SLACK
      ) {
        report(
          'silazak',
          week,
          null,
          'Obim nedelje trke (bez trke) nije spušten prema vršnoj nedelji.'
        );
      }
    }
    const ramp = inAnyWindow(week, causes);
    const partial = week.start < header.startDate;
    const raceWeek = week.intent.kind === 'race';
    const before = costs
      .slice(0, i)
      .filter((x) => !underRamp(x.week.start, adjustments))
      .slice(-3);
    /* Pravilo rasta meri obim u minutima (krug 2, R3): kvalitet ide preko minuta, ne umesto njih. */
    /* krug 4 (S2): obim = km u minutima laganog tempa, isto kao lanac rasta motora */
    const volOf = (x: WeekCost): number => (x.km * ctx.paces.easy) / 60;
    const m = Math.max(
      ...before.map(volOf),
      ...(before.length < 3 ? [d.baseVolumeMin ?? d.baseLoad] : [])
    );
    /* Prethodni dugi se meri odlučenom dužinom kad nedelja ima dugi (dugi sa blokom kraće traje za iste km). */
    const longBefore = Math.max(
      d.longStartSec,
      ...before.map((x) => (x.longSec > 0 ? Math.max(x.longSec, x.week.longSec) : 0))
    );

    for (const { day, cost } of c.days) {
      const w = day.workout;
      if (w === null) {
        previous = day;
        continue;
      }
      lastWorkout = day;
      if (w.kind === 'race') races.push(day);
      const cap = w.stimulus === null ? undefined : d.doseCapSec[w.stimulus];
      if (cap !== undefined && w.workSec > cap + GUARD_DOSE_TOLERANCE_SEC) {
        report(
          'doza-plafon',
          week,
          day,
          `Rad treninga je iznad plafona podražaja (${fmtDate(day.date)}).`
        );
      }
      if (
        w.kind !== 'race' &&
        (w.steps.length === 0 || w.text.trim() === '' || cost.durationSec < shortest)
      ) {
        report(
          'prazan',
          week,
          day,
          `Trening je prazan, bez teksta ili kraći od najkraćeg smislenog trčanja (${fmtDate(day.date)}).`
        );
      }
      /* O3: dan pred trku je odmor ili lagano do 20 min; dugog nema u poslednjih 5 dana pre trke. */
      if (
        day.date === eve &&
        w.kind !== 'race' &&
        (w.kind !== 'easy' || cost.durationSec > RACE_EVE_MAX_SEC + roundingSlack)
      ) {
        report(
          'dan-pred-trku',
          week,
          day,
          `Dan pred trku treba da bude odmor ili lagano do 20 min (${fmtDate(day.date)}).`
        );
      }
      if (w.kind === 'long' && day.date >= noLongFrom && day.date < header.goal.raceDate) {
        report(
          'dugi-pred-trku',
          week,
          day,
          `Dugi trening je u poslednjih 5 dana pre trke (${fmtDate(day.date)}).`
        );
      }
      /* Poredi se dužina: dugi sa blokom je brži, pa kraće traje za iste kilometre. */
      /* U nedelji rampe dugi je namerno ograničen (≤ 75 % poslednjeg), pa se ne poredi sa laganim danom. */
      if (!ramp && w.kind === 'easy' && c.longKm > 0 && cost.km > c.longKm) {
        report(
          'lagan-dugi',
          week,
          day,
          `Lagan dan je duži od dugog iste nedelje (${fmtDate(day.date)}).`
        );
      }
      const hard = (x: PlanDay | null): boolean =>
        x?.workout != null &&
        (x.workout.kind === 'quality' ||
          x.workout.kind === 'test' ||
          (x.workout.kind === 'long' && x.workout.workSec > 0));
      if (
        hard(day) &&
        hard(previous) &&
        previous !== null &&
        diffDays(day.date, previous.date) === 1
      ) {
        report(
          'teski-uzastopno',
          week,
          day,
          `Dva teška treninga u uzastopnim danima (${fmtDate(day.date)}).`
        );
      }
      previous = day;
    }

    const share = c.durationSec > 0 ? c.fastSec / c.durationSec : 0;
    const maxShare = week.intent.kind === 'peak' ? s.maxFastSharePeak : s.maxFastShare;
    /* Nedelja trke se ne meri: mala je, a sama trka ne ulazi u zbir. */
    /* Z10 (krug 7): nedelja u rampi (prekid, malo km) se ne meri udelom; skraćena nedelja izlaska (4 nedelje posle
       rampe) najviše do granice vršne nedelje */
    const exitShare = inAnyWindow(week, causes, 28)
      ? Math.max(maxShare, s.maxFastSharePeak)
      : maxShare;
    if (!raceWeek && !ramp && share > exitShare + GUARD_FAST_SHARE_TOLERANCE) {
      report('brz-udeo', week, null, 'Udeo brzog rada u nedelji je iznad dozvoljenog.');
    }
    const rule = Math.max(m * (1 + s.maxWeeklyRampPct), m + minRampOf(s, ctx.paces.easy));
    /* Z1 (krug 7): 4 nedelje posle rampe važi pravilo izlaska (+ 20 %), ne pravilo rasta */
    const exiting = inAnyWindow(week, causes, 28);
    if (
      (week.intent.kind === 'build' || week.intent.kind === 'peak') &&
      !exiting &&
      volOf(c) > rule * (1 + GUARD_JUMP_TOLERANCE)
    ) {
      report('skok', week, null, 'Obim nedelje raste brže od pravila rasta.');
    }
    if (c.longSec > d.longMaxSec + GUARD_LONG_STEP_TOLERANCE_SEC) {
      report('dugi-plafon', week, null, 'Dugi je duži od najdužeg dozvoljenog u planu.');
    }
    /* R19 (odluka organizatora): posle povratka po nedeljama (pauza 5–21 dan) rast dugog se meri od većeg od
       prethodnog i referentnog dugog pre pauze, po pravilu izlaska (+ 20 min) — isto kao motor */
    const ret = adjustments.reduce<{ ref: Seconds; step: Seconds }>(
      (acc, adj) => {
        const ramp = rampOf(adj);
        if (ramp?.schedule === undefined) return acc;
        const end = addDays(ramp.zero, ramp.days);
        if (week.start <= end || week.start > addDays(end, 28)) return acc;
        return {
          ref: Math.max(acc.ref, ramp.schedule.refLongSec),
          step: Math.max(acc.step, RETURN_LONG_JUMP_SEC)
        };
      },
      { ref: 0, step: 0 }
    );
    if (
      c.longSec >
      Math.max(longBefore, ret.ref) +
        Math.max(longStepOf(s, ctx.paces.easy), ret.step) +
        GUARD_LONG_STEP_TOLERANCE_SEC +
        roundingSlack
    ) {
      report('dugi-korak', week, null, 'Dugi raste za više od jednog koraka.');
    }
    /* Sužavanje je namerno manje od cilja (R1: višak se ne preliva), kao i nedelja u kojoj dugi ustupa mesto
       poslednjim danima pre trke (O3). */
    const calm = week.intent.kind === 'taper' || addDays(week.start, 6) >= noLongFrom;
    /* krug 4: manjak se meri prema obimu (minuti) kad ga nedelja nosi — skraćen brz rad (S1) nije manjak */
    const under =
      week.volumeMin === undefined
        ? c.load < GUARD_UNDER_TARGET * week.targetLoad
        : c.durationSec / 60 < GUARD_UNDER_TARGET * week.volumeMin &&
          c.load < GUARD_UNDER_TARGET * week.targetLoad;
    if (!ramp && !partial && !raceWeek && !calm && under) {
      report('ispod-cilja', week, null, 'Planirano opterećenje je ispod 85 % cilja nedelje.');
    }
    if (!ramp && !partial && !raceWeek) {
      /* krug 15 (M10): nedelja pripremne trke ili provere ima manje treninga zbog same trke (`dan-izostavljen`) */
      const tested = c.days.some((x) => x.day.workout?.kind === 'test');
      const few = !tested && c.workouts < Math.min(GUARD_MIN_WEEK_WORKOUTS, d.runDays.length);
      if (c.load < GUARD_MIN_WEEK_SHARE * d.baseLoad || few) {
        report(
          'min-nedelja',
          week,
          null,
          'Nedelja je ispod minimalnog smislenog obima ili broja treninga.'
        );
      }
    }
    /* krug 10 (stavka 26): udeo brzog rada sužavanja meri se u kalendarskoj nedelji pred nedeljom trke (isto što
       motor drži, dani 8–14); ranije nedelje dužeg sužavanja (3 nedelje) mere km provere silaska (M7) */
    if (
      week.intent.kind === 'taper' &&
      week.start === addDays(raceMonday, -7) &&
      peakWork > 0 &&
      c.fastSec > taperShare * peakWork + GUARD_DOSE_TOLERANCE_SEC
    ) {
      report(
        'taper',
        week,
        null,
        `Brz rad u nedelji sužavanja je veći od ${String(Math.round(taperShare * 100))} % rada vršne nedelje.`
      );
    }
    if (week.intent.source === 'template') {
      const slots = [
        ...(week.intent.long === null
          ? []
          : [{ place: 'long' as const, stimulus: week.intent.long.stimulus }]),
        ...week.intent.stimuli.map((x) => ({ place: 'quality' as const, stimulus: x.stimulus }))
      ];
      for (const slot of slots) {
        const ref = { ...slot, index: 0, phase: week.intent.phase };
        if (candidates(ref, null, build, { noHighImpact: false }).length === 0) {
          report(
            'nema-treninga',
            week,
            null,
            `Biblioteka nema trening za mesto „${slot.stimulus}".`
          );
        }
      }
    }
  });

  /* S3 (krug 4): nalaz čuvara — plan od 16+ nedelja bez dugog za distancu */
  const longest = Math.max(0, ...costs.map((c) => c.longSec));
  const planWeeks = countWeeks(header.startDate, header.goal.raceDate);
  const longestKm = Math.max(0, ...costs.map((c) => c.longKm));
  if (!longReaches(data, planWeeks, longest, ctx.paces.easy, longestKm)) {
    const at = costs.find((c) => c.longSec === longest)?.week ?? doc.weeks[0];
    if (at !== undefined)
      report('dugi-za-distancu', at, null, 'Najduži dugi plana ne stiže do dugog za distancu.');
  }
  const lastWeek = doc.weeks[doc.weeks.length - 1];
  const final: PlanDay | null = lastWorkout;
  const raceOk =
    races.length === 1 &&
    races[0]?.date === header.goal.raceDate &&
    final !== null &&
    final === races[0];
  if (!raceOk && lastWeek !== undefined) {
    report('trka', lastWeek, null, 'Trka mora biti jedna, poslednji trening plana i na dan trke.');
  }
  return findings;
};

/* ------------------------------------------------------------------ § 8.3 upozorenja */

export interface WarningInput {
  state: RunnerState;
  goal: Goal;
  data: DistanceData;
  decisions: Decisions;
  doc: PlanDoc;
  /** Probni plan sa još jednim danom trčanja (isti datum trke): vrh i najduži dugi; `null` kad nema 8. dana. */
  withExtraDay?: () => { peakKm: number; longKm: number; dayMin: number } | null;
  /** Z7: probni plan sa ukupno `total` nedelja pripreme (isti start, trka kasnije): vrh i najduži dugi. */
  withWeeks?: (total: number) => { peakKm: number; longKm: number };
}

/** Z7: najmanja ukupna dužina pripreme (> sadašnje) uz koju probni plan ispunjava uslov; `null` kad ni najduža proba
    ne pomaže (tada uzrok nije dužina pripreme). */
function weeksThatFix(
  input: WarningInput,
  weeks: number,
  ok: (probe: { peakKm: number; longKm: number }) => boolean
): { total: number; probe: { peakKm: number; longKm: number } } | null {
  const at = input.withWeeks;
  if (at === undefined) return null;
  let hi = weeks + PREP_PROBE_MAX_EXTRA_WEEKS;
  let best = at(hi);
  if (!ok(best)) return null;
  let lo = weeks;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    const probe = at(mid);
    if (ok(probe)) {
      hi = mid;
      best = probe;
    } else lo = mid;
  }
  return { total: hi, probe: best };
}

const km = (value: number): string => `${fmtNumber(value)} km`;
/** Krug 15 (M6): dodatni dan se nudi kao predlog samo kad podigne vrh bar ovoliko puta. */
const TRIAL_MIN_GAIN = 1.05;

/** Upozorenja: problem → značenje → predlog sa brojem (AGENTS t. 6). Brojevi iz `data.adequate` i plana. */
export function warnings(input: WarningInput): Warning[] {
  const { state, goal, data, decisions: d, doc } = input;
  /* R19 (stavka 6): broj dana i dugi za distancu po nivou (podatak distance), inače opšti */
  const a: AdequatePrep = {
    ...data.adequate,
    minRunDays: data.adequate.minRunDaysByLevel?.[d.level] ?? data.adequate.minRunDays,
    minLongKm: data.adequate.minLongKmByLevel?.[d.level] ?? data.adequate.minLongKm
  };
  const s = data.safety;
  const ctx = paceCtxOf(doc.header);
  const costs = doc.weeks.map((w) => weekCost(w, goal.raceDate, ctx));
  const weeks = countWeeks(doc.header.startDate, goal.raceDate);
  const peakKm = Math.max(0, ...costs.map((c) => c.km));
  const longKm = Math.max(0, ...costs.map((c) => c.longKm));
  /* T2 (krug 6): predlog dužine pripreme je JEDAN broj u celom planu (najveći od predloga) i nikad kraći od stvarne
     pripreme — svako upozorenje upisuje oznaku, broj se upisuje na kraju */
  const PREP = '\u0000PRIP\u0000';
  /* R22 (B3): „Izaberi trku za koju imaš N nedelja pripreme — tada …" sa dobitkom probnog plana */
  const PREP_GAIN = '\u0000DOBIT\u0000';
  const PREP_GAIN_END = '\u0000DOBITKRAJ\u0000';
  /* R22 (B3): jedna tema — jedan predlog: kratka priprema nosi predlog dužine pripreme, a ostala upozorenja ga ne
     ponavljaju; dodatni dan se predlaže jednom */
  const shortPrep = weeks < a.minWeeks;
  let extraDayProposed = false;
  let weeksProposed = shortPrep;
  /* jedna rečenica o tome da duža priprema ne pomaže */
  let noPrepSaid = false;
  /* Z7: vrh i dugi probnog plana sa tim JEDNIM brojem nedelja (upisuju se na kraju, kao i broj) */
  const PEAK_AT = '\u0000VRH\u0000';
  const LONG_AT = '\u0000DUGI\u0000';
  const prepWanted: number[] = [];
  const prep = (n: number): string => {
    prepWanted.push(n);
    return PREP;
  };
  const out: Warning[] = [];
  const shorter =
    a.shorter === undefined ? '' : `, ili na isti datum trči kraću distancu: ${a.shorter.label}`;

  if (weeks < a.minWeeks) {
    out.push({
      code: 'kratka-priprema',
      severity: weeks < a.minWeeks / 2 ? 'ozbiljno' : 'upozorenje',
      problem: `Do trke ${pluralForm(weeks, ['je', 'su', 'je'])} ${count(weeks, WEEKS)}, a adekvatna priprema za ovu distancu traje bar ${count(a.minWeeks, WEEKS)}.`,
      /* R20 (IV): značenje može da da distanca (`texts['upozorenje.kratka-priprema']`, zamene {weeks}, {minWeeks}) */
      meaning: fillWarn(
        data.texts['upozorenje.kratka-priprema'] ??
          'Plan nema vremena da postepeno podigne obim i dugi trening, pa će završni deo trke biti teži od svega što stigneš da odradiš u pripremi.',
        { weeks: count(weeks, WEEKS), minWeeks: count(a.minWeeks, WEEKS) }
      ),
      /* krug 15 (M6): isti broj nedelja kao u ostalim predlozima (jedan broj u planu), dugi iz probnog plana te dužine */
      /* R22 (B3): predlog dužine pripreme samo uz stvaran dobitak probnog plana (nedelja ili dugi) — oznaka se
         razrešava na kraju; bez dobitka ostaje samo kraća distanca */
      proposal: `${PREP_GAIN}${prep(a.minWeeks)}${PREP_GAIN_END}${shorter}.`,
      suggest: {
        weeks: a.minWeeks,
        ...(a.shorter === undefined ? {} : { distanceId: a.shorter.distanceId })
      }
    });
  }
  const runDays = d.runDays.length;
  /* R8 t. 20 (brzina): proba „+1 dan" se gradi samo kad je neko upozorenje koje je koristi stvarno izdato */
  const reachesEarly = longReaches(
    data,
    weeks,
    Math.max(0, ...costs.map((c) => c.longSec)),
    ctx.paces.easy
  );
  const needTrial =
    peakKm < NEAR_ENOUGH * a.minPeakWeeklyKm ||
    runDays < a.minRunDays ||
    !reachesEarly ||
    longKm < NEAR_ENOUGH * a.minLongKm;
  const trial = needTrial ? (input.withExtraDay?.() ?? null) : null;
  /* M8a (krug 5), Z7 (krug 7): trajanje dodatnog dana je ono što mu probni plan sa još jednim danom stvarno daje */
  const dayMin = trial === null ? null : Math.max(30, Math.round(trial.dayMin / 5) * 5);
  /* deo obima novog dana dolazi sa ostalih dana kad vrh poraste manje od samog dana */
  const shifts =
    trial !== null &&
    dayMin !== null &&
    trial.peakKm - peakKm < 0.6 * ((dayMin * 60) / doc.header.paces.easy);
  const shiftText = shifts ? ' (deo obima se seli sa ostalih dana na novi, pa su oni kraći)' : '';
  const dayText = dayMin === null ? 'od 30–40 min' : `od oko ${String(dayMin)} min`;
  const extraDay = `Uz isti datum trke dodaj ${String(runDays + 1)}. dan laganog trčanja ${dayText}`;
  /* krug 15 (M6): dodatni dan se nudi samo kad vrh stvarno raste (bar 5 %), a kad ni tada ne stiže do praga, rečenica
     to kaže */
  /* R20 B6: dodatni dan se ne predlaže trkaču sa < 3 meseca staža ni uz tegobu u poslednjih 12 meseci */
  const tenureW = state.profile.yearsRunning === undefined ? null : state.profile.yearsRunning * 52;
  const extraOk =
    !(tenureW !== null && tenureW < EXTRA_DAY_MIN_TENURE_WEEKS) && d.painCaution !== true;
  const dayGain =
    extraOk && trial !== null && trial.peakKm >= Math.max(peakKm + 0.5, TRIAL_MIN_GAIN * peakKm);
  const longGain = extraOk && trial !== null && trial.longKm >= longKm + 0.5;
  if (peakKm < NEAR_ENOUGH * a.minPeakWeeklyKm) {
    const fix = weeksThatFix(input, weeks, (p) => p.peakKm >= NEAR_ENOUGH * a.minPeakWeeklyKm);
    /* Predlog nudi samo brojeve VEĆE od onoga što plan već ima (R11). */
    const longer = trial !== null && trial.longKm >= longKm + 0.5;
    /* Z7: kad je broj dana ispod adekvatnog, predlog dana daje `malo-dana` — ovde se ne ponavlja */
    const fewDays = runDays < a.minRunDays;
    const still =
      trial !== null && trial.peakKm < NEAR_ENOUGH * a.minPeakWeeklyKm
        ? ` — i dalje ispod ${km(a.minPeakWeeklyKm)}, pa trku počni sporije nego što forma na kraćim deonicama nudi`
        : '';
    if (trial !== null && dayGain && !fewDays) extraDayProposed = true;
    const now =
      trial !== null && dayGain
        ? fewDays
          ? `Sa ${String(runDays + 1)}. danom trčanja vrh uz isti datum trke ide do ${km(trial.peakKm)} nedeljno${still}.`
          : `${extraDay} — vrh tada ide do ${km(trial.peakKm)} nedeljno${longer ? `, a dugi do ${km(trial.longKm)}` : ''}${still}.`
        : `Uz isti datum trke obim ne može bezbedno iznad ${km(peakKm)} nedeljno, pa trku počni sporije nego što forma na kraćim deonicama nudi.`;
    out.push({
      code: 'mali-obim',
      severity: 'upozorenje',
      problem: `Najveća nedelja u planu ima ${km(peakKm)}, a adekvatna priprema za ovu distancu traži bar ${km(a.minPeakWeeklyKm)} nedeljno.`,
      meaning:
        'Sa manjim obimom izdržljivost u drugoj polovini trke je slabija, pa tempo pada ranije nego što forma na kraćim deonicama pokazuje.',
      proposal: `${now}${
        fix !== null
          ? weeksProposed
            ? ''
            : ` Za sledeću trku planiraj ${prep(fix.total)} pripreme — obim tada bezbedno stiže do ${PEAK_AT} nedeljno.`
          : fewDays
            ? shortPrep
              ? ''
              : ` Duža priprema ovde ne pomaže: obim ograničava broj dana trčanja (${String(runDays)}), ne dužina pripreme.`
            : ` ${shortPrep ? 'I uz dužu pripremu vrh' : 'Duža priprema ovde ne pomaže: vrh'} plana se računa iz tvog sadašnjeg obima (oko ${km((d.baseLoad * 60) / ctx.paces.easy)} nedeljno)${shortPrep ? '' : ', ne iz broja nedelja'} — za sledeću trku uđi u pripremu sa većim redovnim obimom, da vrh pređe ${km(a.minPeakWeeklyKm)}.`
      }`,
      suggest: {
        peakWeeklyKm: a.minPeakWeeklyKm,
        ...(fix !== null ? { weeks: fix.total } : { runDays: Math.max(runDays, a.minRunDays) })
      }
    });
    if (fix !== null) weeksProposed = true;
    else if (!shortPrep) noPrepSaid = true;
  }
  if (runDays < a.minRunDays) {
    /* Šta još jedan dan stvarno donosi — iz probnog plana, nikad broj manji od planiranog (R11). */
    const gain =
      trial !== null && trial.longKm >= longKm + 0.5
        ? `dugi tada može da naraste do ${km(trial.longKm)}`
        : trial !== null && trial.peakKm >= peakKm + 0.5
          ? `nedelja tada stiže do ${km(trial.peakKm)}${shiftText}, a dugi ostaje ${km(longKm)} i nosi manji deo nedelje`
          : 'isti obim se tada deli na više kraćih trčanja, pa je svako lakše za oporavak';
    out.push({
      code: 'malo-dana',
      severity: 'upozorenje',
      problem: `Trčiš ${count(runDays, DAYS)} nedeljno, a za ovu distancu treba bar ${count(a.minRunDays, DAYS)}.`,
      /* R22 (B3): šta to znači za OVU trku — prognoza ne računa napredak (`raceDayNoProgress` u planu); rečenica
         može da dođe iz teksta distance (`texts['upozorenje.malo-dana.trka']`, zamene {days}, {time}) */
      meaning: `Sa toliko dana ceo obim staje u malo treninga, pa svaki trening nosi veliki deo nedelje, a svaki propušten dan je velika rupa. ${fillWarn(
        data.texts['upozorenje.malo-dana.trka'] ??
          'Za ovu trku: sa {days} nedeljno računaj na današnju formu ({time}), ne na napredak — prognoza ga zato ne računa.',
        { days: count(runDays, DAYS), time: fmtClock(doc.header.form.current.raceTimeSec) }
      )}`,
      proposal: extraOk
        ? `Dodaj ${String(runDays + 1)}. dan laganog trčanja ${dayText} — ${gain}.`
        : `Dan više dodaj tek kad trčiš bar 3 meseca bez tegobe — do tada drži ${count(runDays, DAYS)} nedeljno.`,
      suggest: { runDays: a.minRunDays }
    });
    if (extraOk) extraDayProposed = true;
  }
  /* S3 (krug 4): plan od 16+ nedelja koji ne stiže do dugog za distancu — posebno upozorenje, sa razlogom; prognoza
     tada ne računa napredak od obima (`buildState`). */
  const longSecMax = Math.max(0, ...costs.map((c) => c.longSec));
  const longKmMax = Math.max(0, ...costs.map((c) => c.longKm));
  const reaches = longReaches(data, weeks, longSecMax, ctx.paces.easy, longKmMax);
  if (!reaches) {
    const need = a.longCheckKm ?? a.minLongKm;
    const byTime = a.minLongSec === undefined ? '' : ` ili ${fmtMinutes(a.minLongSec)}`;
    const why =
      runDays < a.minRunDays
        ? `uz ${String(runDays)} dana trčanja nedeljno dugi ne sme da nosi veći deo nedelje`
        : `nedeljni obim od najviše ${km(peakKm)} ne nosi duži dugi`;
    out.push({
      code: 'dugi-za-distancu',
      severity: 'upozorenje',
      problem: `Plan traje ${count(weeks, WEEKS, 'acc')}, a najduži trening je ${km(longKm)} — za ovu distancu treba bar ${km(need)}${byTime}, jer ${why}.`,
      meaning: ranGoalDistance(state.today, state.runs, state.profile.recentResult, data.distanceM)
        ? 'Ovu dužinu si već istrčao, ali najduži trening plana je kraći, pa drugu polovinu trke ne vežbaš u treningu — trku počni oprezno.'
        : 'Druga polovina trke biće duža od svega što si trčao, pa prognoza ne računa napredak od obima, a trku treba početi oprezno.',
      proposal: `${
        longGain && trial !== null && !extraDayProposed
          ? `${extraDay} — dugi tada stiže do ${km(trial.longKm)}.`
          : `Podigni nedeljni obim laganim trčanjem (10–15 min više po danu) — kad nedelja pređe ${km(a.minPeakWeeklyKm)}, dugi stiže do ${km(need)}.`
      }${
        /* R20 B6: dugi ostaje daleko od potrebnog — predlog kraće distance */
        a.shorter !== undefined && longKm < SHORTER_DISTANCE_LONG_SHARE * need
          ? ` Ili na isti datum trči kraću distancu (${a.shorter.label}) — za nju je ovaj dugi dovoljan.`
          : ''
      }`,
      suggest: { longKm: need }
    });
  }
  if (reaches && longKm < NEAR_ENOUGH * a.minLongKm) {
    const fix = weeksThatFix(input, weeks, (p) => p.longKm >= NEAR_ENOUGH * a.minLongKm);
    const left = Math.max(1, Math.round(data.distanceM / 1000 - longKm));
    const now =
      longGain && trial !== null && !extraDayProposed
        ? `${extraDay} — dugi tada stiže do ${km(trial.longKm)}.`
        : `Uz isti datum trke dugi ostaje ${km(longKm)}, pa trku počni sporije i čuvaj snagu za poslednjih ${km(left)}.`;
    const next =
      fix !== null
        ? weeksProposed
          ? ''
          : ` Za sledeću trku planiraj ${prep(fix.total)} pripreme — nedelja tada stiže do ${PEAK_AT}, a dugi do ${LONG_AT}.`
        : noPrepSaid
          ? ` Dugi raste tek sa nedeljom od ${km(a.minPeakWeeklyKm)} — tada može do ${km(a.minLongKm)}.`
          : ` ${shortPrep ? 'I uz dužu pripremu dugi' : 'Duža priprema ovde ne pomaže: dugi'} ograničava nedeljni obim — za sledeću trku podigni nedelju do ${km(a.minPeakWeeklyKm)}, pa dugi može do ${km(a.minLongKm)}.`;
    /* R22 (B3): i obim i dugi ispod adekvatnog, bez kratke pripreme — predlog kraće distance (MAR p18) */
    const orShorter =
      a.shorter !== undefined && !shortPrep && peakKm < NEAR_ENOUGH * a.minPeakWeeklyKm
        ? ` Ili na isti datum trči kraću distancu (${a.shorter.label}) — za nju su ovaj obim i dugi dovoljni.`
        : '';
    out.push({
      code: 'kratak-dugi',
      severity: 'upozorenje',
      problem: `Najduži trening u planu je ${km(longKm)}, jer nedelja od najviše ${km(peakKm)} ne nosi duži dugi; za ovu distancu treba bar ${km(a.minLongKm)}.`,
      meaning:
        'Poslednji deo trke biće duži od svega što si trčao u pripremi, pa tu treba očekivati najveći pad.',
      proposal: `${now}${next}${orShorter}`,
      suggest: { longKm: a.minLongKm, ...(fix !== null ? { weeks: fix.total } : {}) }
    });
  }
  const { raceDay } = doc.header.form;
  if (goal.targetTimeSec !== undefined && goal.targetTimeSec < raceDay.lowSec) {
    const gap = Math.max(
      1,
      Math.round(((raceDay.expectedSec - goal.targetTimeSec) / data.distanceM) * 1000)
    );
    out.push({
      code: 'cilj-van-raspona',
      severity: 'upozorenje',
      problem: `Ciljno vreme ${fmtClock(goal.targetTimeSec)} je brže od onoga što tvoja forma i dužina pripreme sada pokazuju.`,
      meaning: `Realan raspon na dan trke je ${fmtClock(raceDay.lowSec)}–${fmtClock(raceDay.highSec)}; tempo za cilj verovatno ne bi mogao da se održi do kraja.`,
      proposal: `Kreni na ${fmtClock(raceDay.expectedSec)}, a cilj vrati ako test ili pripremna trka pokažu da si brži za oko ${String(gap)} s po kilometru.`
    });
  }
  const level = levelVolumeWarning(input, costs, peakKm, out);
  if (level !== null) out.push(level);
  /* O2: baza iz trčanja ispod polovine izjavljenog obima — plan to imenuje. */
  const declaredKm = state.profile.weeklyKm;
  /* R18 (stavka 9): sadašnji obim u km iz istorije (isti broj kao „Polazim od tvojih ≈ … km" u zaglavlju), ne
     opterećenje preračunato laganim tempom */
  const baseKm = d.baseKm ?? (d.baseLoad * 60) / ctx.paces.easy;
  if (
    declaredKm !== undefined &&
    !state.load.seeded &&
    baseKm < BASE_UNDER_DECLARED_SHARE * declaredKm
  ) {
    out.push({
      code: 'baza-ispod-izjave',
      severity: 'upozorenje',
      problem: `Naveo si ${km(declaredKm)} nedeljno, a trčanja iz poslednjih 6 nedelja daju oko ${km(baseKm)} nedeljno.`,
      meaning:
        'Plan polazi od onoga što si stvarno trčao, pa su prve nedelje manje nego što očekuješ — nagli povratak na stari obim je čest put do povrede.',
      proposal: `Ako je razlog pauza ili putovanje, upiši je; ako trčanja nisu stigla sa sata, poveži sat ili ih unesi — plan tada polazi od ${km(declaredKm)}.`
    });
  }
  /* krug 10 (stavka 18): najveća nedelja plana ispod sadašnjeg obima (bez bola i povratka) — uz rečenicu */
  {
    const peakPlanKm = Math.max(
      0,
      ...costs.filter((c) => c.week.intent.kind !== 'race').map((c) => c.km)
    );
    const returning =
      d.painCaution === true ||
      (doc.header.adjustments ?? []).some((x) => x.kind === 'pause' || x.kind === 'pain');
    if (!returning && baseKm > 0 && peakPlanKm < baseKm - PEAK_BELOW_BASE_KM) {
      out.push({
        code: 'vrh-ispod-obima',
        severity: 'upozorenje',
        problem: `Najveća nedelja plana je ${km(peakPlanKm)}, a sada trčiš oko ${km(baseKm)} nedeljno.`,
        meaning:
          'Dugi i lagani dani su ograničeni svojim udelom u nedelji, pa uz ovaj broj dana plan ne stiže do obima koji već trčiš — priprema je lakša nego tvoja sadašnja nedelja.',
        proposal: `Zadrži sadašnji obim: dodaj oko ${km(baseKm - peakPlanKm)} nedeljno laganim trčanjem (po 10–15 min uz lagane dane) ili dodaj dan laganog trčanja.`
      });
    }
  }
  /* S8d (krug 4): lagana trčanja brža od laganog tempa — podatak za personalizaciju, ne veći plan */
  if (state.easyTooFast === true) {
    out.push({
      code: 'lagano-prebrzo',
      severity: 'info',
      problem: `Tvoja obična trčanja iz poslednjih nedelja su u proseku brža od ${fmtPace(ctx.paces.easyFast)}, a to je brža granica laganog tempa.`,
      meaning:
        'Kad je svako trčanje srednje teško, telo se ne odmori za brze treninge i dugi, pa napredak staje, a rizik od povrede raste.',
      proposal: `Lagane dane trči sporije od ${fmtPace(ctx.paces.easyFast)} — tako da možeš da pričaš u celim rečenicama; brzinu čuvaj za zadate treninge.`
    });
  }
  /* S8e: tegoba u poslednjih 12 meseci — bez treninga visokog udara prve 4 nedelje */
  if (d.painCaution === true) {
    out.push({
      code: 'tegoba',
      severity: 'info',
      problem: 'U poslednjih 12 meseci si imao tegobu (bol pri trčanju).',
      meaning:
        'Prve 4 nedelje plan nema sprinteve uzbrdo ni druge treninge visokog udara, a obim raste sporije, da se isto mesto ne vrati.',
      proposal:
        'Ako se ista tegoba javi (bol 3/10 ili više, ili raste tokom trčanja), prekini trening, upiši bol u aplikaciju i javi se lekaru ili fizioterapeutu ako ne prođe za 7 dana.'
    });
  }
  /* S8e: staž kraći od praga — širi raspon prognoze */
  const tenureWeeks =
    state.profile.yearsRunning === undefined ? null : state.profile.yearsRunning * 52;
  if (a.minTenureWeeks !== undefined && tenureWeeks !== null && tenureWeeks < a.minTenureWeeks) {
    out.push({
      code: 'kratak-staz',
      severity: 'upozorenje',
      problem: `Trčiš tek oko ${count(Math.max(1, Math.round(tenureWeeks)), WEEKS, 'acc')}.`,
      meaning:
        'Telo se na trčanje navikava sporije nego što forma raste: tetive i kosti traže više vremena od srca i pluća. Prognoza je zato manje pouzdana, a raspon širi.',
      proposal: `Cilj neka bude da završiš trku; za vreme trke odluči posle provere forme iz plana.${
        weeks < a.minWeeks + 6
          ? ` Ako želiš rezultat, izaberi trku za bar ${prep(a.minWeeks + 6)}${a.shorter === undefined ? '' : ` ili kraću distancu (${a.shorter.label})`}.`
          : ''
      }`
    });
  }
  /* krug 9: isti najkraći lagan dan kao u `lagan-kratak` (rezervni, kad ga nivo ima) — upozorenja se ne protivreče */
  const lvl = doc.header.decisions;
  const dropMin = levelMinEasy(s, lvl.level, lvl.runDays.length)
    ? Math.max(s.minEasySec, (s.minEasyFallbackMin ?? 0) * 60)
    : minEasyOf(s, lvl.level, lvl.runDays.length);
  const streak = streakWarning(doc, s);
  if (streak !== null) out.push(streak);
  const dropped = droppedDayWarning(doc, costs, dropMin);
  const shortEasy = shortEasyWarning(doc, costs, s);
  if (dropped !== null) out.push(dropped);
  if (shortEasy !== null) out.push(shortEasy);
  const back = returnWarning(doc, state);
  if (back !== null) out.push(back);
  /* R20 (IV): upozorenje nivoa iz podatka distance (npr. početnik na hod-trku: cilj, očekivani raspon, šta sledeće) —
     `texts['upozorenje.nivo.<nivo>.problem|znacenje|predlog']`, zamene {low}, {high}, {expected} */
  const lvlWarn = levelWarning(data, d.level, doc.header.form.raceDay);
  if (lvlWarn !== null) out.push(lvlWarn);
  /* O4: tempa po osećaju (dok ne stigne prvi usvojen rezultat) ili obim bez ikakvog podatka. */
  if (doc.header.paces.byFeel || (state.load.seeded && state.profile.weeklyKm === undefined)) {
    out.push({
      code: 'nema-podataka',
      severity: 'info',
      /* T3 (krug 6): „ni trčanja sa sata" samo kad ih stvarno nema */
      problem:
        state.runs.length > 0
          ? `Nemam tvoj skorašnji rezultat; forma je procenjena iz ${String(state.runs.length)} trčanja sa sata, pa je manje pouzdana.`
          : 'Nemam tvoj skorašnji rezultat ni trčanja sa sata, pa su forma i obim procenjeni.',
      meaning:
        'Brzi treninzi su zadati po osećaju umesto po tempu, a prognoza vremena trke ima širok raspon.',
      proposal: `Unesi rezultat trke iz poslednja 3 meseca${testHint(doc, data, state.today)} — tempa i prognoza se tada računaju iz stvarnog rezultata.`
    });
  }
  const prepWeeks = Math.max(weeks + 1, ...prepWanted);
  const at =
    input.withWeeks !== undefined && prepWanted.length > 0 ? input.withWeeks(prepWeeks) : null;
  /* R22 (B3): dobitak duže pripreme iz probnog plana — nedelja (≥ 5 % i + 2 km) i dugi (+ 1,5 km) */
  const gains = [
    at !== null && at.peakKm >= Math.max(peakKm + 2, 1.05 * peakKm)
      ? `nedelja stiže do ${km(at.peakKm)}`
      : '',
    at !== null && at.longKm >= longKm + 1.5 ? `dugi do ${km(at.longKm)}` : ''
  ].filter((x) => x !== '');
  const prepGain = (t: string): string => {
    const i = t.indexOf(PREP_GAIN);
    if (i < 0) return t;
    const j = t.indexOf(PREP_GAIN_END);
    const head = t.slice(0, i);
    const rest = t.slice(j + PREP_GAIN_END.length);
    /* bez dobitka probnog plana: broj nedelja ostaje (AGENTS t. 6), bez obećanja brojeva */
    return `${head}Izaberi trku za koju imaš ${PREP} pripreme${gains.length === 0 ? '' : ` — tada ${gains.join(', a ')}`}${rest}`;
  };
  const fill = (t: string): string =>
    prepGain(t)
      .split(PREP)
      .join(count(prepWeeks, WEEKS, 'acc'))
      .split(PEAK_AT)
      .join(km(at?.peakKm ?? a.minPeakWeeklyKm))
      .split(LONG_AT)
      .join(km(at?.longKm ?? a.minLongKm));
  return rankProposals(
    out.map((w) => ({
      ...w,
      problem: fill(w.problem),
      meaning: fill(w.meaning),
      proposal: fill(w.proposal)
    }))
  );
}

/** R20 (IV): upozorenje nivoa iz podatka distance — `texts['upozorenje.nivo.<nivo>.problem|znacenje|predlog']`,
    zamene {low}, {high}, {expected} iz prognoze; `null` kad distanca za nivo nema tekst. */
export function levelWarning(
  data: DistanceData,
  level: string,
  rd: { lowSec: number; expectedSec: number; highSec: number }
): Warning | null {
  const key = `upozorenje.nivo.${level}`;
  const problem = data.texts[`${key}.problem`];
  if (problem === undefined) return null;
  const v = {
    low: fmtClock(rd.lowSec),
    high: fmtClock(rd.highSec),
    expected: fmtClock(rd.expectedSec)
  };
  return {
    code: 'nivo',
    severity: 'info',
    problem: fillWarn(problem, v),
    meaning: fillWarn(data.texts[`${key}.znacenje`] ?? '', v),
    proposal: fillWarn(data.texts[`${key}.predlog`] ?? '', v)
  };
}

/** R20 (IV): zamene {ključ} u tekstu upozorenja iz podatka distance. */
function fillWarn(text: string, values: Readonly<Record<string, string>>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m);
}

const SEVERITY_RANK: Readonly<Record<string, number>> = { ozbiljno: 0, upozorenje: 1, info: 2 };
/** R20 B6 (odluka organizatora): sve činjenice ostaju, a konkretni predlozi (upozorenja koja nisu „info") se
    rangiraju po težini i redu; prikazuju se najviše dva, ostali se spajaju u jednu rečenicu „Pomoglo bi i: …" uz
    drugi predlog. */
export function rankProposals(list: Warning[]): Warning[] {
  const ranked = list
    .map((w, i) => ({ w, i }))
    .filter(({ w }) => w.severity !== 'info' && w.proposal !== '')
    .sort(
      (a, b) => (SEVERITY_RANK[a.w.severity] ?? 3) - (SEVERITY_RANK[b.w.severity] ?? 3) || a.i - b.i
    );
  if (ranked.length <= MAX_PROPOSALS) return list;
  const keepAt = ranked[MAX_PROPOSALS - 1]?.i ?? -1;
  const extra = ranked.slice(MAX_PROPOSALS);
  const moved = new Set(extra.map((x) => x.i));
  const joined = extra
    .map(({ w }) => w.proposal.replace(/\.$/, ''))
    .map((t) => `${t.charAt(0).toLowerCase()}${t.slice(1)}`)
    .join('; ');
  return list.map((w, i) =>
    moved.has(i)
      ? { ...w, proposal: '' }
      : i === keepAt
        ? { ...w, proposal: `${w.proposal} Pomoglo bi i: ${joined}.` }
        : w
  );
}
const MAX_PROPOSALS = 2;


/** Deo predloga `nema-podataka` o testu: distanca se čita iz plana (prva provera forme koju plan sadrži), inače iz
    biblioteke distance (najkraći unos vrste `test`); bez toga se test ne pominje. */
/** R5 (krug 6): samo provera koja je još pred trkačem. */
function testHint(doc: PlanDoc, data: DistanceData, today: IsoDate): string {
  const effort = (steps: readonly Step[]): number | null => {
    for (const step of steps) {
      if ('repeat' in step) {
        const inner = effort(step.steps);
        if (inner !== null) return inner;
      } else if (step.target.type === 'allOut' && 'distanceM' in step.extent) {
        return step.extent.distanceM;
      }
    }
    return null;
  };
  for (const day of doc.weeks.flatMap((w) => w.days)) {
    const m = day.workout?.kind === 'test' && day.date > today ? effort(day.workout.steps) : null;
    if (m !== null) {
      return `, ili odradi proveru forme na ${fmtDistance(m)} koja je u planu ${fmtDate(day.date)}`;
    }
  }
  const lengths = data.library.flatMap((d) =>
    d.kind === 'test' && d.main.kind === 'all-out' ? [d.main.distanceM] : []
  );
  return lengths.length === 0 ? '' : ` ili istrči test na ${fmtDistance(Math.min(...lengths))}`;
}

const WEEKDAY_ACC = ['ponedeljak', 'utorak', 'sredu', 'četvrtak', 'petak', 'subotu', 'nedelju'];
const WEEKDAY_SHORT_NAMES = ['pon', 'uto', 'sre', 'čet', 'pet', 'sub', 'ned'];

/** Krug 15 (M4): raspored dana pravi niz duži od `maxConsecutiveWithHard` sa brzim treningom i dugim — taj brz trening
    se ne zadaje; plan kaže zašto i koji dan odmora rešava. */
function streakWarning(doc: PlanDoc, s: DistanceData['safety']): Warning | null {
  const rule = s.maxConsecutiveWithHard;
  const d = doc.header.decisions;
  if (rule === undefined || !rule.levels.includes(d.level) || d.runDays.length > 5) return null;
  const max = rule.days;
  const bad = d.qualityDays
    .slice(0, 2)
    .map((wd) => ({ wd, st: runStreak(d.qualityDays.slice(0, 2), wd, d.longDay) }))
    .filter((x) => x.st.hasLong && x.st.len > max && x.wd !== d.longDay);
  const first = bad[0];
  if (first === undefined) return null;
  /* samo kad plan stvarno ima takvu nedelju: dan je lagan, a nedelja nosi drugi brz trening */
  const happened = doc.weeks.some(
    (w) =>
      (w.intent.kind === 'build' || w.intent.kind === 'peak') &&
      w.intent.stimuli.length >= 2 &&
      w.days.some((x) => x.workout?.kind === 'quality') &&
      w.days.some((x) => x.workout?.kind === 'easy' && weekdayOf(x.date) === first.wd)
  );
  if (!happened) return null;
  /* dan odmora koji rešava: zamena jednog dana trčanja u nizu (ne dugog ni brzog) slobodnim danom van niza */
  const free = [0, 1, 2, 3, 4, 5, 6].filter((x) => !d.runDays.includes(x as Weekday));
  let fix: { off: number; on: number } | null = null;
  for (const off of d.runDays) {
    if (off === d.longDay || off === first.wd || fix !== null) continue;
    for (const on of free) {
      const days = [...d.runDays.filter((x) => x !== off), on as Weekday].sort((a, b) => a - b);
      const ok = d.qualityDays.slice(0, 2).every((q) => {
        if (!days.includes(q)) return false;
        const st = runStreak(
          d.qualityDays.slice(0, 2).filter((x) => days.includes(x)),
          q,
          d.longDay
        );
        return !st.hasLong || st.len <= max;
      });
      if (ok) {
        fix = { off, on };
        break;
      }
    }
  }
  const list = d.runDays.map((x) => WEEKDAY_SHORT_NAMES[x] ?? '').join(', ');
  const span = `${WEEKDAY_SHORT_NAMES[first.st.from] ?? ''}–${WEEKDAY_SHORT_NAMES[first.st.to] ?? ''}`;
  return {
    code: 'raspored-dana',
    severity: 'info',
    problem: `Tvoji dani trčanja (${list}) stavljaju brz trening u ${WEEKDAY_ACC[first.wd] ?? ''} odmah uz dugi (${span}), bez laganog dana između.`,
    meaning:
      'Posle dugog telo treba dan-dva bez brzog rada; brz trening na kraju takvog niza nosi umor dugog i podiže rizik od povrede, pa plan taj dan ostavlja laganim.',
    proposal:
      fix === null
        ? 'Trči kako piše; ako možeš da pomeriš jedan dan odmora usred niza, plan tada nosi oba brza treninga.'
        : `Ako možeš, trči u ${WEEKDAY_ACC[fix.on] ?? ''} umesto u ${WEEKDAY_ACC[fix.off] ?? ''} — tada nedelja nosi oba brza treninga bez dugog niza.`
  };
}

/** `obim-za-nivo` (krug 2, R11): trkač sa poznatom formom kome obim ograničava kvalitet — plan ne može da smesti
    brze treninge koje šablon njegovog nivoa traži, ili je vrh ispod obima koji podaci traže za nivo. */
function levelVolumeWarning(
  input: WarningInput,
  costs: readonly WeekCost[],
  peakKm: number,
  issued: readonly Warning[]
): Warning | null {
  const { data, decisions: d, doc } = input;
  const { header } = doc;
  if (header.paces.byFeel || issued.some((w) => w.code === 'mali-obim')) return null;
  const s = data.safety;
  const build = buildCtx(header, data);
  const dayCount = Math.max(0, d.runDays.length - 1);
  /* Nedelje gradnje van rampe: koliko brzih treninga namera traži, a koliko ih je plan smestio. */
  const eligible = costs.filter(
    (c) =>
      (c.week.intent.kind === 'build' || c.week.intent.kind === 'peak') &&
      c.week.intent.source === 'template' &&
      c.week.start >= header.startDate &&
      !inAnyWindow(c.week, header.adjustments ?? [])
  );
  const lost = eligible.filter((c) => {
    const wanted = c.week.intent.stimuli.slice(0, dayCount).filter((slot) => {
      const ref = {
        place: 'quality' as const,
        stimulus: slot.stimulus,
        index: 0,
        phase: c.week.intent.phase
      };
      const first = candidates(ref, null, build, { noHighImpact: false })[0];
      return first !== undefined && first.kind !== 'easy' && slot.onlyByFeel !== true;
    }).length;
    const placed = c.week.days.filter(
      (day) => day.workout?.kind === 'quality' || day.workout?.kind === 'test'
    ).length;
    return placed < wanted;
  });
  const byLevel = data.adequate.minPeakWeeklyKmByLevel?.[d.level];
  const squeezed =
    lost.length >= LEVEL_VOLUME_LOST_MIN_WEEKS &&
    lost.length >= LEVEL_VOLUME_LOST_SHARE * eligible.length;
  const belowLevel = byLevel !== undefined && peakKm < NEAR_ENOUGH * byLevel;
  if (!squeezed && !belowLevel) return null;
  /* krug 15 (M24): skorašnja tegoba — plan namerno štedi brz rad; savet „više obima za više brzog rada" ne važi
     (upozorenje `tegoba` kaže šta plan radi) */
  if (d.painCaution === true) return null;
  /* krug 15 (M24): stariji trkač — brzih treninga je manje zbog razmaka između njih (godine), ne zbog obima */
  if (d.qualityMinGapDays !== undefined && d.ageYears !== undefined) {
    return {
      code: 'obim-za-nivo',
      severity: 'info',
      problem: `Uz tvojih ${String(d.ageYears)} godina brzi treninzi u nedelji imaju bar ${count(d.qualityMinGapDays, DAYS)} razmaka, pa ${squeezed ? `u ${String(lost.length)} od ${String(eligible.length)} nedelja gradnje plan ima jedan brz trening manje nego što šablon traži` : 'plan ima manje brzog rada nego što šablon traži'}.`,
      meaning:
        'Oporavak posle brzog treninga sa godinama traje duže; dva brza treninga preblizu jedan drugom podižu rizik od povrede više nego što donose napretka.',
      proposal:
        'Drži zadate treninge i razmak između njih, a brzinu ne dodaj na svoju ruku. Napredak u ovoj pripremi nosi redovnost: svaki trening odrađen bez bola vredi više od još jednog brzog.'
    };
  }
  /* Bez broja za nivo: obim pri kom plafoni doza prestaju da zavise od obima (najveći `maxWorkSec / udeo`). */
  const used = new Set(doc.weeks.flatMap((w) => w.intent.stimuli.map((x) => x.stimulus)));
  let neededLoad = 0;
  for (const [tag, cap] of Object.entries(s.doseCaps)) {
    if (used.has(tag) && cap.shareOfPeakLoad > 0) {
      const most = maxWorkOf(cap.maxWorkSec, d.level);
      if (Number.isFinite(most)) neededLoad = Math.max(neededLoad, most / 60 / cap.shareOfPeakLoad);
    }
  }
  const neededKm = Math.ceil((neededLoad * 60) / header.paces.easy / 5) * 5;
  const target = Math.max(byLevel ?? neededKm, Math.ceil((peakKm * 1.15) / 5) * 5);
  const share = fmtNumber(s.maxFastShare * 100, 0);
  /* R19 (stavka 6): rezultat ciljne distance nije „rezultat na kraćoj trci" */
  const result = input.state.profile.recentResult;
  const shorterResult =
    result === undefined || result.distanceM < NEAR_ENOUGH * input.data.distanceM;
  const hint = shorterResult ? 'rezultat na kraćoj trci' : 'tvoj rezultat';
  const daysShort = eligible.some((c) => c.workouts < d.runDays.length);
  const binding = eligible.some((c) => {
    const most = c.week.intent.kind === 'peak' ? s.maxFastSharePeak : s.maxFastShare;
    return c.durationSec > 0 && c.fastSec / c.durationSec >= most - 0.01;
  });
  const problem = squeezed
    ? `Tvoja forma traži više brzog rada nego što obim od ${km(peakKm)} nedeljno može da nosi: u ${String(lost.length)} od ${String(eligible.length)} nedelja gradnje brzi trening je zamenjen laganim.`
    : `Najveća nedelja u planu ima ${km(peakKm)}, a za tvoj nivo forme treba bar ${km(target)} nedeljno da bi brzi treninzi imali punu dozu.`;
  return {
    code: 'obim-za-nivo',
    severity: 'upozorenje',
    problem,
    /* M8b (krug 5): granica brzog rada se pominje samo kad stvarno steže (neka nedelja gradnje je na njoj) */
    meaning: binding
      ? `Brz rad sme da bude najviše ${share} % vremena trčanja (u vršnoj nedelji ${fmtNumber(s.maxFastSharePeak * 100, 0)} %), pa uz mali obim doze ostaju ispod onoga što tvoja forma može da iskoristi — napredak će biti sporiji nego što ${hint} nagoveštava.`
      : `Uz mali obim doze brzih treninga ostaju ispod onoga što tvoja forma može da iskoristi — napredak će biti sporiji nego što ${hint} nagoveštava.`,
    /* T4 (krug 6): obim koji ova priprema ne može da dostigne je predlog za sledeću; dan se ne nudi kad plan ni
       tražene dane ne koristi sve */
    proposal: `${target > peakKm + 0.5 ? 'Za sledeću pripremu podigni' : 'Podigni'} nedeljni obim laganim trčanjem do oko ${km(target)} (${daysShort ? 'produži lagane dane za 10–15 min' : 'dodaj dan ili produži lagane dane za 10–15 min'}) — tada brzi treninzi dobijaju punu dozu. Do tada drži zadate doze i ne dodaj brzinu na svoju ruku.`,
    suggest: { peakWeeklyKm: target }
  };
}

/** Z8 (krug 7): traženi dani se poštuju — kad lagan dan padne ispod `minEasyMin` (do `minEasyFallbackMin`), plan to
    kaže brojevima iz plana: u kojim nedeljama i koliko je prva nedelja. */
function shortEasyWarning(
  doc: PlanDoc,
  costs: readonly WeekCost[],
  s: DistanceData['safety']
): Warning | null {
  const { header } = doc;
  const d = header.decisions;
  if (!levelMinEasy(s, d.level, d.runDays.length) || s.minEasyFallbackMin === undefined)
    return null;
  const want = minEasyOf(s, d.level, d.runDays.length);
  const ctx = paceCtxOf(header);
  const short = costs.filter(
    (c) =>
      (c.week.intent.kind === 'build' || c.week.intent.kind === 'peak') &&
      /* A18 (krug 9): nedelja u oporavku/rampi nije „kratak lagan dan zbog traženih dana" */
      !inAnyWindow(c.week, header.adjustments ?? []) &&
      c.week.days.some(
        (x) => x.workout?.kind === 'easy' && summarize(x.workout, ctx).durationSec < want - 90
      )
  );
  if (short.length === 0) return null;
  const first = short[0]?.week.index ?? 0;
  const last = short[short.length - 1]?.week.index ?? 0;
  const span =
    first === last ? `${String(first)}. nedelji` : `${String(first)}–${String(last)}. nedelji`;
  const baseKm = (d.baseLoad * 60) / header.paces.easy;
  /* A18: rečenica o obimu prati brojeve — prva takva nedelja prema sadašnjem obimu */
  const firstKm = short[0]?.km ?? 0;
  const versus =
    firstKm > baseKm + 0.5
      ? `nešto više od sadašnjeg obima (${km(baseKm)})`
      : firstKm < baseKm - 0.5
        ? `manje od sadašnjeg obima (${km(baseKm)}), uz kraće lagane dane`
        : 'koliko i sadašnji obim';
  return {
    code: 'lagan-kratak',
    severity: 'info',
    /* R22 (B3): razumljivo — koliko traju i zašto su kraći od uobičajenog */
    problem: `Tražio si ${count(d.runDays.length, DAYS)} trčanja nedeljno; uz sadašnji obim od oko ${km(baseKm)} lagani dani su u ${span} kratki — oko ${String(s.minEasyFallbackMin)} min, a za tvoj nivo lagan dan inače traje bar ${String(Math.round(want / 60))} min.`,
    /* krug 15 (M20): kad nedelja ustupi lagan dan drugom brzom treningu, ne piše se „svi traženi dani ostaju" */
    meaning: `${costs.some((c) => c.workouts < d.runDays.length && (c.week.intent.kind === 'build' || c.week.intent.kind === 'peak') && !inAnyWindow(c.week, header.adjustments ?? []) && !c.days.some((x) => x.day.workout?.kind === 'test') && c.days.filter((x) => x.day.workout?.kind === 'quality').length >= 2) ? 'U ostalim nedeljama traženi dani ostaju u planu' : 'Svi traženi dani ostaju u planu'}; zato je ${String(first)}. nedelja oko ${km(firstKm)}, ${versus}.`,
    proposal:
      'Trči kako piše; ako ti neki dan ne odgovara, zameni ga šetnjom ili ga izostavi — ostatak nedelje ostaje isti.'
  };
}

/** `dan-izostavljen` (krug 2, R4): traženi dan otpada tek kad bi nedelja i bez kvaliteta, sa najkraćim trčanjem
    svakog dana, prešla cilj za više od 10 % — i tada plan to kaže, sa razlogom. */
function droppedDayWarning(
  doc: PlanDoc,
  costs: readonly WeekCost[],
  minEasySec: number
): Warning | null {
  const { header } = doc;
  const asked = header.decisions.runDays.length;
  if (asked < EASY_FLOOR_MIN_RUN_DAYS) return null;
  /* R20 B6: sužavanje ima manje treninga po nameri — nije „izostavljen dan" */
  const full = costs.filter(
    (c) =>
      c.week.intent.kind !== 'race' &&
      c.week.intent.kind !== 'taper' &&
      c.week.start >= header.startDate &&
      !inAnyWindow(c.week, header.adjustments ?? [])
  );
  const short = full.filter((c) => c.workouts < asked);
  if (short.length === 0) return null;
  /* S11 (krug 4): nedelja sa proverom forme / pripremnom trkom ima manje treninga zbog trke — to je pravi razlog */
  const withTest = (c: WeekCost): boolean => c.days.some((x) => x.day.workout?.kind === 'test');
  if (short.every(withTest)) {
    /* R22 (B3): stavka o nedelji provere nije upozorenje — ispisuje se kao napomena te nedelje (`weeks`) */
    return {
      code: 'dan-izostavljen',
      severity: 'info',
      weeks: short.map((c) => c.week.index),
      problem: `Ove nedelje ${count(Math.min(...short.map((c) => c.workouts)), WORKOUTS)} umesto ${String(asked)}:`,
      meaning:
        'pre provere forme ili pripremne trke dan ostaje slobodan da je trčiš odmoran, a posle nje telo traži oporavak.',
      proposal: 'Posle ove nedelje plan opet koristi sve tražene dane.'
    };
  }
  /* krug 15 (M20): lagan dan izostavljen da stane drugi brzi trening (lagani dani su na najkraćem) — to je razlog */
  const hard = (c: WeekCost): number =>
    c.days.filter((x) => x.day.workout?.kind === 'quality').length;
  const forQuality = short.filter((c) => !withTest(c) && hard(c) >= 2);
  if (forQuality.length > 0 && short.every((c) => withTest(c) || hard(c) >= 2)) {
    const list = forQuality.map((c) => `${String(c.week.index)}.`).join(', ');
    return {
      code: 'dan-izostavljen',
      severity: 'info',
      problem: `Tražio si ${count(asked, DAYS)} trčanja nedeljno, a plan u ${list} nedelji ima ${count(Math.min(...forQuality.map((c) => c.workouts)), WORKOUTS)}.`,
      meaning:
        'Uz sadašnji obim lagani dani su već na najkraćem, pa jedan lagan dan te nedelje ustupa mesto drugom brzom treningu — za tvoju formu brzi trening vredi više od još jednog kratkog laganog trčanja.',
      proposal:
        'Te nedelje trči kako piše; ako ipak želiš da izađeš i tog dana, neka to bude šetnja ili 20 min vrlo laganog trčanja.'
    };
  }
  const least = Math.min(...short.map((c) => c.workouts));
  const lastShort = short[short.length - 1]?.week.index ?? 0;
  const firstShort = short[0]?.week.index ?? 0;
  const span =
    short.length === 1
      ? `${String(firstShort)}. nedelja`
      : lastShort - firstShort + 1 === short.length
        ? `${String(firstShort)}–${String(lastShort)}. nedelja`
        : `nedelje ${short.map((c) => String(c.week.index)).join(', ')}`;
  const later = full.find((c) => c.week.index > lastShort);
  const baseKm = (header.decisions.baseLoad * 60) / header.paces.easy;
  /* T4 (krug 6): bez kasnije pune nedelje plan ne obećava da će dodati dan */
  const then =
    later === undefined
      ? `ovaj plan ostaje na ${count(least, DAYS)} nedeljno`
      : `od ${String(later.week.index)}. nedelje plan koristi sve tražene dane`;
  return {
    code: 'dan-izostavljen',
    severity: 'info',
    problem: `Tražio si ${count(asked, DAYS)} trčanja nedeljno, a plan ${later === undefined && short.length >= full.length - 1 ? 'nedeljno' : `u nekim nedeljama (${span})`} ima ${count(least, WORKOUTS)}.`,
    meaning: `Uz sadašnji obim od oko ${km(baseKm)} nedeljno, svi traženi dani bi i sa najkraćim trčanjem od ${String(Math.round(minEasySec / 60))} min podigli nedelju za više od 10 % odjednom, a nagli skok obima je čest put do povrede.`,
    proposal: `${later === undefined ? 'Trči' : 'Te nedelje trči'} kako piše — ${then}. Ako želiš da izlaziš ${pluralForm(asked, ['svaki', 'sva', 'svih'])} ${count(asked, DAYS)} odmah, dodatni dan neka bude šetnja ili 30 min vrlo laganog trčanja.`
  };
}

/** `povratak`: plan počinje u rampi posle napora ili pauze (§ 6.5). Tekst prati plan: do kada su treninzi kraći
    i kog datuma je prvi brzi trening (krug 2, R9, R10). */
function returnWarning(doc: PlanDoc, state: RunnerState): Warning | null {
  const start = doc.header.startDate;
  let best: { end: IsoDate; problem: string } | null = null;
  for (const adj of doc.header.adjustments ?? []) {
    if (adj.kind === 'effort') {
      const end = addDays(adj.date, effortRampDays(adj.durationSec));
      if (end >= start && (best === null || end > best.end)) {
        const after = diffDays(start, adj.date);
        const run = state.runs.find((r) => r.date === adj.date && r.effort !== undefined);
        const what = run?.effort === 'test' ? 'testa' : 'trke';
        const result =
          run === undefined
            ? ''
            : ` (${fmtDistance(run.distanceM)} za ${fmtClock(run.durationSec)})`;
        best = {
          end,
          problem: `Plan počinje ${after === 1 ? 'dan' : count(after, DAYS)} posle ${what}${result}.`
        };
      }
    }
    if (adj.kind === 'pause') {
      const length = pauseLength(adj.from, adj.to);
      const end = addDays(adj.to, pauseRampDays(length, adj.reason));
      if (length >= 3 && end >= start && (best === null || end > best.end)) {
        best = { end, problem: `Plan počinje posle pauze od ${count(length, DAYS)}.` };
      }
    }
  }
  if (best === null) return null;
  const firstFast = doc.weeks
    .flatMap((w) => w.days)
    .find(
      (day) =>
        day.date > state.today &&
        day.workout !== null &&
        day.workout.kind !== 'race' &&
        day.workout.workSec > 0
    );
  const when =
    firstFast === undefined
      ? 'U ovom planu nema brzih treninga pre trke'
      : `Prvi brzi trening je ${fmtDate(firstFast.date)}`;
  const tired =
    firstFast === undefined
      ? 'ako si i posle oporavka umoran, skrati lagana trčanja na 30 min'
      : 'ako se tog dana i dalje osećaš umorno, zameni ga laganim trčanjem od 30 min';
  return {
    code: 'povratak',
    severity: 'info',
    problem: best.problem,
    /* R5 (krug 6): „oporavak do X" ⇒ prvi brzi trening posle X — kad brzi dolazi ranije, lagani deo oporavka traje
       do dana pred njega, a kraći treninzi do kraja rampe */
    meaning:
      firstFast !== undefined && firstFast.date <= best.end
        ? `Do ${fmtDate(addDays(firstFast.date, -1))} traje oporavak: treninzi su lagani, da se telo vrati pre nego što opterećenje krene da raste; do ${fmtDate(best.end)} su i kraći nego inače.`
        : `Do ${fmtDate(best.end)} traje oporavak: treninzi su kraći i lagani, da se telo vrati pre nego što opterećenje krene da raste.`,
    proposal: `${when}; ${tired}.`
  };
}
