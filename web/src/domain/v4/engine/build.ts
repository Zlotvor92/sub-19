/* V4 — JEDAN PROLAZ KROZ NEDELJE (SPEC § 6.2 k. 5–8, § 6.4). `plan` i `replan` zovu isti prolaz:
   cilj nedelje → dugi → budžet brzog rada → lagani dani → spremnost. Svaka veličina ima jednu funkciju-vlasnika;
   nema petlje „skrati pa dopuni". Dan se uvek gradi iz namere nedelje + `header.decisions` (§ 1.3). */
import { RACE_EVE_MAX_SEC } from './constants';
import { addDays, weekdayOf } from './dates';
import { assignDays } from './decide';
import { doneIds } from './done';
import { paceCtxOf, stepsCost, summarize } from './load';
import { applyReadiness, modsFor, PLAIN_LONG, recipeKey, type Seen } from './readiness';
import {
  addonSteps,
  allOutSec,
  type BuildCtx,
  extraWeight,
  mainZone,
  minDoseOf,
  pickDef,
  type Place,
  realize,
  type Recipe,
  REST,
  type SlotRef,
  slotDose,
  steadyLongDef
} from './select';
import { canonical } from './fingerprint';
import type {
  Adjustment,
  DayId,
  DistanceData,
  IsoDate,
  LoadPoints,
  PlanDay,
  PlanDoc,
  PlanHeader,
  PlanWeek,
  RunnerState,
  Seconds,
  StimulusTag,
  WeekIntent,
  Weekday,
  Workout
} from './types';

/* ------------------------------------------------------------------ zaštita (§ 1.2) */

export function doneDayIds(state: RunnerState): Set<DayId> {
  return doneIds(state.runs);
}

/** JEDINA provera zaštite: budući, nije ručni, nije zaključan, nije urađen, nije dan trke, plan nije zaštićen. */
export function isMutable(
  day: PlanDay,
  header: PlanHeader,
  today: IsoDate,
  done: ReadonlySet<DayId>
): boolean {
  if (header.protected || day.date <= today || day.origin === 'manual' || day.locked) return false;
  if (done.has(day.id)) return false;
  return !(day.workout?.kind === 'race' && day.date === header.goal.raceDate);
}

export function buildCtx(header: PlanHeader, data: DistanceData): BuildCtx {
  return {
    data,
    decisions: header.decisions,
    pace: paceCtxOf(header),
    template: data.templates.find((t) => t.id === header.decisions.templateId) ?? null
  };
}

/* ------------------------------------------------------------------ vlasnici veličina nedelje */

interface Span {
  startDate: IsoDate;
  raceDate: IsoDate;
}

const inRaceWeek = (weekStart: IsoDate, span: Span): boolean =>
  span.raceDate >= weekStart && span.raceDate <= addDays(weekStart, 6);

/** Dani trčanja nedelje koji postoje u planu: od početka plana i pre dana trke. */
function usableRunDays(weekStart: IsoDate, span: Span, ctx: BuildCtx): Weekday[] {
  const race = inRaceWeek(weekStart, span);
  return ctx.decisions.runDays.filter((wd) => {
    const date = addDays(weekStart, wd);
    return date >= span.startDate && (!race || date < span.raceDate);
  });
}

/** Udeo nedelje koji plan pokriva (nepotpuna prva nedelja, nedelja trke usred nedelje). */
function weekFraction(weekStart: IsoDate, span: Span, ctx: BuildCtx): number {
  const raceWd = inRaceWeek(weekStart, span) ? weekdayOf(span.raceDate) : null;
  const expected = ctx.decisions.runDays.filter((wd) => wd !== raceWd).length;
  if (expected === 0) return 1;
  return Math.min(1, usableRunDays(weekStart, span, ctx).length / expected);
}

/** CILJ NEDELJE (§ 6.2 k. 5): `loadPct × P`; `build`/`peak` najviše pravilo rasta nad `m` (najveća od prethodne 3). */
export function weekTarget(
  intent: WeekIntent,
  m: LoadPoints,
  fraction: number,
  ctx: BuildCtx
): LoadPoints {
  const s = ctx.data.safety;
  let target = intent.loadPct * ctx.decisions.peakLoad;
  if (intent.kind === 'build' || intent.kind === 'peak') {
    target = Math.min(target, Math.max(m * (1 + s.maxWeeklyRampPct), m + s.minRampLoad));
  }
  return Math.round(target * fraction);
}

