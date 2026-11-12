/* V4 — JEDAN PROLAZ KROZ NEDELJE (SPEC § 6.2 k. 5–8, § 6.4). `plan` i `replan` zovu isti prolaz:
   cilj nedelje → dugi → budžet brzog rada → lagani dani → spremnost. Svaka veličina ima jednu funkciju-vlasnika;
   nema petlje „skrati pa dopuni". Dan se uvek gradi iz namere nedelje + `header.decisions` (§ 1.3). */
import {
  EASY_FLOOR_MIN_RUN_DAYS,
  EASY_FLOOR_OVER_TARGET,
  RACE_CALM_DAYS,
  RACE_EVE_MAX_SEC,
  RACE_NO_LONG_DAYS,
  RETURN_WEEK_MAX_OVER_LAST,
  TAPER_ADDON_MIN_EASY_SEC
} from './constants';
import { addDays, weekdayOf } from './dates';
import { assignDays, easyOverPrevious, easyShareOfLong, longShare, taperEasyMax } from './decide';
import { doneIds } from './done';
import { paceCtxOf, stepsCost, summarize } from './load';
import {
  applyReadiness,
  inReturn,
  modsFor,
  PLAIN_LONG,
  recipeKey,
  type Seen,
  underRamp
} from './readiness';
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
  Workout,
  WorkoutDef
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

export interface TargetInput {
  /** Najveći obim (minuti trčanja) u poslednje 3 nedelje van pauze/rampe (pre plana `B`). */
  m: number;
  /** Udeo nedelje koji plan pokriva. */
  fraction: number;
  /** Stvarni (neumanjeni) cilj prethodne nedelje plana; `null` za prvu. */
  previousTarget: LoadPoints | null;
  /** Dodatno opterećenje kvaliteta te nedelje: bodovi iznad laganog trčanja istog trajanja (R5). */
  extra?: LoadPoints;
  /** Prva nedelja posle rampe povratka: najveći obim u minutima (R9); `null` = bez uslova. */
  returnCap?: number | null;
}

/** CILJ NEDELJE (§ 6.2 k. 5, krug 2: R3, R5, R9). Cilj je obim (minuti) + dodatno opterećenje kvaliteta:
    - gradnja i vrh: obim = `max(loadPct × P − dodatno, B)` — kvalitet ide PREKO sadašnjih minuta (R5);
      obim ≤ najveći od prethodne 3 nedelje × (1 + rast), bez izuzetka (R3);
    - rasterećenje: najviše `recovery.loadFactor × cilj prethodne nedelje`;
    - prva nedelja posle rampe: obim ≤ poslednja puna nedelja pre pauze × 1,10 (R9).
    Vraća pun cilj (za lanac) i cilj umanjen za nepotpunu nedelju. */
export function weekTarget(
  intent: WeekIntent,
  input: TargetInput,
  ctx: BuildCtx
): { full: LoadPoints; target: LoadPoints } {
  const s = ctx.data.safety;
  const { m } = input;
  const extra = input.extra ?? 0;
  let full = intent.loadPct * ctx.decisions.peakLoad;
  if (intent.kind === 'build' || intent.kind === 'peak') {
    const wanted = Math.max(full - extra, ctx.decisions.baseLoad);
    const rule = Math.max(m * (1 + s.maxWeeklyRampPct), m + s.minRampLoad);
    full = Math.min(wanted, rule) + extra;
  }
  if (intent.kind === 'recovery' && input.previousTarget !== null && ctx.template !== null) {
    full = Math.min(full, ctx.template.recovery.loadFactor * input.previousTarget);
  }
  if (input.returnCap !== undefined && input.returnCap !== null) {
    full = Math.min(full, input.returnCap + extra);
  }
  return { full, target: Math.round(full * input.fraction) };
}

/** DUGI (§ 6.2 k. 6, krug 2: R4, R5): `min(namera, najduži od prethodne 3 (ili polazni) + korak,
    udeo po danima × PLANIRANI minuti te nedelje)`, na ceo minut. Namera je `lenPct × najduži`, a u nedelji
    gradnje i vrha nije ispod polaznog dugog (sadašnji dugi trkača). Rasterećenje: najviše
    `recovery.longFactor × dugi prethodne nedelje`. Bez `week` važi samo lanac (bez udela nedelje). */
