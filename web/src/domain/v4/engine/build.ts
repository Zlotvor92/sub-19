/* V4 — JEDAN PROLAZ KROZ NEDELJE (SPEC § 6.2 k. 5–8, § 6.4). `plan` i `replan` zovu isti prolaz:
   cilj nedelje → dugi → budžet brzog rada → lagani dani → spremnost. Svaka veličina ima jednu funkciju-vlasnika;
   nema petlje „skrati pa dopuni". Dan se uvek gradi iz namere nedelje + `header.decisions` (§ 1.3). */
import {
  EASY_FLOOR_MIN_RUN_DAYS,
  EASY_FLOOR_OVER_TARGET,
  VOLUME_ROOM_OVER,
  RACE_CALM_DAYS,
  RACE_EVE_MAX_SEC,
  RACE_NO_LONG_DAYS,
  RETURN_TEST_AFTER_RAMP_DAYS,
  RP_TEST_GAP_DAYS,
  TAPER_BLOCK_SHARE,
  RETURN_WEEK_MAX_OVER_LAST,
  TAPER_ADDON_MIN_EASY_SEC
} from './constants';
import { addDays, diffDays, weekdayOf } from './dates';
import {
  assignDays,
  easyOverPrevious,
  easyShareOfLong,
  longShareFor,
  longStepOf,
  minRampOf,
  taperEasyMax
} from './decide';
import { doneIds } from './done';
import { paceCtxOf, stepsCost, summarize, zonePace } from './load';
import {
  adjustmentWindow,
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
    const wanted = Math.max(full - extra, ctx.decisions.baseVolumeMin ?? ctx.decisions.baseLoad);
    /* Prva nedelja plana je sadašnji obim (S2: ograničenje je korak od onoga što trkač sada trči). */
    const rule =
      input.previousTarget === null
        ? m
        : Math.max(m * (1 + s.maxWeeklyRampPct), m + minRampOf(s, ctx.pace.paces.easy));
    full = Math.min(wanted, rule) + extra;
  }
  if (intent.kind === 'recovery' && input.previousTarget !== null && ctx.template !== null) {
    full = Math.min(full, ctx.template.recovery.loadFactor * input.previousTarget);
  }
  if (input.returnCap !== undefined && input.returnCap !== null) {
    /* S9/E1: obim (km nedelje) ≤ poslednja puna nedelja gradnje pre pauze × 1,10; kvalitet ide preko (R5) */
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
  week?: {
    plannedMin: number;
    runDays: number;
    previousLong?: Seconds;
    highShare?: boolean;
    /** Blok u dugom: sekunde i tempo (E7: blok nosi više km od laganog dela). */
    block?: { sec: Seconds; pace: number };
    /** Broj ranijih nedelja gradnje/vrha u planu (D1/D6: pod dugog raste od `longStartShare` polaznog). */
    builds?: number;
  }
): Seconds {
  if (intent.long === null) return 0;
  const d = ctx.decisions;
  /* D1/D6 (krug 5): dugi raste od prethodnog (ne skače na polazni kad je krenuo niže) */
  const grown =
    (previousLongest > 0 ? previousLongest : d.longStartSec) +
    longStepOf(ctx.data.safety, ctx.pace.paces.easy);
  let wanted = intent.long.lenPct * d.longMaxSec;
  const step = longStepOf(ctx.data.safety, ctx.pace.paces.easy);
  if (week !== undefined && (intent.kind === 'build' || intent.kind === 'peak')) {
    /* D1/D6 (krug 5): dugi ne kreće na plafonu — pod je `longStartFloorShare` × polazni, pa raste za korak po
       nedelji gradnje do polaznog (bez podatka: odmah polazni) */
    const startFloor = ctx.data.safety.longStartFloorShare;
    const full = Math.min(d.longStartSec, d.longMaxSec);
    const floor =
      startFloor === undefined ? full : Math.min(full, startFloor * full + (week.builds ?? 0) * step);
    wanted = Math.max(wanted, floor);
  }
  let cap = Number.POSITIVE_INFINITY;
  if (week !== undefined) {
    const weekKm = (week.plannedMin * 60) / ctx.pace.paces.easy;
    const share = longShareFor(ctx.data.safety, d.level, week.runDays, weekKm, week.highShare === true);
    /* E7 (krug 5): udeo je u KM — km nedelje se procenjuju iz minuta u laganom tempu (donja procena), a blok u
       dugom nosi više km od istog vremena lagano, pa se njegov višak oduzima. */
    const easy = ctx.pace.paces.easy;
    const blockKm =
      week.block === undefined ? 0 : week.block.sec * (1 / week.block.pace - 1 / easy);
    cap = Math.max(0, share * weekKm - blockKm) * easy;
    const before = week.previousLong ?? 0;
    if (intent.kind === 'recovery' && before > 0 && ctx.template !== null) {
      cap = Math.min(cap, ctx.template.recovery.longFactor * before);
    }
  }
  let sec = Math.min(wanted, grown, cap);
  /* T3 (krug 4): dugi koji ne raste (na plafonu ili polaznom) ide u talasu po nameri šablona */
  const wave = intent.long.wave;
  /* D1 (krug 5): talas samo kad je dugi na plafonu (najduži dozvoljen ili udeo nedelje) */
  const atCap = sec >= d.longMaxSec - 60 || sec >= cap - 60;
  if (wave !== undefined && week !== undefined && atCap && previousLongest > 0 && sec <= previousLongest + 60)
    sec *= wave;
  /* Dugi nije kraći od najkraćeg smislenog trčanja (krug 3, S13). */
  return Math.max(ctx.data.safety.minEasySec, Math.round(sec / 60) * 60);
}