/** DUGI (§ 6.2 k. 6): `min(lenPct × najduži, najduži od prethodne 3 (ili polazni) + korak)`, na ceo minut. */
export function longPlan(intent: WeekIntent, previousLongest: Seconds, ctx: BuildCtx): Seconds {
  if (intent.long === null) return 0;
  const d = ctx.decisions;
  const grown = Math.max(previousLongest, d.longStartSec) + ctx.data.safety.longStepSec;
  return Math.round(Math.min(intent.long.lenPct * d.longMaxSec, grown) / 60) * 60;
}

/** BUDŽET BRZOG RADA (§ 6.2 k. 6): redom dugi pa podražaji; `take` vraća dozu koja staje i knjiži je. */
function fastBudget(
  targetLoad: LoadPoints,
  share: number
): {
  take: (wanted: Seconds, extra: number) => Seconds;
  book: (sec: Seconds, extra: number) => void;
} {
  let workMin = 0;
  let extraLoad = 0;
  const book = (sec: Seconds, extra: number): void => {
    workMin += sec / 60;
    extraLoad += (extra * sec) / 60;
  };
  return {
    book,
    take: (wanted, extra) => {
      const room = (share * (targetLoad - extraLoad) - workMin) / (1 + share * extra);
      return Math.max(0, Math.min(wanted, room * 60));
    }
  };
}

interface EasyDay {
  date: IsoDate;
  addon: Recipe | null;
  cap: Seconds;
}

/** LAGANI DANI (§ 6.2 k. 7): ostatak cilja jednako na lagane dane, uz plafon po danu; višak se ne preraspodeljuje. */
function easyFill(
  pool: EasyDay[],
  leftMin: LoadPoints,
  dayBeforeLong: IsoDate | null,
  ctx: BuildCtx
): Map<IsoDate, Recipe> {
  const out = new Map<IsoDate, Recipe>();
  const minEasy = ctx.data.safety.minEasySec;
  const addonCost = (day: EasyDay): { load: number; durationSec: number } =>
    day.addon !== null && day.addon.type === 'addon'
      ? stepsCost(addonSteps(day.addon.def), ctx.pace)
      : { load: 0, durationSec: 0 };
  const addonLoad = (day: EasyDay): number => addonCost(day).load;
  let days = [...pool].sort((a, b) => (a.date < b.date ? -1 : 1));
  const budget = (list: EasyDay[]): number =>
    (leftMin - list.reduce((sum, day) => sum + addonLoad(day), 0)) * 60;
  if (days.length > 0 && budget(days) / days.length < minEasy) {
    const keep = Math.max(0, Math.min(days.length, Math.floor(budget(days) / minEasy)));
    const dropOrder = [
      ...days.filter((d) => d.date === dayBeforeLong),
      ...days.filter((d) => d.date !== dayBeforeLong)
    ];
    const dropped = new Set(dropOrder.slice(0, days.length - keep).map((d) => d.date));
    days = days.filter((d) => !dropped.has(d.date));
  }
  const per = days.length > 0 ? budget(days) / days.length : 0;
  for (const day of days) {
    /* Plafon važi za ceo dan: lagani deo + dodatak. */
    const sec = Math.min(per, day.cap - addonCost(day).durationSec);
    if (sec < minEasy) {
      out.set(day.date, { type: 'easy', sec: Math.min(per, day.cap) });
      continue;
    }
    out.set(
      day.date,
      day.addon !== null && day.addon.type === 'addon'
        ? { ...day.addon, sec }
        : { type: 'easy', sec }
    );
  }
  return out;
}

export interface WeekShell {
  index: number;
  start: IsoDate;
  intent: WeekIntent;
  targetLoad: LoadPoints;
  longSec: Seconds;
}

