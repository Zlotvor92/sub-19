/* V4 — `plan` (SPEC § 6.1–6.2): čista funkcija (stanje, cilj, podaci distance) → plan. Redosled odluka:
   unos → šablon → odluke (vrh, plafoni, dugi, dani) → prolaz kroz nedelje → zaglavlje i upozorenja. */
import { applyBreakRamp, breakStartOf } from './breakRamp';
import { effortScheduleFits, effortShares } from './readiness';
import {
  LONG_HABIT_GUESS_DAY_SHARE,
  LONG_HABIT_WEEKS,
  LONG_GUESS_FREE_SEC,
  LONG_START_OVER_KM,
  FATIGUE_RATIO,
  FATIGUE_WEEK_SHARE,
  NO_PROGRESS_SHARE,
  RETURNED_AFTER_DAYS
} from './constants';
import { runPass } from './build';
import { addDays, diffDays, mondayOf, weekdayOf } from './dates';
import { decide, ladderInputOf, longStepOf, ranGoalDistance } from './decide';
import { levelWarning, validate, warnings, weekCost } from './guard';
import { paceCtxOf, summarize } from './load';
import { raceWorkout } from './select';
import {
  baseLoadOf,
  lastLongAfterEffort,
  lastLongBefore,
  recentLoad,
  refWeekKmBefore
} from './state';
import { countWeeks, expandTemplate, pickLevel, pickTemplate } from './template';
import {
  type Adjustment,
  type Availability,
  type Decisions,
  type Paces,
  type Seconds,
  type SecPerKm,
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
  type Warning,
  type Weekday,
  type WeekIntent
} from './types';
import { trainingRacePace } from './racePace';
import { zonePaces } from './vdot';

/** E6 (krug 5): polazni obim = prosek poslednje 3 stvarne nedelje; uz bol ili pauzu u te 3 nedelje (ili bez
    merodavne istorije) ostaje manje od baze i proseka. */
function historyBase(
  state: RunnerState,
  baseLoad: number
): { baseVolumeMin?: number; baseKm?: number; baseLoad?: number } {
  const min = state.historyWeeklyMin;
  const km = state.historyWeeklyKm;
  if (min === undefined || km === undefined) return {};
  const from = addDays(mondayOf(state.today), -21);
  const troubled =
    state.pauses.some((p) => p.to >= from) ||
    [...state.pain, ...(state.painHistory ?? [])].some((p) => p.date >= from);
  if (troubled) return { baseVolumeMin: Math.min(baseLoad, min), baseKm: km };
  return { baseVolumeMin: min, baseKm: km, ...(min > baseLoad ? { baseLoad: min } : {}) };
}

/** Krug 11 (stavka 19): godine iz `birthYear` (u godini početka plana) i razmak brzih treninga iz podatka distance. */
const BASE_QUALITY_GAP_DAYS = 2;
function ageDecision(
  state: RunnerState,
  data: DistanceData,
  startDate: IsoDate
): { ageYears?: number; qualityMinGapDays?: number } {
  const born = state.profile.birthYear;
  const rule = data.safety.ageRecovery;
  if (born === undefined || rule === undefined) return {};
  const age = Number(startDate.slice(0, 4)) - born;
  if (!(age >= rule.fromAge)) return {};
  return { ageYears: age, qualityMinGapDays: BASE_QUALITY_GAP_DAYS + rule.extraGapDays };
}

/** S8e (krug 4): staž kraći od `adequate.minTenureWeeks` širi raspon prognoze (× 1,5 oko očekivanog). */
const TENURE_RANGE_FACTOR = 1.5;
function widenOf(state: RunnerState, data: DistanceData): number | undefined {
  const years = state.profile.yearsRunning;
  const min = data.adequate.minTenureWeeks;
  if (years === undefined || min === undefined || years * 52 >= min) return undefined;
  return TENURE_RANGE_FACTOR;
}

/** M3 (krug 5): prognoza dana trke prema odlukama plana — bez napretka od obima očekivano je današnja prognoza
    (raspon zadržava svoju širinu), kratak staž širi raspon. Jedno mesto za plan i ispis. */