/** BUDŽET BRZOG RADA (§ 6.2 k. 6): redom dugi pa podražaji; `take` vraća dozu koja staje, `book` je knjiži. */
function fastBudget(
  targetLoad: LoadPoints,
  share: number,
  /** Najveći brz rad nedelje u minutima (S1, ispravljen raspored); `null` = procena iz cilja. */
  maxWorkMin: number | null = null
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
      const room =
        maxWorkMin === null
          ? (share * (targetLoad - extraLoad) - workMin) / (1 + share * extra)
          : maxWorkMin - workMin;
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
  long: {
    slot: SlotRef;
    def: WorkoutDef | null;
    wanted: Seconds;
    extra: number;
    /** Tempo zone bloka (s/km), kad dugi ima blok. */
    pace?: number;
  } | null;
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
  hardBefore: IsoDate | null = null,
  /** Pomerena provera ne ide pre ovog dana (S9: najranije 10 dana posle kraja rampe). */
  forcedFrom: IsoDate | null = null
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
  /* S8e (krug 4): tegoba u 12 meseci — prve 4 nedelje bez unosa visokog udara */
  const cautious = d.painCaution === true && week.start < addDays(span.startDate, 28);
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
      extra: blocky && zone !== null ? extraWeight(zone, ctx) : 0,
      ...(blocky && zone !== null ? { pace: zonePace(zone, ctx.pace.paces) } : {})
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
    const def = pickDef(slot, wanted > 0 ? wanted : null, ctx, { noHighImpact: cautious });
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
    /* E3 (krug 5): pomerena provera ne ide u ± 2 dana od treninga u tempu trke (ni bloka u dugom) i ne zamenjuje
       jedini tempo trke nedelje */
    const rpDates = [
      ...items.filter((x) => x.kind === 'quality' && mainZone(x.def.main) === 'RP').map((x) => x.date),
      ...(long !== null && long.wanted > 0 && long.def !== null && mainZone(long.def.main) === 'RP' && longWd !== null
        ? [dateOf(longWd)]
        : [])
    ];
    const replaced = at >= 0 ? items[at] : undefined;
    const replacesOnlyRp =
      replaced?.kind === 'quality' && mainZone(replaced.def.main) === 'RP' && rpDates.length === 1;
    const nearRp =
      date !== undefined &&
      rpDates.some((x) => x !== replaced?.date && Math.abs(diffDays(x, date)) <= RP_TEST_GAP_DAYS);
    const usable =
      date !== undefined &&
      date < calmFrom &&
      (forcedFrom === null || date >= forcedFrom) &&
      !replacesOnlyRp &&
      !nearRp &&
      (longWd === null || date !== dateOf(longWd));
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
  week: {
    targetLoad: LoadPoints;
    fixedLoad: LoadPoints;
    runDays: number;
    /** Preostali obim (minuti) za lagane dane; `Infinity` = bez uslova. */
    leftVolumeMin: number;
  },
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
  const addonSec = (list: EasyDay[]): number =>
    list.reduce((sum, day) => sum + addonCost(day).durationSec, 0);
  const budget = (list: EasyDay[]): number =>
    Math.min((leftMin - addons(list)) * 60, week.leftVolumeMin * 60 - addonSec(list));
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
  /** Obim nedelje u minutima (cilj bez dodatka kvaliteta, R5): lagani dani ga ne prelaze (S1/S2: kad budžet skrati
      rad, oslobođeni bodovi ne postaju dodatni minuti). */
  volumeMin?: number;
}