/** RASPORED NEDELJE: recept za svaki dan iz namere + odluka. Čista funkcija sačuvanih veličina — zato je
    ponovno građenje dana idempotentno. `slotIndex` je redni broj pojavljivanja podražaja (§ 4.4). */
export function layoutWeek(
  week: WeekShell,
  span: Span,
  ctx: BuildCtx,
  slotIndex: (place: Place, stimulus: StimulusTag) => number
): Map<IsoDate, Recipe> {
  const { decisions: d, data } = ctx;
  const s = data.safety;
  const { intent } = week;
  const dateOf = (wd: number): IsoDate => addDays(week.start, wd);
  const out = new Map<IsoDate, Recipe>();
  for (let wd = 0; wd < 7; wd += 1) out.set(dateOf(wd), REST);

  const race = inRaceWeek(week.start, span);
  const eve = race ? addDays(span.raceDate, -1) : null;
  const runDays = usableRunDays(week.start, span, ctx);
  const longWd =
    intent.long !== null &&
    week.longSec > 0 &&
    runDays.includes(d.longDay) &&
    dateOf(d.longDay) !== eve
      ? d.longDay
      : null;
  const raceOrder = (): Weekday[] => {
    const raceWd = weekdayOf(span.raceDate);
    const all = [...new Set<Weekday>([...d.runDays, raceWd])].sort((a, b) => a - b);
    return assignDays(all, raceWd).filter(
      (wd) => runDays.includes(wd) && wd !== longWd && dateOf(wd) !== eve
    );
  };
  const qualityDays = race ? raceOrder() : d.qualityDays;

  const budget = fastBudget(
    week.targetLoad,
    intent.kind === 'peak' ? s.maxFastSharePeak : s.maxFastShare
  );
  const fixed = new Map<IsoDate, Recipe>();
  const addons = new Map<IsoDate, Recipe>();

  if (longWd !== null && intent.long !== null) {
    const slot: SlotRef = {
      place: 'long',
      stimulus: intent.long.stimulus,
      index: slotIndex('long', intent.long.stimulus),
      phase: intent.phase
    };
    const wanted = slotDose(slot, intent.long.dosePct, intent.kind, ctx);
    let def = pickDef(slot, wanted > 0 ? wanted : null, ctx, { noHighImpact: false });
    let dose = 0;
    const zone = def === null ? null : mainZone(def.main);
    if (
      def !== null &&
      zone !== null &&
      (def.main.kind === 'finish-block' || def.main.kind === 'progressive')
    ) {
      const extra = extraWeight(zone, ctx);
      dose = budget.take(wanted, extra);
      if (dose < minDoseOf(def, ctx)) {
        def = steadyLongDef(ctx, null);
        dose = 0;
      } else {
        budget.book(dose, extra);
      }
    }
    fixed.set(dateOf(longWd), { type: 'long', sec: week.longSec, def, dose, slot });
  }

  intent.stimuli.forEach((st, k) => {
    const wd = qualityDays[k];
    if (wd === undefined || !runDays.includes(wd) || wd === longWd || dateOf(wd) === eve) return;
    const slot: SlotRef = {
      place: 'quality',
      stimulus: st.stimulus,
      index: slotIndex('quality', st.stimulus),
      phase: intent.phase,
      ...(st.workoutId === undefined ? {} : { workoutId: st.workoutId })
    };
    const wanted = slotDose(slot, st.dosePct, intent.kind, ctx);
    const def = pickDef(slot, wanted > 0 ? wanted : null, ctx, { noHighImpact: false });
    if (def === null) return;
    const date = dateOf(wd);
    if (def.main.kind === 'add-on') {
      addons.set(date, { type: 'addon', sec: 0, def });
      return;
    }
    if (def.main.kind === 'all-out') {
      const recipe: Recipe = { type: 'test', def, slot };
      const cost = summarize(realize(recipe, ctx), ctx.pace);
      const sec = allOutSec(def.main.distanceM, ctx);
      budget.book(
        sec,
        cost.workSec > 0 ? Math.max(0, (cost.load - cost.durationSec / 60) / (sec / 60)) : 0
      );
      fixed.set(date, recipe);
      return;
    }
    const zone = mainZone(def.main);
    if (zone === null) return;
    const extra = extraWeight(zone, ctx);
    const dose = budget.take(wanted, extra);
    if (dose < minDoseOf(def, ctx)) return;
    budget.book(dose, extra);
    fixed.set(date, { type: 'quality', def, dose, slot });
  });

  let fixedLoad = 0;
  for (const [date, recipe] of fixed) {
    out.set(date, recipe);
    fixedLoad += summarize(realize(recipe, ctx), ctx.pace).load;
  }
  const longDate = longWd === null ? null : dateOf(longWd);
  const dayBeforeLong = longDate === null ? eve : addDays(longDate, -1);
  const pool: EasyDay[] = runDays
    .map((wd) => dateOf(wd))
    .filter((date) => !fixed.has(date))
    .map((date) => {
      let cap = Number.POSITIVE_INFINITY;
      if (week.longSec > 0 && longDate !== null) {
        cap =
          week.longSec * (date === dayBeforeLong ? s.dayBeforeLongMaxShare : s.easyMaxShareOfLong);
      }
      if (date === eve) cap = Math.min(cap, RACE_EVE_MAX_SEC);
      return { date, addon: date === eve ? null : (addons.get(date) ?? null), cap };
    });
  for (const [date, recipe] of easyFill(pool, week.targetLoad - fixedLoad, dayBeforeLong, ctx)) {
    out.set(date, recipe);
  }
  return out;
}

