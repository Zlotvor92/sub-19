/* V4 — `plan` (SPEC § 6.1–6.2): čista funkcija (stanje, cilj, podaci distance) → plan. Redosled odluka:
   unos → šablon → odluke (vrh, plafoni, dugi, dani) → prolaz kroz nedelje → zaglavlje i upozorenja. */
import { FATIGUE_RATIO, FATIGUE_WEEK_SHARE } from './constants';
import { runPass } from './build';
import { addDays, mondayOf } from './dates';
import { decide, ladderInputOf, longStepOf } from './decide';
import { validate, warnings, weekCost } from './guard';
import { paceCtxOf } from './load';
import { raceWorkout } from './select';
import { baseLoadOf, lastLongAfterEffort, lastLongBefore, recentLoad } from './state';
import { countWeeks, expandTemplate, pickLevel, pickTemplate } from './template';
import {
  type Adjustment,
  type Availability,
  type Decisions,
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
  type Weekday,
  type WeekIntent
} from './types';
import { zonePaces } from './vdot';

/** S8e (krug 4): staž kraći od `adequate.minTenureWeeks` širi raspon prognoze (× 1,5 oko očekivanog). */
const TENURE_RANGE_FACTOR = 1.5;
function widened(state: RunnerState, data: DistanceData): RunnerState['form']['raceDay'] {
  const r = state.form.raceDay;
  const years = state.profile.yearsRunning;
  const min = data.adequate.minTenureWeeks;
  if (years === undefined || min === undefined || years * 52 >= min) return r;
  return {
    lowSec: Math.round(r.expectedSec - (r.expectedSec - r.lowSec) * TENURE_RANGE_FACTOR),
    expectedSec: r.expectedSec,
    highSec: Math.round(r.expectedSec + (r.highSec - r.expectedSec) * TENURE_RANGE_FACTOR)
  };
}

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
      lastLongSec: lastLongAfterEffort(state, effort.date, effort.durationSec)
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
  firstIndex: number,
  vdot: number
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
        workout: date === raceDate ? raceWorkout(data, vdot) : null
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
  availability: Availability = state.availability,
  /** Probni plan za upozorenja: bez sopstvenih upozorenja (da se probni poziv ne ponavlja). */
  trial = false
): PlanDoc {
  const weeks = countWeeks(startDate, goal.raceDate);
  const baseLoad = baseLoadOf(state);
  const form = state.form.current;
  const level = pickLevel(data, {
    beginner: state.profile.beginner === true,
    vdot: form.vdot,
    baseLoad,
    recentQualityWeeks: state.recentQualityWeeks,
    weeksSincePause: state.weeksSincePause
  });
  const picked = pickTemplate(data, level, weeks, availability.runDays.length);
  if (picked === null) throw new Error('DistanceData bez šablona');
  const decided = decide({
      data,
      template: picked.template,
      level,
      baseLoad,
      longestRecentSec: state.longestRecentSec,
      runDays: availability.runDays,
      longDay: availability.longDay,
      easyPaceSecPerKm: zonePaces(form.vdot, data.distanceM, false).easy,
      ladder: ladderInputOf({
        baseLoad,
        easyPaceSecPerKm: zonePaces(form.vdot, data.distanceM, false).easy,
        weeks,
        yearsRunning: state.profile.yearsRunning,
        painInYear: (state.painHistory ?? []).length > 0,
        safety: data.safety
      })
    });
  const easyPace = zonePaces(form.vdot, data.distanceM, false).easy;
  const fromRuns = !state.load.seeded && state.longestRecentSec > 0;
  const decisions: Decisions = {
    ...decided,
    ...(fromRuns
      ? {
          longStartSec: Math.min(
            decided.longStartSec,
            Math.round((state.longestRecentSec + longStepOf(data.safety, easyPace)) / 60) * 60
          )
        }
      : {}),
    /* S8a/b (krug 4): istorija je merodavna → lanac rasta kreće od stvarnih minuta, polazni dugi ≤ najduže stvarno
       trčanje u 28 dana + korak (ne udeo nedelje u bodovima). */
    ...(state.historyWeeklyMin === undefined || state.historyWeeklyKm === undefined
      ? {}
      : {
          baseVolumeMin: Math.min(baseLoad, state.historyWeeklyMin),
          baseKm: state.historyWeeklyKm
        }),
    ...((state.painHistory ?? []).length > 0 ? { painCaution: true } : {}),
    /* Personalizacija: činjenice iz istorije se pamte u planu, da ponovno građenje bira iste unose. */
    ...(state.recentQualityWeeks === null || state.recentQualityWeeks === undefined
      ? {}
      : { recentQualityWeeks: state.recentQualityWeeks }),
    ...(state.weeksSincePause === null || state.weeksSincePause === undefined
      ? {}
      : { weeksSincePause: state.weeksSincePause })
  };
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
        raceDay: widened(state, data)
      },
      paces: zonePaces(form.vdot, data.distanceM, form.confidence === 'niska'),
      decisions,
      warnings: [],
      protected: false,
      appliedEvents: [],
      eventsFrom: state.today,
      /* Kad nema istorije dugih, „poslednji dugi" za plafon u rampi je polazni dugi plana. */
      adjustments: initialAdjustments(state).map((a) =>
        (a.kind === 'effort' || a.kind === 'pause' || a.kind === 'pain') &&
        (a.lastLongSec === undefined || a.lastLongSec === 0)
          ? { ...a, lastLongSec: decisions.longStartSec }
          : a
      )
    },
    weeks: skeleton(
      startDate,
      goal.raceDate,
      expandTemplate(picked.template, weeks, data.library),
      data,
      1,
      form.vdot
    )
  };
  const built = runPass(draft, state, data, { window: null, rechainFrom: 1, fresh: true });
  if (trial) return built;
  /* Šta bi dao još jedan dan trčanja uz isti datum trke — brojevi za predlog u upozorenju. */
  const withExtraDay = (): { peakKm: number; longKm: number } | null => {
    const extra = extraRunDay(availability.runDays);
    if (extra === null) return null;
    const more: Availability = {
      runDays: [...availability.runDays, extra].sort((x, y) => x - y),
      longDay: availability.longDay
    };
    const probe = createPlan(state, goal, data, startDate, more, true);
    const ctx = paceCtxOf(probe.header);
    const costs = probe.weeks.map((w) => weekCost(w, goal.raceDate, ctx));
    return {
      peakKm: Math.max(0, ...costs.map((c) => c.km)),
      longKm: Math.max(0, ...costs.map((c) => c.longKm))
    };
  };
  return {
    ...built,
    header: {
      ...built.header,
      warnings: warnings({ state, goal, data, decisions, doc: built, withExtraDay })
    }
  };
}

/** Slobodan dan koji je najdalje od postojećih dana trčanja (izjednačeno: raniji); `null` kad su svi zauzeti. */
function extraRunDay(runDays: readonly Weekday[]): Weekday | null {
  const all: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
  const free = all.filter((d) => !runDays.includes(d));
  const gap = (a: number, b: number): number => Math.min(Math.abs(a - b), 7 - Math.abs(a - b));
  let best: Weekday | null = null;
  let bestScore = -1;
  for (const day of free) {
    const score = Math.min(7, ...runDays.map((r) => gap(day, r)));
    if (score > bestScore) {
      best = day;
      bestScore = score;
    }
  }
  return best;
}

export const plan: PlanFn = (state, goal, data) => {
  /* O5: i ono što je `buildState` morao da preskoči (neispravan datum pauze, bola, trčanja) je neispravan unos. */
  const seen = new Set<string>();
  const errors = [...(state.inputErrors ?? []), ...validate(state, goal, data)].filter((e) => {
    const key = `${e.code}:${e.field}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, doc: createPlan(state, goal, data, startDateOf(state, goal)) };
};
