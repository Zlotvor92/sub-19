/* V4 — ČUVAR (SPEC § 8): odbija samo neispravan unos; sve ostalo prijavljuje (nalazi) ili upozorava (tri rečenice
   sa predlogom u brojevima). Ništa ne menja — ni generisan ni lični plan. */
import {
  EASY_DISTANCE_STEP_M,
  EASY_DURATION_STEP_SEC,
  GUARD_DOSE_TOLERANCE_SEC,
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
import { addDays, diffDays, isValidDate } from './dates';
import { decideLongMax } from './decide';
import { count, DAYS, FIRST, countWith, fmtClock, fmtDate, fmtNumber, WEEKS } from './format';
import { type PaceCtx, paceCtxOf, summarize, type WorkoutSummary } from './load';
import {
  adjustmentWindow,
  effortRampDays,
  pauseLength,
  pauseRampDays,
  underRamp
} from './readiness';
import { candidates } from './select';
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
  Warning
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
  km: number;
  longSec: number;
  longKm: number;
  workouts: number;
}

export function weekCost(week: PlanWeek, raceDate: IsoDate, ctx: PaceCtx): WeekCost {
  const out: WeekCost = {
    week,
    days: [],
    load: 0,
    durationSec: 0,
    workSec: 0,
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
      .map((c) => c.workSec)
  );

  costs.forEach((c, i) => {
    const { week } = c;
    const ramp = inAnyWindow(week, causes);
    const partial = week.start < header.startDate;
    const raceWeek = week.intent.kind === 'race';
    const before = costs
      .slice(0, i)
      .filter((x) => !underRamp(x.week.start, adjustments))
      .slice(-3);
    const m = Math.max(...before.map((x) => x.load), ...(before.length < 3 ? [d.baseLoad] : []));
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
        report('doza-plafon', week, day, `Rad treninga je iznad plafona podražaja (${day.date}).`);
      }
      if (
        w.kind !== 'race' &&
        (w.steps.length === 0 || w.text.trim() === '' || cost.durationSec < GUARD_MIN_WORKOUT_SEC)
      ) {
        report(
          'prazan',
          week,
          day,
          `Trening je prazan, bez teksta ili kraći od 15 min (${day.date}).`
        );
      }
      /* Poredi se dužina: dugi sa blokom je brži, pa kraće traje za iste kilometre. */
      /* U nedelji rampe dugi je namerno ograničen (≤ 75 % poslednjeg), pa se ne poredi sa laganim danom. */
      if (!ramp && w.kind === 'easy' && c.longKm > 0 && cost.km > c.longKm) {
        report('lagan-dugi', week, day, `Lagan dan je duži od dugog iste nedelje (${day.date}).`);
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
          `Dva teška treninga u uzastopnim danima (${day.date}).`
        );
      }
      previous = day;
    }

    const share = c.durationSec > 0 ? c.workSec / c.durationSec : 0;
    const maxShare = week.intent.kind === 'peak' ? s.maxFastSharePeak : s.maxFastShare;
    /* Nedelja trke se ne meri: mala je, a sama trka ne ulazi u zbir. */
    if (!raceWeek && share > maxShare + GUARD_FAST_SHARE_TOLERANCE) {
      report('brz-udeo', week, null, 'Udeo brzog rada u nedelji je iznad dozvoljenog.');
    }
    const rule = Math.max(m * (1 + s.maxWeeklyRampPct), m + s.minRampLoad);
    if (
      (week.intent.kind === 'build' || week.intent.kind === 'peak') &&
      c.load > rule * (1 + GUARD_JUMP_TOLERANCE)
    ) {
      report('skok', week, null, 'Opterećenje nedelje raste brže od pravila rasta.');
    }
    if (c.longSec > d.longMaxSec + GUARD_LONG_STEP_TOLERANCE_SEC) {
      report('dugi-plafon', week, null, 'Dugi je duži od najdužeg dozvoljenog u planu.');
    }
    if (c.longSec > longBefore + s.longStepSec + GUARD_LONG_STEP_TOLERANCE_SEC + roundingSlack) {
      report('dugi-korak', week, null, 'Dugi raste za više od jednog koraka.');
    }
    if (!ramp && !partial && !raceWeek && c.load < GUARD_UNDER_TARGET * week.targetLoad) {
      report('ispod-cilja', week, null, 'Planirano opterećenje je ispod 90 % cilja nedelje.');
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
      c.workSec > GUARD_TAPER_WORK_SHARE * peakWork
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
      problem: `Do trke je ${count(weeks, WEEKS)}, a adekvatna priprema za ovu distancu traje bar ${count(a.minWeeks, WEEKS)}.`,
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
    const now =
      trial !== null && trial.peakKm >= peakKm + 0.5
        ? `${extraDay} — vrh tada ide do ${km(trial.peakKm)} nedeljno, a dugi do ${km(trial.longKm)}.`
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
  const longWithDays =
    Math.round((decideLongMax(d.peakLoad, s, d.level, a.minRunDays) / ctx.paces.easy) * 2) / 2;
  if (runDays < a.minRunDays) {
    out.push({
      code: 'malo-dana',
      severity: 'upozorenje',
      problem: `Trčiš ${count(runDays, DAYS)} nedeljno, a za ovu distancu treba bar ${count(a.minRunDays, DAYS)}.`,
      meaning:
        'Sa toliko dana ceo obim staje u malo treninga, pa je dugi trening kraći nego što trka traži, a svaki propušten dan je veliki deo nedelje.',
      proposal: `Dodaj ${String(runDays + 1)}. dan laganog trčanja od 30–40 min — uz ${count(a.minRunDays, DAYS)} trčanja nedeljno dugi može da naraste do ${km(longWithDays)}.`,
      suggest: { runDays: a.minRunDays }
    });
  }
  if (longKm < NEAR_ENOUGH * a.minLongKm) {
    const capKm = d.longMaxSec / ctx.paces.easy;
    const stepKm = Math.max(0.5, Math.round((s.longStepSec / ctx.paces.easy) * 2) / 2);
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
  const back = returnWarning(doc, state);
  if (back !== null) out.push(back);
  if (
    state.form.current.confidence === 'niska' ||
    (state.load.seeded && state.profile.weeklyKm === undefined)
  ) {
    out.push({
      code: 'nema-podataka',
      severity: 'info',
      problem: 'Nemam tvoj skorašnji rezultat ni trčanja sa sata, pa su forma i obim procenjeni.',
      meaning:
        'Brzi treninzi su zadati po osećaju umesto po tempu, a prognoza vremena trke ima širok raspon.',
      proposal:
        'Unesi rezultat trke iz poslednja 3 meseca ili istrči test od 3 km — tempa i prognoza se tada računaju iz stvarnog rezultata.'
    });
  }
  return out;
}

/** `povratak`: plan počinje u rampi posle napora ili pauze (§ 6.5). */
function returnWarning(doc: PlanDoc, state: RunnerState): Warning | null {
  const start = doc.header.startDate;
  let best: { days: number; end: IsoDate; problem: string } | null = null;
  for (const adj of doc.header.adjustments ?? []) {
    if (adj.kind === 'effort') {
      const days = effortRampDays(adj.durationSec);
      const end = addDays(adj.date, days);
      if (end >= start && (best === null || end > best.end)) {
        const after = diffDays(start, adj.date);
        best = {
          days,
          end,
          problem: `Plan počinje ${after === 1 ? 'dan' : count(after, DAYS)} posle trke ili testa od ${String(Math.round(adj.durationSec / 60))} min.`
        };
      }
    }
    if (adj.kind === 'pause') {
      const length = pauseLength(adj.from, adj.to);
      const days = pauseRampDays(length, adj.reason);
      const end = addDays(adj.to, days);
      if (length >= 3 && end >= start && (best === null || end > best.end)) {
        best = { days, end, problem: `Plan počinje posle pauze od ${count(length, DAYS)}.` };
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
  return {
    code: 'povratak',
    severity: 'info',
    problem: best.problem,
    meaning: `${capitalize(countWith(best.days, FIRST, DAYS))} je oporavak: treninzi su kraći i lagani, bez brzih deonica, da se telo vrati pre nego što opterećenje krene da raste.`,
    proposal: `${when}; ako se tog dana i dalje osećaš umorno, zameni ga laganim trčanjem od 30 min.`
  };
}

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