/* ------------------------------------------------------------------ prolaz */

export interface PassOptions {
  /** Dani van prozora se ne grade iznova; `null` = svi budući. */
  window: { from: IsoDate; to: IsoDate } | null;
  /** Od ove nedelje (indeks) cilj i dugi se odlučuju ponovo, iz stvarne i planirane istorije; `null` = sačuvano. */
  rechainFrom: number | null;
  /** Nov plan: nijedan dan nije urađen (stari `dayId` iz ranijeg plana se ne računa). */
  fresh?: boolean;
}

/** Redni broj pojavljivanja podražaja pre nedelje `index`: broj ranijih nedelja (≠ rasterećenje) koje ga nose. */
function slotCounter(weeks: readonly PlanWeek[], index: number) {
  return (place: Place, stimulus: StimulusTag): number => {
    let n = 0;
    for (const week of weeks) {
      if (week.index >= index || week.intent.kind === 'recovery') continue;
      const carries =
        place === 'long'
          ? week.intent.long?.stimulus === stimulus
          : week.intent.stimuli.some((s) => s.stimulus === stimulus);
      if (carries) n += 1;
    }
    return n;
  };
}

function applyRepeat(recipe: Recipe, dayId: DayId, adjustments: readonly Adjustment[]): Recipe {
  for (const adj of adjustments) {
    if (adj.kind !== 'repeat' || adj.dayId !== dayId) continue;
    if (recipe.type === 'quality' && adj.workSec !== undefined) {
      return { ...recipe, dose: Math.min(recipe.dose, adj.workSec) };
    }
    if (recipe.type === 'long' && adj.lengthSec !== undefined) {
      return { ...recipe, sec: Math.min(recipe.sec, adj.lengthSec) };
    }
  }
  return recipe;
}

const sameWorkout = (a: Workout | null, b: Workout | null): boolean =>
  canonical(a) === canonical(b);

function seenKey(workout: Workout | null): string | null {
  if (workout === null || workout.stimulus === null) return null;
  if (workout.kind === 'quality' || workout.kind === 'test') return `quality:${workout.stimulus}`;
  if (workout.kind === 'long' && workout.workSec > 0) return `long:${workout.stimulus}`;
  return null;
}

/** Stvarno (prošlo) + planirano (buduće) opterećenje i najduže trčanje nedelje — ulaz pravila rasta. */
function weekTotals(
  week: PlanWeek,
  header: PlanHeader,
  state: RunnerState,
  ctx: BuildCtx
): { load: LoadPoints; longSec: Seconds } {
  const end = addDays(week.start, 6);
  const actual = state.weeks.find((w) => w.start === week.start);
  let load = 0;
  let longSec = 0;
  for (const day of week.days) {
    const past = day.date <= state.today;
    if (past && (actual !== undefined || end > state.today)) continue;
    if (day.workout === null || (day.workout.kind === 'race' && day.date === header.goal.raceDate))
      continue;
    const cost = summarize(day.workout, ctx.pace);
    load += cost.load;
    if (day.workout.kind === 'long') longSec = Math.max(longSec, cost.durationSec);
  }
  if (week.start <= state.today && actual !== undefined) {
    load += actual.load;
    longSec = Math.max(longSec, actual.longestSec);
  }
  return { load, longSec };
}

