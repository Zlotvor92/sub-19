/* V4 — ČUVAR (SPEC § 8): odbija samo neispravan unos; sve ostalo prijavljuje (nalazi) ili upozorava (tri rečenice
   sa predlogom u brojevima). Ništa ne menja — ni generisan ni lični plan. */
import {
  BASE_UNDER_DECLARED_SHARE,
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
  GUARD_FAST_SHARE_TOLERANCE,
  GUARD_JUMP_TOLERANCE,
  GUARD_LONG_STEP_TOLERANCE_SEC,
  GUARD_MIN_WEEK_SHARE,
  GUARD_MIN_WEEK_WORKOUTS,
  GUARD_MIN_WORKOUT_SEC,
  GUARD_TAPER_WORK_SHARE,
  GUARD_UNDER_TARGET
} from './constants';
import { buildCtx, plannedEffort } from './build';
import { addDays, diffDays, isValidDate, mondayOf } from './dates';
import { longReaches, longStepOf, maxWorkOf, minEasyOf, minRampOf } from './decide';
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
  underRamp
} from './readiness';
import { byDistance, candidates } from './select';
import { countWeeks } from './template';
import type {
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
  Workout
} from './types';

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

function inAnyWindow(week: PlanWeek, adjustments: readonly Adjustment[]): boolean {
  const end = addDays(week.start, 6);
  return adjustments.some((adj) => {
    const w = adjustmentWindow(adj);
    return w !== null && w.from <= end && w.rampEnd >= week.start;
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
  /* Vršna nedelja pod rampom (skraćen brz rad) nije merilo za sužavanje. */
  const peakWork = Math.max(
    0,
    ...costs
      .filter((c) => c.week.intent.kind === 'peak' && !inAnyWindow(c.week, causes))
      .map((c) => c.fastSec)
  );

  /* M7 (krug 5): silazak obima po KALENDARSKOJ nedelji (km prema vršnoj nedelji, broj brzih treninga) */
  const peakKm = Math.max(0, ...costs.filter((c) => c.week.intent.kind === 'peak').map((c) => c.km));
  const raceMonday = mondayOf(header.goal.raceDate);

  costs.forEach((c, i) => {
    const { week } = c;
    const taper = s.taper;
    if (taper !== undefined && peakKm > 0 && week.start >= header.startDate) {
      if (week.start === addDays(raceMonday, -14)) {
        const fastDays = week.days.filter((d) => fastWorkSec(d.workout) > 0).length;
        if (taper.calendarMinus2MaxQuality !== undefined && fastDays > taper.calendarMinus2MaxQuality) {
          report('silazak', week, null, 'Dve nedelje pred nedeljom trke ima više brzih treninga od dozvoljenog.');
        }
        if (taper.weekMinus2MaxOfPeak !== undefined && c.km > taper.weekMinus2MaxOfPeak * peakKm + GUARD_TAPER_KM_SLACK) {
          report('silazak', week, null, 'Obim dve nedelje pred nedeljom trke nije spušten prema vršnoj nedelji.');
        }
      }
      if (
        week.start === raceMonday &&
        taper.raceWeekMaxOfPeak !== undefined &&
        c.km > taper.raceWeekMaxOfPeak * peakKm + GUARD_TAPER_KM_SLACK
      ) {
        report('silazak', week, null, 'Obim nedelje trke (bez trke) nije spušten prema vršnoj nedelji.');
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
    if (!raceWeek && share > maxShare + GUARD_FAST_SHARE_TOLERANCE) {
      report('brz-udeo', week, null, 'Udeo brzog rada u nedelji je iznad dozvoljenog.');
    }
    const rule = Math.max(m * (1 + s.maxWeeklyRampPct), m + minRampOf(s, ctx.paces.easy));
    if (
      (week.intent.kind === 'build' || week.intent.kind === 'peak') &&
      volOf(c) > rule * (1 + GUARD_JUMP_TOLERANCE)
    ) {
      report('skok', week, null, 'Obim nedelje raste brže od pravila rasta.');
    }
    if (c.longSec > d.longMaxSec + GUARD_LONG_STEP_TOLERANCE_SEC) {
      report('dugi-plafon', week, null, 'Dugi je duži od najdužeg dozvoljenog u planu.');
    }
    if (c.longSec > longBefore + longStepOf(s, ctx.paces.easy) + GUARD_LONG_STEP_TOLERANCE_SEC + roundingSlack) {
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
      const few = c.workouts < Math.min(GUARD_MIN_WEEK_WORKOUTS, d.runDays.length);
      if (c.load < GUARD_MIN_WEEK_SHARE * d.baseLoad || few) {
        report(
          'min-nedelja',
          week,
          null,
          'Nedelja je ispod minimalnog smislenog obima ili broja treninga.'
        );
      }
    }
    if (
      week.intent.kind === 'taper' &&
      peakWork > 0 &&
      c.fastSec > GUARD_TAPER_WORK_SHARE * peakWork + GUARD_DOSE_TOLERANCE_SEC
    ) {
      report(
        'taper',
        week,
        null,
        'Brz rad u nedelji sužavanja je veći od 60 % rada vršne nedelje.'
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
  if (!longReaches(data, planWeeks, longest, ctx.paces.easy)) {
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
  withExtraDay?: () => { peakKm: number; longKm: number } | null;
}

/** Razlika do adekvatnog ispod 5 % se ne prijavljuje (38,6 naspram 40 km nije upozorenje). */
const NEAR_ENOUGH = 0.95;

const km = (value: number): string => `${fmtNumber(value)} km`;

/** Upozorenja: problem → značenje → predlog sa brojem (AGENTS t. 6). Brojevi iz `data.adequate` i plana. */
export function warnings(input: WarningInput): Warning[] {
  const { state, goal, data, decisions: d, doc } = input;
  const a = data.adequate;
  const s = data.safety;
  const ctx = paceCtxOf(doc.header);
  const costs = doc.weeks.map((w) => weekCost(w, goal.raceDate, ctx));
  const weeks = countWeeks(doc.header.startDate, goal.raceDate);
  const peakKm = Math.max(0, ...costs.map((c) => c.km));
  const longKm = Math.max(0, ...costs.map((c) => c.longKm));
  const out: Warning[] = [];
  const shorter =
    a.shorter === undefined ? '' : `, ili na isti datum trči kraću distancu: ${a.shorter.label}`;

  if (weeks < a.minWeeks) {
    out.push({
      code: 'kratka-priprema',
      severity: weeks < a.minWeeks / 2 ? 'ozbiljno' : 'upozorenje',
      problem: `Do trke ${pluralForm(weeks, ['je', 'su', 'je'])} ${count(weeks, WEEKS)}, a adekvatna priprema za ovu distancu traje bar ${count(a.minWeeks, WEEKS)}.`,
      meaning:
        'Plan nema vremena da postepeno podigne obim i dugi trening, pa će završni deo trke biti teži od svega što stigneš da odradiš u pripremi.',
      proposal: `Izaberi trku za koju imaš ${count(a.minWeeks, WEEKS, 'acc')} pripreme — tada plan stiže do dugog od ${km(a.minLongKm)}${shorter}.`,
      suggest: {
        weeks: a.minWeeks,
        ...(a.shorter === undefined ? {} : { distanceId: a.shorter.distanceId })
      }
    });
  }
  const runDays = d.runDays.length;
  const trial = input.withExtraDay?.() ?? null;
  const extraDay = `Uz isti datum trke dodaj ${String(runDays + 1)}. dan laganog trčanja od 30–40 min`;
  if (peakKm < NEAR_ENOUGH * a.minPeakWeeklyKm) {
    const extra =
      peakKm > 0
        ? Math.max(
            1,
            Math.ceil(
              ((Math.log(a.minPeakWeeklyKm / peakKm) / Math.log(1 + s.maxWeeklyRampPct)) * 4) / 3
            )
          )
        : a.minWeeks;
    /* Predlog nudi samo brojeve VEĆE od onoga što plan već ima (R11). */
    const longer = trial !== null && trial.longKm >= longKm + 0.5;
    const now =
      trial !== null && trial.peakKm >= peakKm + 0.5
        ? `${extraDay} — vrh tada ide do ${km(trial.peakKm)} nedeljno${longer ? `, a dugi do ${km(trial.longKm)}` : ''}.`
        : `Uz isti datum trke obim ne može bezbedno iznad ${km(peakKm)} nedeljno, pa trku počni sporije nego što forma na kraćim deonicama nudi.`;
    out.push({
      code: 'mali-obim',
      severity: 'upozorenje',
      problem: `Najveća nedelja u planu ima ${km(peakKm)}, a adekvatna priprema za ovu distancu traži bar ${km(a.minPeakWeeklyKm)} nedeljno.`,
      meaning:
        'Sa manjim obimom izdržljivost u drugoj polovini trke je slabija, pa tempo pada ranije nego što forma na kraćim deonicama pokazuje.',
      proposal: `${now} Za sledeću trku planiraj ${count(weeks + extra, WEEKS, 'acc')} pripreme — obim tada bezbedno stiže do ${km(a.minPeakWeeklyKm)} nedeljno.`,
      suggest: { peakWeeklyKm: a.minPeakWeeklyKm, weeks: weeks + extra }
    });
  }
  if (runDays < a.minRunDays) {
    /* Šta još jedan dan stvarno donosi — iz probnog plana, nikad broj manji od planiranog (R11). */
    const gain =
      trial !== null && trial.longKm >= longKm + 0.5
        ? `dugi tada može da naraste do ${km(trial.longKm)}`
        : trial !== null && trial.peakKm >= peakKm + 0.5
          ? `nedelja tada stiže do ${km(trial.peakKm)}, a dugi ostaje ${km(longKm)} i nosi manji deo nedelje`
          : 'isti obim se tada deli na više kraćih trčanja, pa je svako lakše za oporavak';
    out.push({
      code: 'malo-dana',
      severity: 'upozorenje',
      problem: `Trčiš ${count(runDays, DAYS)} nedeljno, a za ovu distancu treba bar ${count(a.minRunDays, DAYS)}.`,
      meaning:
        'Sa toliko dana ceo obim staje u malo treninga, pa svaki trening nosi veliki deo nedelje, a svaki propušten dan je velika rupa.',
      proposal: `Dodaj ${String(runDays + 1)}. dan laganog trčanja od 30–40 min — ${gain}.`,
      suggest: { runDays: a.minRunDays }
    });
  }
  /* S3 (krug 4): plan od 16+ nedelja koji ne stiže do dugog za distancu — posebno upozorenje, sa razlogom; prognoza
     tada ne računa napredak od obima (`buildState`). */
  const longSecMax = Math.max(0, ...costs.map((c) => c.longSec));
  const reaches = longReaches(data, weeks, longSecMax, ctx.paces.easy);
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
      meaning:
        'Druga polovina trke biće duža od svega što si trčao, pa prognoza ne računa napredak od obima, a trku treba početi oprezno.',
      proposal:
        trial !== null && trial.longKm >= longKm + 0.5
          ? `${extraDay} — dugi tada stiže do ${km(trial.longKm)}.`
          : `Podigni nedeljni obim laganim trčanjem (10–15 min više po danu) — kad nedelja pređe ${km(a.minPeakWeeklyKm)}, dugi stiže do ${km(need)}.`,
      suggest: { longKm: need }
    });
  }
  if (reaches && longKm < NEAR_ENOUGH * a.minLongKm) {
    const capKm = d.longMaxSec / ctx.paces.easy;
    const stepKm = Math.max(0.5, Math.round((longStepOf(s, ctx.paces.easy) / ctx.paces.easy) * 2) / 2);
    const moreWeeks = Math.max(1, Math.ceil((a.minLongKm - longKm) / stepKm));
    const byTime = capKm >= a.minLongKm;
    const left = Math.max(1, Math.round(data.distanceM / 1000 - longKm));
    const now =
      trial !== null && trial.longKm >= longKm + 0.5
        ? `${extraDay} — dugi tada stiže do ${km(trial.longKm)}.`
        : `Uz isti datum trke dugi ostaje ${km(longKm)}, pa trku počni sporije i čuvaj snagu za poslednjih ${km(left)}.`;
    const next = byTime
      ? `Za sledeću trku planiraj ${count(weeks + moreWeeks, WEEKS, 'acc')} pripreme — dugi tada stiže do ${km(a.minLongKm)}.`
      : `Za sledeću trku podigni nedeljni obim do ${km(a.minPeakWeeklyKm)} — dugi tada može da naraste do ${km(a.minLongKm)}.`;
    out.push({
      code: 'kratak-dugi',
      severity: 'upozorenje',
      problem: `Najduži trening u planu je ${km(longKm)}, a za ovu distancu treba bar ${km(a.minLongKm)}.`,
      meaning:
        'Poslednji deo trke biće duži od svega što si trčao u pripremi, pa tu treba očekivati najveći pad.',
      proposal: `${now} ${next}`,
      suggest: { longKm: a.minLongKm, ...(byTime ? { weeks: weeks + moreWeeks } : {}) }
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
  const baseKm = (d.baseLoad * 60) / ctx.paces.easy;
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
  const tenureWeeks = state.profile.yearsRunning === undefined ? null : state.profile.yearsRunning * 52;
  if (a.minTenureWeeks !== undefined && tenureWeeks !== null && tenureWeeks < a.minTenureWeeks) {
    out.push({
      code: 'kratak-staz',
      severity: 'upozorenje',
      problem: `Trčiš tek oko ${count(Math.max(1, Math.round(tenureWeeks)), WEEKS, 'acc')}.`,
      meaning:
        'Telo se na trčanje navikava sporije nego što forma raste: tetive i kosti traže više vremena od srca i pluća. Prognoza je zato manje pouzdana, a raspon širi.',
      proposal: `Cilj neka bude da završiš trku; za vreme trke odluči posle provere forme iz plana. Ako želiš rezultat, izaberi trku za bar ${count(a.minWeeks + 6, WEEKS, 'acc')}${a.shorter === undefined ? '' : ` ili kraću distancu (${a.shorter.label})`}.`
    });
  }
  const dropped = droppedDayWarning(doc, costs, minEasyOf(s, doc.header.decisions.level, doc.header.decisions.runDays.length));
  if (dropped !== null) out.push(dropped);
  const back = returnWarning(doc, state);
  if (back !== null) out.push(back);
  /* O4: tempa po osećaju (dok ne stigne prvi usvojen rezultat) ili obim bez ikakvog podatka. */
  if (doc.header.paces.byFeel || (state.load.seeded && state.profile.weeklyKm === undefined)) {
    out.push({
      code: 'nema-podataka',
      severity: 'info',
      problem: 'Nemam tvoj skorašnji rezultat ni trčanja sa sata, pa su forma i obim procenjeni.',
      meaning:
        'Brzi treninzi su zadati po osećaju umesto po tempu, a prognoza vremena trke ima širok raspon.',
      proposal: `Unesi rezultat trke iz poslednja 3 meseca${testHint(doc, data)} — tempa i prognoza se tada računaju iz stvarnog rezultata.`
    });
  }
  return out;
}

/** Deo predloga `nema-podataka` o testu: distanca se čita iz plana (prva provera forme koju plan sadrži), inače iz
    biblioteke distance (najkraći unos vrste `test`); bez toga se test ne pominje. */
function testHint(doc: PlanDoc, data: DistanceData): string {
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
    const m = day.workout?.kind === 'test' ? effort(day.workout.steps) : null;
    if (m !== null) {
      return `, ili odradi proveru forme na ${fmtDistance(m)} koja je u planu ${fmtDate(day.date)}`;
    }
  }
  const lengths = data.library.flatMap((d) =>
    d.kind === 'test' && d.main.kind === 'all-out' ? [d.main.distanceM] : []
  );
  return lengths.length === 0 ? '' : ` ili istrči test na ${fmtDistance(Math.min(...lengths))}`;
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
  const problem = squeezed
    ? `Tvoja forma traži više brzog rada nego što obim od ${km(peakKm)} nedeljno može da nosi: u ${String(lost.length)} od ${String(eligible.length)} nedelja gradnje brzi trening je zamenjen laganim.`
    : `Najveća nedelja u planu ima ${km(peakKm)}, a za tvoj nivo forme treba bar ${km(target)} nedeljno da bi brzi treninzi imali punu dozu.`;
  return {
    code: 'obim-za-nivo',
    severity: 'upozorenje',
    problem,
    meaning: `Brz rad sme da bude najviše ${share} % vremena trčanja, pa uz mali obim doze ostaju ispod onoga što tvoja forma može da iskoristi — napredak će biti sporiji nego što rezultat na kraćoj trci nagoveštava.`,
    proposal: `Podigni nedeljni obim laganim trčanjem do oko ${km(target)} (dodaj dan ili produži lagane dane za 10–15 min) — tada brzi treninzi dobijaju punu dozu. Do tada drži zadate doze i ne dodaj brzinu na svoju ruku.`,
    suggest: { peakWeeklyKm: target }
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
  const full = costs.filter(
    (c) =>
      c.week.intent.kind !== 'race' &&
      c.week.start >= header.startDate &&
      !inAnyWindow(c.week, header.adjustments ?? [])
  );
  const short = full.filter((c) => c.workouts < asked);
  if (short.length === 0) return null;
  /* S11 (krug 4): nedelja sa proverom forme / pripremnom trkom ima manje treninga zbog trke — to je pravi razlog */
  const withTest = (c: WeekCost): boolean => c.days.some((x) => x.day.workout?.kind === 'test');
  if (short.every(withTest)) {
    const list = short.map((c) => `${String(c.week.index)}.`).join(', ');
    return {
      code: 'dan-izostavljen',
      severity: 'info',
      problem: `Tražio si ${count(asked, DAYS)} trčanja nedeljno, a u nedelji provere forme (${list} nedelja) plan ima ${count(Math.min(...short.map((c) => c.workouts)), WORKOUTS)}.`,
      meaning:
        'Pre provere forme ili pripremne trke dan ostaje slobodan da trku trčiš odmoran, a posle nje telo traži oporavak.',
      proposal: 'Te nedelje trči kako piše; posle nje plan opet koristi sve tražene dane.'
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
  const then =
    later === undefined
      ? 'kad obim poraste, novi plan koristi sve tražene dane'
      : `od ${String(later.week.index)}. nedelje plan koristi sve tražene dane`;
  return {
    code: 'dan-izostavljen',
    severity: 'info',
    problem: `Tražio si ${count(asked, DAYS)} trčanja nedeljno, a plan u nekim nedeljama ima ${count(least, WORKOUTS)} (${span}).`,
    meaning: `Uz sadašnji obim od oko ${km(baseKm)} nedeljno, svi traženi dani bi i sa najkraćim trčanjem od ${String(Math.round(minEasySec / 60))} min podigli nedelju za više od 10 % odjednom, a nagli skok obima je čest put do povrede.`,
    proposal: `Te nedelje trči kako piše — ${then}. Ako želiš da izlaziš ${pluralForm(asked, ['svaki', 'sva', 'svih'])} ${count(asked, DAYS)} odmah, dodatni dan neka bude šetnja ili 15–20 min vrlo laganog trčanja.`
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
    meaning: `Do ${fmtDate(best.end)} traje oporavak: treninzi su kraći i lagani, da se telo vrati pre nego što opterećenje krene da raste.`,
    proposal: `${when}; ${tired}.`
  };
}