/** RASPORED NEDELJE: recept za svaki dan iz mesta nedelje + sačuvanih veličina (cilj, dugi). Čista funkcija —
    zato je ponovno građenje dana idempotentno. `previous` su lagani dani prethodne nedelje (R1, R2b). */
export function layoutWeek(
  week: WeekShell,
  ctx: BuildCtx,
  slots: WeekSlots,
  previous: EasyRef | null = null
): Map<IsoDate, Recipe> {
  /* S1: budžet brzog rada i čuvar mere isto — od PLANIRANOG zbira nedelje. Prvi raspored procenjuje zbir iz cilja;
     kad lagani dani udare u plafon i nedelja ispadne manja, drugi raspored deli budžet od stvarnog zbira (rad samo
     opada, lagani deo samo raste, pa treći nije potreban). */
  const share = week.intent.kind === 'peak' ? ctx.data.safety.maxFastSharePeak : ctx.data.safety.maxFastShare;
  let out = layoutOnce(week, ctx, slots, previous, null);
  /* Budžet od planiranog: rad W sme da bude `udeo × zbir`; kad lagani dani ne mogu da porastu (plafon dana), zbir
     pada zajedno sa radom, pa je granica `W ≤ udeo / (1 − udeo) × ostatak`. Najviše dva ispravljena rasporeda. */
  /* Doza se zaokružuje na komad (500 m, 60 s), pa ostvareni rad može da pređe dodeljen: svaki sledeći raspored
     skida i taj višak. Najviše četiri ispravljena rasporeda (rad samo opada). */
  let maxWork: number | null = null;
  for (let pass = 0; pass < 4; pass += 1) {
    const sums = recipeSums(out, ctx);
    const allowed = (share / (1 - share)) * ((sums.durationSec - sums.fastSec) / 60);
    const work = sums.fastSec / 60;
    if (work <= allowed + 1 / 60) return out;
    maxWork = Math.min(maxWork ?? work, allowed) - (maxWork === null ? 0 : work - maxWork);
    out = layoutOnce(week, ctx, slots, previous, Math.max(0, maxWork));
  }
  return out;
}

/** SILAZAK INTENZITETA (E9, krug 5): jedini vlasnik intenziteta poslednje dve nedelje. Poslednjih `lastDays` dana
    samo oštrenje (ostali kvalitet postaje lagan dan istog trajanja, blok iz dugog otpada); u nedelji pre toga
    najviše `weekBeforeMaxQuality` brzih treninga redom po datumu i brz rad ≤ `weekBeforeMaxOfPeak` × vršna nedelja
    (doza poslednjeg se skraćuje do granice, ispod najmanje doze je dan lagan). */