export function adjustRaceDay(
  raw: RunnerState['form']['raceDay'],
  todaySec: Seconds,
  d: Pick<
    Decisions,
    | 'raceDayNoProgress'
    | 'raceDayWiden'
    | 'raceDayMaxGain'
    | 'raceDayVolumeShare'
    | 'raceDayPenalty'
  >
): RunnerState['form']['raceDay'] {
  let r = raw;
  /* A8 (krug 9): napredak u tački ograničen po nivou (početnik ≤ 3 %, potpuno nov 0) */
  const floor = d.raceDayMaxGain === undefined ? null : todaySec * (1 - d.raceDayMaxGain);
  if (floor !== null && r.expectedSec < floor) {
    const shift = floor - r.expectedSec;
    r = {
      lowSec: Math.round(r.lowSec + shift),
      expectedSec: Math.round(floor),
      highSec: Math.round(r.highSec + shift)
    };
  }
  /* A17 (krug 9b): izgubljen obim (spušten ostatak plana) smanjuje očekivani napredak u istom odnosu */
  const share = d.raceDayVolumeShare;
  if (share !== undefined && share < 1 && r.expectedSec < todaySec) {
    const shift = (todaySec - r.expectedSec) * (1 - Math.max(0, share));
    r = {
      lowSec: Math.round(r.lowSec + shift),
      expectedSec: Math.round(r.expectedSec + shift),
      highSec: Math.round(r.highSec + shift)
    };
  }
  if (d.raceDayNoProgress === true && r.expectedSec < todaySec) {
    r = {
      lowSec: Math.round(todaySec - (r.expectedSec - r.lowSec)),
      expectedSec: todaySec,
      highSec: Math.round(todaySec + (r.highSec - r.expectedSec))
    };
  }
  /* R20 (I): obim/dugi/priprema ne nose distancu — očekivano je sporije od današnje forme za kaznu, brža granica
     ostaje, a spora strana se širi za istu kaznu */
  const pen = d.raceDayPenalty ?? 0;
  if (pen > 0) {
    const base = Math.max(r.expectedSec, todaySec);
    const add = pen * todaySec;
    r = {
      lowSec: r.lowSec,
      expectedSec: Math.round(base + add),
      highSec: Math.round(Math.max(r.highSec, base) + 2 * add)
    };
  }
  const f = d.raceDayWiden;
  if (f !== undefined)
    r = {
      lowSec: Math.round(r.expectedSec - (r.expectedSec - r.lowSec) * f),
      expectedSec: r.expectedSec,
      highSec: Math.round(r.expectedSec + (r.highSec - r.expectedSec) * f)
    };
  return slowSideAtLeastFast(r);
}

/** R20 B5: raspon nikad naopako — spora strana nije uža od brze (nepouzdana forma češće ispadne sporija nego
    brža). */
function slowSideAtLeastFast(r: RunnerState['form']['raceDay']): RunnerState['form']['raceDay'] {
  const fast = Math.max(0, r.expectedSec - r.lowSec);
  const high = Math.max(r.highSec, r.expectedSec + fast);
  return { ...r, highSec: Math.round(high) };
}

/** Plan počinje sutra, osim ako je zadat kasniji početak (§ 6.1). */
export function startDateOf(state: RunnerState, goal: Goal): IsoDate {
  const tomorrow = addDays(state.today, 1);
  return goal.startDate !== undefined && goal.startDate > tomorrow ? goal.startDate : tomorrow;
}

/** R20 (A6): posle neplanirane trke prve 3 nedelje nisu „vršne" (oznaka gradnja), a kad raspored povratka kreće ispod
    65 % (duga trka), u prve 4 nedelje nema ni rasterećenja — povratak je već rasterećenje. */
function afterRaceIntents(doc: PlanDoc): PlanDoc {
  const race = (doc.header.adjustments ?? []).find(
    (a) => a.kind === 'effort' && a.race === true && a.planned !== true
  );
  if (race?.kind !== 'effort') return doc;
  const low = race.refWeekKm !== undefined && (effortShares(race.durationSec)[0] ?? 1) < 0.65;
  let prevLoad = 0;
  const weeks = doc.weeks.map((w) => {
    const days = diffDays(w.start, race.date);
    let intent = w.intent;
    if (intent.kind === 'peak' && days <= 21) intent = { ...intent, kind: 'build' };
    if (intent.kind === 'recovery' && low && days <= 28)
      intent = { ...intent, kind: 'build', loadPct: Math.max(intent.loadPct, prevLoad) };
    prevLoad = intent.loadPct;
    return intent === w.intent ? w : { ...w, intent };
  });
  return { ...doc, weeks };
}