export function longPlan(
  intent: WeekIntent,
  previousLongest: Seconds,
  ctx: BuildCtx,
  week?: { plannedMin: number; runDays: number; previousLong?: Seconds }
): Seconds {
  if (intent.long === null) return 0;
  const d = ctx.decisions;
  const grown = Math.max(previousLongest, d.longStartSec) + ctx.data.safety.longStepSec;
  let wanted = intent.long.lenPct * d.longMaxSec;
  if (week !== undefined && (intent.kind === 'build' || intent.kind === 'peak')) {
    wanted = Math.max(wanted, Math.min(d.longStartSec, d.longMaxSec));
  }
  let cap = Number.POSITIVE_INFINITY;
  if (week !== undefined) {
    cap = longShare(ctx.data.safety, d.level, week.runDays) * week.plannedMin * 60;
    const before = week.previousLong ?? 0;
    if (intent.kind === 'recovery' && before > 0 && ctx.template !== null) {
      cap = Math.min(cap, ctx.template.recovery.longFactor * before);
    }
  }
  /* Dugi nije kraći od najkraćeg smislenog trčanja (krug 3, S13). */
  return Math.max(ctx.data.safety.minEasySec, Math.round(Math.min(wanted, grown, cap) / 60) * 60);
}

/** BUDŽET BRZOG RADA (§ 6.2 k. 6): redom dugi pa podražaji; `take` vraća dozu koja staje, `book` je knjiži. */
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

/* ------------------------------------------------------------------ mesta nedelje (pre budžeta) */

type SlotItem =
  | { kind: 'addon'; date: IsoDate; def: WorkoutDef }
  | { kind: 'test'; date: IsoDate; def: WorkoutDef; slot: SlotRef }
  | {
      kind: 'quality';
      date: IsoDate;
      def: WorkoutDef;
      slot: SlotRef;
      wanted: Seconds;
      extra: number;
    };

/** Mesta nedelje iz namere + odluka, PRE budžeta i cilja: ko je dugi, koji dani nose koji podražaj i koju dozu
    žele. Čista funkcija namere — iz nje se računa dodatno opterećenje kvaliteta (R5) i raspored. */
export interface WeekSlots {
  race: boolean;
  /** Dan pred trku (najviše 20 min, bez dodatka) i prvi od poslednjih dana pre trke (plafon sužavanja). */
  eve: IsoDate;
  calmFrom: IsoDate;
  /** Dani trčanja koje nedelja ima u planu (od početka plana, pre dana trke). */
  runDays: Weekday[];
  /** Dan dugog ako ga namera ima i dan postoji. */
  longWd: Weekday | null;
  long: { slot: SlotRef; def: WorkoutDef | null; wanted: Seconds; extra: number } | null;
  /** Podražaji po važnosti. */
  items: SlotItem[];
}