function taperIntensity(
  recipes: Map<IsoDate, Recipe>,
  span: Span,
  peakFastSec: Seconds,
  ctx: BuildCtx,
  /** Brojač preko granice nedelje (prozor 8–14 dana seče dve nedelje plana). */
  acc: { count: number; fast: number } = { count: 0, fast: 0 }
): Map<IsoDate, Recipe> {
  const t = ctx.data.safety.taper;
  if (t === undefined) return recipes;
  const sharp = ctx.data.safety.sharpening?.stimulus;
  const lastFrom = addDays(span.raceDate, -t.lastDays);
  const beforeFrom = addDays(span.raceDate, -t.weekBeforeFromDays);
  const out = new Map(recipes);
  /* dugi bez bloka zadržava dužinu (km), ne trajanje — lagani dani ostaju u odnosu prema dugom */
  const plainLong = (recipe: Extract<Recipe, { type: 'long' }>): Recipe => {
    const km = summarize(realize(recipe, ctx), ctx.pace).km;
    return { ...recipe, def: steadyLongDef(ctx, null), dose: 0, sec: Math.round(km * ctx.pace.paces.easy) };
  };
  /* kvalitet postaje lagan dan: kraći za zagrevanje/hlađenje, ne duži od plafona sužavanja ni 60 % dugog te nedelje */
  const longOfWeek = [...out.values()].find((x) => x.type === 'long');
  const longCap = longOfWeek?.type === 'long' ? 0.6 * longOfWeek.sec : Number.POSITIVE_INFINITY;
  const asEasy = (recipe: Recipe): Recipe => ({
    type: 'easy',
    sec: Math.max(
      ctx.data.safety.minEasySec,
      Math.min(
        summarize(realize(recipe, ctx), ctx.pace).durationSec - 600,
        taperEasyMax(ctx.data.safety, ctx.decisions.runDays.length),
        longCap
      )
    )
  });
  let { count, fast } = acc;
  const budget = t.weekBeforeMaxOfPeak * peakFastSec;
  for (const date of [...out.keys()].sort()) {
    const r = out.get(date);
    if (r === undefined || date >= span.raceDate || date < beforeFrom) continue;
    const isQuality = r.type === 'quality' && r.def.stimulus !== sharp;
    const isBlock = r.type === 'long' && r.dose > 0;
    if (!isQuality && !isBlock) continue;
    if (date >= lastFrom) {
      out.set(date, isBlock && r.type === 'long' ? plainLong(r) : asEasy(r));
      continue;
    }
    const work = isQuality && r.type === 'quality' ? r.dose : r.type === 'long' ? r.dose : 0;
    /* dopuna kruga 4: u nedelji −2 prednost ima kvalitet usred nedelje — blok u dugom dobija najviše pola budžeta */
    const room =
      peakFastSec > 0
        ? Math.min(budget - fast, isBlock ? TAPER_BLOCK_SHARE * budget : Number.POSITIVE_INFINITY)
        : Number.POSITIVE_INFINITY;
    if (count >= t.weekBeforeMaxQuality || room < ctx.data.safety.minDoseSec) {
      out.set(date, r.type === 'long' ? plainLong(r) : asEasy(r));
      continue;
    }
    const dose = Math.min(work, room);
    if (dose < work) {
      if (r.type === 'quality') out.set(date, { ...r, dose });
      if (r.type === 'long') out.set(date, { ...r, dose });
    }
    count += 1;
    /* ostvaren rad (zaokruženje na komad) — da granica važi za ono što trkač trči; višak zaokruženja se skida */
    let real = realize(out.get(date) ?? r, ctx);
    const cur = out.get(date) ?? r;
    if (real !== null && real.workSec > room && (cur.type === 'quality' || cur.type === 'long')) {
      const less = Math.max(0, cur.dose - (real.workSec - room) - 60);
      const next: Recipe =
        less < ctx.data.safety.minDoseSec
          ? cur.type === 'long'
            ? plainLong(cur)
            : asEasy(cur)
          : { ...cur, dose: less };
      out.set(date, next);
      real = realize(next, ctx);
    }
    fast += real === null ? dose : real.workSec;
  }
  acc.count = count;
  acc.fast = fast;
  return out;
}

/** Zbir trajanja i brzog rada rasporeda (S1: test i trka nisu brz rad). */
function recipeSums(
  recipes: ReadonlyMap<IsoDate, Recipe>,
  ctx: BuildCtx
): { durationSec: Seconds; fastSec: Seconds } {
  let durationSec = 0;
  let fastSec = 0;
  for (const recipe of recipes.values()) {
    if (recipe.type === 'rest') continue;
    const workout = realize(recipe, ctx);
    durationSec += summarize(workout, ctx.pace).durationSec;
    if (workout !== null && (workout.kind === 'quality' || workout.kind === 'long')) {
      fastSec += workout.workSec;
    }
  }
  return { durationSec, fastSec };
}