/** Prolaz kroz sve nedelje dokumenta. Menja samo dane koje `isMutable` dozvoljava i koji su u prozoru. */
export function runPass(
  doc: PlanDoc,
  state: RunnerState,
  data: DistanceData,
  opts: PassOptions
): PlanDoc {
  const { header } = doc;
  const ctx = buildCtx(header, data);
  const span: Span = { startDate: header.startDate, raceDate: header.goal.raceDate };
  const done = opts.fresh === true ? new Set<DayId>() : doneDayIds(state);
  const adjustments = header.adjustments ?? [];
  const explicitEfforts = new Set(
    adjustments.flatMap((a) => (a.kind === 'effort' ? [a.date] : []))
  );
  const causes: Adjustment[] = [...adjustments];
  const seen: Seen[] = [];
  const loads: LoadPoints[] = [];
  const longs: Seconds[] = [];
  const lastThree = <T>(list: readonly T[]): T[] => list.slice(Math.max(0, list.length - 3));

  const weeks = doc.weeks.map((week): PlanWeek => {
    let shell: WeekShell = week;
    if (opts.rechainFrom !== null && week.index >= opts.rechainFrom) {
      const recent = lastThree(loads);
      const m = Math.max(...recent, ...(recent.length < 3 ? [header.decisions.baseLoad] : []));
      shell = {
        ...week,
        targetLoad: weekTarget(week.intent, m, weekFraction(week.start, span, ctx), ctx),
        longSec: longPlan(week.intent, Math.max(0, ...lastThree(longs)), ctx)
      };
    }
    const recipes = layoutWeek(shell, span, ctx, slotCounter(doc.weeks, week.index));
    const days = week.days.map((day): PlanDay => {
      let final = day;
      const inWindow =
        opts.window === null || (day.date >= opts.window.from && day.date <= opts.window.to);
      if (inWindow && isMutable(day, header, state.today, done)) {
        const recipe = applyRepeat(recipes.get(day.date) ?? REST, day.id, adjustments);
        const mods = modsFor(day.date, causes, seen, recipeKey(recipe));
        const workout = realize(applyReadiness(recipe, mods, ctx), ctx);
        if (!sameWorkout(workout, day.workout)) {
          final = {
            id: day.id,
            date: day.date,
            ...(day.movedFrom === undefined ? {} : { movedFrom: day.movedFrom }),
            origin: 'template',
            locked: false,
            workout,
            ...(day.extras === undefined ? {} : { extras: day.extras })
          };
        }
      }
      const key = seenKey(final.workout);
      if (key !== null) seen.push({ date: final.date, key });
      /* Dugi bez bloka: za prošle dane se računa samo ako je odrađen (§ 14.6). */
      if (
        final.workout?.kind === 'long' &&
        final.workout.workSec === 0 &&
        (final.date > state.today || done.has(final.id))
      ) {
        seen.push({
          date: final.date,
          key: PLAIN_LONG,
          sec: summarize(final.workout, ctx.pace).durationSec
        });
      }
      if (final.workout?.kind === 'test' && !explicitEfforts.has(final.date)) {
        causes.push({
          kind: 'effort',
          source: 'plan',
          date: final.date,
          durationSec: final.workout.workSec
        });
      }
      return final;
    });
    const built: PlanWeek = {
      index: week.index,
      start: week.start,
      intent: week.intent,
      targetLoad: shell.targetLoad,
      longSec: shell.longSec,
      days
    };
    const totals = weekTotals(built, header, state, ctx);
    loads.push(totals.load);
    longs.push(totals.longSec);
    return built;
  });
  return { ...doc, weeks };
}