export function weekSlots(
  week: { start: IsoDate; intent: WeekIntent },
  span: Span,
  ctx: BuildCtx,
  slotIndex: (place: Place, stimulus: StimulusTag) => number,
  /** Provera forme pomerena iz pauze ili rampe: zamenjuje prvi kvalitet nedelje (R9). */
  forcedTest: Extract<Recipe, { type: 'test' }> | null = null,
  /** Poslednji težak dan prethodne nedelje: kvalitet ne ide dan posle njega (u nedelji trke dani kvaliteta se
      biraju prema danu trke, pa bi ponedeljak mogao da stane uz nedeljni kvalitet). */
  hardBefore: IsoDate | null = null
): WeekSlots {
  const { decisions: d } = ctx;
  const { intent } = week;
  const dateOf = (wd: number): IsoDate => addDays(week.start, wd);
  const race = inRaceWeek(week.start, span);
  /* O3: dan pred trku i poslednji dani pre trke važe po DATUMU, i kad padnu u nedelju pre nedelje trke. */
  const eve = addDays(span.raceDate, -1);
  const calmFrom = addDays(span.raceDate, -RACE_CALM_DAYS);
  const noLongFrom = addDays(span.raceDate, -RACE_NO_LONG_DAYS);
  const runDays = usableRunDays(week.start, span, ctx);
  const longWd =
    intent.long !== null && runDays.includes(d.longDay) && dateOf(d.longDay) < noLongFrom
      ? d.longDay
      : null;
  const raceOrder = (): Weekday[] => {
    const raceWd = weekdayOf(span.raceDate);
    const all = [...new Set<Weekday>([...d.runDays, raceWd])].sort((a, b) => a - b);
    return assignDays(all, raceWd).filter(
      (wd) => runDays.includes(wd) && wd !== longWd && dateOf(wd) < calmFrom
    );
  };
  const qualityDays = race ? raceOrder() : d.qualityDays;

  let long: WeekSlots['long'] = null;
  if (longWd !== null && intent.long !== null) {
    const slot: SlotRef = {
      place: 'long',
      stimulus: intent.long.stimulus,
      index: slotIndex('long', intent.long.stimulus),
      phase: intent.phase
    };
    const wanted = slotDose(slot, intent.long.dosePct, intent.kind, ctx);
    const def = pickDef(slot, wanted > 0 ? wanted : null, ctx, { noHighImpact: false });
    const zone = def === null ? null : mainZone(def.main);
    const blocky =
      def !== null &&
      zone !== null &&
      (def.main.kind === 'finish-block' || def.main.kind === 'progressive');
    long = {
      slot,
      def,
      wanted: blocky ? wanted : 0,
      extra: blocky && zone !== null ? extraWeight(zone, ctx) : 0
    };
  }

  const items: SlotItem[] = [];
  intent.stimuli.forEach((st, k) => {
    const wd = qualityDays[k];
    if (wd === undefined || !runDays.includes(wd) || wd === longWd || dateOf(wd) >= calmFrom)
      return;
    if (hardBefore !== null && dateOf(wd) === addDays(hardBefore, 1)) return;
    if (st.onlyByFeel === true && !ctx.pace.paces.byFeel) return;
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
      items.push({ kind: 'addon', date, def });
      return;
    }
    if (def.main.kind === 'all-out') {
      items.push({ kind: 'test', date, def, slot });
      return;
    }
    const zone = mainZone(def.main);
    if (zone === null) return;
    items.push({ kind: 'quality', date, def, slot, wanted, extra: extraWeight(zone, ctx) });
  });

  /* Pomerena provera forme: na mesto prvog kvaliteta; nedelja koja već ima proveru ostaje kakva je. */
  const movable = week.intent.kind !== 'taper' && week.intent.kind !== 'race';
  if (forcedTest !== null && movable && !items.some((x) => x.kind === 'test')) {
    const at = items.findIndex((x) => x.kind === 'quality');
    const wd = qualityDays[0];
    const date = at >= 0 ? items[at]?.date : wd === undefined ? undefined : dateOf(wd);
    const usable =
      date !== undefined && date < calmFrom && (longWd === null || date !== dateOf(longWd));
    if (date !== undefined && usable && runDays.some((x) => dateOf(x) === date)) {
      const item: SlotItem = { kind: 'test', date, def: forcedTest.def, slot: forcedTest.slot };
      if (at >= 0) items[at] = item;
      else {
        const clash = items.findIndex((x) => x.date === date);
        if (clash >= 0) items[clash] = item;
        else items.unshift(item);
      }
    }
  }
  return { race, eve, calmFrom, runDays, longWd, long, items };
}

/** Opterećenje punog napora iznad laganog trčanja istog trajanja, i njegovo trajanje (za budžet i R5). */
function testCost(
  item: Extract<SlotItem, { kind: 'test' }>,
  ctx: BuildCtx
): { sec: Seconds; extraLoad: LoadPoints; recipe: Recipe } {
  const recipe: Recipe = { type: 'test', def: item.def, slot: item.slot };
  const cost = summarize(realize(recipe, ctx), ctx.pace);
  const sec = item.def.main.kind === 'all-out' ? allOutSec(item.def.main.distanceM, ctx) : 0;
  return { sec, extraLoad: Math.max(0, cost.load - cost.durationSec / 60), recipe };
}

/** DODATNO OPTEREĆENJE KVALITETA nedelje (R5): bodovi iznad laganog trčanja istog trajanja, iz željenih doza. */
export function wantedExtra(slots: WeekSlots, ctx: BuildCtx): LoadPoints {
  let extra = slots.long === null ? 0 : (slots.long.wanted * slots.long.extra) / 60;
  for (const item of slots.items) {
    if (item.kind === 'quality') extra += (item.wanted * item.extra) / 60;
    if (item.kind === 'test') extra += testCost(item, ctx).extraLoad;
    if (item.kind === 'addon') {
      const cost = stepsCost(addonSteps(item.def), ctx.pace);
      extra += Math.max(0, cost.load - cost.durationSec / 60);
    }
  }
  return extra;
}