function layoutOnce(
  week: WeekShell,
  ctx: BuildCtx,
  slots: WeekSlots,
  previous: EasyRef | null,
  maxWorkMin: number | null
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
    intent.kind === 'peak' ? s.maxFastSharePeak : s.maxFastShare,
    maxWorkMin
  );
  const sharp = s.sharpening;
  /* D7 (krug 5): plafon rada jedne zone nedeljno (tempo trke uklj. blok u dugom) po nivou */
  const zoneCap = s.weeklyZoneMaxSec;
  let zoneLeft =
    zoneCap === undefined ? Number.POSITIVE_INFINITY : (zoneCap.byLevel[d.level] ?? Number.POSITIVE_INFINITY);
  const inZone = (def: WorkoutDef | null): boolean =>
    zoneCap !== undefined && def !== null && mainZone(def.main) === zoneCap.zone;
  const fixed = new Map<IsoDate, Recipe>();
  const addons = new Map<IsoDate, Recipe>();
  let fixedLoad = 0;
  let fixedSec = 0;
  const fix = (date: IsoDate, recipe: Recipe): void => {
    fixed.set(date, recipe);
    const cost = summarize(realize(recipe, ctx), ctx.pace);
    fixedLoad += cost.load;
    fixedSec += cost.durationSec;
  };

  if (longWd !== null && slots.long !== null) {
    let { def } = slots.long;
    let dose = 0;
    if (slots.long.wanted > 0 && def !== null) {
      dose = budget.take(slots.long.wanted, slots.long.extra);
      if (inZone(def)) dose = Math.min(dose, zoneLeft);
      if (dose < minDoseOf(def, ctx)) {
        def = steadyLongDef(ctx, null);
        dose = 0;
      } else {
        budget.book(dose, slots.long.extra);
        if (inZone(def)) zoneLeft -= dose;
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
  const addonSec = (date: IsoDate): Seconds => {
    const item = slots.items.find((x) => x.kind === 'addon' && x.date === date);
    return item === undefined ? 0 : stepsCost(addonSteps(item.def), ctx.pace).durationSec;
  };
  /* Prvi (najvažniji) kvalitet nedelje sme da digne obim do 10 %, ostali do 5 % (krug 4: brz trkač malog obima
     ne ostaje bez ijednog kvaliteta — p06) */
  let placedQuality = 0;
  const roomFor = (date: IsoDate, load: LoadPoints, sec: Seconds): boolean => {
    const room = placedQuality === 0 ? EASY_FLOOR_OVER_TARGET : VOLUME_ROOM_OVER;
    const rest = runDays.map((wd) => dateOf(wd)).filter((x) => x !== date && !fixed.has(x));
    const floor = rest.reduce((sum, x) => sum + s.minEasySec / 60 + addonLoad(x), 0);
    /* i obim (minuti): kvalitet sa zagrevanjem i hlađenjem ne sme da digne nedelju preko pravila rasta (S2) */
    const volume = week.volumeMin ?? Number.POSITIVE_INFINITY;
    const floorMin = rest.reduce((sum, x) => sum + (s.minEasySec + addonSec(x)) / 60, 0);
    /* Kad ni najkraći lagani dani ne staju u obim (mnogo dana, mali obim), važi samo provera bodova. */
    const fits = fixedSec / 60 + floorMin + s.minEasySec / 60 <= volume * (1 + EASY_FLOOR_OVER_TARGET);
    return (
      fixedLoad + load + floor <= week.targetLoad * (1 + EASY_FLOOR_OVER_TARGET) &&
      (!fits || (fixedSec + sec) / 60 + floorMin <= volume * (1 + room))
    );
  };
  /* Kad u obim staje samo jedan od dva kvaliteta, parne nedelje prednost daju drugom — da nedelje ne nose isti
     trening iz nedelje u nedelju (smena podražaja; krug 4). */
  const order = [...slots.items];
  const qi = order.flatMap((x, i) => (x.kind === 'quality' ? [i] : []));
  const [a, b] = qi;
  if (a !== undefined && b !== undefined && keepDays && week.index % 2 === 0) {
    const secOf = (x: SlotItem): Seconds =>
      x.kind === 'quality'
        ? summarize(realize({ type: 'quality', def: x.def, dose: x.wanted, slot: x.slot }, ctx), ctx.pace)
            .durationSec
        : 0;
    const others = runDays.filter((wd) => !fixed.has(dateOf(wd))).length - 2;
    const both =
      (fixedSec + secOf(order[a] as SlotItem) + secOf(order[b] as SlotItem)) / 60 +
      (Math.max(0, others) * s.minEasySec) / 60;
    if (both > (week.volumeMin ?? Number.POSITIVE_INFINITY) * (1 + VOLUME_ROOM_OVER)) {
      const first = order[a] as SlotItem;
      order[a] = order[b] as SlotItem;
      order[b] = first;
    }
  }
  for (let item of order) {
    if (item.date === (longWd === null ? null : dateOf(longWd))) continue;
    if (item.kind === 'addon') {
      addons.set(item.date, { type: 'addon', sec: 0, def: item.def });
      continue;
    }
    if (item.kind === 'test') {
      /* S1: trka i test nisu brz rad — ne troše budžet. */
      fix(item.date, testCost(item, ctx).recipe);
      continue;
    }
    /* S1: oštrenje nedelje trke je van budžeta i uvek postoji (doza u [min, max]). */
    if (slots.race && sharp !== undefined && item.def.stimulus === sharp.stimulus) {
      const sec = Math.min(sharp.maxSec, Math.max(sharp.minSec, item.wanted));
      /* bodovi van cilja (ne istiskuje lagane dane nedelje trke), trajanje u obimu nedelje */
      const recipe: Recipe = { type: 'quality', def: item.def, dose: sec, slot: item.slot };
      fixed.set(item.date, recipe);
      fixedSec += summarize(realize(recipe, ctx), ctx.pace).durationSec;
      continue;
    }
    /* D7 dopuna: kad plafon zone ne ostavlja ni najmanju dozu, mesto dobija zamenski podražaj iz biblioteke
       (`weeklyZoneMaxSec.fallbackStimulus`), ne lagano trčanje */
    if (inZone(item.def) && zoneLeft < minDoseOf(item.def, ctx) && zoneCap?.fallbackStimulus !== undefined) {
      const slot: SlotRef = { place: 'quality', stimulus: zoneCap.fallbackStimulus, index: 0, phase: item.slot.phase };
      const capSec = d.doseCapSec[slot.stimulus] ?? 0;
      const wanted = Math.min(capSec, item.wanted);
      const def = pickDef(slot, wanted > 0 ? wanted : null, ctx, { noHighImpact: false });
      const zone = def === null ? null : mainZone(def.main);
      if (def !== null && zone !== null && def.main.kind !== 'add-on' && def.main.kind !== 'all-out')
        item = { ...item, def, slot, wanted, extra: extraWeight(zone, ctx) };
    }
    const dose = Math.min(
      budget.take(item.wanted, item.extra),
      inZone(item.def) ? zoneLeft : Number.POSITIVE_INFINITY
    );
    if (dose < minDoseOf(item.def, ctx)) continue;
    const recipe: Recipe = { type: 'quality', def: item.def, dose, slot: item.slot };
    const cost = summarize(realize(recipe, ctx), ctx.pace);
    if (keepDays && !roomFor(item.date, cost.load, cost.durationSec)) continue;
    budget.book(dose, item.extra);
    if (inZone(item.def)) zoneLeft -= dose;
    fix(item.date, recipe);
    placedQuality += 1;
  }

  for (const [date, recipe] of fixed) out.set(date, recipe);
  const longDate = longWd === null ? null : dateOf(longWd);
  /* Dugi kakav će stvarno biti (posle zaokruživanja; blok je brži): merilo plafona laganog dana i po trajanju
     i po dužini — strože od ta dva. */
  const longRecipe = longDate === null ? undefined : fixed.get(longDate);
  const longCost = longRecipe === undefined ? null : summarize(realize(longRecipe, ctx), ctx.pace);
  const realLong =
    longCost === null
      ? 0
      : Math.min(longCost.durationSec, (longCost.distanceM * ctx.pace.paces.easy) / 1000);
  /* D1/D6 (krug 5): lagani dani se mere prema dugom koji trkač već trči (polazni) i dugom pre talasa — kad dugi
     kreće niže ili ide u talasu, razlika ide u lagane dane i obim nedelje se ne ljulja */
  const building = intent.kind === 'build' || intent.kind === 'peak';
  const unwaved =
    intent.long?.wave === undefined ? 0 : Math.min(d.longMaxSec, week.longSec / intent.long.wave);
  const longRef =
    realLong > 0 && building
      ? Math.max(realLong, unwaved, Math.min(d.longStartSec, d.longMaxSec))
      : realLong;
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
    {
      targetLoad: week.targetLoad,
      fixedLoad,
      runDays: d.runDays.length,
      leftVolumeMin:
        week.volumeMin === undefined ? Number.POSITIVE_INFINITY : week.volumeMin - fixedSec / 60
    },
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

/** Sitna razlika dana (S9): lagan ili dugi bez rada, ista vrsta i isti unos biblioteke, a dužina se razlikuje < 1 km i < 10 %. */
export const MINOR_CHANGE_KM = 1;
export const MINOR_CHANGE_SHARE = 0.1;
function minorChange(before: Workout, after: Workout, ctx: BuildCtx): boolean {
  if (before.kind !== after.kind || before.libraryId !== after.libraryId) return false;
  if (before.kind === 'race' || before.kind === 'test') return false;
  if (before.workSec > 0 || after.workSec > 0) return false;
  const a = summarize(before, ctx.pace).km;
  const b = summarize(after, ctx.pace).km;
  const diff = Math.abs(a - b);
  return diff < MINOR_CHANGE_KM && diff < MINOR_CHANGE_SHARE * Math.max(a, b);
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
): { durationSec: Seconds; longSec: Seconds; km: number } {
  const end = addDays(week.start, 6);
  const actual = state.weeks.find((w) => w.start === week.start);
  let durationSec = 0;
  let longSec = 0;
  let km = 0;
  for (const day of week.days) {
    const past = day.date <= state.today;
    if (past && (actual !== undefined || end > state.today)) continue;
    if (day.workout === null || (day.workout.kind === 'race' && day.date === header.goal.raceDate))
      continue;
    const cost = summarize(day.workout, ctx.pace);
    durationSec += cost.durationSec;
    km += cost.km;
    if (day.workout.kind === 'long') longSec = Math.max(longSec, cost.durationSec);
  }
  if (week.start <= state.today && actual !== undefined) {
    durationSec += actual.durationSec;
    km += actual.distanceM / 1000;
    longSec = Math.max(longSec, actual.longestSec);
  }
  return { durationSec, longSec, km };
}

/** E2 (dopuna kruga 4): kad je nedelja skraćena (spremnost, bol, pauza), dugi i blok u njemu se skraćuju srazmerno —
    dugi ≤ `safety.shortenedLongMaxShare` nedelje u km. Menja samo promenljiv dugi; nedelja trke i 1–3 dana ne. */
function shortenLong(
  days: PlanDay[],
  week: PlanWeek,
  header: PlanHeader,
  today: IsoDate,
  done: ReadonlySet<DayId>,
  ctx: BuildCtx,
  opts: PassOptions
): PlanDay[] {
  const share = ctx.data.safety.shortenedLongMaxShare;
  if (share === undefined || ctx.decisions.runDays.length < 4 || week.intent.kind === 'race') return days;
  /* samo skraćena nedelja: ponovno planiranje ili nedelja u rampi/zaštiti */
  if (opts.fresh === true && !underRamp(week.start, header.adjustments ?? [])) return days;
  const kmOf = (d: PlanDay): number =>
    d.workout === null || (d.workout.kind === 'race' && d.date === header.goal.raceDate)
      ? 0
      : summarize(d.workout, ctx.pace).km;
  const total = days.reduce((sum, d) => sum + kmOf(d), 0);
  const at = days.findIndex((d) => d.workout?.kind === 'long');
  const day = days[at];
  if (day === undefined || day.workout === null || total <= 0) return days;
  const longKm = kmOf(day);
  if (longKm <= share * total + 0.25) return days;
  const inWindow = opts.window === null || (day.date >= opts.window.from && day.date <= opts.window.to);
  if (!inWindow || !isMutable(day, header, today, done)) return days;
  /* dugi D, ostatak R: D' ≤ share × (R + D') → D' = share × R / (1 − share) */
  const ratio = (share * (total - longKm)) / (1 - share) / longKm;
  const w = day.workout;
  const def = ctx.data.library.find((x) => x.id === w.libraryId) ?? steadyLongDef(ctx, null);
  const sec = Math.max(ctx.data.safety.minEasySec, summarize(w, ctx.pace).durationSec * ratio);
  const recipe: Recipe = { type: 'long', sec, def, dose: Math.round(w.workSec * ratio), slot: null };
  const workout = realize(recipe, ctx);
  const out = [...days];
  out[at] = { ...day, origin: 'template', locked: false, workout };
  return out;
}

/** Broj nedelja gradnje/vrha pre nedelje `index`. */
function buildsBefore(weeks: readonly PlanWeek[], index: number): number {
  return weeks.filter(
    (w) => w.index < index && (w.intent.kind === 'build' || w.intent.kind === 'peak')
  ).length;
}

/** Blok u dugom iz mesta nedelje (E7): željena doza i tempo zone. */
function blockOf(slots: WeekSlots): { block?: { sec: Seconds; pace: number } } {
  const l = slots.long;
  if (l === null || l.wanted <= 0 || l.def === null || l.pace === undefined) return {};
  return { block: { sec: l.wanted, pace: l.pace } };
}

/** Nedelje sa najvećim udelom dugog kod malog obima (S3): najduži dugi namere u gradnji/vrhu, kasnije prvo. */
function highShareWeeks(weeks: readonly PlanWeek[], data: DistanceData): Set<number> {
  const n = data.safety.longShareLowVolume?.peakWeeks ?? 0;
  const list = weeks
    .filter((w) => (w.intent.kind === 'build' || w.intent.kind === 'peak') && w.intent.long !== null)
    .sort(
      (a, b) =>
        (b.intent.long?.lenPct ?? 0) - (a.intent.long?.lenPct ?? 0) || b.index - a.index
    );
  return new Set(list.slice(0, n).map((w) => w.index));
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
  let lastFullVolume: number = header.decisions.baseVolumeMin ?? header.decisions.baseLoad;
  let previousRamped = false;
  let rampSeen = false;
  /* E9: brz rad vršne nedelje (merilo silaska intenziteta) */
  let peakFast = 0;
  const taperAcc = { count: 0, fast: 0 };
  let previousHard: IsoDate | null = null;
  /* Provera forme koja je pala u pauzu ili rampu: čeka prvu nedelju posle rampe (R9). */
  let pendingTest: Extract<Recipe, { type: 'test' }> | null = null;
  let pendingFrom: IsoDate | null = null;
  const lastThree = <T>(list: readonly T[]): T[] => list.slice(Math.max(0, list.length - 3));
  const high = highShareWeeks(doc.weeks, data);

  const weeks = doc.weeks.map((week): PlanWeek => {
    const ramped = underRamp(week.start, adjustments);
    const forced = ramped ? null : pendingTest;
    const slots = weekSlots(
      week,
      span,
      ctx,
      slotCounter(doc.weeks, week.index),
      forced,
      previousHard,
      pendingFrom
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
      /* Posle rampe povratka lanac rasta kreće od odrađenih nedelja posle nje, ne od baze pre pauze (S9). */
      const fallback = recent.length < 3 && !(rampSeen && recent.length > 0);
      const baseVolume = header.decisions.baseVolumeMin ?? header.decisions.baseLoad;
      const m = Math.max(...recent, ...(fallback ? [baseVolume] : []));
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
          previousLong,
          highShare: high.has(week.index),
          builds: buildsBefore(doc.weeks, week.index),
          ...blockOf(slots)
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
          previousLong,
          highShare: high.has(week.index),
          builds: buildsBefore(doc.weeks, week.index),
          ...blockOf(slots)
        })
      };
    }
    previousTarget = fullTarget;
    const volumeMin = Math.round(plannedMin(shell.targetLoad) * 10) / 10;
    const recipes = taperIntensity(
      layoutWeek({ ...shell, volumeMin }, ctx, slots, previousEasy),
      span,
      peakFast,
      ctx,
      taperAcc
    );
    if (week.intent.kind === 'peak') peakFast = Math.max(peakFast, recipeSums(recipes, ctx).fastSec);
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
    const rawDays = week.days.map((day): PlanDay => {
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
        /* S9 (krug 4): u ponovnom planiranju sitna razlika (< 1 km i < 10 %, ista vrsta i isti trening) ne pravi
           izmenu — nema repa ± 0,5 km nedeljama posle događaja. */
        const minor =
          opts.fresh !== true &&
          day.workout !== null &&
          workout !== null &&
          !adjustments.some((a) => a.kind === 'repeat' && a.dayId === day.id) &&
          minorChange(day.workout, workout, ctx);
        if (!minor && !sameWorkout(workout, day.workout)) {
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
        /* S9: najranije 10 dana posle kraja rampe povratka — ne kao pun napor odmah posle rampe */
        let end: IsoDate | null = null;
        for (const adj of adjustments) {
          const w = adjustmentWindow(adj);
          if (w !== null && w.from <= day.date && day.date <= w.rampEnd && (end === null || w.rampEnd > end))
            end = w.rampEnd;
        }
        pendingFrom = end === null ? null : addDays(end, RETURN_TEST_AFTER_RAMP_DAYS);
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
    const days = shortenLong(rawDays, week, header, state.today, done, ctx, opts);
    const built: PlanWeek = {
      index: week.index,
      start: week.start,
      intent: week.intent,
      targetLoad: shell.targetLoad,
      longSec: shell.longSec,
      volumeMin,
      days
    };
    /* Nedelje koje seku pauzu ili rampu ne ulaze u pravilo rasta (drugi krug): povratak određuje samo rampa. */
    if (!ramped) {
      const totals = weekTotals(built, header, state, ctx);
      /* Krug 4 (S2): obim u lancu rasta = km u minutima laganog tempa (minuti kvaliteta nose više km; pravilo
         „+ 8 % ili + 3 km" je pravilo kilometara). */
      const volume = (totals.km * ctx.pace.paces.easy) / 60;
      volumes.push(volume);
      /* E1 (krug 5): merilo povratka je poslednja PUNA nedelja gradnje — ne lanča se preko rasterećenja */
      if (fraction >= 1 && week.intent.kind !== 'recovery') lastFullVolume = volume;
      longs.push(longAsDecided ? Math.max(shell.longSec, totals.longSec) : totals.longSec);
    }
    previousRamped = ramped;
    if (ramped) rampSeen = true;
    previousLong = shell.longSec;
    return built;
  });
  return { ...doc, weeks };
}
