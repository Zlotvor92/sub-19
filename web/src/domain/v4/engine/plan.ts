/* V4 — `plan` (SPEC § 6.1–6.2): čista funkcija (stanje, cilj, podaci distance) → plan. Redosled odluka:
   unos → šablon → odluke (vrh, plafoni, dugi, dani) → prolaz kroz nedelje → zaglavlje i upozorenja. */
import { FATIGUE_RATIO, FATIGUE_WEEK_SHARE } from './constants';
import { runPass } from './build';
import { addDays, mondayOf } from './dates';
import { decide } from './decide';
import { validate, warnings } from './guard';
import { raceWorkout } from './select';
import { lastLongBefore, recentLoad } from './state';
import { countWeeks, expandTemplate, pickLevel, pickTemplate } from './template';
import {
  type Adjustment,
  type Availability,
  type DistanceData,
  ENGINE_VERSION,
  type Goal,
  type IsoDate,
  PLAN_DOC_VERSION,
  type PlanDay,
  type PlanDoc,
  type PlanFn,
  type PlanWeek,
  type RunnerState,
  type WeekIntent
} from './types';
import { zonePaces } from './vdot';

/** Plan počinje sutra, osim ako je zadat kasniji početak (§ 6.1). */
export function startDateOf(state: RunnerState, goal: Goal): IsoDate {
  const tomorrow = addDays(state.today, 1);
  return goal.startDate !== undefined && goal.startDate > tomorrow ? goal.startDate : tomorrow;
}

/** Uzroci spremnosti poznati na dan plana (§ 6.2 k. 8): poslednji pun napor, pauze, bol, umor. */
export function initialAdjustments(state: RunnerState): Adjustment[] {
  const out: Adjustment[] = [];
  const effort = state.lastHardEffort;
  if (effort !== null) {
    out.push({
      kind: 'effort',
      source: 'plan',
      date: effort.date,
      durationSec: effort.durationSec,
      lastLongSec: lastLongBefore(state, effort.date)
    });
  }
  for (const pause of state.pauses) {
    out.push({
      kind: 'pause',
      source: 'plan',
      from: pause.from,
      to: pause.to,
      reason: pause.reason,
      lastLongSec: lastLongBefore(state, pause.from)
    });
  }
  for (const pain of state.pain) {
    if (pain.resolvedOn === undefined) {
      out.push({
        kind: 'pain',
        source: 'plan',
        date: pain.date,
        level: pain.level,
        lastLongSec: lastLongBefore(state, pain.date)
      });
    }
  }
  const { load } = state;
  const strained = !load.seeded && load.chronic > 0 && load.acute / load.chronic >= FATIGUE_RATIO;
  if (strained && recentLoad(state, 7) >= FATIGUE_WEEK_SHARE * 7 * load.chronic) {
    out.push({ kind: 'fatigue', source: 'plan', date: state.today });
  }
  return out;
}

/** Prazne nedelje od nedelje `startDate` do nedelje trke: svi dani odmor, dan trke upisan. */
export function skeleton(
  startDate: IsoDate,
  raceDate: IsoDate,
  intents: readonly WeekIntent[],
  data: DistanceData,
  firstIndex: number
): PlanWeek[] {
  const first = mondayOf(startDate);
  return intents.map((intent, i): PlanWeek => {
    const start = addDays(first, 7 * i);
    const index = firstIndex + i;
    const days: PlanDay[] = [];
    for (let wd = 0; wd < 7; wd += 1) {
      const date = addDays(start, wd);
      if (date < startDate) continue;
      days.push({
        id: `w${String(index)}d${String(wd)}`,
        date,
        origin: 'template',
        locked: false,
        workout: date === raceDate ? raceWorkout(data) : null
      });
    }
    return { index, start, intent, targetLoad: 0, longSec: 0, days };
  });
}

/** Plan od `startDate` bez provere unosa; koristi ga `plan` i ponovno planiranje ostatka (§ 6.4). */
export function createPlan(
  state: RunnerState,
  goal: Goal,
  data: DistanceData,
  startDate: IsoDate,
  availability: Availability = state.availability
): PlanDoc {
  const weeks = countWeeks(startDate, goal.raceDate);
  const baseLoad = Math.round(70 * state.load.chronic) / 10;
  const form = state.form.current;
  const level = pickLevel(data, {
    beginner: state.profile.beginner === true,
    vdot: form.vdot,
    baseLoad
  });
  const picked = pickTemplate(data, level, weeks, availability.runDays.length);
  if (picked === null) throw new Error('DistanceData bez šablona');
  const decisions = decide({
    data,
    template: picked.template,
    level,
    baseLoad,
    longestRecentSec: state.longestRecentSec,
    runDays: availability.runDays,
    longDay: availability.longDay
  });
  const draft: PlanDoc = {
    schema: 'plan-doc',
    version: PLAN_DOC_VERSION,
    engineVersion: ENGINE_VERSION,
    header: {
      goal,
      startDate,
      policyId: data.id,
      policyVersion: data.version,
      form: {
        start: form,
        current: form,
        paceVdot: form.vdot,
        pacesUpdatedOn: state.today,
        raceDay: state.form.raceDay
      },
      paces: zonePaces(form.vdot, data.distanceM, form.confidence === 'niska'),
      decisions,
      warnings: [],
      protected: false,
      appliedEvents: [],
      eventsFrom: state.today,
      adjustments: initialAdjustments(state)
    },
    weeks: skeleton(startDate, goal.raceDate, expandTemplate(picked.template, weeks), data, 1)
  };
  const built = runPass(draft, state, data, { window: null, rechainFrom: 1, fresh: true });
  return {
    ...built,
    header: { ...built.header, warnings: warnings({ state, goal, data, decisions, doc: built }) }
  };
}

export const plan: PlanFn = (state, goal, data) => {
  const errors = validate(state, goal, data);
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, doc: createPlan(state, goal, data, startDateOf(state, goal)) };
};