interface EasyDay {
  date: IsoDate;
  addon: Recipe | null;
  cap: Seconds;
  /** Nedelja sužavanja ili trke: plafon dana je strog i za dan sa dodatkom (R1). */
  tight: boolean;
}

/** Lagani dani prethodne nedelje koja nije rasterećenje: trajanje po danu u nedelji i najduži (R1, R2b). */
export interface EasyRef {
  /** Trajanje treninga po danu u nedelji — bilo koje vrste (isti dan prethodne nedelje, R1). */
  byWeekday: ReadonlyMap<number, Seconds>;
  /** Najduži lagan dan (R2b). */
  max: Seconds;
}

/** LAGANI DANI (§ 6.2 k. 7, krug 2: R2, R4): ostatak cilja jednako na lagane dane, uz plafon po danu; višak se NE
    preraspodeljuje (nedelja je tada manja od cilja). Kad je deo po danu ispod `minEasySec`: sa ≥ 3 dana trčanja
    svaki traženi dan ostaje na `minEasySec`; dan otpada tek kad bi nedelja i bez kvaliteta prešla cilj za više od
    10 % (plan to kaže upozorenjem); sa 1–2 dana ostaje `floor(ostatak / minEasySec)` dana. */
function easyFill(
  pool: EasyDay[],
  week: { targetLoad: LoadPoints; fixedLoad: LoadPoints; runDays: number },
  dayBeforeLong: IsoDate | null,
  afterQuality: ReadonlySet<IsoDate>,
  ctx: BuildCtx
): Map<IsoDate, Recipe> {
  const out = new Map<IsoDate, Recipe>();
  const minEasy = ctx.data.safety.minEasySec;
  const leftMin = week.targetLoad - week.fixedLoad;
  const addonCost = (day: EasyDay): { load: number; durationSec: number } =>
    day.addon !== null && day.addon.type === 'addon'
      ? stepsCost(addonSteps(day.addon.def), ctx.pace)
      : { load: 0, durationSec: 0 };
  const addons = (list: EasyDay[]): number =>
    list.reduce((sum, day) => sum + addonCost(day).load, 0);
  const budget = (list: EasyDay[]): number => (leftMin - addons(list)) * 60;
  const capOf = (day: EasyDay): { maxSec?: Seconds } =>
    Number.isFinite(day.cap) ? { maxSec: day.cap } : {};
  /* Ceo dan (lagani deo + dodatak) staje pod plafon dana. Kad lagani deo uz dodatak padne ispod najkraćeg
     trčanja, dan je samo lagan; u nedelji sužavanja i trke dodatak ostaje dok je lagani deo bar 10 min. */
  const put = (day: EasyDay, wanted: Seconds): void => {
    const extra = addonCost(day).durationSec;
    const sec = Math.min(wanted, day.cap - extra);
    const least = day.tight ? Math.min(minEasy, TAPER_ADDON_MIN_EASY_SEC) : minEasy;
    if (day.addon !== null && day.addon.type === 'addon' && sec >= least) {
      out.set(day.date, { ...day.addon, sec, ...capOf(day) });
    } else {
      out.set(day.date, { type: 'easy', sec: Math.min(wanted, day.cap), ...capOf(day) });
    }
  };
  let days = [...pool].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (days.length > 0 && budget(days) / days.length < minEasy) {
    if (week.runDays >= EASY_FLOOR_MIN_RUN_DAYS) {
      const over = (list: EasyDay[]): boolean =>
        week.fixedLoad + addons(list) + (list.length * minEasy) / 60 >
        week.targetLoad * (1 + EASY_FLOOR_OVER_TARGET);
      const dropOrder = [
        ...days.filter((d) => !afterQuality.has(d.date)),
        ...days.filter((d) => afterQuality.has(d.date))
      ];
      while (days.length > 0 && over(days)) {
        const drop = dropOrder.shift();
        days = days.filter((d) => d.date !== drop?.date);
      }
      for (const day of days) {
        /* Na najkraćem trčanju dodatak ide preko laganog dela; strog plafon važi samo u sužavanju i nedelji trke. */
        const free = !day.tight && day.cap >= minEasy;
        if (free && day.addon !== null && day.addon.type === 'addon') {
          out.set(day.date, { ...day.addon, sec: minEasy });
        } else put(day, minEasy);
      }
      return out;
    }
    const keep = Math.max(0, Math.min(days.length, Math.floor(budget(days) / minEasy)));
    const dropOrder = [
      ...days.filter((d) => d.date === dayBeforeLong),
      ...days.filter((d) => d.date !== dayBeforeLong)
    ];
    const dropped = new Set(dropOrder.slice(0, days.length - keep).map((d) => d.date));
    days = days.filter((d) => !dropped.has(d.date));
  }
  const per = days.length > 0 ? budget(days) / days.length : 0;
  for (const day of days) put(day, per);
  return out;
}