/** R20 (A1): referentna nedelja pre trke — iz istorije, inače sadašnji obim iz profila. */
function raceRefKm(state: RunnerState, date: IsoDate): number {
  const fromRuns = refWeekKmBefore(state, date);
  return fromRuns > 0 ? fromRuns : (state.profile.weeklyKm ?? 0);
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
      lastLongSec: lastLongAfterEffort(state, effort.date, effort.durationSec),
      ...(effort.race === true ? { race: true } : {}),
      /* R20 (A1): povratak posle trke po nedeljama — od referentne nedelje pre trke (bez istorije: sadašnji obim) */
      ...(effort.race === true && raceRefKm(state, effort.date) > 0
        ? { refWeekKm: raceRefKm(state, effort.date) }
        : {})
    });
  }
  for (const pause of state.pauses) {
    /* E6 (krug 5): trkač koji posle pauze već trči 3+ nedelje (bar 6 trčanja) se vratio — rampa se ne ponavlja */
    const after = state.runs.filter((r) => r.date > pause.to);
    const back =
      after.length >= 6 &&
      diffDays(state.today, after[0]?.date ?? state.today) >= RETURNED_AFTER_DAYS;
    if (back) continue;
    out.push({
      kind: 'pause',
      source: 'plan',
      from: pause.from,
      to: pause.to,
      reason: pause.reason,
      lastLongSec: lastLongBefore(state, pause.from),
      /* krug 14 (M2): obim plana polazi od današnjeg (posle pauze) — rampa ga ne skraćuje ponovo */
      ...(diffDays(state.today, pause.to) >= BASE_AFTER_PAUSE_DAYS ? { baseAfter: true } : {})
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
  /* E6 (krug 5): trkač koji ravnomerno gradi obim (poslednja nedelja ≤ 1,2 × prosek poslednje 3) nije umoran samo
     zato što je baza od 42 dana niska */
  const steady =
    state.historyWeeklyMin !== undefined &&
    recentLoad(state, 7) <= FATIGUE_WEEK_SHARE * state.historyWeeklyMin;
  if (strained && !steady && recentLoad(state, 7) >= FATIGUE_WEEK_SHARE * 7 * load.chronic) {
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
/** R20 B1: dugi koji trkač redovno trči — drugi najduži nedeljni dugi u poslednjih `LONG_HABIT_WEEKS` nedelja
    (jedno dugo trčanje nije navika); bez stvarnih trčanja 0. */
function habitLong(state: RunnerState): Seconds {
  if (state.load.seeded) return 0;
  const longs = state.weeks
    .slice(-LONG_HABIT_WEEKS)
    .map((w) => w.longestSec)
    .sort((a, b) => b - a);
  return longs[1] ?? 0;
}

export function createPlan(
  state: RunnerState,
  goal: Goal,
  data: DistanceData,
  startDate: IsoDate,
  availability: Availability = state.availability,
  /** Probni plan za upozorenja: bez sopstvenih upozorenja (da se probni poziv ne ponavlja). */
  trial = false,
  /** R22 (B2): drugi prolaz — tempo trke u treninzima = tempo koji plan savetuje za trku (s/km). */
  racePaceSec?: SecPerKm
): PlanDoc {
  const weeks = countWeeks(startDate, goal.raceDate);
  const hist = historyBase(state, baseLoadOf(state));
  const baseLoad = hist.baseLoad ?? baseLoadOf(state);
  const form = state.form.current;
  /* F4-K2: lična kriva forme po dužini iz procene (tempa svake zone po svom sidru) */
  const transfer = state.form.transfer;
  const level = pickLevel(data, {
    yearsRunning: state.profile.yearsRunning,
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
    easyPaceSecPerKm: zonePaces(form.vdot, data.distanceM, false, undefined, transfer).easy,
    raceSec: state.form.raceDay.expectedSec,
    habitLongSec: habitLong(state),
    ladder: ladderInputOf({
      baseLoad,
      easyPaceSecPerKm: zonePaces(form.vdot, data.distanceM, false, undefined, transfer).easy,
      weeks,
      yearsRunning: state.profile.yearsRunning,
      painInYear: (state.painHistory ?? []).length > 0,
      safety: data.safety
    })
  });
  const easyPace = zonePaces(form.vdot, data.distanceM, false, undefined, transfer).easy;
  const fromRuns = !state.load.seeded && state.longestRecentSec > 0;
  /* R20 B1: dugi u nedelji 1 ≤ najduži iz istorije + 2 km (bez podatka: procena navike iz obima i dana) */
  const weeklyKm = state.profile.weeklyKm ?? 0;
  const knownLongKm =
    state.longestRecentM !== undefined
      ? state.longestRecentM / 1000
      : (LONG_HABIT_GUESS_DAY_SHARE * weeklyKm) / Math.max(1, availability.runDays.length);
  /* na 5 min naniže; kad veže, prvi dugi plana je polazni (bez koraka) */
  const kmCapRaw =
    knownLongKm > 0
      ? Math.floor(((knownLongKm + LONG_START_OVER_KM) * easyPace) / 300) * 300
      : Number.POSITIVE_INFINITY;
  /* procena navike (bez podatka) ne spušta dugi do 90 min — to nosi svaki trkač tog obima — niti dugi kratke
     pripreme (< `longCheckMinWeeks`): ona nema nedelja da nadoknadi niži početak */
  const guessOnly = state.longestRecentM === undefined;
  const short = weeks < (data.adequate.longCheckMinWeeks ?? 0);
  const kmCap = !guessOnly
    ? kmCapRaw
    : short
      ? Number.POSITIVE_INFINITY
      : Math.max(kmCapRaw, LONG_GUESS_FREE_SEC);
  const decisions: Decisions = {
    ...decided,
    ...(Number.isFinite(kmCap) ? { longFirstCapSec: kmCap } : {}),
    ...(fromRuns
      ? {
          longStartFromRuns: true,
          longStartSec: Math.min(
            decided.longStartSec,
            Math.round((state.longestRecentSec + longStepOf(data.safety, easyPace)) / 60) * 60
          )
        }
      : {}),
    /* S8a/b (krug 4): istorija je merodavna → lanac rasta kreće od stvarnih minuta, polazni dugi ≤ najduže stvarno
       trčanje u 28 dana + korak (ne udeo nedelje u bodovima). */
    ...(hist.baseVolumeMin === undefined
      ? {}
      : { baseVolumeMin: hist.baseVolumeMin, baseKm: hist.baseKm ?? 0 }),
    ...((state.painHistory ?? []).length > 0 ? { painCaution: true } : {}),
    ...ageDecision(state, data, startDate),
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
        ...(transfer !== undefined ? { transfer } : {}),
        raceDay: adjustRaceDay(state.form.raceDay, form.raceTimeSec, {
          raceDayWiden: widenOf(state, data),
          raceDayMaxGain: data.safety.forecastMaxGainByLevel?.[level]
        })
      },
      paces: withRacePace(
        zonePaces(
          form.vdot,
          data.distanceM,
          form.confidence === 'niska',
          data.safety.intervalPaceFloor,
          transfer
        ),
        racePaceSec
      ),
      decisions,
      warnings: [],
      protected: false,
      appliedEvents: [],
      eventsFrom: state.today,
      /* Kad nema istorije dugih, „poslednji dugi" za plafon u rampi je polazni dugi plana. */
      adjustments: initialAdjustments(state)
        .map((a) =>
          (a.kind === 'effort' || a.kind === 'pause' || a.kind === 'pain') &&
          (a.lastLongSec === undefined || a.lastLongSec === 0)
            ? { ...a, lastLongSec: decisions.longStartSec }
            : /* R20 (A1): posle trke bez istorije dugih „poslednji dugi" je polazni dugi plana, ne 60 % trke */
              a.kind === 'effort' && lastLongBefore(state, a.date) === 0
              ? { ...a, lastLongSec: Math.max(a.lastLongSec ?? 0, decisions.longStartSec) }
              : a
        )
        .map((a) => {
          /* R20 (A1): raspored posle trke samo kad se završi pre nedelje pred trkom */
          if (a.kind !== 'effort' || a.refWeekKm === undefined) return a;
          if (effortScheduleFits(a.date, a.durationSec, goal.raceDate)) return a;
          const { refWeekKm: _drop, ...rest } = a;
          void _drop;
          return rest;
        })
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
  const pass = runPass(afterRaceIntents(draft), state, data, {
    window: null,
    rechainFrom: 1,
    fresh: true
  });
  /* R20 (A1): plan iz stanja posle skorog prekida (bolest, bol, trka) — isto pravilo povratka kao u `replan` */
  const brk = breakStartOf(pass, state.today);
  const built = brk === null ? pass : applyBreakRamp(pass, pass, state, data, brk);
  if (trial) return built;
  /* Šta bi dao još jedan dan trčanja uz isti datum trke — brojevi za predlog u upozorenju. */
  const withExtraDay = (): { peakKm: number; longKm: number; dayMin: number } | null => {
    const extra = extraRunDay(availability.runDays);
    if (extra === null) return null;
    const more: Availability = {
      runDays: [...availability.runDays, extra].sort((x, y) => x - y),
      longDay: availability.longDay
    };
    /* R20 (dopuna MAR 1): dodat dan ide NA postojeći obim (bazna nedelja + jedan lagan dan od `EXTRA_DAY_MIN`), ne
       deli isti obim na više dana — probni plan tada kaže koliko nedelja i dugi stvarno rastu */
    const more_state: RunnerState = {
      ...state,
      load: { ...state.load, chronic: state.load.chronic + EXTRA_DAY_MIN / 7 },
      ...(state.historyWeeklyMin === undefined
        ? {}
        : { historyWeeklyMin: state.historyWeeklyMin + EXTRA_DAY_MIN })
    };
    const probe = createPlan(more_state, goal, data, startDate, more, true);
    const ctx = paceCtxOf(probe.header);
    const costs = probe.weeks.map((w) => weekCost(w, goal.raceDate, ctx));
    /* Z7 (krug 7): trajanje dodatnog dana je ono što probni plan stvarno daje tom danu (prosek nedelja gradnje) */
    const onExtra = probe.weeks
      .filter((w) => w.intent.kind === 'build' || w.intent.kind === 'peak')
      .flatMap((w) => w.days)
      .filter((d) => weekdayOf(d.date) === extra && d.workout?.kind === 'easy')
      .map((d) => (d.workout === null ? 0 : summarize(d.workout, ctx).durationSec));
    const dayMin =
      onExtra.length === 0 ? 30 : onExtra.reduce((x, y) => x + y, 0) / onExtra.length / 60;
    return {
      peakKm: Math.max(0, ...costs.map((c) => c.km)),
      longKm: Math.max(0, ...costs.map((c) => c.longKm)),
      dayMin
    };
  };
  /* Z7 (krug 7): šta bi dala duža priprema (isti start, trka kasnije) — predlog „planiraj N nedelja" samo kad probni
     plan stvarno menja nalaz */
  const probes = new Map<number, { peakKm: number; longKm: number }>();
  const withWeeks = (total: number): { peakKm: number; longKm: number } => {
    const hit = probes.get(total);
    if (hit !== undefined) return hit;
    const later: Goal = { ...goal, raceDate: addDays(goal.raceDate, 7 * (total - weeks)) };
    const probe = createPlan(state, later, data, startDate, availability, true);
    const ctx = paceCtxOf(probe.header);
    const costs = probe.weeks.map((w) => weekCost(w, later.raceDate, ctx));
    const out = {
      peakKm: Math.max(0, ...costs.map((c) => c.km)),
      longKm: Math.max(0, ...costs.map((c) => c.longKm))
    };
    probes.set(total, out);
    return out;
  };
  const found = warnings({ state, goal, data, decisions, doc: built, withExtraDay, withWeeks });
  /* M3: nalaz „dugi-za-distancu" kaže da prognoza ne računa napredak od obima — i broj to prati.
     M7 (krug 14): isto kad upozorenje kaže da obim ili dugi ne nose trku („mali-obim", „kratak-dugi") — tada ni
     prognoza ni tempo trke nisu brži od današnje forme. */
  const flags = {
    ...(found.some((w) => w.code === 'dugi-za-distancu') ||
    farBelowAdequate(built, goal, data, found)
      ? { raceDayNoProgress: true }
      : {}),
    ...penaltyOf(built, goal, data, found, weeks, state),
    ...(widenOf(state, data) === undefined ? {} : { raceDayWiden: widenOf(state, data) }),
    ...(data.safety.forecastMaxGainByLevel?.[level] === undefined
      ? {}
      : { raceDayMaxGain: data.safety.forecastMaxGainByLevel[level] })
  };
  const finalDecisions = { ...built.header.decisions, ...flags };
  const finalRaceDay = adjustRaceDay(state.form.raceDay, form.raceTimeSec, finalDecisions);
  const out: PlanDoc = {
    ...built,
    header: {
      ...built.header,
      decisions: finalDecisions,
      form: { ...built.header.form, raceDay: finalRaceDay },
      /* R20 (IV): upozorenje nivoa nosi brojeve konačne prognoze (posle kazne) */
      warnings: found.map((w) =>
        w.code === 'nivo' ? (levelWarning(data, finalDecisions.level, finalRaceDay) ?? w) : w
      )
    }
  };
  /* R22 (B2): tempo trke u treninzima = tempo koji plan savetuje za trku (sporiji cilj, oprezno uz kaznu ili
     „počni sporije") — plan se gradi još jednom sa tim tempom, da tekst, km i trajanje treninga nose isti broj */
  if (racePaceSec !== undefined) return out;
  const rp = trainingRacePace(out.header, finalRaceDay, data.distanceM);
  return rp === null
    ? out
    : createPlan(state, goal, data, startDate, availability, false, rp);
}

/** R22 (B2): tempo trke zadat planom (sporiji od tempa iz forme). */
function withRacePace(paces: Paces, racePaceSec: SecPerKm | undefined): Paces {
  return racePaceSec === undefined || racePaceSec <= paces.RP
    ? paces
    : { ...paces, RP: racePaceSec, rpBase: paces.RP };
}

/** R20 (I, odluka organizatora): kazna prognoze kad upozorenje kaže da obim (`mali-obim`), dugi (`dugi-za-distancu`,
    `kratak-dugi`) ili priprema (`kratka-priprema`) ne nose distancu — `PENALTY_SCALE` × najveći manjak (udeo ispod
    adekvatnog), najviše `PENALTY_MAX`. */
const PENALTY_SCALE = 0.12;
const PENALTY_MAX = 0.08;
function penaltyOf(
  doc: PlanDoc,
  goal: Goal,
  data: DistanceData,
  found: readonly Warning[],
  weeks: number,
  state: RunnerState
): { raceDayPenalty?: number; raceDayNoProgress?: true } {
  /* ko je ciljnu dužinu već istrčao, nema kaznu (njegova forma je dokazana na toj dužini) */
  if (ranGoalDistance(state.today, state.runs, state.profile.recentResult, data.distanceM))
    return {};
  const has = (c: string): boolean => found.some((w) => w.code === c);
  const ctx = paceCtxOf(doc.header);
  const costs = doc.weeks.map((w) => weekCost(w, goal.raceDate, ctx));
  const a = data.adequate;
  const short: number[] = [];
  if (has('mali-obim')) short.push(1 - Math.max(0, ...costs.map((c) => c.km)) / a.minPeakWeeklyKm);
  if (has('dugi-za-distancu') || has('kratak-dugi'))
    short.push(1 - Math.max(0, ...costs.map((c) => c.longKm)) / (a.longCheckKm ?? a.minLongKm));
  if (has('kratka-priprema')) short.push(1 - weeks / a.minWeeks);
  const worst = Math.max(0, ...short);
  if (worst <= 0) return {};
  return {
    raceDayPenalty: Math.round(Math.min(PENALTY_MAX, PENALTY_SCALE * worst) * 1000) / 1000,
    raceDayNoProgress: true
  };
}

/** R20 (dopuna MAR 1): trajanje dana koji probni plan „+1 dan" dodaje na postojeći obim (min). */
const EXTRA_DAY_MIN = 40;

/** Krug 14 (M2): bar ovoliko dana od kraja pauze do danas — sadašnji obim je već obim posle pauze. */
const BASE_AFTER_PAUSE_DAYS = 7;

/** M7 (krug 14): upozorenje „mali-obim" ili „kratak-dugi" i vrh ili dugi plana ispod `NO_PROGRESS_SHARE` adekvatnog —
    obim ne nosi trku, pa prognoza ne računa napredak od obima (blizu praga, npr. dugi 15 od 16 km, napredak ostaje). */
function farBelowAdequate(
  doc: PlanDoc,
  goal: Goal,
  data: DistanceData,
  found: readonly Warning[]
): boolean {
  if (!found.some((w) => w.code === 'mali-obim' || w.code === 'kratak-dugi')) return false;
  const ctx = paceCtxOf(doc.header);
  const costs = doc.weeks.map((w) => weekCost(w, goal.raceDate, ctx));
  const peakKm = Math.max(0, ...costs.map((c) => c.km));
  const longKm = Math.max(0, ...costs.map((c) => c.longKm));
  const a = data.adequate;
  return peakKm < NO_PROGRESS_SHARE * a.minPeakWeeklyKm || longKm < NO_PROGRESS_SHARE * a.minLongKm;
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
