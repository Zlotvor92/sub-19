/* V4 — JEDAN PROLAZ KROZ NEDELJE (SPEC § 6.2 k. 5–8, § 6.4). `plan` i `replan` zovu isti prolaz:
   cilj nedelje → dugi → budžet brzog rada → lagani dani → spremnost. Svaka veličina ima jednu funkciju-vlasnika;
   nema petlje „skrati pa dopuni". Dan se uvek gradi iz namere nedelje + `header.decisions` (§ 1.3). */
import {
  EASY_FLOOR_MIN_RUN_DAYS,
  EASY_FLOOR_OVER_TARGET,
  QUALITY_MIN_WORK_SEC,
  QUALITY_SHORTEN_STEP_SEC,
  LONG_BLOCK_MIN_WEEK_SHARE,
  VOLUME_ROOM_OVER,
  RACE_CALM_DAYS,
  RACE_EVE_MAX_SEC,
  RACE_NO_LONG_DAYS,
  RETURN_TEST_AFTER_RAMP_DAYS,
  AFTER_GOAL_RACE_LONG_SHARE,
  GOAL_RACE_EFFORT_SHARE,
  LATE_PAUSE_SHARPEN_MAX_SEC,
  MOVED_TEST_MIN_DAYS_BEFORE_RACE,
  NO_TEST_AFTER_RACE_DAYS,
  RESTORE_PEAK_AFTER_DAYS,
  RETURN_FIRST_LONG_SHARE,
  RETURN_LONG_JUMP_SEC,
  RETURN_LONG_JUMP_SHARE,
  RP_TEST_GAP_DAYS,
  TAPER_BLOCK_SHARE,
  RETURN_WEEK_MAX_OVER_LAST,
  TAPER_ADDON_MIN_EASY_SEC,
  AFTER_TEST_EASY_MAX_OF_LONG,
  AFTER_TEST_SPREAD_MAX_SEC
} from './constants';
import { addDays, diffDays, mondayOf, weekdayOf } from './dates';
import {
  assignDays,
  easyOverPrevious,
  easyShareOfLong,
  longShareFor,
  longStepOf,
  levelMinEasy,
  longEasyFloor,
  minEasyOf,
  runStreak,
  minRampOf,
  taperEasyMax
} from './decide';
import { doneIds } from './done';
import { paceCtxOf, stepsCost, summarize, type WorkoutSummary, zonePace } from './load';
import {
  adjustmentWindow,
  afterRace,
  anyCauseIn,
  applyReadiness,
  inReturn,
  modsFor,
  PLAIN_LONG,
  rampOf,
  recipeKey,
  RETURN_SCHEDULE_FIRST_LONG_SHARE,
  returnWeekNo,
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
  /** R8 t. 13: višak km kvaliteta (minuti laganog tempa) — ulazi u pravilo rasta, koje je pravilo km. */
  kmExtra?: number;
  /** Prva nedelja posle rampe povratka: najveći obim u minutima (R9); `null` = bez uslova. */
  returnCap?: number | null;
  /** M7 (krug 5): silazak obima — najveći obim nedelje prema vršnoj nedelji; `null` = bez uslova. */
  taperCap?: number | null;
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
): { full: LoadPoints; target: LoadPoints; kmCut: number } {
  const s = ctx.data.safety;
  let kmCut = 0;
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
    /* R8 t. 13: pravilo rasta je u km — minuti nedelje + višak km kvaliteta ≤ pravilo */
    const kmOver = input.previousTarget === null ? 0 : (input.kmExtra ?? 0);
    const minutes = Math.min(wanted, rule);
    /* R8 t. 13: cilj (i budžet kvaliteta) ostaje; višak km kvaliteta preko pravila skida se sa laganih minuta */
    kmCut = Math.max(0, minutes + kmOver - rule);
    full = minutes + extra;
  }
  if (intent.kind === 'recovery' && input.previousTarget !== null && ctx.template !== null) {
    full = Math.min(full, ctx.template.recovery.loadFactor * input.previousTarget);
  }
  if (input.returnCap !== undefined && input.returnCap !== null) {
    /* S9/E1: obim (km nedelje) ≤ poslednja puna nedelja gradnje pre pauze × 1,10; kvalitet ide preko (R5) */
    full = Math.min(full, input.returnCap + extra);
  }
  if (input.taperCap !== undefined && input.taperCap !== null) {
    full = Math.min(full, input.taperCap + extra);
  }
  return { full, target: Math.round(full * input.fraction), kmCut: kmCut * input.fraction };
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
    /** R19 (stavka 2a): koraka dugog do nedelje najdužeg dugog (uključujući ovu); 0 = posle nje. */
    toPeak?: number;
  }
): Seconds {
  /* krug 15 (M10): trka na dan dugog — te nedelje nema dugog */
  if (intent.long === null || intent.long.race !== undefined) return 0;
  const d = ctx.decisions;
  const step = longStepOf(ctx.data.safety, ctx.pace.paces.easy);
  /* R19 (stavka 2a): kad lestvica sa korakom iz podataka ne stiže do dugog za distancu (`minLongKm`) do nedelje
     najdužeg dugog, korak raste koliko treba, najviše `LONG_STEP_STRETCH` × korak (zaokruživanje dana na 0,5 km tada
     ne prelazi korak + 0,5 km) */
  let grownStep = step;
  if (
    week?.toPeak !== undefined &&
    week.toPeak > 0 &&
    previousLongest > 0 &&
    (intent.kind === 'build' || intent.kind === 'peak')
  ) {
    /* cilj je dugi provere `dugi-za-distancu` (km u laganom tempu, ne duže od plafona dugog) */
    const a = ctx.data.adequate;
    const target = Math.min((a.longCheckKm ?? a.minLongKm) * ctx.pace.paces.easy, d.longMaxSec);
    const t = week.toPeak;
    /* korak raste što kasnije: tek kad ni uz veći korak u ostalim nedeljama ova ne sme da ostane na osnovnom */
    const late = previousLongest + step + (t - 1) * LONG_STEP_STRETCH * step < target;
    if (previousLongest + t * step < target && late)
      grownStep = Math.min((target - previousLongest) / t, LONG_STEP_STRETCH * step);
  }
  /* D1/D6 (krug 5): dugi raste od prethodnog (ne skače na polazni kad je krenuo niže) */
  /* R20 B1: prvi dugi plana ≤ najduži iz istorije + 2 km */
  const grown =
    previousLongest > 0
      ? previousLongest + grownStep
      : Math.min(d.longStartSec + grownStep, d.longFirstCapSec ?? Number.POSITIVE_INFINITY);
  let wanted = intent.long.lenPct * d.longMaxSec;
  if (week !== undefined && (intent.kind === 'build' || intent.kind === 'peak')) {
    /* D1/D6 (krug 5): dugi ne kreće na plafonu — pod je `longStartFloorShare` × polazni, pa raste za korak po
       nedelji gradnje do polaznog (bez podatka: odmah polazni) */
    const full = Math.min(d.longStartSec, d.longMaxSec);
    /* P2 (krug 5): 85 % samo kad je polazni dugi na plafonu (≥ `longStartFloorFromCapShare` × najduži dozvoljeni);
       inače stabilan trkač kreće od onoga što već trči */
    /* T7 (krug 6): polazni dugi iz stvarnih trčanja nije procena — dugi kreće od njega (P3 B) */
    const atCap =
      d.longStartFromRuns !== true &&
      d.longStartSec >= (ctx.data.safety.longStartFloorFromCapShare ?? 0) * d.longMaxSec;
    const startFloor = atCap ? ctx.data.safety.longStartFloorShare : undefined;
    /* posle polaznog pod raste dalje pola koraka po nedelji gradnje (D1 dopuna: p04 1 h 50 → 2 h 10) */
    /* D6: sa malo dana pod ne raste do polaznog — dugi prati nameru šablona (p08: 20,5+ km samo u završnici) */
    const few = ctx.decisions.runDays.length < (ctx.data.safety.longFloorGrowMinRunDays ?? 0);
    const n = few ? 0 : (week.builds ?? 0);
    const start = startFloor === undefined ? full : startFloor * full;
    const reach = step > 0 ? Math.max(0, Math.ceil((full - start) / step)) : 0;
    /* Y3 (krug 7): ni trkač čiji polazni dugi nije na plafonu ne stoji na polaznom — od 3. nedelje gradnje pod raste
       pola koraka po nedelji (P3 A), kad podaci distance to dozvoljavaju nivou (`longGrowPastStart`) */
    const floor =
      startFloor === undefined
        ? growPast(ctx)
          ? Math.min(d.longMaxSec, full + (Math.max(0, n - 1) * step) / 2)
          : full
        : Math.min(
            d.longMaxSec,
            n <= reach || !growPast(ctx)
              ? Math.min(full, start + n * step)
              : full + ((n - reach) * step) / 2
          );
    wanted = Math.max(wanted, floor);
  }
  let cap = Number.POSITIVE_INFINITY;
  if (week !== undefined) {
    const weekKm = (week.plannedMin * 60) / ctx.pace.paces.easy;
    const share = longShareFor(
      ctx.data.safety,
      d.level,
      week.runDays,
      weekKm,
      week.highShare === true
    );
    /* E7 (krug 5): udeo je u KM — km nedelje se procenjuju iz minuta u laganom tempu (donja procena), a blok u
       dugom nosi više km od istog vremena lagano, pa se njegov višak oduzima. */
    const easy = ctx.pace.paces.easy;
    const blockKm =
      week.block === undefined ? 0 : week.block.sec * (1 / week.block.pace - 1 / easy);
    cap = Math.max(0, share * weekKm - blockKm) * easy;
    /* R8 t. 15: blok u dugom (višak km) ne spušta plafon dugog ispod donjeg udela vremena nedelje */
    if (week.block !== undefined) {
      const minShare = ctx.data.safety.longBlockMinWeekShare ?? LONG_BLOCK_MIN_WEEK_SHARE;
      /* nedelja traje najmanje koliko planirani minuti, ili ostali dani na najkraćem laganom trajanju */
      const others =
        (Math.max(0, week.runDays - 1) * minEasyOf(ctx.data.safety, d.level, d.runDays.length)) /
        60;
      const weekMin = Math.max(week.plannedMin, others / (1 - minShare));
      /* dugi je zadat dužinom: brži blok skraćuje vreme za isti km, pa se višak km bloka dodaje */
      cap = Math.max(cap, Math.min(d.longMaxSec, minShare * weekMin * 60 + blockKm * easy));
    }
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
  if (
    wave !== undefined &&
    week !== undefined &&
    atCap &&
    previousLongest > 0 &&
    sec <= previousLongest + 60
  )
    sec *= wave;
  /* Dugi nije kraći od najkraćeg smislenog trčanja (krug 3, S13). */
  return Math.max(
    minEasyOf(ctx.data.safety, ctx.decisions.level, ctx.decisions.runDays.length),
    Math.round(sec / 60) * 60
  );
}

/** R19 (stavka 2a): najveće povećanje koraka dugog kad lestvica inače ne stiže do dugog za distancu. */
const LONG_STEP_STRETCH = 1.15;

/** R19 (stavka 2a): broj nedelja gradnje/vrha sa dugim od `index` do nedelje najdužeg dugog (najveći `lenPct` pre
    sužavanja, poslednja pri jednakim); 0 posle nje. */
function longStepsToPeak(weeks: readonly PlanWeek[], index: number): number {
  const grows = (w: PlanWeek): boolean =>
    (w.intent.kind === 'build' || w.intent.kind === 'peak') &&
    w.intent.long !== null &&
    w.intent.long.race === undefined;
  let peak: PlanWeek | null = null;
  for (const w of weeks)
    if (
      grows(w) &&
      (peak === null || (w.intent.long?.lenPct ?? 0) >= (peak.intent.long?.lenPct ?? 0))
    )
      peak = w;
  if (peak === null || index > peak.index) return 0;
  return weeks.filter((w) => w.index >= index && w.index <= (peak?.index ?? 0) && grows(w)).length;
}

/** Najkraće zagrevanje i hlađenje iz podataka (`warmupCooldown`). */
function shortestWuCd(ctx: BuildCtx): { warmupSec: Seconds; cooldownSec: Seconds } {
  const wc = ctx.data.safety.warmupCooldown;
  const shortest = wc.reduce(
    (m, x) => (x.warmupSec + x.cooldownSec < m.warmupSec + m.cooldownSec ? x : m),
    wc[0] ?? { warmupSec: ctx.decisions.warmupSec, cooldownSec: ctx.decisions.cooldownSec }
  );
  return { warmupSec: shortest.warmupSec, cooldownSec: shortest.cooldownSec };
}

/** A1 (krug 9): skraćivanje treninga koji ne staje — prvo najkraće zagrevanje/hlađenje iz podataka (`warmupCooldown`),
    pa doza korak po korak do najmanje smislene (≥ `QUALITY_MIN_WORK_SEC` i najmanji oblik; manji unos istog
    podražaja kad treba). `null` kad ni tako ne staje. */
function shrinkQuality(
  item: Extract<SlotItem, { kind: 'quality' }>,
  dose: Seconds,
  ctx: BuildCtx,
  fits: (cost: WorkoutSummary) => boolean
): { recipe: Recipe; cost: WorkoutSummary } | null {
  const wuCd = shortestWuCd(ctx);
  const floor = Math.max(ctx.data.safety.minDoseSec, QUALITY_MIN_WORK_SEC);
  for (let d = dose; d >= floor; d -= QUALITY_SHORTEN_STEP_SEC) {
    let def = item.def;
    if (d < minDoseOf(def, ctx)) {
      const smaller = pickDef(item.slot, d, ctx, { noHighImpact: false });
      if (smaller === null || smaller.stimulus !== def.stimulus || d < minDoseOf(smaller, ctx))
        break;
      def = smaller;
    }
    const recipe: Recipe = { type: 'quality', def, dose: d, slot: item.slot, wuCd };
    const cost = summarize(realize(recipe, ctx), ctx.pace);
    if (fits(cost)) return { recipe, cost };
  }
  return null;
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
      /** R8 t. 3: `dosePct` mesta iz šablona — nosi ga i zamenski podražaj. */
      dosePct?: number;
      /** Krug 15 (M4): mesto ostaje u nameri nedelje (cilj i obim se ne menjaju), ali se trening ne zadaje — dan je
          lagan (predug niz dana trčanja sa dugim). */
      skip?: boolean;
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
  forcedFrom: IsoDate | null = null,
  /** P3 (krug 5): oznake kvaliteta prethodnih nedelja (poslednja na kraju) — za `safety.tagMaxRun`. */
  previousTags: ReadonlyArray<ReadonlySet<string>> = [],
  /** Krug 10: pred trkom nema rasterećenja za pomerenu proveru — ide u prvu pogodnu nedelju (ne briše se). */
  forcedAnyWeek = false,
  /** R19: pomerena provera ne ide posle ovog dana (posle kratke pauze najviše 2 nedelje od prvobitnog dana). */
  forcedUntil: IsoDate | null = null
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
  if (longWd !== null && intent.long !== null && intent.long.race === undefined) {
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
  /* krug 15 (M4): brzi treninzi koji bi napravili predug niz sa dugim — otpadaju posle izbora, ako nedelji ostaje bar
     jedan drugi brz trening */
  const streakDates = new Set<IsoDate>();
  /* krug 16 (M23): pravilo godina skinulo je brz trening — nedelja dobija dodatak (ubrzanja) na dan pred dugi */
  let gapSkipped = false;
  intent.stimuli.forEach((st, k) => {
    const wd = qualityDays[k];
    if (wd === undefined || !runDays.includes(wd) || wd === longWd || dateOf(wd) >= calmFrom)
      return;
    if (hardBefore !== null && dateOf(wd) === addDays(hardBefore, 1)) return;
    if (st.onlyByFeel === true && !ctx.pace.paces.byFeel) return;
    /* krug 15 (M4): brz trening ne pravi niz dužih od `maxConsecutiveWithHard` dana trčanja zaredom sa dugim (provera
       forme i dodatak se ne broje); pravilo ima smisla samo uz bar dva dana odmora (sa 6–7 dana niz je neizbežan) */
    const maxRun = ctx.data.safety.maxConsecutiveWithHard;
    const longStreak =
      maxRun !== undefined &&
      maxRun.levels.includes(d.level) &&
      longWd !== null &&
      !race &&
      d.runDays.length <= 5
        ? runStreak(d.qualityDays.slice(0, 2), wd, longWd)
        : null;
    const tooLong =
      longStreak !== null && longStreak.hasLong && longStreak.len > (maxRun?.days ?? 7);
    /* krug 11 (stavka 19): stariji trkač — brzi treninzi nedelje bar `qualityMinGapDays` dana razmaka */
    const gapDays = d.qualityMinGapDays;
    if (
      gapDays !== undefined &&
      !race &&
      items.some(
        (x) =>
          (x.kind === 'quality' || x.kind === 'test') &&
          Math.abs(diffDays(x.date, dateOf(wd))) < gapDays
      )
    ) {
      gapSkipped = true;
      return;
    }
    const slot: SlotRef = {
      place: 'quality',
      stimulus: st.stimulus,
      index: slotIndex('quality', st.stimulus),
      phase: intent.phase,
      ...(st.workoutId === undefined ? {} : { workoutId: st.workoutId })
    };
    let wanted = slotDose(slot, st.dosePct, intent.kind, ctx);
    let def = pickDef(slot, wanted > 0 ? wanted : null, ctx, { noHighImpact: cautious });
    if (def === null) return;
    /* P3 (krug 5): oznaka (npr. brdo) najviše `max` od `window` nedelja zaredom — inače zamenski podražaj */
    for (const rule of ctx.data.safety.tagMaxRun ?? []) {
      if (!def.tags.includes(rule.tag)) continue;
      const recent = previousTags.slice(-(rule.window - 1)).filter((t) => t.has(rule.tag)).length;
      if (recent < rule.max) continue;
      /* indeks zamenskog podražaja (prvi trening zone ≤ 70 % plafona, K7) */
      const alt: SlotRef = {
        ...slot,
        stimulus: rule.replacement,
        index: slotIndex('quality', rule.replacement),
        workoutId: undefined
      };
      const altWanted = slotDose(alt, undefined, intent.kind, ctx);
      const altDef = pickDef(alt, altWanted > 0 ? altWanted : null, ctx, {
        noHighImpact: cautious
      });
      if (
        altDef !== null &&
        !altDef.tags.includes(rule.tag) &&
        altDef.main.kind !== 'add-on' &&
        altDef.main.kind !== 'all-out'
      ) {
        def = altDef;
        wanted = altWanted;
      }
    }
    const date = dateOf(wd);
    if (def.main.kind === 'add-on') {
      items.push({ kind: 'addon', date, def });
      return;
    }
    if (tooLong && def.main.kind !== 'all-out') streakDates.add(date);
    if (def.main.kind === 'all-out') {
      items.push({ kind: 'test', date, def, slot });
      return;
    }
    const zone = mainZone(def.main);
    if (zone === null) return;
    items.push({
      kind: 'quality',
      date,
      def,
      slot,
      wanted,
      extra: extraWeight(zone, ctx),
      ...(st.dosePct === undefined ? {} : { dosePct: st.dosePct })
    });
  });

  if (streakDates.size > 0 && items.some((x) => x.kind === 'quality' && !streakDates.has(x.date))) {
    for (let i = 0; i < items.length; i += 1) {
      const x = items[i];
      if (x !== undefined && x.kind === 'quality' && streakDates.has(x.date))
        items[i] = { ...x, skip: true };
    }
    /* smena podražaja: svake druge nedelje preostali dan nosi podražaj izostavljenog (raznovrsnost, R16) */
    const odd = Math.floor(diffDays(week.start, mondayOf(span.startDate)) / 7) % 2 === 1;
    const kept = items.findIndex((x) => x.kind === 'quality' && x.skip !== true);
    const gone = items.findIndex((x) => x.kind === 'quality' && x.skip === true);
    const a = items[kept];
    const b = items[gone];
    if (odd && a !== undefined && b !== undefined && a.kind === 'quality' && b.kind === 'quality') {
      items[kept] = { ...b, date: a.date, skip: false };
      items[gone] = { ...a, date: b.date, skip: true };
    }
  }
  if (gapSkipped && longWd !== null && !items.some((x) => x.kind === 'addon')) {
    const before = ((longWd + 6) % 7) as Weekday;
    const date = dateOf(before);
    const addon = ctx.data.library.find(
      (x) => x.main.kind === 'add-on' && x.impact !== 'visok' && x.kind === 'easy'
    );
    if (
      addon !== undefined &&
      runDays.includes(before) &&
      date < calmFrom &&
      !items.some((x) => x.date === date)
    )
      items.push({ kind: 'addon', date, def: addon });
  }
  /* krug 15 (M10): trka ili provera na dan dugog (pripremna trka) — prvo mesto nedelje */
  const raceOnLong = intent.long?.race;
  if (raceOnLong !== undefined && longWd !== null) {
    const slot: SlotRef = {
      place: 'quality',
      stimulus: raceOnLong.stimulus,
      index: slotIndex('quality', raceOnLong.stimulus),
      phase: intent.phase,
      ...(raceOnLong.workoutId === undefined ? {} : { workoutId: raceOnLong.workoutId })
    };
    const def = pickDef(slot, null, ctx, { noHighImpact: false });
    if (def !== null && def.main.kind === 'all-out')
      items.unshift({ kind: 'test', date: dateOf(longWd), def, slot });
  }
  /* D8 (dopuna kruga 4): kad su prag i tempo trke skoro isti tempo (< `minZoneGapSecPerKm`), ne zadaju se kao dva
     podražaja u istoj nedelji — prag otpada, tempo trke ostaje */
  const gap = ctx.data.safety.minZoneGapSecPerKm;
  if (gap !== undefined && Math.abs(ctx.pace.paces.T - ctx.pace.paces.RP) < gap) {
    /* M2 (krug 5): samo u nedelji sa tempom trke USRED nedelje; P4: prag se ne briše nego postaje drugi podražaj
       (`safety.zoneGapReplacement`, npr. intervali), da nedelja zadrži dva kvaliteta */
    const hasRp = items.some((x) => x.kind === 'quality' && mainZone(x.def.main) === 'RP');
    if (hasRp) {
      const repl = ctx.data.safety.zoneGapReplacement;
      for (let i = items.length - 1; i >= 0; i -= 1) {
        const x = items[i];
        if (x === undefined || x.kind !== 'quality' || mainZone(x.def.main) !== 'T') continue;
        const slot: SlotRef =
          repl === undefined ? x.slot : { ...x.slot, stimulus: repl, workoutId: undefined };
        /* R8 t. 3: zamena nosi `dosePct` originala (mala doza praga u N−2/N−1 ostaje mala) */
        const wanted = repl === undefined ? 0 : slotDose(slot, x.dosePct, intent.kind, ctx);
        const def =
          repl === undefined
            ? null
            : pickDef(slot, wanted > 0 ? wanted : null, ctx, { noHighImpact: cautious });
        const zone = def === null ? null : mainZone(def.main);
        if (
          def !== null &&
          zone !== null &&
          def.main.kind !== 'add-on' &&
          def.main.kind !== 'all-out'
        )
          items[i] = {
            kind: 'quality',
            date: x.date,
            def,
            slot,
            wanted,
            extra: extraWeight(zone, ctx),
            ...(x.dosePct === undefined ? {} : { dosePct: x.dosePct })
          };
        else items.splice(i, 1);
      }
    }
  }
  /* Pomerena provera forme: na mesto prvog kvaliteta; nedelja koja već ima proveru ostaje kakva je. */
  const movable = week.intent.kind !== 'taper' && week.intent.kind !== 'race';
  if (forcedTest !== null && movable && !items.some((x) => x.kind === 'test')) {
    /* E3 (krug 5): pomerena provera ne ide u ± 2 dana od treninga u tempu trke (ni bloka u dugom) */
    const rpItem = (x: SlotItem): boolean => x.kind === 'quality' && mainZone(x.def.main) === 'RP';
    const rpDates = [
      ...items.filter(rpItem).map((x) => x.date),
      ...(long !== null &&
      long.wanted > 0 &&
      long.def !== null &&
      mainZone(long.def.main) === 'RP' &&
      longWd !== null
        ? [dateOf(longWd)]
        : [])
    ];
    /* R18 (stavka 3, M5): pomerena provera ne zamenjuje trening u tempu trke — ide na mesto prvog drugog kvaliteta,
       a bez njega na lagan dan nedelje (ne uz tempo trke i ne na dan dugog) */
    const otherQ = items.findIndex((x) => x.kind === 'quality' && !rpItem(x));
    const easyDay = runDays
      .map((x) => dateOf(x))
      .find(
        (x) =>
          !items.some((y) => y.date === x) &&
          (longWd === null || x !== dateOf(longWd)) &&
          !rpDates.some((r) => Math.abs(diffDays(r, x)) <= RP_TEST_GAP_DAYS)
      );
    const at = otherQ;
    const wd = qualityDays[0];
    const date =
      at >= 0
        ? items[at]?.date
        : items.some((x) => x.kind === 'quality') || wd === undefined
          ? easyDay
          : dateOf(wd);
    const replaced = at >= 0 ? items[at] : undefined;
    const replacesOnlyRp = replaced !== undefined && rpItem(replaced);
    const nearRp =
      date !== undefined &&
      rpDates.some((x) => x !== replaced?.date && Math.abs(diffDays(x, date)) <= RP_TEST_GAP_DAYS);
    /* M4 (krug 5): pomerena provera ide u prvo RASTEREĆENJE posle prozora izmene, najkasnije 3 nedelje pred trku;
       bez takve nedelje otpada (plan to kaže) */
    const restWeek =
      (week.intent.kind === 'recovery' || forcedAnyWeek) &&
      date !== undefined &&
      date <= addDays(span.raceDate, -MOVED_TEST_MIN_DAYS_BEFORE_RACE);
    const usable =
      date !== undefined &&
      restWeek &&
      date < calmFrom &&
      (forcedFrom === null || date >= forcedFrom) &&
      (forcedUntil === null || date <= forcedUntil) &&
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
  /* M7 (krug 5): kalendarska nedelja dve pred nedeljom trke — najviše `weekMinus2MaxQuality` brzih treninga
     (blok u dugom se broji); otpadaju poslednji po važnosti */
  const tq = ctx.data.safety.taper?.calendarMinus2MaxQuality;
  const raceMonday = mondayOf(span.raceDate);
  if (tq !== undefined && week.start === addDays(raceMonday, -14)) {
    const room = tq - (long !== null && long.wanted > 0 ? 1 : 0);
    /* T6 (krug 6): prednost ima tempo trke (nedelja −2 nosi tempo trke, ne intervale; p05 N14) */
    const rp = (x: SlotItem): number =>
      x.kind === 'quality' && mainZone(x.def.main) === 'RP' ? 1 : 0;
    const keep = new Set(
      items
        .filter((x) => x.kind === 'quality')
        .sort((a, b) => rp(b) - rp(a))
        .slice(0, Math.max(0, room))
    );
    for (let i = 0; i < items.length; i += 1) {
      const x = items[i];
      if (x === undefined || x.kind !== 'quality' || keep.has(x)) continue;
      items.splice(i, 1);
      i -= 1;
    }
  }
  /* M6 (krug 5): nema kvaliteta 2 dana pre provere forme / trke-testa — taj kvalitet otpada (dan je lagan) */
  const gapDays = ctx.data.safety.noQualityBeforeTestDays ?? 0;
  const tests = items.filter((x) => x.kind === 'test').map((x) => x.date);
  const kept = items.filter(
    (x) => x.kind !== 'quality' || !tests.some((t) => x.date < t && diffDays(t, x.date) <= gapDays)
  );
  return { race, eve, calmFrom, runDays, longWd, long, items: kept };
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
/** R8 t. 13: višak km kvaliteta u minutima laganog tempa — brži rad nosi više km po minutu od laganog, pa pravilo
    rasta (koje je pravilo kilometara, S2) mora da ga vidi pre nego što odredi minute nedelje. */
export function wantedKmExtra(slots: WeekSlots, ctx: BuildCtx): number {
  const easy = ctx.pace.paces.easy;
  const over = (sec: Seconds, pace: number | undefined): number =>
    pace === undefined || pace <= 0 ? 0 : Math.max(0, (sec * (easy / pace - 1)) / 60);
  let minutes = slots.long === null ? 0 : over(slots.long.wanted, slots.long.pace);
  for (const item of slots.items) {
    if (item.kind !== 'quality') continue;
    const zone = mainZone(item.def.main);
    if (zone !== null) minutes += over(item.wanted, zonePace(zone, ctx.pace.paces));
  }
  return minutes;
}

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
    /** Krug 9b (A10 a): lagani dani smeju do ovoga, nijedan se ne izostavlja. */
    floorSec?: Seconds;
    /** Krug 15 (M2, M21): pod laganog dana uz dugi ≥ 90 min (`longEasyFloor`); 0 = bez uslova. */
    longFloorSec?: Seconds;
  },
  dayBeforeLong: IsoDate | null,
  afterQuality: ReadonlySet<IsoDate>,
  ctx: BuildCtx
): Map<IsoDate, Recipe> {
  const out = new Map<IsoDate, Recipe>();
  const longFloor = week.longFloorSec ?? 0;
  const baseMinEasy = minEasyOf(ctx.data.safety, ctx.decisions.level, ctx.decisions.runDays.length);
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
    /* sužavanje: dan sa dodatkom ne prelazi isti dan nedelje pre ni posle zaokruživanja lagani dela na 0,5 km */
    const margin =
      day.tight &&
      day.addon !== null &&
      Number.isFinite(day.cap) &&
      levelMinEasy(ctx.data.safety, ctx.decisions.level, ctx.decisions.runDays.length)
        ? 0.5 * ctx.pace.paces.easy
        : 0;
    /* krug 11 (stavka 16, `easyNotBelowMin`): dan sa dodatkom ceo traje bar `minEasySec` kad plafon dana to dozvoljava */
    const whole =
      ctx.data.safety.easyNotBelowMin === true && day.addon !== null
        ? Math.min(ctx.data.safety.minEasySec - extra, day.cap - extra)
        : 0;
    const sec = Math.max(Math.min(wanted, day.cap - extra - margin), whole);
    const least = day.tight ? Math.min(minEasy, TAPER_ADDON_MIN_EASY_SEC) : minEasy;
    if (day.addon !== null && day.addon.type === 'addon' && sec >= least) {
      out.set(day.date, { ...day.addon, sec, ...capOf(day) });
    } else {
      out.set(day.date, {
        type: 'easy',
        sec: Math.min(wanted, day.cap),
        ...capOf(day),
        ...(longFloor > 0 ? { minSec: longFloor } : {})
      });
    }
  };
  let days = [...pool].sort((a, b) => (a.date < b.date ? -1 : 1));
  /* krug 15: pod uz dugi ≥ 90 min važi dokle ga obim nedelje nosi (kvalitet se pre toga skraćuje, `roomFor`) */
  const share = days.length > 0 ? budget(days) / days.length : 0;
  const withFloor = Math.max(baseMinEasy, longFloor);
  /* isto merilo kao za najkraće lagano: svi dani na podu ne dižu nedelju preko cilja za više od 10 % */
  const floorFits =
    days.length > 0 &&
    week.fixedLoad + addons(days) + (days.length * withFloor) / 60 <=
      week.targetLoad * (1 + EASY_FLOOR_OVER_TARGET) &&
    (days.length * withFloor + addonSec(days)) / 60 <=
      week.leftVolumeMin * (1 + EASY_FLOOR_OVER_TARGET);
  const minEasy = floorFits ? withFloor : Math.max(baseMinEasy, Math.min(longFloor, share));
  if (week.floorSec !== undefined && days.length > 0 && budget(days) / days.length < minEasy) {
    const per = Math.round(Math.max(week.floorSec, budget(days) / days.length) / 60) * 60;
    for (const day of days) put(day, per);
    return out;
  }
  if (days.length > 0 && budget(days) / days.length < minEasy) {
    if (week.runDays >= EASY_FLOOR_MIN_RUN_DAYS) {
      /* M5 (krug 5): nivo sa najkraćim laganim po nivou meri i obim (minuti) — dan otpada kad najkraći lagani dani
         ne staju u obim nedelje */
      const byVolume = levelMinEasy(
        ctx.data.safety,
        ctx.decisions.level,
        ctx.decisions.runDays.length
      );
      const over = (list: EasyDay[]): boolean =>
        week.fixedLoad + addons(list) + (list.length * minEasy) / 60 >
          week.targetLoad * (1 + EASY_FLOOR_OVER_TARGET) ||
        (byVolume &&
          (list.length * minEasy + addonSec(list)) / 60 >
            week.leftVolumeMin * (1 + EASY_FLOOR_OVER_TARGET));
      const dropOrder = [
        ...days.filter((d) => !afterQuality.has(d.date)),
        ...days.filter((d) => afterQuality.has(d.date))
      ];
      /* Z8 (krug 7): nivo sa najkraćim laganim po nivou ne gubi dan (traženi dani se poštuju) — lagan dan sme do
         `minEasyFallbackMin` (plan to kaže rečenicom); ostali nivoi kao do sada */
      /* krug 15: pod uz dugi ≥ 90 min ne važi kad ni najkraći lagani dani ne staju u obim (traženi dani ostaju) */
      const fallback = Math.max(
        ctx.data.safety.minEasySec,
        (ctx.data.safety.minEasyFallbackMin ?? 0) * 60
      );
      const least = byVolume ? days.length : 0;
      while (days.length > least && days.length > 0 && over(days)) {
        const drop = dropOrder.shift();
        days = days.filter((d) => d.date !== drop?.date);
      }
      /* sužavanje i nedelja trke: lagan dan ostaje na najkraćem (ne duži od nedelje pre) */
      const calm = byVolume && days.every((d) => d.tight);
      const per =
        byVolume && days.length > 0
          ? calm
            ? minEasy
            : Math.round(Math.min(minEasy, Math.max(fallback, budget(days) / days.length)) / 60) *
              60
          : minEasy;
      for (const day of days) {
        /* Na najkraćem trčanju dodatak ide preko laganog dela; strog plafon važi samo u sužavanju i nedelji trke. */
        /* F4-K2: „preko" samo kad ceo dan (lagano + dodatak) staje pod plafon dana — inače bi lagan dan sa ubrzanjima
           bio duži od dugog u rasterećenju (degenerisan plan) */
        const free = !day.tight && day.cap >= per + addonCost(day).durationSec;
        if (free && !calm && day.addon !== null && day.addon.type === 'addon') {
          out.set(day.date, { ...day.addon, sec: per });
        } else put(day, per);
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
  /** R8 t. 13: lagani minuti koje pravilo rasta u km skida (višak km kvaliteta) — samo sa laganih dana, kvalitet ostaje. */
  kmCutMin?: number;
  /** Krug 9b (A10 a): najkraći lagan dan nedelje sužavanja koja ne sme preći nedelju pre sebe — lagani dani se
      skraćuju do ovoga (`minEasyFallbackMin`), dan se ne izostavlja. */
  easyFloorSec?: Seconds;
  /** Krug 9b (A10 a): najduži lagan dan nedelje silaska (korekcija obima skraćuje lagane dane, cilj ostaje). */
  easyMaxSec?: Seconds;
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
  const share =
    week.intent.kind === 'peak' ? ctx.data.safety.maxFastSharePeak : ctx.data.safety.maxFastShare;
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
    return {
      ...recipe,
      def: steadyLongDef(ctx, null),
      dose: 0,
      sec: Math.round((km * ctx.pace.paces.easy) / 60) * 60
    };
  };
  /* kvalitet postaje lagan dan: kraći za zagrevanje/hlađenje, ne duži od plafona sužavanja ni 60 % dugog te nedelje */
  const longOfWeek = [...out.values()].find((x) => x.type === 'long');
  const longCap = longOfWeek?.type === 'long' ? 0.6 * longOfWeek.sec : Number.POSITIVE_INFINITY;
  const asEasy = (recipe: Recipe): Recipe => ({
    type: 'easy',
    sec: roundMin(
      Math.max(
        minEasyOf(ctx.data.safety, ctx.decisions.level, ctx.decisions.runDays.length),
        Math.min(
          summarize(realize(recipe, ctx), ctx.pace).durationSec - 600,
          taperEasyMax(ctx.data.safety, ctx.decisions.runDays.length),
          longCap
        )
      )
    )
  });
  function roundMin(x: number): number {
    return Math.round(x / 300) * 300;
  }
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
    let room =
      peakFastSec > 0
        ? Math.min(budget - fast, isBlock ? TAPER_BLOCK_SHARE * budget : Number.POSITIVE_INFINITY)
        : Number.POSITIVE_INFINITY;
    /* M9 (krug 5): poslednji dugi pred trku zadržava najmanji blok (`taper.lastLongMinBlockSec`) — i posle bolesti,
       kad je vršna nedelja ponovo izgrađena sa manje brzog rada (s06) */
    const lastBlock = t.lastLongMinBlockSec;
    if (isBlock && lastBlock !== undefined && count < t.weekBeforeMaxQuality)
      room = Math.max(room, Math.min(work, lastBlock));
    if (count >= t.weekBeforeMaxQuality || room < ctx.data.safety.minDoseSec) {
      out.set(date, r.type === 'long' ? plainLong(r) : asEasy(r));
      continue;
    }
    const dose = Math.min(work, room);
    if (dose < work) {
      if (r.type === 'quality') {
        /* krug 5 (p04): skraćena doza ispod najmanje za unos — manji unos istog podražaja, inače lagan dan po
           pravilu sužavanja (ne lagan dan punog trajanja kvaliteta) */
        let def = r.def;
        if (dose < minDoseOf(def, ctx)) {
          const smaller = pickDef(r.slot, dose, ctx, { noHighImpact: false });
          if (
            smaller !== null &&
            smaller.stimulus === def.stimulus &&
            dose >= minDoseOf(smaller, ctx)
          )
            def = smaller;
        }
        if (dose < minDoseOf(def, ctx)) {
          out.set(date, asEasy(r));
          continue;
        }
        out.set(date, { ...r, def, dose });
      }
      if (r.type === 'long') out.set(date, { ...r, dose });
    }
    count += 1;
    /* ostvaren rad (zaokruženje na komad) — da granica važi za ono što trkač trči; višak zaokruženja se skida */
    let real = realize(out.get(date) ?? r, ctx);
    const cur = out.get(date) ?? r;
    if (real !== null && real.workSec > room && (cur.type === 'quality' || cur.type === 'long')) {
      const less = Math.max(0, cur.dose - (real.workSec - room) - 60);
      const next: Recipe =
        less < ctx.data.safety.minDoseSec ||
        (cur.type === 'quality' && less < minDoseOf(cur.def, ctx))
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
  maxWorkMin: number | null,
  /** Krug 15 (M20): bez izostavljanja laganog dana za drugi kvalitet (kad bi nedelja ispala manja od obima). */
  noSecondDrop = false
): Map<IsoDate, Recipe> {
  const { decisions: d, data } = ctx;
  const s = data.safety;
  const { intent } = week;
  const dateOf = (wd: number): IsoDate => addDays(week.start, wd);
  const out = new Map<IsoDate, Recipe>();
  for (let wd = 0; wd < 7; wd += 1) out.set(dateOf(wd), REST);

  const { eve, runDays } = slots;
  const longWd = week.longSec > 0 ? slots.longWd : null;
  /* krug 15 (M2, M21): uz dugi ≥ 90 min lagan dan ima pod (kvalitet se pre toga skraćuje, `roomFor`) */
  /* silazak (nedelje −2 i −1) ima svoj pod (`easyFloorSec`) — tamo obim mora da padne; raspodela bez promene obima
     (`balanceEasy`) i dalje važi */
  const longFloor =
    longWd === null || week.easyFloorSec !== undefined
      ? 0
      : longEasyFloor(d, week.longSec, ctx.pace.paces.easy);
  const easyLeast = Math.max(minEasyOf(s, d.level, d.runDays.length), longFloor);
  const budget = fastBudget(
    week.targetLoad,
    intent.kind === 'peak' ? s.maxFastSharePeak : s.maxFastShare,
    maxWorkMin
  );
  const sharp = s.sharpening;
  /* D7 (krug 5): plafon rada jedne zone nedeljno (tempo trke uklj. blok u dugom) po nivou */
  const zoneCap = s.weeklyZoneMaxSec;
  let zoneLeft =
    zoneCap === undefined
      ? Number.POSITIVE_INFINITY
      : (zoneCap.byLevel[d.level] ?? Number.POSITIVE_INFINITY);
  const inZone = (def: WorkoutDef | null): boolean =>
    zoneCap !== undefined && def !== null && mainZone(def.main) === zoneCap.zone;
  let longZoneSec = 0;
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
        if (inZone(def)) {
          zoneLeft -= dose;
          longZoneSec = dose;
        }
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
  /* krug 15: `withFloor` — merilo sa podom laganog dana uz dugi ≥ 90 min (samo za kraće zagrevanje/hlađenje;
     kvalitet ima prednost nad podom, pa se zbog njega ne skraćuje doza ni ne izbacuje trening) */
  const roomFor = (date: IsoDate, load: LoadPoints, sec: Seconds, withFloor = false): boolean => {
    const lf = withFloor ? longFloor : 0;
    const room = placedQuality === 0 ? EASY_FLOOR_OVER_TARGET : VOLUME_ROOM_OVER;
    const rest = runDays.map((wd) => dateOf(wd)).filter((x) => x !== date && !fixed.has(x));
    const minEasy = Math.max(
      week.easyFloorSec ?? minEasyOf(s, ctx.decisions.level, ctx.decisions.runDays.length),
      lf
    );
    /* M5 (krug 5): nivo sa najkraćim laganim po nivou — kvalitet ostaje, a otpada jedan lagan dan (dan manje uz
       rečenicu „dan-izostavljen"), dok ostaju bar dva lagana dana */
    /* Z8 (krug 7): nivo sa najkraćim laganim po nivou meri pod laganih dana na `minEasyFallbackMin` (dan se ne ispušta) */
    const fallback = Math.max(s.minEasySec, (s.minEasyFallbackMin ?? 0) * 60, lf);
    const spare =
      week.easyFloorSec === undefined &&
      levelMinEasy(s, ctx.decisions.level, ctx.decisions.runDays.length)
        ? (rest.length * Math.max(0, minEasy - fallback)) / 60
        : 0;
    const floor = rest.reduce((sum, x) => sum + minEasy / 60 + addonLoad(x), 0) - spare;
    /* i obim (minuti): kvalitet sa zagrevanjem i hlađenjem ne sme da digne nedelju preko pravila rasta (S2) */
    /* krug 15: uz pod dugog i lagani minuti koje pravilo rasta u km skida (`kmCutMin`) — inače kvalitet stane, a
       lagan dan padne ispod poda */
    const volume =
      week.volumeMin === undefined
        ? Number.POSITIVE_INFINITY
        : week.volumeMin - (lf > 0 ? (week.kmCutMin ?? 0) : 0);
    const floorMin = rest.reduce((sum, x) => sum + (minEasy + addonSec(x)) / 60, 0) - spare;
    /* Kad ni najkraći lagani dani ne staju u obim (mnogo dana, mali obim), važi samo provera bodova. */
    const fits = fixedSec / 60 + floorMin + minEasy / 60 <= volume * (1 + EASY_FLOOR_OVER_TARGET);
    return (
      fixedLoad + load + floor <= week.targetLoad * (1 + EASY_FLOOR_OVER_TARGET) &&
      (!fits || (fixedSec + sec) / 60 + floorMin <= volume * (1 + room))
    );
  };
  /* Kad u obim staje samo jedan od dva kvaliteta, parne nedelje prednost daju drugom — da nedelje ne nose isti
     trening iz nedelje u nedelju (smena podražaja; krug 4). */
  const order = [...slots.items];
  const qi = order.flatMap((x, i) => (x.kind === 'quality' && x.skip !== true ? [i] : []));
  const [a, b] = qi;
  if (a !== undefined && b !== undefined && keepDays && week.index % 2 === 0) {
    const secOf = (x: SlotItem): Seconds =>
      x.kind === 'quality'
        ? summarize(
            realize({ type: 'quality', def: x.def, dose: x.wanted, slot: x.slot }, ctx),
            ctx.pace
          ).durationSec
        : 0;
    const others = runDays.filter((wd) => !fixed.has(dateOf(wd))).length - 2;
    const both =
      (fixedSec + secOf(order[a] as SlotItem) + secOf(order[b] as SlotItem)) / 60 +
      (Math.max(0, others) * minEasyOf(s, ctx.decisions.level, ctx.decisions.runDays.length)) / 60;
    if (both > (week.volumeMin ?? Number.POSITIVE_INFINITY) * (1 + VOLUME_ROOM_OVER)) {
      const first = order[a] as SlotItem;
      order[a] = order[b] as SlotItem;
      order[b] = first;
    }
  }
  const unplaced: { item: Extract<SlotItem, { kind: 'quality' }>; dose: Seconds }[] = [];
  for (let item of order) {
    if (item.date === (longWd === null ? null : dateOf(longWd))) continue;
    if (item.kind === 'quality' && item.skip === true) continue;
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
    /* M1 (krug 5): ostatak ispod `minLeftSec` (15 min) — cela doza ide u zamenski podražaj pune doze */
    const minLeft = Math.max(minDoseOf(item.def, ctx), zoneCap?.minLeftSec ?? 0);
    /* krug 5 (P1 → p04): dugi već nosi blok iste zone, a plafon seče i ovaj trening — nedelja bi imala dva ista
       podražaja, pa i tada ide zamenski podražaj pune doze */
    const clippedTwice = longZoneSec > 0 && zoneLeft < item.wanted;
    if (
      inZone(item.def) &&
      (zoneLeft < minLeft || clippedTwice) &&
      zoneCap?.fallbackStimulus !== undefined
    ) {
      /* pun dozni korak (M1: „prag pune doze") */
      const full: SlotRef = {
        place: 'quality',
        stimulus: zoneCap.fallbackStimulus,
        index: 99,
        phase: item.slot.phase
      };
      const wanted = slotDose(full, undefined, intent.kind, ctx);
      /* T6 (krug 6): oblik zamenskog treninga se menja iz nedelje u nedelju (3 × 12 → 2 × 18 → komad), doza ostaje
         puna — indeks unosa prati mesto u šablonu */
      const slot: SlotRef = { ...full, index: item.slot.index };
      const def = pickDef(slot, wanted > 0 ? wanted : null, ctx, { noHighImpact: false });
      const zone = def === null ? null : mainZone(def.main);
      /* zamena dva puta isečene zone samo kad nosi više rada od ostatka zone */
      const gains = zoneLeft < minLeft || wanted > zoneLeft;
      if (
        gains &&
        def !== null &&
        zone !== null &&
        def.main.kind !== 'add-on' &&
        def.main.kind !== 'all-out'
      )
        item = { ...item, def, slot, wanted, extra: extraWeight(zone, ctx) };
    }
    let dose = Math.min(
      budget.take(item.wanted, item.extra),
      inZone(item.def) ? zoneLeft : Number.POSITIVE_INFINITY
    );
    /* krug 5 (p08): kad budžet nedelje skrati dozu ispod najmanje za izabrani unos, bira se unos istog podražaja
       koji tu dozu nosi (2 × 7 umesto 3 × …) — kvalitet ne otpada zbog izbora unosa */
    if (dose < minDoseOf(item.def, ctx) && dose > 0) {
      const smaller = pickDef(item.slot, dose, ctx, { noHighImpact: false });
      if (
        smaller !== null &&
        smaller.stimulus === item.def.stimulus &&
        dose >= minDoseOf(smaller, ctx)
      ) {
        const zone = mainZone(smaller.main);
        if (zone !== null) {
          item = { ...item, def: smaller, extra: extraWeight(zone, ctx) };
          dose = Math.min(dose, inZone(smaller) ? zoneLeft : Number.POSITIVE_INFINITY);
        }
      }
    }
    if (dose < minDoseOf(item.def, ctx)) continue;
    let recipe: Recipe = { type: 'quality', def: item.def, dose, slot: item.slot };
    let cost = summarize(realize(recipe, ctx), ctx.pace);
    /* krug 15: uz pod laganog dana (dugi ≥ 90 min) trening prvo dobija najkraće zagrevanje i hlađenje, iste doze */
    if (keepDays && longFloor > 0 && !roomFor(item.date, cost.load, cost.durationSec, true)) {
      const short: Recipe = { ...recipe, wuCd: shortestWuCd(ctx) };
      const shortCost = summarize(realize(short, ctx), ctx.pace);
      if (
        shortCost.durationSec < cost.durationSec &&
        roomFor(item.date, shortCost.load, shortCost.durationSec, true)
      ) {
        recipe = short;
        cost = shortCost;
      }
    }
    if (keepDays && !roomFor(item.date, cost.load, cost.durationSec)) {
      /* A1 (krug 9): trening koji ne staje uz tražene dane — (1) najkraće zagrevanje i hlađenje iz podataka, (2) kraća
         doza do najmanje smislene; (3) izostavljen lagan dan i (4) brisanje dolaze posle petlje */
      const fit = shrinkQuality(item, dose, ctx, (c) => roomFor(item.date, c.load, c.durationSec));
      if (fit === null) {
        unplaced.push({ item, dose });
        continue;
      }
      recipe = fit.recipe;
      cost = fit.cost;
      dose = fit.recipe.type === 'quality' ? fit.recipe.dose : dose;
      if (fit.recipe.type === 'quality' && fit.recipe.def !== item.def) {
        const zone = mainZone(fit.recipe.def.main);
        if (zone !== null) item = { ...item, def: fit.recipe.def, extra: extraWeight(zone, ctx) };
      }
    }
    budget.book(dose, item.extra);
    if (inZone(item.def)) zoneLeft -= dose;
    fix(item.date, recipe);
    placedQuality += 1;
  }

  /* A1 (3): nedelja gradnje/vrha bez ijednog kvaliteta — izostavlja se jedan lagan dan (rečenica „dan-izostavljen")
     da prvi trening stane; (4) tek kad ni tada ne staje, kvalitet otpada */
  const first = unplaced[0];
  const buildWeek = intent.kind === 'build' || intent.kind === 'peak';
  /* krug 15 (M20): kvalitet ima prednost nad laganim danom na podu — i DRUGI kvalitet nedelje gradnje/vrha dobija
     mesto izostavljanjem jednog laganog dana, kad su lagani dani na najkraćem (ostatak obima po danu ispod najkraćeg
     laganog) */
  /* lagani dani kakvi bi bili bez drugog kvaliteta (i njegov dan je tada lagan) */
  const restDays = runDays.filter((wd) => !fixed.has(dateOf(wd))).length;
  const perEasy =
    restDays > 0 && week.volumeMin !== undefined
      ? (week.volumeMin - fixedSec / 60) / restDays
      : Number.POSITIVE_INFINITY;
  const easyAtFloor = keepDays && perEasy * 60 < minEasyOf(s, d.level, d.runDays.length);
  const secondQuality =
    !noSecondDrop && buildWeek && placedQuality === 1 && week.easyFloorSec === undefined;
  let secondDropped = false;
  /* krug 9b (A10 a): u silasku (nedelja pod granicom silaska) dan se ne izostavlja */
  if (
    first !== undefined &&
    ((buildWeek && placedQuality === 0 && week.easyFloorSec === undefined) ||
      (easyAtFloor && secondQuality))
  ) {
    const longDay = longWd === null ? null : dateOf(longWd);
    const free = runDays
      .map((wd) => dateOf(wd))
      .filter((x) => !fixed.has(x) && x !== first.item.date && x !== longDay);
    const drop = free[free.length - 1];
    if (drop !== undefined && free.length >= 2) {
      fixed.set(drop, { type: 'rest' });
      /* doza kakva je (i ispod praga skraćivanja), pa kraće zagrevanje/hlađenje, pa kraća doza */
      const asIs = (wuCd?: { warmupSec: Seconds; cooldownSec: Seconds }) => {
        const recipe: Recipe = {
          type: 'quality',
          def: first.item.def,
          dose: first.dose,
          slot: first.item.slot,
          ...(wuCd === undefined ? {} : { wuCd })
        };
        const cost = summarize(realize(recipe, ctx), ctx.pace);
        return first.dose >= minDoseOf(first.item.def, ctx) &&
          roomFor(first.item.date, cost.load, cost.durationSec)
          ? { recipe, cost }
          : null;
      };
      const fit =
        asIs() ??
        asIs(shortestWuCd(ctx)) ??
        shrinkQuality(first.item, first.dose, ctx, (c) =>
          roomFor(first.item.date, c.load, c.durationSec)
        );
      if (fit === null) fixed.delete(drop);
      else {
        if (placedQuality === 1) secondDropped = true;
        const zone = fit.recipe.type === 'quality' ? mainZone(fit.recipe.def.main) : null;
        budget.book(
          fit.recipe.type === 'quality' ? fit.recipe.dose : 0,
          zone === null ? first.item.extra : extraWeight(zone, ctx)
        );
        fix(first.item.date, fit.recipe);
        placedQuality += 1;
      }
    }
  }
  /* krug 15 (M20): lagani dani na najkraćem — ostatak obima po slobodnom danu ispod najkraćeg laganog */
  const easyAtFloorNow = (): boolean => {
    if (!keepDays || week.volumeMin === undefined) return false;
    let sec = 0;
    for (const r of fixed.values()) sec += summarize(realize(r, ctx), ctx.pace).durationSec;
    const free = runDays.filter((wd) => !fixed.has(dateOf(wd))).length;
    return free > 0 && (week.volumeMin * 60 - sec) / free < minEasyOf(s, d.level, d.runDays.length);
  };
  /* A1 (krug 9) + R8 t. 15: dugi sa blokom ≥ donji udeo OSTVARENE nedelje (kvalitet i najkraći lagani dani su sada
     poznati) — duži dugi, plafon dugog važi */
  if (longWd !== null && week.longSec > 0) {
    const lr = fixed.get(dateOf(longWd));
    if (lr !== undefined && lr.type === 'long' && lr.dose > 0) {
      const minShare = s.longBlockMinWeekShare ?? LONG_BLOCK_MIN_WEEK_SHARE;
      const minEasyNow = minEasyOf(s, ctx.decisions.level, ctx.decisions.runDays.length);
      let otherSec = 0;
      for (const [date, r] of fixed)
        if (date !== dateOf(longWd)) otherSec += summarize(realize(r, ctx), ctx.pace).durationSec;
      const easyLeft = runDays.filter((wd) => !fixed.has(dateOf(wd))).length;
      otherSec += easyLeft * minEasyNow;
      const longNow = summarize(realize(lr, ctx), ctx.pace).durationSec;
      /* koliko ostali dani smeju da traju da dugi nosi donji udeo; višak skida poslednji kvalitet nedelje (ne prvi),
         do najmanje smislene doze — dugi i obim nedelje se ne dižu */
      const allowed = (longNow * (1 - minShare)) / minShare;
      const qualityDates = [...fixed.entries()]
        .filter(([, r]) => r.type === 'quality')
        .map(([date]) => date)
        .sort();
      const lastQ = qualityDates.length >= 2 ? qualityDates[qualityDates.length - 1] : undefined;
      const qr = lastQ === undefined ? undefined : fixed.get(lastQ);
      if (otherSec > allowed && lastQ !== undefined && qr !== undefined && qr.type === 'quality') {
        const qSec = summarize(realize(qr, ctx), ctx.pace).durationSec;
        const target = qSec - (otherSec - allowed);
        const fit = shrinkQuality(
          { kind: 'quality', date: lastQ, def: qr.def, slot: qr.slot, wanted: qr.dose, extra: 0 },
          qr.dose - QUALITY_SHORTEN_STEP_SEC,
          ctx,
          (c) => c.durationSec <= target
        );
        /* ni najmanja doza ne ostavlja dugom donji udeo: poslednji kvalitet otpada (A1 korak 4), dan je lagan —
           krug 15 (M20): osim kad je to drugi kvalitet nedelje, a lagani dani su na najkraćem: tada otpada blok u dugom
           (dugi je lagan), a kvalitet ostaje */
        if (fit !== null) fixed.set(lastQ, fit.recipe);
        else if (qualityDates.length === 2 && easyAtFloorNow())
          fixed.set(dateOf(longWd), { ...lr, def: steadyLongDef(ctx, null), dose: 0 });
        else fixed.delete(lastQ);
      }
    }
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
      /* krug 9b (A10 a): u sužavanju i nedelji trke ni najkraće ne duže od najdužeg laganog dana nedelje pre (kad je
         ona skraćena do `minEasyFallbackMin`) */
      const least = easyLeast;
      cap = Math.max(
        cap,
        calm && previous !== null
          ? Math.min(least, previous.byWeekday.get(wd) ?? previous.max)
          : least
      );
      if (week.easyMaxSec !== undefined) cap = Math.min(cap, week.easyMaxSec);
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
        week.volumeMin === undefined
          ? Number.POSITIVE_INFINITY
          : week.volumeMin - fixedSec / 60 - (week.kmCutMin ?? 0),
      ...(week.easyFloorSec === undefined ? {} : { floorSec: week.easyFloorSec }),
      longFloorSec: longFloor
    },
    dayBeforeLong,
    afterQuality,
    ctx
  );
  for (const [date, recipe] of filled) out.set(date, recipe);
  /* T6 (krug 6): vršna nedelja nije ispod polaznog obima (p08: 3 dana, dugi na plafonu) — lagani dani rastu preko
     udela dugog tačno koliko treba */
  const baseVolume = d.baseVolumeMin ?? d.baseLoad;
  if (
    s.peakNotBelowBase === true &&
    intent.kind === 'peak' &&
    baseVolume !== undefined &&
    filled.size > 0
  ) {
    let km = 0;
    for (const r of out.values()) {
      const w = realize(r, ctx);
      if (w !== null) km += summarize(w, ctx.pace).km;
    }
    const baseKm = (baseVolume * 60) / ctx.pace.paces.easy;
    const missing = baseKm - km;
    /* samo mali manjak (≤ 10 % polaznog), lagan dan najviše 15 % preko svog plafona */
    if (missing > 0 && missing <= 0.1 * baseKm) {
      const per = (missing * ctx.pace.paces.easy + 0.5 * ctx.pace.paces.easy) / filled.size;
      /* lagan dan ne prelazi udeo dugog za ovaj broj dana (+ 2 %) */
      const most =
        realLong > 0
          ? (easyShareOfLong(s, d.runDays.length) + 0.02) * realLong
          : Number.POSITIVE_INFINITY;
      for (const [date, recipe] of filled) {
        if (recipe.type !== 'easy' && recipe.type !== 'addon') continue;
        const sec = Math.round(Math.max(recipe.sec, Math.min(recipe.sec + per, most)) / 60) * 60;
        if (recipe.type === 'easy') out.set(date, { type: 'easy', sec });
        else out.set(date, { ...recipe, sec, maxSec: undefined });
      }
    }
  }
  /* krug 15 (M20): izostavljen lagan dan ne sme da spusti nedelju ispod prethodne (preostali lagani dani su na
     plafonu dana, pa bi sledeća nedelja bila skok) — tada nedelja ostaje sa jednim kvalitetom i svim danima */
  if (secondDropped && previous !== null) {
    let sec = 0;
    for (const r of out.values())
      if (r.type !== 'rest') sec += summarize(realize(r, ctx), ctx.pace).durationSec;
    let before = 0;
    for (const x of previous.byWeekday.values()) before += x;
    if (sec < before - 60) return layoutOnce(week, ctx, slots, previous, maxWorkMin, true);
  }
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

/** Ključ treninga: vrsta, podražaj i zona rada (Z3: „prvi rad zone posle bola" vidi i blok u dugom). */
function seenKey(workout: Workout | null, ctx: BuildCtx): string | null {
  if (workout === null || workout.stimulus === null) return null;
  const def = ctx.data.library.find((x) => x.id === workout.libraryId);
  const zone = def === undefined ? '' : (mainZone(def.main) ?? '');
  if (workout.kind === 'quality' || workout.kind === 'test')
    return `quality:${workout.stimulus}@${zone}`;
  if (workout.kind === 'long' && workout.workSec > 0) return `long:${workout.stimulus}@${zone}`;
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
/** R19 (stavka 1): granica obima nedelje u rasporedu povratka (km u minutima laganog tempa) i dugog; `null` van
    rasporeda. */
function returnWeekCap(
  weekStart: IsoDate,
  adjustments: readonly Adjustment[],
  ctx: BuildCtx
): { volume: number; longSec: Seconds; first: boolean } | null {
  let cap: { volume: number; longSec: Seconds; first: boolean } | null = null;
  for (const adj of adjustments) {
    const ramp = rampOf(adj);
    const sch = ramp?.schedule;
    if (ramp === null || sch === undefined || ramp.days <= 0) continue;
    const end = addDays(ramp.zero, ramp.days);
    if (addDays(weekStart, 6) <= ramp.zero || weekStart > end) continue;
    const k = returnWeekNo(weekStart, sch);
    const share = sch.shares[k - 1];
    if (share === undefined) continue;
    const volume = (share * sch.refKm * ctx.pace.paces.easy) / 60;
    const longSec =
      sch.refLongSec <= 0
        ? Number.POSITIVE_INFINITY
        : k === 1
          ? RETURN_SCHEDULE_FIRST_LONG_SHARE * sch.refLongSec
          : sch.refLongSec;
    cap =
      cap === null
        ? { volume, longSec, first: k === 1 && sch.noFirstQuality }
        : {
            volume: Math.min(cap.volume, volume),
            longSec: Math.min(cap.longSec, longSec),
            first: cap.first || (k === 1 && sch.noFirstQuality)
          };
  }
  return cap;
}

/** R19 (stavka 1): lagani dani nedelje povratka rastu po 5 min (najkraći prvi) dok nedelja ne stigne cilj (km);
    lagan dan ne prelazi najduži lagan dan prvobitne nedelje ni dugi − 5 min. */
function fillReturnWeek(
  days: PlanDay[],
  rebuilt: ReadonlySet<DayId>,
  targetKm: number,
  week: PlanWeek,
  header: PlanHeader,
  ctx: BuildCtx
): PlanDay[] {
  const secOf = (w: Workout | null): Seconds =>
    w === null ? 0 : summarize(w, ctx.pace).durationSec;
  const kmOf = (ds: readonly PlanDay[]): number =>
    ds.reduce((sum, d) => sum + (d.workout === null ? 0 : summarize(d.workout, ctx.pace).km), 0);
  const eve = addDays(header.goal.raceDate, -1);
  const long = secOf(days.find((d) => d.workout?.kind === 'long')?.workout ?? null);
  const planMax = Math.max(
    0,
    ...week.days.map((d) => (d.workout?.kind === 'easy' ? secOf(d.workout) : 0))
  );
  let out = [...days];
  for (let guard = 0; guard < 40 && kmOf(out) < targetKm - 0.75; guard += 1) {
    let pick = -1;
    let pickSec = Number.POSITIVE_INFINITY;
    out.forEach((d, i) => {
      if (!rebuilt.has(d.id) || d.date === eve || d.workout?.kind !== 'easy') return;
      const sec = secOf(d.workout);
      const most = Math.min(Math.max(planMax, sec), long > 0 ? long - 300 : planMax);
      if (sec + EASY_FILL_STEP_SEC <= most && sec < pickSec) {
        pick = i;
        pickSec = sec;
      }
    });
    const day = out[pick];
    if (day === undefined) break;
    const workout = realize({ type: 'easy', sec: pickSec + EASY_FILL_STEP_SEC }, ctx);
    if (workout === null) break;
    const next = [...out];
    next[pick] = { ...day, origin: 'template', locked: false, workout };
    if (kmOf(next) > targetKm + 0.25) break;
    out = next;
  }
  return out;
}
const EASY_FILL_STEP_SEC = 300;
/** R19: najveće pomeranje provere forme posle kratke pauze (dana). */
const RETURN_TEST_MAX_SHIFT_DAYS = 14;

/** Z2 (krug 7): provera ili kvalitet koji otpadne (spremnost, rampa) postaje lagan dan ≤ udela dugog te nedelje
    (65 %), ne dužine dugog (s14 ned 8, s05 ned 8, s16). Meri se prema KONAČNOM dugom nedelje. */
function capDroppedDays(
  days: PlanDay[],
  recipes: ReadonlyMap<IsoDate, Recipe>,
  week: PlanWeek,
  header: PlanHeader,
  today: IsoDate,
  done: ReadonlySet<DayId>,
  ctx: BuildCtx
): PlanDay[] {
  const long = days.find((d) => d.workout?.kind === 'long')?.workout ?? null;
  if (long === null) return days;
  const s = ctx.data.safety;
  const most = Math.max(
    minEasyOf(s, ctx.decisions.level, ctx.decisions.runDays.length),
    Math.round(
      (easyShareOfLong(s, ctx.decisions.runDays.length) * summarize(long, ctx.pace).durationSec) /
        300
    ) * 300
  );
  return days.map((d) => {
    const was = recipes.get(d.date)?.type;
    void week;
    if (
      (was !== 'test' && was !== 'quality') ||
      d.workout?.kind !== 'easy' ||
      !isMutable(d, header, today, done)
    )
      return d;
    if (summarize(d.workout, ctx.pace).durationSec <= most + 60) return d;
    const workout = realize({ type: 'easy', sec: most }, ctx);
    return workout === null ? d : { ...d, workout };
  });
}

/** Krug 15 (M26): lagan dan nije duži od dugog nedelje (ni po trajanju ni po km) — jedini vlasnik ovog pravila na
    kraju prolaza; dan koji je duži se skraćuje na dužinu dugog (zaokruživanje naniže). */
function easyNotOverLong(days: PlanDay[], rebuilt: ReadonlySet<DayId>, ctx: BuildCtx): PlanDay[] {
  const long = days.find((d) => d.workout?.kind === 'long')?.workout;
  if (long == null) return days;
  const l = summarize(long, ctx.pace);
  return days.map((d): PlanDay => {
    if (!rebuilt.has(d.id) || d.workout?.kind !== 'easy') return d;
    const e = summarize(d.workout, ctx.pace);
    if (e.durationSec <= l.durationSec + 30 && e.km <= l.km + 0.05) return d;
    const most = Math.min(l.durationSec, l.km * ctx.pace.paces.easy);
    const addon = ctx.data.library.find(
      (x) => x.id === d.workout?.libraryId && x.main.kind === 'add-on'
    );
    const extra = addon === undefined ? 0 : stepsCost(addonSteps(addon), ctx.pace).durationSec;
    const workout = realize(
      addon === undefined
        ? { type: 'easy', sec: Math.floor(most / 60) * 60, maxSec: most }
        : { type: 'addon', def: addon, sec: Math.floor((most - extra) / 60) * 60, maxSec: most },
      ctx
    );
    if (workout === null) return d;
    const w = summarize(workout, ctx.pace);
    if (w.durationSec > l.durationSec + 30 || w.km > l.km + 0.05) return d;
    return { ...d, origin: 'template', locked: false, workout };
  });
}

/** Krug 15 (M2, M21): uz dugi ≥ 90 min lagan dan nije ispod poda (`longEasyFloor`). Važi za dane koje je prolaz
    ponovo gradio (rampa, zaštita posle bola, prozor izmene) — spremnost skraćuje dane po datumu, pa nedelja ima
    neravne lagane dane. Obim nedelje i dugi se ne menjaju: kratki dani dobijaju minute samo od dužih laganih dana
    (do poda). Dan pred trku i dan sa dodatkom se ne diraju. U nedelji koju granica obima seče (silazak, nedelja −1,
    nedelja pomerene provere) ostatak daje i dugi, najviše `BALANCE_LONG_MAX_SHARE` njega. */
const BALANCE_LONG_MAX_SHARE = 0.1;
function balanceEasy(
  days: PlanDay[],
  rebuilt: ReadonlySet<DayId>,
  header: PlanHeader,
  ctx: BuildCtx,
  capped: boolean
): PlanDay[] {
  const longDay = days.find((d) => d.workout?.kind === 'long');
  if (longDay?.workout == null) return days;
  const secOf = (w: Workout): Seconds => summarize(w, ctx.pace).durationSec;
  const longSec = secOf(longDay.workout);
  const floor = longEasyFloor(ctx.decisions, longSec, ctx.pace.paces.easy);
  if (floor <= 0) return days;
  const eve = addDays(header.goal.raceDate, -1);
  const easy = days.filter(
    (d) =>
      rebuilt.has(d.id) &&
      d.date !== eve &&
      d.workout?.kind === 'easy' &&
      d.workout.stimulus === null
  );
  const short = easy.filter((d) => d.workout !== null && secOf(d.workout) < floor - 30);
  if (short.length === 0) return days;
  const step = 300;
  const sec = new Map<DayId, Seconds>(
    easy.map((d) => [d.id, d.workout === null ? 0 : secOf(d.workout)])
  );
  let need = short.reduce((sum, d) => sum + (floor - (sec.get(d.id) ?? 0)), 0);
  /* od najdužih laganih dana iznad poda, po 5 min */
  for (let guard = 0; need > 0 && guard < 50; guard += 1) {
    let pick: DayId | null = null;
    let most = floor + step - 1;
    for (const d of easy) {
      const x = sec.get(d.id) ?? 0;
      if (x > most) {
        most = x;
        pick = d.id;
      }
    }
    if (pick === null) break;
    const give = Math.min(step, need, most - floor);
    sec.set(pick, most - give);
    need -= give;
  }
  let longNext = longSec;
  if (need > 0 && capped && rebuilt.has(longDay.id)) {
    const give = Math.min(need, BALANCE_LONG_MAX_SHARE * longSec);
    longNext = longSec - give;
    need -= give;
  }
  /* obim ostaje: kratki dani dobijaju samo ono što su drugi dali (ravnomerno), ne više */
  const total = short.reduce((sum, d) => sum + (floor - (sec.get(d.id) ?? 0)), 0);
  const got = Math.max(0, total - Math.max(0, need));
  for (const d of short) {
    const was = sec.get(d.id) ?? 0;
    sec.set(d.id, was + (total > 0 ? ((floor - was) * got) / total : 0));
  }
  return days.map((d): PlanDay => {
    if (d.id === longDay.id && longNext < longSec - 30 && d.workout !== null) {
      const w = d.workout;
      const def = ctx.data.library.find((x) => x.id === w.libraryId) ?? steadyLongDef(ctx, null);
      const sec = Math.round(longNext / 60) * 60;
      const workout = realize(
        {
          type: 'long',
          sec,
          def,
          dose: Math.min(w.workSec, Math.floor(sec / 120) * 60),
          slot: null
        },
        ctx
      );
      return workout === null ? d : { ...d, origin: 'template', locked: false, workout };
    }
    const want = sec.get(d.id);
    if (want === undefined || d.workout === null) return d;
    if (Math.abs(want - secOf(d.workout)) < 30) return d;
    const workout = realize(
      {
        type: 'easy',
        sec: Math.round(want / 60) * 60,
        ...(want >= floor ? { minSec: floor } : {})
      },
      ctx
    );
    return workout === null ? d : { ...d, origin: 'template', locked: false, workout };
  });
}

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
  if (share === undefined || ctx.decisions.runDays.length < 4 || week.intent.kind === 'race')
    return days;
  /* samo skraćena nedelja: ponovno planiranje ili nedelja u rampi/zaštiti */
  if (opts.fresh === true && !underRamp(week.start, header.adjustments ?? [])) return days;
  /* R20 (A1): nedelja rasporeda povratka ima svoj plafon dugog (¾ / ceo referentni) — udeo nedelje ga ne spušta */
  if (returnWeekCap(week.start, header.adjustments ?? [], ctx) !== null) return days;
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
  const inWindow =
    opts.window === null || (day.date >= opts.window.from && day.date <= opts.window.to);
  if (!inWindow || !isMutable(day, header, today, done)) return days;
  /* dugi D, ostatak R: D' ≤ share × (R + D') → D' = share × R / (1 − share) */
  const ratio = (share * (total - longKm)) / (1 - share) / longKm;
  const w = day.workout;
  const def = ctx.data.library.find((x) => x.id === w.libraryId) ?? steadyLongDef(ctx, null);
  const sec =
    Math.round(
      Math.max(
        minEasyOf(ctx.data.safety, ctx.decisions.level, ctx.decisions.runDays.length),
        summarize(w, ctx.pace).durationSec * ratio
      ) / 60
    ) * 60;
  /* R2 (krug 6): prvi dugi posle prekida najmanje `RETURN_FIRST_LONG_SHARE` poslednjeg dugog pre njega (s05: 60–65 %,
     ne 46 %) — ne duži od onoga što spremnost dozvoljava */
  const was = summarize(w, ctx.pace).durationSec;
  const before = Math.max(
    0,
    ...(header.adjustments ?? []).map((a) => {
      const win = adjustmentWindow(a);
      const last = 'lastLongSec' in a ? (a.lastLongSec ?? 0) : 0;
      return win !== null && win.from <= day.date && day.date <= win.rampEnd ? last : 0;
    })
  );
  const floor = Math.min(was, Math.round((RETURN_FIRST_LONG_SHARE * before) / 60) * 60);
  const recipe: Recipe = {
    type: 'long',
    sec: Math.max(sec, floor),
    def,
    dose: Math.round(w.workSec * ratio),
    slot: null
  };
  const workout = realize(recipe, ctx);
  const out = [...days];
  out[at] = { ...day, origin: 'template', locked: false, workout };
  return out;
}

/** Da li pod dugog raste i posle polaznog (D1): nivo i broj dana iz `safety.longGrowPastStart`. */
function growPast(ctx: BuildCtx): boolean {
  const g = ctx.data.safety.longGrowPastStart;
  return (
    g !== undefined &&
    ctx.decisions.runDays.length >= g.minRunDays &&
    g.levels.includes(ctx.decisions.level)
  );
}

/** M7 (krug 5): silazak obima po KALENDARSKOJ nedelji — dve nedelje pred nedeljom trke ≤ `weekMinus2MaxOfPeak`,
    nedelja trke (bez trke) ≤ `raceWeekMaxOfPeak` vršne nedelje. */
function taperVolumeCap(
  week: { start: IsoDate },
  span: Span,
  peakVolume: number,
  data: DistanceData
): number | null {
  const t = data.safety.taper;
  if (t === undefined || peakVolume <= 0) return null;
  const raceMonday = mondayOf(span.raceDate);
  if (week.start === raceMonday && t.raceWeekMaxOfPeak !== undefined)
    return t.raceWeekMaxOfPeak * peakVolume;
  if (week.start === addDays(raceMonday, -14) && t.weekMinus2MaxOfPeak !== undefined)
    return t.weekMinus2MaxOfPeak * peakVolume;
  if (week.start === addDays(raceMonday, -7) && t.weekMinus1MaxOfPeak !== undefined)
    return t.weekMinus1MaxOfPeak * peakVolume;
  return null;
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
    .filter(
      (w) => (w.intent.kind === 'build' || w.intent.kind === 'peak') && w.intent.long !== null
    )
    .sort(
      (a, b) => (b.intent.long?.lenPct ?? 0) - (a.intent.long?.lenPct ?? 0) || b.index - a.index
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
  /* R8 t. 11: istrčani dugi poslednje nedelje rampe (ili skraćene nedelje izlaska) — merilo izlaska */
  let exitLong: Seconds | null = null;
  let rampSeen = false;
  /* E9: brz rad vršne nedelje (merilo silaska intenziteta) */
  let peakFast = 0;
  const taperAcc = { count: 0, fast: 0 };
  /* M7: obim vršne nedelje (km u minutima laganog tempa) */
  let peakVolume = 0;
  /* R8 t. 10: najveća puna nedelja gradnje van prozora izmene */
  let fullBuildVolume = 0;
  /* krug 9b (A10 a): obim (km u minutima laganog tempa) prethodne izgrađene nedelje — merilo nedelje −1 */
  let lastBuiltVolume: number | null = null;
  let lastBuiltLong: Seconds = 0;
  let lastBuiltHard: number | null = null;
  /* P3: oznake kvaliteta po nedelji (za `tagMaxRun`) */
  const weekTags: Set<string>[] = [];
  let previousHard: IsoDate | null = null;
  /* Provera forme koja je pala u pauzu ili rampu: čeka prvu nedelju posle rampe (R9). */
  let pendingTest: Extract<Recipe, { type: 'test' }> | null = null;
  let pendingFrom: IsoDate | null = null;
  /** R18: prvobitni dan pomerene provere. */
  let pendingOrigin: IsoDate | null = null;
  /** R19: posle kratke pauze (povratak po nedeljama) provera se pomera najviše 2 nedelje, inače otpada. */
  let pendingUntil: IsoDate | null = null;
  const lastThree = <T>(list: readonly T[]): T[] => list.slice(Math.max(0, list.length - 3));
  const high = highShareWeeks(doc.weeks, data);

  const weeks = doc.weeks.map((week): PlanWeek => {
    const ramped = underRamp(week.start, adjustments);
    if (pendingTest !== null && pendingUntil !== null && week.start > pendingUntil) {
      pendingTest = null;
      pendingUntil = null;
    }
    const forced = ramped ? null : pendingTest;
    /* krug 10: jedina provera se pomera, ne briše — kad do 3 nedelje pred trku nema rasterećenja posle nje */
    const lastTestDay = addDays(span.raceDate, -MOVED_TEST_MIN_DAYS_BEFORE_RACE);
    const recoveryAhead = doc.weeks.some(
      (w) =>
        w.index >= week.index &&
        w.intent.kind === 'recovery' &&
        w.start <= lastTestDay &&
        (pendingFrom === null || addDays(w.start, 6) >= pendingFrom) &&
        (pendingUntil === null || w.start <= pendingUntil)
    );
    /* R19 (stavka 1): povratak posle pauze od 5 do 21 dan po nedeljama — cilj nedelje je udeo referentne nedelje pre
       pauze (75 / 90 % …, nikad iznad plana), dugi prve nedelje ≤ ¾ referentnog, dalje ≤ referentni; prva nedelja se
       slaže bez kvaliteta (lagani dani nose obim, ne kvalitet koji bi spremnost posle skinula) */
    const schedule = returnWeekCap(week.start, adjustments, ctx);
    const planSlots = weekSlots(
      week,
      span,
      ctx,
      slotCounter(doc.weeks, week.index),
      forced,
      previousHard,
      pendingFrom,
      weekTags,
      forced !== null && !recoveryAhead,
      forced === null ? null : pendingUntil
    );
    /* R19: prva nedelja povratka bez kvaliteta, dalje u rasporedu najviše jedan (prvi u nedelji) */
    const firstQuality = planSlots.items.find((x) => x.kind === 'quality');
    const slots: WeekSlots =
      schedule === null
        ? planSlots
        : {
            ...planSlots,
            items: planSlots.items.filter(
              (x) => x.kind !== 'quality' || (!schedule.first && x === firstQuality)
            )
          };
    if (forced !== null && slots.items.some((x) => x.kind === 'test' && x.def === forced.def)) {
      pendingTest = null;
    }
    const fraction = weekFraction(week.start, span, ctx);
    const extra = wantedExtra(slots, ctx);
    const plannedMin = (target: LoadPoints): number => Math.max(0, target - extra * fraction);
    let shell: WeekShell = week;
    let fullTarget: LoadPoints = week.targetLoad;
    /* R8 t. 13: lagani minuti koje pravilo rasta u km skida (višak km kvaliteta) */
    let weekKmCut = 0;
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
          kmExtra: wantedKmExtra(slots, ctx) * fraction,
          returnCap: !ramped && previousRamped ? RETURN_WEEK_MAX_OVER_LAST * lastFullVolume : null,
          taperCap: null
        },
        ctx
      );
      fullTarget = decided.full;
      weekKmCut = decided.kmCut;
      shell = {
        ...week,
        targetLoad: decided.target,
        longSec: longPlan(week.intent, Math.max(0, ...lastThree(longs)), ctx, {
          plannedMin: plannedMin(decided.target),
          runDays: slots.runDays.length,
          previousLong,
          highShare: high.has(week.index),
          builds: buildsBefore(doc.weeks, week.index),
          /* R19 (stavka 2a): samo kratak plan (kraći od provere dugog za distancu) — duži stiže lestvicom */
          ...(doc.weeks.length < (data.adequate.longCheckMinWeeks ?? 0)
            ? { toPeak: longStepsToPeak(doc.weeks, week.index) }
            : {}),
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
          /* R19 (stavka 2a): samo kratak plan (kraći od provere dugog za distancu) — duži stiže lestvicom */
          ...(doc.weeks.length < (data.adequate.longCheckMinWeeks ?? 0)
            ? { toPeak: longStepsToPeak(doc.weeks, week.index) }
            : {}),
          ...blockOf(slots)
        })
      };
    }
    /* R8 t. 11: izlazak iz POČETNE rampe (plan počinje dan posle testa/trke) po pravilu R2 — dugi nedelju za nedeljom
       ≤ + `RETURN_LONG_JUMP_SHARE` ili + `RETURN_LONG_JUMP_SEC` od istrčanog dugog prethodne nedelje */
    let exitCapped = false;
    /* nedelja čiji kraj (dan dugog) prozor prilagođavanja (rampa ili oporavak posle testa/trke) još pokriva */
    /* R18 (stavka 5): oporavak posle TRKE nije povratak posle pauze — izlazak dugog po R2 posle pauze, bola i testa */
    const touched = adjustments.some((adj) => {
      if (adj.kind === 'effort' && adj.race === true) return false;
      const w = adjustmentWindow(adj);
      return w !== null && w.from <= addDays(week.start, 6) && w.rampEnd > addDays(week.start, 6);
    });
    if (!touched && exitLong !== null && exitLong > 0 && shell.longSec > 0) {
      const cap = Math.max(RETURN_LONG_JUMP_SHARE * exitLong, exitLong + RETURN_LONG_JUMP_SEC);
      if (shell.longSec > cap) {
        shell = { ...shell, longSec: Math.round(cap / 60) * 60 };
        exitCapped = true;
      }
    }
    previousTarget = fullTarget;
    const accBefore = { ...taperAcc };
    const lay = (sh: WeekShell, sl: WeekSlots = slots): Map<IsoDate, Recipe> =>
      taperIntensity(
        layoutWeek(
          {
            ...sh,
            volumeMin: Math.round(plannedMin(sh.targetLoad) * 10) / 10,
            kmCutMin: weekKmCut
          },
          ctx,
          sl,
          previousEasy
        ),
        span,
        peakFast,
        ctx,
        taperAcc
      );
    /* krug 9b (A10 a): ni dugi nedelje pred nedeljom trke nije duži od dugog nedelje pre nje */
    if (
      week.start === addDays(mondayOf(span.raceDate), -7) &&
      lastBuiltLong > 0 &&
      shell.longSec > lastBuiltLong
    )
      shell = {
        ...shell,
        /* lagan dan ostaje u udelu dugog (R2a): dugi ne kraći od najdužeg laganog dana nedelje pre / udeo */
        longSec: Math.min(
          shell.longSec,
          Math.ceil(
            Math.max(
              lastBuiltLong,
              minEasyOf(ctx.data.safety, ctx.decisions.level, ctx.decisions.runDays.length),
              (previousEasy?.max ?? 0) /
                easyShareOfLong(ctx.data.safety, ctx.decisions.runDays.length)
            ) / 60
          ) * 60
        )
      };
    /* krug 9b (A10 a): silazak (nedelje −2 i −1) ne izostavlja dan — lagani dani tamo smeju do
       `minEasyFallbackMin` od prvog rasporeda */
    const descent =
      week.start === addDays(mondayOf(span.raceDate), -7) ||
      week.start === addDays(mondayOf(span.raceDate), -14);
    if (descent && week.start >= header.startDate)
      shell = {
        ...shell,
        easyFloorSec: Math.max(
          ctx.data.safety.minEasySec,
          (ctx.data.safety.minEasyFallbackMin ?? 0) * 60
        )
      };
    if (schedule !== null && shell.longSec > schedule.longSec)
      shell = { ...shell, longSec: Math.floor(schedule.longSec / 60) * 60 };
    let recipes = lay(shell);
    /* M7 (krug 5): granica silaska je u km (km u minutima laganog tempa); kvalitet i dugi nose više km po minutu
       od cilja, pa se višak skida JEDNOM sa laganih dana (cilj − višak km × lagan tempo) */
    const m7Cap = taperVolumeCap(week, span, peakVolume, data);
    /* krug 9b (A10 a): sužavanje nije naopako — nedelja pred nedeljom trke ne prelazi nedelju pre nje (kad je ta
       manja zbog izostavljenog dana ili skraćenja, nedelja −1 se skraćuje ispod nje; dan se ne izostavlja) */
    const minusOne =
      week.start === addDays(mondayOf(span.raceDate), -7) && lastBuiltVolume !== null
        ? lastBuiltVolume
        : null;
    /* krug 10: nedelja sa pomerenom proverom forme ne prelazi prvobitnu nedelju (bez nadoknade nabijanjem) */
    const forcedCap =
      forced !== null && opts.fresh !== true
        ? (weekTotals(week, header, state, ctx).km * ctx.pace.paces.easy) / 60
        : null;
    const caps = [m7Cap, minusOne, forcedCap, schedule?.volume ?? null].filter(
      (x): x is number => x !== null
    );
    const capVolume = caps.length === 0 ? null : Math.min(...caps);
    if (capVolume !== null) {
      const measure = (): { over: number; load: number; volume: number } => {
        let km = 0;
        let load = 0;
        for (const [date, r0] of recipes) {
          /* R19: u rasporedu povratka meri se nedelja posle spremnosti (manja doza prvog kvaliteta) */
          const r =
            schedule === null
              ? r0
              : applyReadiness(r0, modsFor(date, causes, seen, recipeKey(r0)), ctx);
          const w = realize(r, ctx);
          if (w === null) continue;
          const c = summarize(w, ctx.pace);
          km += c.km;
          load += c.load;
        }
        /* pola km rezerve: dani se zaokružuju na 0,5 km */
        const volume = ((km + 0.5) * ctx.pace.paces.easy) / 60;
        return { over: volume - capVolume, load, volume };
      };
      /* korak 1: cela nedelja srazmerno (dugi i lagani dani, od OSTVARENOG — lagani dani mogu biti na plafonu dana,
         ispod cilja; udeo dugog ostaje); korak 2: ostatak sa laganih dana; korak 3: kad su lagani dani na
         najmanjem trajanju, ostatak skraćuje dugi */
      const byMinusOne = minusOne !== null && capVolume === minusOne;
      /* krug 9b (A10 a): silazak ne izostavlja dan ni kvalitet — korak koji bi skinuo trčanje ili brz trening se ne
         prihvata */
      const shape = (rs: ReadonlyMap<IsoDate, Recipe>): { runs: number; hard: number } => {
        let runs = 0;
        let hard = 0;
        for (const r of rs.values()) {
          if (r.type === 'rest') continue;
          runs += 1;
          if (r.type === 'quality' || r.type === 'test') hard += 1;
        }
        return { runs, hard };
      };
      const start = { shell, recipes, acc: { ...taperAcc } };
      const startShape = shape(recipes);
      const longFloorOf = (): Seconds => {
        /* F4-K2: korekcija ne spušta dugi ispod najkraćeg smislenog trčanja (inače je lagan dan duži od dugog) */
        /* R8 t. 13: i ne ispod najdužeg laganog dana nedelje (sa dodatkom) + 5 min — dugi ostaje duži i po km */
        let easiest = 0;
        for (const r of recipes.values())
          if (r.type === 'easy' || r.type === 'addon')
            easiest = Math.max(easiest, summarize(realize(r, ctx), ctx.pace).durationSec);
        return shell.longSec > 0
          ? Math.max(
              minEasyOf(ctx.data.safety, ctx.decisions.level, ctx.decisions.runDays.length),
              Math.min(shell.longSec, easiest + 300)
            )
          : 0;
      };
      let lost = false;
      /* R19: u rasporedu povratka dugi je već na svojoj granici — skraćuju se prvo lagani dani */
      const order =
        schedule !== null
          ? (['easy', 'long'] as const)
          : (data.safety.taper?.trimOrder ?? (['scale', 'easy', 'long'] as const));
      /* krug 11: brzi treninzi nedelje na najmanjoj dozi (oštrenje nedelje trke ima svoju dozu) */
      const minDoseSlots = (sl: WeekSlots): WeekSlots =>
        sl.race
          ? sl
          : {
              ...sl,
              items: sl.items.map((x) =>
                x.kind === 'quality'
                  ? { ...x, wanted: Math.min(x.wanted, minDoseOf(x.def, ctx)) }
                  : x
              )
            };
      let trimSlots = slots;
      if (!byMinusOne) {
        for (const step of order) {
          const m = measure();
          if (m.over <= 0) break;
          Object.assign(taperAcc, accBefore);
          const from = Math.min(shell.targetLoad, m.load);
          const f = capVolume / m.volume;
          /* R20 (A1): u drugoj i daljim nedeljama rasporeda dugi ne pada ispod plafona prve (¾ referentnog) — dugi
             posle prekida raste, ne spušta se */
          const longFloor =
            schedule !== null && !schedule.first
              ? Math.max(
                  longFloorOf(),
                  Math.min(shell.longSec, RETURN_SCHEDULE_FIRST_LONG_SHARE * schedule.longSec)
                )
              : longFloorOf();
          /* krug 11: brz trening do najmanje doze (podražaj i dan ostaju), cilj nedelje srazmerno */
          if (step === 'quality') trimSlots = minDoseSlots(trimSlots);
          shell =
            step === 'quality'
              ? { ...shell, targetLoad: Math.max(0, Math.round(from * f)) }
              : step === 'scale'
                ? {
                    ...shell,
                    targetLoad: Math.max(0, Math.round(from * f)),
                    longSec: Math.max(longFloor, Math.round((shell.longSec * f) / 60) * 60)
                  }
                : step === 'easy'
                  ? { ...shell, targetLoad: Math.max(0, Math.round(from - m.over)) }
                  : {
                      ...shell,
                      targetLoad: Math.max(0, Math.round(from - m.over)),
                      longSec: Math.max(
                        longFloor,
                        Math.round((shell.longSec - m.over * 60) / 60) * 60
                      )
                    };
          recipes = lay(shell, trimSlots);
          const now = shape(recipes);
          if (now.runs < startShape.runs || now.hard < startShape.hard) {
            lost = true;
            break;
          }
        }
        /* R19: u rasporedu povratka korak „lagani dani" ne preskače cilj (bodovi i minuti nisu ista mera) — cilj nedelje
           se traži polovljenjem između skraćenog i prvobitnog, najveći koji staje u granicu */
        if (!lost && schedule !== null && measure().over < -1) {
          const keep = { shell, recipes, acc: { ...taperAcc } };
          let lo = shell.targetLoad;
          let hi = start.shell.targetLoad;
          for (let it = 0; it < 7 && hi - lo > 2; it += 1) {
            const mid = Math.round((lo + hi) / 2);
            Object.assign(taperAcc, accBefore);
            const next = { ...shell, targetLoad: mid };
            const rs = lay(next, trimSlots);
            const prev = recipes;
            recipes = rs;
            const m = measure();
            const sh = shape(rs);
            if (m.over <= 0 && sh.runs >= startShape.runs && sh.hard >= startShape.hard) {
              lo = mid;
              keep.shell = next;
              keep.recipes = rs;
              keep.acc = { ...taperAcc };
            } else hi = mid;
            recipes = prev;
          }
          shell = keep.shell;
          recipes = keep.recipes;
          Object.assign(taperAcc, keep.acc);
        }
      }
      if (byMinusOne || lost) {
        /* A10 a: od prvobitnog rasporeda — lagani dani do `minEasyFallbackMin`, pa dugi do najkraćeg smislenog;
           cilj (bodovi) ostaje, pa kvalitet ostaje na svom mestu */
        shell = {
          ...start.shell,
          easyFloorSec: Math.max(
            ctx.data.safety.minEasySec,
            (ctx.data.safety.minEasyFallbackMin ?? 0) * 60
          )
        };
        recipes = start.recipes;
        Object.assign(taperAcc, start.acc);
        /* raspored prihvatljiv: isti dani i kvalitet, dugi duži od laganog dana i po trajanju (blok ga skraćuje) */
        /* nedelja −1 ne nosi više brzih treninga od nedelje pre sebe (višak ide pre skraćenja dugog) */
        const hardWant =
          byMinusOne && lastBuiltHard !== null
            ? Math.min(
                startShape.hard,
                /* krug 10: posle kasne bolesti nedelja −1 zadržava oštrenje i kad −2 nema kvalitet */
                adjustments.some((a) => a.kind === 'pause' && a.rampDays !== undefined)
                  ? Math.max(1, lastBuiltHard)
                  : lastBuiltHard
              )
            : startShape.hard;
        let sl = slots;
        const valid = (rs: ReadonlyMap<IsoDate, Recipe>): boolean => {
          const now = shape(rs);
          let longest = 0;
          let longNow = Number.POSITIVE_INFINITY;
          for (const r of rs.values()) {
            const sec = r.type === 'rest' ? 0 : summarize(realize(r, ctx), ctx.pace).durationSec;
            if (r.type === 'easy' || r.type === 'addon') longest = Math.max(longest, sec);
            if (r.type === 'long') longNow = sec;
          }
          /* brzih treninga ni manje od traženog ni više nego pre koraka (kraći dugi ne otvara mesto novom) */
          return (
            now.runs >= startShape.runs &&
            now.hard >= hardWant &&
            now.hard <= shape(recipes).hard &&
            longNow >= longest + 300
          );
        };
        const attempt = (next: WeekShell, nextSlots: WeekSlots = sl): boolean => {
          const kept = { shell, recipes, acc: { ...taperAcc } };
          Object.assign(taperAcc, accBefore);
          const rs = lay(next, nextSlots);
          if (!valid(rs)) {
            Object.assign(taperAcc, kept.acc);
            return false;
          }
          shell = next;
          recipes = rs;
          sl = nextSlots;
          return true;
        };
        for (let i = 0; i < 2; i += 1) {
          const m = measure();
          if (m.over <= 0) break;
          const easy = [...recipes.values()].filter((r) => r.type === 'easy' || r.type === 'addon');
          if (easy.length === 0) break;
          const longest = Math.max(
            ...easy.map((r) => summarize(realize(r, ctx), ctx.pace).durationSec)
          );
          const next = Math.max(
            shell.easyFloorSec ?? 0,
            Math.floor((longest - (m.over * 60) / easy.length) / 60) * 60
          );
          if (next >= longest || !attempt({ ...shell, easyMaxSec: next })) break;
        }
        /* krug 11: distanca sa korakom `quality` u redosledu — brz trening do najmanje doze pre skidanja treninga i
           skraćenja dugog */
        const qualityFirst =
          order.includes('quality') && order.indexOf('quality') < order.indexOf('long');
        if (qualityFirst && measure().over > 0) attempt(shell, minDoseSlots(sl));
        /* dugi: rez koliko treba, a kad bi bio kraći od laganog dana, upola manji (najviše četiri puta) */
        while (measure().over > 0 && shape(recipes).hard > hardWant) {
          const dates = [...recipes.entries()]
            .filter(([, r]) => r.type === 'quality')
            .map(([date]) => date)
            .sort();
          const last = dates[dates.length - 1];
          if (last === undefined) break;
          const fewer: WeekSlots = {
            ...sl,
            items: sl.items.filter((x) => !(x.kind === 'quality' && x.date === last))
          };
          if (!attempt(shell, fewer)) break;
        }
        let cut = measure().over * 60;
        for (let i = 0; i < 6 && measure().over > 0 && cut >= 60; i += 1) {
          const longSec = Math.max(longFloorOf(), Math.round((shell.longSec - cut) / 60) * 60);
          if (longSec >= shell.longSec) break;
          if (attempt({ ...shell, longSec })) cut = measure().over * 60;
          else cut /= 2;
        }
        if (order.includes('quality') && !qualityFirst && measure().over > 0)
          attempt(shell, minDoseSlots(sl));
        if (order.includes('quality') && measure().over > 0) {
          /* krug 11 (`quality` u redosledu): na kraju i najkraće zagrevanje i hlađenje iz podataka (isto kao kad
             trening ne staje uz tražene dane) */
          const wc = ctx.data.safety.warmupCooldown;
          const shortest = wc.reduce(
            (m, x) => (x.warmupSec + x.cooldownSec < m.warmupSec + m.cooldownSec ? x : m),
            wc[0] ?? { warmupSec: ctx.decisions.warmupSec, cooldownSec: ctx.decisions.cooldownSec }
          );
          const short = new Map(
            [...recipes].map(([date, r]): [IsoDate, Recipe] => [
              date,
              r.type === 'quality' && !sl.race
                ? {
                    ...r,
                    wuCd: { warmupSec: shortest.warmupSec, cooldownSec: shortest.cooldownSec }
                  }
                : r
            ])
          );
          if (measure().over > 0 && valid(short)) recipes = short;
        }
      }
      /* krug 16 (odluka organizatora, izuzetak od A10 a): nedelja trke i nedelja pred njom koje ni na najkraćim
         laganim danima ne silaze do granice — lagani dani redom postaju odmor (pre skraćenja dugog), dok ostaju bar dva trčanja */
      const lastTwo =
        week.start === mondayOf(span.raceDate) ||
        week.start === addDays(mondayOf(span.raceDate), -7);
      for (let k = 0; lastTwo && k < 3 && measure().over > 0; k += 1) {
        const easyDates = [...recipes.entries()]
          .filter(([date, r]) => r.type === 'easy' && date < addDays(span.raceDate, -1))
          .map(([date]) => date)
          .sort();
        const runs = [...recipes.values()].filter((r) => r.type !== 'rest').length;
        const first = easyDates[0];
        if (first === undefined || runs < 3) break;
        const next = new Map(recipes);
        next.set(first, REST);
        recipes = next;
      }
      /* dugi skraćen silaskom dobija nazad prostor koji je oslobodio izostavljen dan (ne preko prvobitnog) */
      if (lastTwo && measure().over < 0) {
        const startLong = [...start.recipes.values()].find((r) => r.type === 'long');
        const nowEntry = [...recipes.entries()].find(([, r]) => r.type === 'long');
        if (startLong?.type === 'long' && nowEntry !== undefined && nowEntry[1].type === 'long') {
          const [date, now] = nowEntry;
          const room = -measure().over * 60;
          const sec = Math.min(startLong.sec, now.sec + room);
          if (sec > now.sec + 60) {
            const next = new Map(recipes);
            next.set(date, { ...now, sec: Math.floor(sec / 60) * 60 });
            recipes = next;
          }
        }
      }
    }
    /* krug 10 (stavka 5): posle trke na ciljnoj dužini (pun napor ≥ 80 % današnjeg vremena trke) dugi u drugoj
       nedelji ≤ `AFTER_GOAL_RACE_LONG_SHARE` planiranog, a nikad kraći od najdužeg laganog dana + 5 min */
    {
      const goalRace = adjustments.find(
        (a) =>
          a.kind === 'effort' &&
          a.planned !== true &&
          a.durationSec >= GOAL_RACE_EFFORT_SHARE * header.form.current.raceTimeSec &&
          /* R20 (A1): trka sa rasporedom povratka — nedelje drži raspored (jedan vlasnik odluke) */
          rampOf(a)?.schedule === undefined &&
          week.start > addDays(a.date, 7) &&
          week.start <= addDays(a.date, 14)
      );
      if (goalRace !== undefined) {
        let easiest = 0;
        let longDate: IsoDate | null = null;
        for (const [date, r] of recipes) {
          if (r.type === 'easy' || r.type === 'addon')
            easiest = Math.max(easiest, summarize(realize(r, ctx), ctx.pace).durationSec);
          if (r.type === 'long') longDate = date;
        }
        const lr = longDate === null ? undefined : recipes.get(longDate);
        if (longDate !== null && lr !== undefined && lr.type === 'long') {
          const cap = Math.max(
            Math.round((AFTER_GOAL_RACE_LONG_SHARE * lr.sec) / 60) * 60,
            Math.ceil((easiest + 300) / 60) * 60
          );
          if (cap < lr.sec) {
            const next = new Map(recipes);
            next.set(longDate, { ...lr, sec: cap, dose: Math.min(lr.dose, cap / 2) });
            recipes = next;
          }
        }
      }
    }
    /* krug 15 (M3, E5): posle duge trke van plana (podatak `afterLongRace`) prve nedelje su manje — dugi ≤ udeo
       planiranog, nedelja ≤ udeo polaznog obima (lagani dani srazmerno, ne ispod najkraćeg) */
    {
      const rule = data.safety.afterLongRace;
      const race =
        rule === undefined
          ? undefined
          : adjustments.find(
              (a) =>
                a.kind === 'effort' &&
                a.planned !== true &&
                a.durationSec >= rule.minEffortSec &&
                rampOf(a)?.schedule === undefined &&
                week.start > a.date &&
                week.start <= addDays(a.date, 7 * rule.weeks)
            );
      if (rule !== undefined && race !== undefined) {
        const next = new Map(recipes);
        let longDate: IsoDate | null = null;
        for (const [date, r] of recipes) if (r.type === 'long') longDate = date;
        const lr = longDate === null ? undefined : recipes.get(longDate);
        if (longDate !== null && lr !== undefined && lr.type === 'long') {
          const cap = Math.round((rule.longShare * lr.sec) / 60) * 60;
          if (cap < lr.sec)
            next.set(longDate, { ...lr, sec: cap, dose: Math.min(lr.dose, cap / 2) });
        }
        const secOf = (r: Recipe): Seconds =>
          r.type === 'rest' ? 0 : summarize(realize(r, ctx), ctx.pace).durationSec;
        let total = 0;
        for (const r of next.values()) total += secOf(r);
        const most =
          rule.weekShare * (header.decisions.baseVolumeMin ?? header.decisions.baseLoad) * 60;
        const easy = [...next.entries()].filter(([, r]) => r.type === 'easy' || r.type === 'addon');
        const easySec = easy.reduce((sum, [, r]) => sum + secOf(r), 0);
        if (total > most && easySec > 0) {
          const least = minEasyOf(
            ctx.data.safety,
            ctx.decisions.level,
            ctx.decisions.runDays.length
          );
          const f = Math.max(0, 1 - (total - most) / easySec);
          for (const [date, r] of easy) {
            if (r.type !== 'easy' && r.type !== 'addon') continue;
            const sec = Math.max(least, Math.round((r.sec * f) / 60) * 60);
            next.set(date, { ...r, sec, maxSec: undefined });
          }
        }
        recipes = next;
      }
    }
    /* krug 10 (stavka 5): posle kasne bolesti (skraćena rampa) nedelja pred trkom zadržava samo oštrenje u tempu trke
       — doza ≤ `LATE_PAUSE_SHARPEN_MAX_SEC` */
    if (
      week.start === addDays(mondayOf(span.raceDate), -7) &&
      adjustments.some((a) => a.kind === 'pause' && a.rampDays !== undefined)
    ) {
      const next = new Map(recipes);
      for (const [date, r] of recipes)
        if (r.type === 'quality' && r.dose > LATE_PAUSE_SHARPEN_MAX_SEC)
          next.set(date, { ...r, dose: LATE_PAUSE_SHARPEN_MAX_SEC });
      recipes = next;
    }
    /* Odluka organizatora (krug 9b, umesto A15): dan posle provere forme je lagano trčanje ≤
       `AFTER_TEST_EASY_MAX_OF_LONG` prethodnog dugog — ne „dugi" */
    {
      const ref = Math.min(
        ...[lastBuiltLong, previousLong].filter((x) => x > 0),
        Number.POSITIVE_INFINITY
      );
      const next = new Map(recipes);
      for (const [date, r] of recipes) {
        if (r.type !== 'test') continue;
        /* provera u pauzi, rampi povratka ili posle trke se ne radi (dan je lagan) — pravilo ne važi */
        if (ramped || inReturn(date, adjustments) || afterRace(date, adjustments)) continue;
        const after = addDays(date, 1);
        const day = next.get(after);
        if (day === undefined || (day.type !== 'long' && day.type !== 'easy')) continue;
        const sec = summarize(realize(day, ctx), ctx.pace).durationSec;
        const cap = Number.isFinite(ref)
          ? Math.floor((AFTER_TEST_EASY_MAX_OF_LONG * ref) / 300) * 300
          : sec;
        const least = minEasyOf(ctx.data.safety, ctx.decisions.level, ctx.decisions.runDays.length);
        const easySec = Math.max(least, Math.min(sec, cap));
        if (day.type === 'easy' && sec <= easySec + 60) continue;
        next.set(after, { type: 'easy', sec: easySec });
        /* skinuti minuti idu u ostale lagane dane nedelje (najviše + 10 min po danu) — obim nedelje ostaje, pa
           sledeća nedelja nije skok (R2) */
        let left = sec - easySec;
        const others = [...next.entries()].filter(
          ([d, x]) => d !== after && (x.type === 'easy' || x.type === 'addon')
        );
        for (const [d, x] of others) {
          if (left <= 0 || (x.type !== 'easy' && x.type !== 'addon')) break;
          const add = Math.min(
            AFTER_TEST_SPREAD_MAX_SEC,
            Math.ceil(left / others.length / 60) * 60
          );
          next.set(d, { ...x, sec: x.sec + add, maxSec: undefined });
          left -= add;
        }
      }
      recipes = next;
    }
    const volumeMin = Math.round(plannedMin(shell.targetLoad) * 10) / 10;

    /* R19: nedelja rasporeda povratka nije merilo laganih dana sledeće nedelje (merilo ostaje nedelja pre pauze) */
    if (
      week.intent.kind !== 'recovery' &&
      week.intent.source === 'template' &&
      schedule === null &&
      /* R19 (stavka 2d): nedelja pripremne trke (trka na mestu dugog) nije merilo laganih dana posle nje */
      week.intent.long?.race === undefined
    ) {
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
    const rebuilt = new Set<DayId>();
    const rawDays = week.days.map((day): PlanDay => {
      let final = day;
      const planned = recipes.get(day.date) ?? REST;
      /* M4: pomerena provera forme sme van prozora izmene (prvo rasterećenje posle njega) */
      const movedTest = forced !== null && planned.type === 'test' && planned.def === forced.def;
      /* A2 (krug 9b): provera forme u 14 dana posle trke se dira i van prozora izmene (pretvara se u lagan dan) */
      const prevDate = addDays(day.date, -1);
      const raceTest =
        (planned.type === 'test' && afterRace(day.date, adjustments)) ||
        /* i dan posle izbačene provere (bio je lagan zbog provere — vraća se dugi) */
        (recipes.get(prevDate)?.type === 'test' && afterRace(prevDate, adjustments));
      /* krug 10: nedelja koja prima pomerenu proveru se gradi cela (obim ≤ prvobitne nedelje) */
      const forcedWeek =
        forced !== null && slots.items.some((x) => x.kind === 'test' && x.def === forced.def);
      const inWindow =
        opts.window === null ||
        movedTest ||
        forcedWeek ||
        raceTest ||
        (day.date >= opts.window.from && day.date <= opts.window.to);
      const mutable = isMutable(day, header, state.today, done);
      let kept = planned.type === 'test';
      if (inWindow && mutable) {
        rebuilt.add(day.id);
        /* Provera forme se ne radi u pauzi ni u rampi povratka — ni pri njenom kraju: čeka prvu nedelju posle
           rampe (R9), a dan ostaje lagan. */
        const source: Recipe =
          planned.type === 'test' &&
          (inReturn(day.date, adjustments) || afterRace(day.date, adjustments))
            ? {
                type: 'easy',
                /* R18 (stavka 5): izbačena provera (i pripremna trka) postaje lagan dan, ne duži od poslednjeg
                   izgrađenog dugog — ne „lagano 2 h 30" tri dana posle trke */
                sec: Math.min(
                  summarize(realize(planned, ctx), ctx.pace).durationSec,
                  lastBuiltLong > 0
                    ? Math.floor(lastBuiltLong / 300) * 300
                    : Number.POSITIVE_INFINITY,
                  /* R19: u rasporedu povratka ni duži od dugog te nedelje */
                  schedule === null
                    ? Number.POSITIVE_INFINITY
                    : Math.floor(schedule.longSec / 300) * 300
                )
              }
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
      /* Provera forme koju su pauza ili rampa povratka pojele se pomera, ne briše (R9); posle trke (A2) čeka da prođe
         14 dana. */
      /* R18 (stavka 3, M5): posle prave (neplanirane) trke provera otpada — trka je već dala formu */
      const raceNear = adjustments.some(
        (a) =>
          a.kind === 'effort' &&
          a.race === true &&
          a.planned !== true &&
          a.date >= addDays(day.date, -NO_TEST_AFTER_RACE_DAYS)
      );
      if (pendingTest !== null && pendingOrigin !== null) {
        const origin = pendingOrigin;
        if (
          adjustments.some(
            (a) =>
              a.kind === 'effort' &&
              a.race === true &&
              a.planned !== true &&
              a.date >= addDays(origin, -NO_TEST_AFTER_RACE_DAYS)
          )
        ) {
          pendingTest = null;
          pendingOrigin = null;
        }
      }
      if (
        planned.type === 'test' &&
        !kept &&
        !raceNear &&
        (inReturn(day.date, adjustments) || afterRace(day.date, adjustments))
      ) {
        pendingOrigin = day.date;
        pendingTest = planned;
        /* S9: najranije 10 dana posle kraja rampe povratka — ne kao pun napor odmah posle rampe */
        let end: IsoDate | null = null;
        for (const adj of adjustments) {
          const w = adjustmentWindow(adj);
          if (
            w !== null &&
            w.from <= day.date &&
            day.date <= w.rampEnd &&
            (end === null || w.rampEnd > end)
          )
            end = w.rampEnd;
        }
        pendingFrom = end === null ? null : addDays(end, RETURN_TEST_AFTER_RAMP_DAYS);
        /* R19 (odluka organizatora): posle kratke pauze provera se pomera najviše 2 nedelje; ako tu ne staje,
           otpada (rečenica u objašnjenju) */
        const fromSchedule = adjustments.some((a) => {
          const w = adjustmentWindow(a);
          return (
            rampOf(a)?.schedule !== undefined &&
            w !== null &&
            w.from <= day.date &&
            day.date <= w.rampEnd
          );
        });
        pendingUntil = fromSchedule ? addDays(day.date, RETURN_TEST_MAX_SHIFT_DAYS) : null;
      }
      const key = seenKey(final.workout, ctx);
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
    const shaped = easyNotOverLong(
      balanceEasy(
        capDroppedDays(
          /* R19: u rasporedu povratka dugi drži raspored (¾ referentnog, pa referentni), ne udeo skraćene nedelje */
          schedule === null
            ? shortenLong(rawDays, week, header, state.today, done, ctx, opts)
            : rawDays,
          recipes,
          week,
          header,
          state.today,
          done,
          ctx
        ),
        rebuilt,
        header,
        ctx,
        /* i nedelja pod uzrokom spremnosti (rampa, bol, umor): dugi daje lagane minute */
        capVolume !== null || anyCauseIn(week.start, adjustments)
      ),
      rebuilt,
      ctx
    );
    /* R19 (stavka 1): nedelja rasporeda povratka ne ostaje ispod svog cilja (udeo referentne, ne iznad plana) zbog
       izostavljenog kvaliteta ili pomerene provere — manjak nose lagani dani */
    const days =
      schedule === null
        ? shaped
        : fillReturnWeek(
            shaped,
            rebuilt,
            Math.min(
              (schedule.volume * 60) / ctx.pace.paces.easy,
              weekTotals(week, header, state, ctx).km
            ),
            week,
            header,
            ctx
          );
    weekTags.push(
      new Set(
        days.flatMap((x) =>
          x.workout?.kind === 'quality'
            ? (ctx.data.library.find((def) => def.id === x.workout?.libraryId)?.tags ?? [])
            : []
        )
      )
    );
    /* E9: merilo silaska je OSTVAREN brz rad vršne nedelje (posle spremnosti), isto što meri čuvar */
    if (week.intent.kind === 'peak') {
      const real = days.reduce(
        (sum, x) =>
          sum +
          (x.workout !== null && (x.workout.kind === 'quality' || x.workout.kind === 'long')
            ? x.workout.workSec
            : 0),
        0
      );
      /* M9 (krug 5): vršna nedelja u 21 dan posle rampe povratka je skraćena zbog povratka — merilo silaska je
         prvobitna vršna nedelja (čuvar je tada ne meri, isto pravilo) */
      const afterRamp = adjustments.some((adj) => {
        const w = adjustmentWindow(adj);
        return (
          w !== null &&
          w.from <= addDays(week.start, 6) &&
          week.start < addDays(w.rampEnd, RESTORE_PEAK_AFTER_DAYS)
        );
      });
      const planned = afterRamp
        ? week.days.reduce(
            (sum, x) =>
              sum +
              (x.workout !== null && (x.workout.kind === 'quality' || x.workout.kind === 'long')
                ? x.workout.workSec
                : 0),
            0
          )
        : 0;
      peakFast = Math.max(peakFast, real, planned);
    }
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
      /* R18 (stavka 5): nedelja oporavka posle trke (do 14 dana) ne spušta lanac rasta — oporavak posle trke nije
         povratak posle pauze; lanac nastavlja od nameravane nedelje (MAR s17: vrh 80,4 → 65,6 km) */
      const raceRecovery = adjustments.some(
        (a) =>
          a.kind === 'effort' &&
          a.planned !== true &&
          a.date <= addDays(week.start, 6) &&
          a.date >= addDays(week.start, -14)
      );
      volumes.push(raceRecovery ? Math.max(volume, plannedMin(shell.targetLoad)) : volume);
      /* R8 t. 10: vršna nedelja skraćena zbog događaja (u prozoru izmene + 28 dana) nije merilo silaska — merilo je
         najveća puna nedelja gradnje van prozora, pa sužavanje posle više događaja ne produžava rep izmena */
      const shortened = adjustments.some((adj) => {
        const w = adjustmentWindow(adj);
        return (
          w !== null && w.from <= addDays(week.start, 6) && addDays(w.rampEnd, 28) > week.start
        );
      });
      if (!shortened && (week.intent.kind === 'build' || week.intent.kind === 'peak'))
        fullBuildVolume = Math.max(fullBuildVolume, volume);
      if (week.intent.kind === 'peak')
        peakVolume = Math.max(peakVolume, shortened ? Math.max(volume, fullBuildVolume) : volume);
      /* E1 (krug 5): merilo povratka je poslednja PUNA nedelja gradnje — ne lanča se preko rasterećenja */
      if (fraction >= 1 && week.intent.kind !== 'recovery') lastFullVolume = volume;
      longs.push(
        longAsDecided || raceRecovery ? Math.max(shell.longSec, totals.longSec) : totals.longSec
      );
    }
    if (opts.fresh === true && (touched || exitCapped)) {
      const real = weekTotals(built, header, state, ctx).longSec;
      exitLong = real > 0 ? real : exitLong;
    } else exitLong = null;
    {
      const t = weekTotals(built, header, state, ctx);
      lastBuiltVolume = (t.km * ctx.pace.paces.easy) / 60;
      lastBuiltLong = t.longSec;
      lastBuiltHard = built.days.filter(
        (x) => x.workout?.kind === 'quality' || x.workout?.kind === 'test'
      ).length;
    }
    /* R18 (stavka 5): oporavak posle trke ne pokreće lanac rasta „od odrađenih nedelja posle rampe" (MAR s17) */
    const returnRamped = underRamp(week.start, adjustments, false);
    previousRamped = returnRamped;
    if (returnRamped) rampSeen = true;
    previousLong = shell.longSec;
    return built;
  });
  return { ...doc, weeks: onlyLongestNotes(weeks, state, ctx) };
}

/** R20 B6: napomena sa `onlyLongest` ostaje samo uz najduži trening te vrste; sa ostalih (budućih, iz šablona,
    nezaključanih) dana se skida. */
function onlyLongestNotes(weeks: PlanWeek[], state: RunnerState, ctx: BuildCtx): PlanWeek[] {
  let out = weeks;
  for (const rule of ctx.data.noteRules) {
    const text = ctx.data.texts[rule.text];
    if (rule.onlyLongest !== true || text === undefined) continue;
    let best: { id: string; sec: number } | null = null;
    for (const w of out)
      for (const day of w.days) {
        const wk = day.workout;
        if (wk === null || !rule.kinds.includes(wk.kind) || !(wk.notes ?? []).includes(text))
          continue;
        const sec = summarize(wk, ctx.pace).durationSec;
        if (best === null || sec > best.sec) best = { id: day.id, sec };
      }
    if (best === null) continue;
    const keep = best.id;
    out = out.map((w) => ({
      ...w,
      days: w.days.map((day) => {
        const wk = day.workout;
        if (
          wk === null ||
          day.id === keep ||
          day.locked ||
          day.origin !== 'template' ||
          day.date < state.today ||
          !(wk.notes ?? []).includes(text)
        )
          return day;
        const notes = (wk.notes ?? []).filter((n) => n !== text);
        const { notes: _drop, ...rest } = wk;
        return { ...day, workout: notes.length === 0 ? rest : { ...rest, notes } };
      })
    }));
  }
  return out;
}