export interface WeekShell {
  index: number;
  start: IsoDate;
  intent: WeekIntent;
  targetLoad: LoadPoints;
  longSec: Seconds;
}

/** RASPORED NEDELJE: recept za svaki dan iz mesta nedelje + sačuvanih veličina (cilj, dugi). Čista funkcija —
    zato je ponovno građenje dana idempotentno. `previous` su lagani dani prethodne nedelje (R1, R2b). */
export function layoutWeek(
  week: WeekShell,
  ctx: BuildCtx,
  slots: WeekSlots,
  previous: EasyRef | null = null
): Map<IsoDate, Recipe> {
  const { decisions: d, data } = ctx;
  const s = data.safety;
  const { intent } = week;
  const dateOf = (wd: number): IsoDate => addDays(week.start, wd);
  const out = new Map<IsoDate, Recipe>();
  for (let wd = 0; wd < 7; wd += 1) out.set(dateOf(wd), REST);

  const { eve, runDays } = slots;
  const longWd = week.longSec > 0 ? slots.longWd : null;
  const budget = fastBudget(
    week.targetLoad,
    intent.kind === 'peak' ? s.maxFastSharePeak : s.maxFastShare
  );
  const fixed = new Map<IsoDate, Recipe>();
  const addons = new Map<IsoDate, Recipe>();
  let fixedLoad = 0;
  const fix = (date: IsoDate, recipe: Recipe): void => {
    fixed.set(date, recipe);
    fixedLoad += summarize(realize(recipe, ctx), ctx.pace).load;
  };

  if (longWd !== null && slots.long !== null) {
    let { def } = slots.long;
    let dose = 0;
    if (slots.long.wanted > 0 && def !== null) {
      dose = budget.take(slots.long.wanted, slots.long.extra);
      if (dose < minDoseOf(def, ctx)) {
        def = steadyLongDef(ctx, null);
        dose = 0;
      } else {
        budget.book(dose, slots.long.extra);
      }
    }
    fix(dateOf(longWd), { type: 'long', sec: week.longSec, def, dose, slot: slots.long.slot });
  }

  /* Svaki traženi dan ostaje u planu (R4): kvalitet se prihvata samo ako posle njega svi preostali dani mogu
     da dobiju najkraće lagano trčanje a da nedelja ne pređe cilj za više od 10 %; inače taj dan postaje lagan.
     Redom po važnosti — važniji podražaj ostaje. Provera forme se ne odbija. */
  const keepDays = d.runDays.length >= EASY_FLOOR_MIN_RUN_DAYS;
  const addonLoad = (date: IsoDate): LoadPoints => {
    const item = slots.items.find((x) => x.kind === 'addon' && x.date === date);
    return item === undefined ? 0 : stepsCost(addonSteps(item.def), ctx.pace).load;
  };
  const roomFor = (date: IsoDate, load: LoadPoints): boolean => {
    const rest = runDays.map((wd) => dateOf(wd)).filter((x) => x !== date && !fixed.has(x));
    const floor = rest.reduce((sum, x) => sum + s.minEasySec / 60 + addonLoad(x), 0);
    return fixedLoad + load + floor <= week.targetLoad * (1 + EASY_FLOOR_OVER_TARGET);
  };
  for (const item of slots.items) {
    if (item.date === (longWd === null ? null : dateOf(longWd))) continue;
    if (item.kind === 'addon') {
      addons.set(item.date, { type: 'addon', sec: 0, def: item.def });
      continue;
    }
    if (item.kind === 'test') {
      const cost = testCost(item, ctx);
      budget.book(cost.sec, cost.sec > 0 ? cost.extraLoad / (cost.sec / 60) : 0);
      fix(item.date, cost.recipe);
      continue;
    }
    const dose = budget.take(item.wanted, item.extra);
    if (dose < minDoseOf(item.def, ctx)) continue;
    const recipe: Recipe = { type: 'quality', def: item.def, dose, slot: item.slot };
    if (keepDays && !roomFor(item.date, summarize(realize(recipe, ctx), ctx.pace).load)) continue;
    budget.book(dose, item.extra);
    fix(item.date, recipe);
  }

  for (const [date, recipe] of fixed) out.set(date, recipe);
  const longDate = longWd === null ? null : dateOf(longWd);
  /* Dugi kakav će stvarno biti (posle zaokruživanja; blok je brži): merilo plafona laganog dana i po trajanju
     i po dužini — strože od ta dva. */
  const longRecipe = longDate === null ? undefined : fixed.get(longDate);
  const longCost = longRecipe === undefined ? null : summarize(realize(longRecipe, ctx), ctx.pace);
  const longRef =
    longCost === null
      ? 0
      : Math.min(longCost.durationSec, (longCost.distanceM * ctx.pace.paces.easy) / 1000);
  const dayBeforeLong = longDate === null ? eve : addDays(longDate, -1);
  const calmWeek = intent.kind === 'taper' || intent.kind === 'race';
  const pool: EasyDay[] = runDays
    .map((wd) => ({ wd, date: dateOf(wd) }))
    .filter(({ date }) => !fixed.has(date))
    .map(({ wd, date }) => {
      const calm = calmWeek || date >= slots.calmFrom;
      let cap = Number.POSITIVE_INFINITY;
      /* R2a: lagan dan najviše udeo dugog te nedelje (dan pred dugi manji udeo). */
      if (longRef > 0) {
        const share = easyShareOfLong(s, d.runDays.length);
        cap = longRef * (date === dayBeforeLong ? Math.min(share, s.dayBeforeLongMaxShare) : share);
      }
      /* R2b: najviše 1,25 × najduži lagan dan prethodne nedelje koja nije rasterećenje. */
      if (previous !== null) cap = Math.min(cap, easyOverPrevious(s) * previous.max);
      /* R1: sužavanje i nedelja trke — ne duže od istog dana prethodne nedelje ni od plafona sužavanja. */
      if (calm) {
        cap = Math.min(cap, taperEasyMax(s, d.runDays.length));
        if (previous !== null) cap = Math.min(cap, previous.byWeekday.get(wd) ?? previous.max);
      }
      /* Plafoni ne spuštaju lagan dan ispod najkraćeg smislenog trčanja; kraći je samo dan pred trku. */
      cap = Math.max(cap, s.minEasySec);
      if (date === eve) cap = Math.min(cap, RACE_EVE_MAX_SEC);
      return { date, addon: date === eve ? null : (addons.get(date) ?? null), cap, tight: calm };
    });
  const afterQuality = new Set<IsoDate>();
  for (const [date, recipe] of fixed) {
    if (recipe.type === 'quality' || recipe.type === 'test') afterQuality.add(addDays(date, 1));
  }
  const filled = easyFill(
    pool,
    { targetLoad: week.targetLoad, fixedLoad, runDays: d.runDays.length },
    dayBeforeLong,
    afterQuality,
    ctx
  );
  for (const [date, recipe] of filled) out.set(date, recipe);
  return out;
}

/** Lagani dani rasporeda (pre spremnosti) kao merilo za sledeću nedelju; `null` kad nedelja nema laganih dana. */
function easyRefOf(recipes: ReadonlyMap<IsoDate, Recipe>, ctx: BuildCtx): EasyRef | null {
  const byWeekday = new Map<number, Seconds>();
  let max = 0;
  for (const [date, recipe] of recipes) {
    if (recipe.type === 'rest') continue;
    const sec = summarize(realize(recipe, ctx), ctx.pace).durationSec;
    byWeekday.set(weekdayOf(date), sec);
    if (recipe.type === 'easy' || recipe.type === 'addon') max = Math.max(max, sec);
  }
  return max > 0 ? { byWeekday, max } : null;
}

/** Uzrok za pun napor iz plana (provera forme, pripremna trka): važi samo § 14.1. */
export function plannedEffort(day: PlanDay): Adjustment {
  return {
    kind: 'effort',
    source: 'plan',
    date: day.date,
    durationSec: day.workout?.workSec ?? 0,
    planned: true
  };
}

/* ------------------------------------------------------------------ prolaz */

export interface PassOptions {
  /** Dani van prozora se ne grade iznova; `null` = svi budući. */
  window: { from: IsoDate; to: IsoDate } | null;
  /** Od ove nedelje (indeks) cilj i dugi se odlučuju ponovo, iz stvarne i planirane istorije; `null` = sačuvano. */
  rechainFrom: number | null;
  /** Od ove nedelje samo se DUGI odlučuje ponovo, od stvarno odrađenih dugih (R8c); cilj ostaje sačuvan. */
  rechainLongFrom?: number | null;
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

/** Ponovljena doza ili dužina propuštenog ključnog treninga (§ 6.4, R8): važe sve stavke za taj dan. */
function applyRepeat(
  recipe: Recipe,
  dayId: DayId,
  adjustments: readonly Adjustment[],
  ctx: BuildCtx
): Recipe {
  let out = recipe;
  for (const adj of adjustments) {
    if (adj.kind !== 'repeat' || adj.dayId !== dayId) continue;
    if (out.type === 'quality' && adj.workSec !== undefined) {
      out = { ...out, dose: Math.min(out.dose, adj.workSec) };
    }
    if (out.type !== 'long') continue;
    if (adj.lengthSec !== undefined) out = { ...out, sec: Math.min(out.sec, adj.lengthSec) };
    if (adj.noBlock === true) {
      out = { ...out, def: steadyLongDef(ctx, null), dose: 0 };
    } else if (adj.blockSec !== undefined) {
      const own = out.def;
      const blocky =
        own !== null && (own.main.kind === 'finish-block' || own.main.kind === 'progressive');
      const def = blocky ? own : (ctx.data.library.find((x) => x.id === adj.blockDefId) ?? null);
      const cap = def === null ? 0 : (ctx.decisions.doseCapSec[def.stimulus] ?? 0);
      if (def !== null && cap > 0) out = { ...out, def, dose: Math.min(adj.blockSec, cap) };
    }
  }
  return out;
}

const sameWorkout = (a: Workout | null, b: Workout | null): boolean =>
  canonical(a) === canonical(b);

function seenKey(workout: Workout | null): string | null {
  if (workout === null || workout.stimulus === null) return null;
  if (workout.kind === 'quality' || workout.kind === 'test') return `quality:${workout.stimulus}`;
  if (workout.kind === 'long' && workout.workSec > 0) return `long:${workout.stimulus}`;
  return null;
}

/** Stvarno (prošlo) + planirano (buduće) trajanje i najduže trčanje nedelje — ulaz pravila rasta (minuti). */
function weekTotals(
  week: PlanWeek,
  header: PlanHeader,
  state: RunnerState,
  ctx: BuildCtx
): { durationSec: Seconds; longSec: Seconds } {
  const end = addDays(week.start, 6);
  const actual = state.weeks.find((w) => w.start === week.start);
  let durationSec = 0;
  let longSec = 0;
  for (const day of week.days) {
    const past = day.date <= state.today;
    if (past && (actual !== undefined || end > state.today)) continue;
    if (day.workout === null || (day.workout.kind === 'race' && day.date === header.goal.raceDate))
      continue;
    const cost = summarize(day.workout, ctx.pace);
    durationSec += cost.durationSec;
    if (day.workout.kind === 'long') longSec = Math.max(longSec, cost.durationSec);
  }
  if (week.start <= state.today && actual !== undefined) {
    durationSec += actual.durationSec;
    longSec = Math.max(longSec, actual.longestSec);
  }
  return { durationSec, longSec };
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
  /* Obim (minuti) i dugi nedelja van pauze i rampe — lanci pravila rasta. */
  const volumes: number[] = [];
  const longs: Seconds[] = [];
  let previousTarget: LoadPoints | null = null;
  let previousEasy: EasyRef | null = null;
  /* Odlučen dugi prethodne nedelje plana (rasterećenje ga ne prelazi). */
  let previousLong: Seconds = 0;
  let lastFullVolume: number = header.decisions.baseLoad;
  let previousRamped = false;
  let previousHard: IsoDate | null = null;
  /* Provera forme koja je pala u pauzu ili rampu: čeka prvu nedelju posle rampe (R9). */
  let pendingTest: Extract<Recipe, { type: 'test' }> | null = null;
  const lastThree = <T>(list: readonly T[]): T[] => list.slice(Math.max(0, list.length - 3));

  const weeks = doc.weeks.map((week): PlanWeek => {
    const ramped = underRamp(week.start, adjustments);
    const forced = ramped ? null : pendingTest;
    const slots = weekSlots(
      week,
      span,
      ctx,
      slotCounter(doc.weeks, week.index),
      forced,
      previousHard
    );
    if (forced !== null && slots.items.some((x) => x.kind === 'test' && x.def === forced.def)) {
      pendingTest = null;
    }
    const fraction = weekFraction(week.start, span, ctx);
    const extra = wantedExtra(slots, ctx);
    const plannedMin = (target: LoadPoints): number => Math.max(0, target - extra * fraction);
    let shell: WeekShell = week;
    let fullTarget: LoadPoints = week.targetLoad;
    if (opts.rechainFrom !== null && week.index >= opts.rechainFrom) {
      const recent = lastThree(volumes);
      const m = Math.max(...recent, ...(recent.length < 3 ? [header.decisions.baseLoad] : []));
      const decided = weekTarget(
        week.intent,
        {
          m,
          fraction,
          previousTarget,
          extra,
          returnCap: !ramped && previousRamped ? RETURN_WEEK_MAX_OVER_LAST * lastFullVolume : null
        },
        ctx
      );
      fullTarget = decided.full;
      shell = {
        ...week,
        targetLoad: decided.target,
        longSec: longPlan(week.intent, Math.max(0, ...lastThree(longs)), ctx, {
          plannedMin: plannedMin(decided.target),
          runDays: slots.runDays.length,
          previousLong
        })
      };
    } else if (
      opts.rechainLongFrom !== undefined &&
      opts.rechainLongFrom !== null &&
      week.index >= opts.rechainLongFrom
    ) {
      shell = {
        ...week,
        longSec: longPlan(week.intent, Math.max(0, ...lastThree(longs)), ctx, {
          plannedMin: plannedMin(week.targetLoad),
          runDays: slots.runDays.length,
          previousLong
        })
      };
    }
    previousTarget = fullTarget;
    const recipes = layoutWeek(shell, ctx, slots, previousEasy);
    if (week.intent.kind !== 'recovery' && week.intent.source === 'template') {
      previousEasy = easyRefOf(recipes, ctx) ?? previousEasy;
    }
    previousHard = null;
    for (const [date, recipe] of recipes) {
      const hard =
        recipe.type === 'quality' ||
        recipe.type === 'test' ||
        (recipe.type === 'long' && recipe.dose > 0);
      if (hard && (previousHard === null || date > previousHard)) previousHard = date;
    }
    let longAsDecided = false;
    const days = week.days.map((day): PlanDay => {
      let final = day;
      const planned = recipes.get(day.date) ?? REST;
      const inWindow =
        opts.window === null || (day.date >= opts.window.from && day.date <= opts.window.to);
      const mutable = isMutable(day, header, state.today, done);
      let kept = planned.type === 'test';
      if (inWindow && mutable) {
        /* Provera forme se ne radi u pauzi ni u rampi povratka — ni pri njenom kraju: čeka prvu nedelju posle
           rampe (R9), a dan ostaje lagan. */
        const source: Recipe =
          planned.type === 'test' && inReturn(day.date, adjustments)
            ? { type: 'easy', sec: summarize(realize(planned, ctx), ctx.pace).durationSec }
            : planned;
        const recipe = applyRepeat(source, day.id, adjustments, ctx);
        const mods = modsFor(day.date, causes, seen, recipeKey(recipe));
        const ready = applyReadiness(recipe, mods, ctx);
        kept = ready.type === 'test';
        /* Dugi izgrađen bez skraćivanja: lanac rasta uzima odlučenu (nezaokruženu) dužinu. */
        if (ready.type === 'long' && ready.sec === shell.longSec) longAsDecided = true;
        const workout = realize(ready, ctx);
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
      } else if (!mutable) {
        kept = day.workout?.kind === 'test' && (day.date > state.today || done.has(day.id));
      }
      /* Provera forme koju su pauza ili rampa povratka pojele se pomera, ne briše (R9). */
      if (planned.type === 'test' && !kept && inReturn(day.date, adjustments)) {
        pendingTest = planned;
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
        causes.push(plannedEffort(final));
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
    /* Nedelje koje seku pauzu ili rampu ne ulaze u pravilo rasta (drugi krug): povratak određuje samo rampa. */
    if (!ramped) {
      const totals = weekTotals(built, header, state, ctx);
      volumes.push(totals.durationSec / 60);
      if (fraction >= 1) lastFullVolume = totals.durationSec / 60;
      longs.push(longAsDecided ? Math.max(shell.longSec, totals.longSec) : totals.longSec);
    }
    previousRamped = ramped;
    previousLong = shell.longSec;
    return built;
  });
  return { ...doc, weeks };
}
