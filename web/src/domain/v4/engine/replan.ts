/* V4 — `replan` (SPEC § 6.3–6.4, § 10): najmanja dovoljna promena po događaju. Bez događaja vraća ulazni dokument.
   Dan u prozoru se gradi iznova iz namere + odluka (isti prolaz kao `plan`); svaka razlika dobija objašnjenje. */
import {
  PACE_UPDATE_AFTER_RESULT_VDOT,
  PAIN_HIGH_REST_DAYS,
  PAIN_LOW_DAYS,
  PAIN_LOW_MAX,
  PAIN_MID_DAYS,
  PAIN_MID_MAX,
  PAUSE_FULL_REPLAN_DAYS,
  PAUSE_MIN_DAYS,
  FATIGUE_DAYS,
  MISSED_LOOKAHEAD_DAYS
} from './constants';
import { doneDayIds, isMutable, runPass } from './build';
import { addDays, isValidDate, mondayOf } from './dates';
import { assignDays, decideCaps, decideLongMax, decidePeak, decideWarmup, decide } from './decide';
import { sortEvents } from './events';
import { canonical } from './fingerprint';
import {
  count,
  countWith,
  DAYS,
  fmtClock,
  fmtDate,
  fmtDateRange,
  fmtDateYear,
  fmtDistance,
  fmtNumber,
  fmtPace,
  NEXT,
  FIRST
} from './format';
import { warnings, weekCost } from './guard';
import { paceCtxOf, summarize } from './load';
import { skeleton } from './plan';
import { adjustmentWindow, effortRampDays, pauseLength, pauseRampDays } from './readiness';
import { lastLongBefore, normalizeAvailability } from './state';
import { countWeeks, expandTemplate, pickLevel, pickTemplate } from './template';
import type {
  Adjustment,
  Availability,
  Change,
  Decisions,
  DistanceData,
  Goal,
  IsoDate,
  PlanDay,
  PlanDoc,
  PlanEvent,
  PlanHeader,
  PlanWeek,
  ReplanFn,
  RunnerState,
  Warning
} from './types';
import { raceTimeSec, zonePaces } from './vdot';

type EventOf<K extends PlanEvent['kind']> = Extract<PlanEvent, { kind: K }>;

/** Kandidat posle jednog događaja: novi dokument, poslednji dan na koji promena utiče i dan ponovljene doze. */
interface Candidate {
  doc: PlanDoc;
  until: IsoDate;
  repeatDayId?: string;
}

const sameAdjustment = (a: Adjustment, b: Adjustment): boolean => {
  if (a.kind === 'pause' && b.kind === 'pause') return a.from === b.from;
  if (a.kind === 'repeat' && b.kind === 'repeat') return a.dayId === b.dayId;
  if (a.kind === 'effort' && b.kind === 'effort') return a.date === b.date;
  if (a.kind === 'pain' && b.kind === 'pain') return a.date === b.date;
  if (a.kind === 'fatigue' && b.kind === 'fatigue') return a.date === b.date;
  return false;
};

function withAdjustment(header: PlanHeader, adj: Adjustment): PlanHeader {
  const kept = (header.adjustments ?? []).filter((a) => !sameAdjustment(a, adj));
  return { ...header, adjustments: [...kept, adj] };
}

const currentWeekIndex = (doc: PlanDoc, today: IsoDate): number => {
  const monday = mondayOf(today);
  let index = 0;
  for (const week of doc.weeks) if (week.start <= monday) index = week.index;
  return index;
};

const allDays = (doc: PlanDoc): PlanDay[] => doc.weeks.flatMap((w) => w.days);

/* ------------------------------------------------------------------ događaji → kandidat */

function onResult(
  doc: PlanDoc,
  state: RunnerState,
  ev: EventOf<'result'>,
  data: DistanceData
): Candidate | null {
  const run = state.runs.find((r) => r.id === ev.runId);
  if (run === undefined) return null;
  const adj: Adjustment = {
    kind: 'effort',
    source: ev.id,
    date: run.date,
    durationSec: run.durationSec,
    lastLongSec: lastLongBefore(state, run.date)
  };
  let header = withAdjustment(doc.header, adj);
  const vdot = state.form.current.vdot;
  if (Math.abs(vdot - header.form.paceVdot) >= PACE_UPDATE_AFTER_RESULT_VDOT) {
    header = {
      ...header,
      form: { ...header.form, paceVdot: vdot, pacesUpdatedOn: state.today },
      paces: zonePaces(vdot, data.distanceM, false)
    };
  }
  const window = adjustmentWindow(adj);
  if (window === null) return null;
  return {
    doc: runPass({ ...doc, header }, state, data, { window, rechainFrom: null }),
    until: window.rampEnd
  };
}

function onMissed(
  doc: PlanDoc,
  state: RunnerState,
  ev: EventOf<'missed'>,
  data: DistanceData
): Candidate | null {
  const week = doc.weeks.find((w) => w.days.some((d) => d.id === ev.dayId));
  const day = week?.days.find((d) => d.id === ev.dayId);
  const missed = day?.workout;
  if (week === undefined || day === undefined || missed == null) return null;
  const isLong = missed.kind === 'long';
  const isFirstStimulus =
    (missed.kind === 'quality' || missed.kind === 'test') &&
    (week.intent.kind === 'build' || week.intent.kind === 'peak') &&
    week.intent.stimuli[0]?.stimulus === missed.stimulus;
  if (!isLong && !isFirstStimulus) return null;
  const done = doneDayIds(state);
  const last = addDays(day.date, MISSED_LOOKAHEAD_DAYS);
  const target = allDays(doc).find(
    (d) =>
      d.date > state.today &&
      d.date > day.date &&
      d.date <= last &&
      isMutable(d, doc.header, state.today, done) &&
      d.workout !== null &&
      d.workout.kind === missed.kind &&
      (isLong || d.workout.stimulus === missed.stimulus)
  );
  if (target === undefined) return null;
  const adj: Adjustment = isLong
    ? {
        kind: 'repeat',
        source: ev.id,
        dayId: target.id,
        lengthSec: Math.round(summarize(missed, paceCtxOf(doc.header)).durationSec)
      }
    : { kind: 'repeat', source: ev.id, dayId: target.id, workSec: missed.workSec };
  const header = withAdjustment(doc.header, adj);
  return {
    doc: runPass({ ...doc, header }, state, data, {
      window: { from: target.date, to: target.date },
      rechainFrom: null
    }),
    until: target.date,
    repeatDayId: target.id
  };
}

/** Pauza ≥ 14 dana: vrh iz nove baze (ne iznad starog), plafoni i najduži dugi iz njega (§ 6.3). */
function redecide(d: Decisions, state: RunnerState, data: DistanceData): Decisions {
  const template = data.templates.find((t) => t.id === d.templateId);
  if (template === undefined) return d;
  const baseLoad = Math.round(70 * state.load.chronic) / 10;
  const peakLoad = Math.min(
    d.peakLoad,
    Math.round(decidePeak(baseLoad, template, data.safety, d.level) * 10) / 10
  );
  return {
    ...d,
    baseLoad,
    peakLoad,
    doseCapSec: decideCaps(peakLoad, data.safety),
    longMaxSec: Math.min(
      d.longMaxSec,
      decideLongMax(peakLoad, data.safety, d.level, d.runDays.length)
    ),
    ...decideWarmup(baseLoad, data.safety)
  };
}

function refreshWarnings(doc: PlanDoc, state: RunnerState, data: DistanceData): PlanDoc {
  const kept = doc.header.warnings.filter((w) => w.code === 'bol');
  const fresh = warnings({
    state,
    goal: doc.header.goal,
    data,
    decisions: doc.header.decisions,
    doc
  });
  return { ...doc, header: { ...doc.header, warnings: [...fresh, ...kept] } };
}

function onPause(
  doc: PlanDoc,
  state: RunnerState,
  ev: EventOf<'pause'>,
  data: DistanceData
): Candidate | null {
  if (!isValidDate(ev.from) || !isValidDate(ev.to)) return null;
  const length = pauseLength(ev.from, ev.to);
  if (length < PAUSE_MIN_DAYS) return null;
  const adj: Adjustment = {
    kind: 'pause',
    source: ev.id,
    from: ev.from,
    to: ev.to,
    reason: ev.reason,
    lastLongSec: lastLongBefore(state, ev.from)
  };
  let header = withAdjustment(doc.header, adj);
  const full = length >= PAUSE_FULL_REPLAN_DAYS;
  if (full) header = { ...header, decisions: redecide(header.decisions, state, data) };
  const built = runPass({ ...doc, header }, state, data, {
    window: null,
    rechainFrom: currentWeekIndex(doc, state.today) + 1
  });
  return {
    doc: full ? refreshWarnings(built, state, data) : built,
    until: addDays(ev.to, pauseRampDays(length, ev.reason))
  };
}

const PAIN_WARNING: Warning = {
  code: 'bol',
  severity: 'ozbiljno',
  problem: 'Prijavljen je jak bol.',
  meaning: 'Trčanje preko jakog bola obično produži oporavak sa nekoliko dana na nekoliko nedelja.',
  proposal: 'Odmor traje 7 dana — javi se lekaru ili fizioterapeutu pre prvog sledećeg trčanja.'
};

function onPain(
  doc: PlanDoc,
  state: RunnerState,
  ev: EventOf<'pain'>,
  data: DistanceData
): Candidate | null {
  if (!Number.isFinite(ev.level) || ev.level < 1) return null;
  const adj: Adjustment = {
    kind: 'pain',
    source: ev.id,
    date: ev.date,
    level: ev.level,
    lastLongSec: lastLongBefore(state, ev.date)
  };
  const window = adjustmentWindow(adj);
  if (window === null) return null;
  let header = withAdjustment(doc.header, adj);
  if (ev.level > PAIN_MID_MAX && !header.warnings.some((w) => w.code === 'bol')) {
    header = { ...header, warnings: [...header.warnings, PAIN_WARNING] };
  }
  return {
    doc: runPass({ ...doc, header }, state, data, { window, rechainFrom: null }),
    until: window.rampEnd
  };
}

function onFatigue(
  doc: PlanDoc,
  state: RunnerState,
  ev: EventOf<'fatigue'>,
  data: DistanceData
): Candidate | null {
  const adj: Adjustment = { kind: 'fatigue', source: ev.id, date: ev.date };
  const window = adjustmentWindow(adj);
  if (window === null) return null;
  return {
    doc: runPass({ ...doc, header: withAdjustment(doc.header, adj) }, state, data, {
      window,
      rechainFrom: null
    }),
    until: window.rampEnd
  };
}

function onFormUpdate(
  doc: PlanDoc,
  state: RunnerState,
  ev: EventOf<'form-update'>,
  data: DistanceData
): Candidate | null {
  if (!Number.isFinite(ev.vdot) || ev.vdot <= 0) return null;
  const byFeel = state.form.current.confidence === 'niska';
  const header: PlanHeader = {
    ...doc.header,
    form: { ...doc.header.form, paceVdot: ev.vdot, pacesUpdatedOn: ev.date },
    paces: zonePaces(ev.vdot, data.distanceM, byFeel)
  };
  return { doc: { ...doc, header }, until: header.goal.raceDate };
}

function onAvailability(
  doc: PlanDoc,
  state: RunnerState,
  ev: EventOf<'availability-change'>,
  data: DistanceData
): Candidate | null {
  const a: Availability = normalizeAvailability(ev.availability);
  if (a.runDays.length === 0 || !a.runDays.includes(a.longDay)) return null;
  const d = doc.header.decisions;
  const decisions: Decisions = {
    ...d,
    runDays: a.runDays,
    longDay: a.longDay,
    qualityDays: assignDays(a.runDays, a.longDay),
    longMaxSec: decideLongMax(d.peakLoad, data.safety, d.level, a.runDays.length)
  };
  const built = runPass({ ...doc, header: { ...doc.header, decisions } }, state, data, {
    window: null,
    rechainFrom: currentWeekIndex(doc, state.today) + 1
  });
  return { doc: refreshWarnings(built, state, data), until: doc.header.goal.raceDate };
}

/** Nove nedelje od sutra do nove trke; prošlo ostaje, numeracija se nastavlja, zaštićeni budući dani ostaju. */
function reskeleton(
  doc: PlanDoc,
  state: RunnerState,
  goal: Goal,
  data: DistanceData
): Candidate | null {
  const tomorrow = addDays(state.today, 1);
  if (!isValidDate(goal.raceDate) || goal.raceDate < tomorrow || goal.distanceId !== data.id)
    return null;
  const old = doc.header;
  const sameDistance = old.policyId === data.id;
  const monday = mondayOf(tomorrow);
  const kept = doc.weeks.filter((w) => w.start < monday);
  const current = doc.weeks.find((w) => w.start === monday);
  const weeks = countWeeks(tomorrow, goal.raceDate);
  const baseLoad = Math.round(70 * state.load.chronic) / 10;
  const vdot = state.form.current.vdot;
  const level = sameDistance
    ? old.decisions.level
    : pickLevel(data, { beginner: state.profile.beginner === true, vdot, baseLoad });
  const picked = pickTemplate(data, level, kept.length + weeks, old.decisions.runDays.length);
  if (picked === null) return null;
  const fresh = decide({
    data,
    template: picked.template,
    level,
    baseLoad,
    longestRecentSec: state.longestRecentSec,
    runDays: old.decisions.runDays,
    longDay: old.decisions.longDay
  });
  /* Ista distanca: vrh, plafoni i polazni dugi ostaju (plan je u toku); menja se samo raspored nedelja do trke. */
  const decisions: Decisions = sameDistance
    ? { ...old.decisions, templateId: picked.template.id }
    : fresh;
  const intents = sameDistance
    ? expandTemplate(picked.template, kept.length + weeks).slice(kept.length)
    : expandTemplate(picked.template, weeks);
  const firstIndex = (kept[kept.length - 1]?.index ?? 0) + 1;
  const shells = skeleton(tomorrow, goal.raceDate, intents, data, firstIndex);
  const done = doneDayIds(state);
  const frozen = new Map<IsoDate, PlanDay>();
  for (const day of allDays(doc)) {
    const oldRace = day.workout?.kind === 'race' && day.date === old.goal.raceDate;
    if (day.date > state.today && !oldRace && !isMutable(day, old, state.today, done))
      frozen.set(day.date, day);
  }
  const weeksOut: PlanWeek[] = shells.map((shell, i) => {
    const past =
      i === 0 && current !== undefined ? current.days.filter((d) => d.date <= state.today) : [];
    const future = shell.days.map((d) =>
      d.date === goal.raceDate ? d : (frozen.get(d.date) ?? d)
    );
    return { ...shell, days: [...past, ...future] };
  });
  const header: PlanHeader = {
    ...old,
    goal,
    policyId: data.id,
    policyVersion: data.version,
    decisions,
    paces: zonePaces(old.form.paceVdot, data.distanceM, old.paces.byFeel)
  };
  const built = runPass({ ...doc, header, weeks: [...kept, ...weeksOut] }, state, data, {
    window: null,
    rechainFrom: firstIndex
  });
  return { doc: refreshWarnings(built, state, data), until: goal.raceDate };
}

function onGoal(
  doc: PlanDoc,
  state: RunnerState,
  ev: EventOf<'goal-change'>,
  data: DistanceData
): Candidate | null {
  const old = doc.header.goal;
  if (ev.goal.raceDate === old.raceDate && ev.goal.distanceId === old.distanceId) {
    const header: PlanHeader = { ...doc.header, goal: ev.goal };
    return { doc: refreshWarnings({ ...doc, header }, state, data), until: old.raceDate };
  }
  return reskeleton(doc, state, ev.goal, data);
}

function candidateFor(
  doc: PlanDoc,
  state: RunnerState,
  ev: PlanEvent,
  data: DistanceData
): Candidate | null {
  switch (ev.kind) {
    case 'result':
      return onResult(doc, state, ev, data);
    case 'missed':
      return onMissed(doc, state, ev, data);
    case 'pause':
      return onPause(doc, state, ev, data);
    case 'pain':
      return onPain(doc, state, ev, data);
    case 'fatigue':
      return onFatigue(doc, state, ev, data);
    case 'goal-change':
      return onGoal(doc, state, ev, data);
    case 'availability-change':
      return onAvailability(doc, state, ev, data);
    case 'form-update':
      return onFormUpdate(doc, state, ev, data);
    case 'manual-edit':
    case 'none':
      return null;
  }
}

/* ------------------------------------------------------------------ objašnjenje (§ 10) */

const PAUSE_REASON: Readonly<Record<EventOf<'pause'>['reason'], string>> = {
  bolest: ' zbog bolesti',
  put: ' zbog puta',
  povreda: ' zbog povrede',
  nepoznato: ''
};

interface Explain {
  /** Dan u prozoru događaja. */
  day: string;
  /** Dan posle prozora (pravilo rasta, prvi brzi trening posle povratka). */
  late: string;
  week: string;
  header: string;
}

function paceShift(before: PlanDoc, after: PlanDoc): string {
  const delta = after.header.paces.T - before.header.paces.T;
  return `tempa su ${delta < 0 ? 'ubrzana' : 'usporena'} za oko ${String(Math.max(1, Math.abs(delta)))} s po kilometru`;
}

/** Rečenice po događaju: šta se desilo → šta je promenjeno → do kada. */
function explain(
  ev: PlanEvent,
  before: PlanDoc,
  c: Candidate,
  state: RunnerState,
  data: DistanceData,
  last: IsoDate
): Explain {
  const lighter = `zato su treninzi do ${fmtDate(last)} lakši nego što su bili`;
  const next = fmtDate(addDays(c.until, 1));
  const resume = `od ${next} plan se nastavlja kako je bio`;
  const same = (text: string): Explain => ({
    day: text,
    late: text,
    week: text,
    header: text
  });
  switch (ev.kind) {
    case 'pause': {
      const length = pauseLength(ev.from, ev.to);
      const what = `Pauza${PAUSE_REASON[ev.reason]} trajala je ${count(length, DAYS)} (${fmtDateRange(ev.from, ev.to)})`;
      const ramp = countWith(pauseRampDays(length, ev.reason), FIRST, DAYS);
      const day = `${what}, pa je povratak postepen: ${ramp} posle nje treninzi su kraći i lagani, bez brzih deonica; ${resume}.`;
      const late = `${what}; posle povratka obim raste postepeno od onoga što je stvarno odrađeno, a prvi brzi trening svake vrste je kraći — ${lighter}.`;
      const header = `${what}, pa je ostatak plana preračunat od sadašnje baze; ${lighter}.`;
      return { day, late, week: late, header };
    }
    case 'result': {
      const run = state.runs.find((r) => r.id === ev.runId);
      const what =
        run === undefined
          ? 'Stigao je rezultat trke ili testa'
          : `Rezultat ${fmtDistance(run.distanceM)} za ${fmtClock(run.durationSec)} (${fmtDate(run.date)})`;
      const ramp = run === undefined ? 0 : effortRampDays(run.durationSec);
      const day = `${what}: oporavak traje ${count(ramp, DAYS)} — treninzi su kraći i lagani, bez brzih deonica; ${resume}.`;
      const old = fmtClock(raceTimeSec(before.header.form.paceVdot, data.distanceM));
      const faster = c.doc.header.form.paceVdot > before.header.form.paceVdot;
      const { raceDay } = state.form;
      const header = `${what} pokazuje ${faster ? 'bolju' : 'slabiju'} formu od one po kojoj je plan pisan (${old} na distanci trke): ${paceShift(before, c.doc)}, a očekivano vreme trke je sada oko ${fmtClock(raceDay.expectedSec)} (raspon ${fmtClock(raceDay.lowSec)}–${fmtClock(raceDay.highSec)}).`;
      const late = `${what}: posle oporavka je prvi brzi trening svake vrste nešto kraći — ${lighter}; ostatak plana je isti.`;
      return { day, late, week: late, header };
    }
    case 'missed': {
      const missed = before.weeks.flatMap((w) => w.days).find((d) => d.id === ev.dayId);
      return same(
        `Propušten je trening „${missed?.workout?.text ?? ''}" (${fmtDate(ev.date)}), zato sledeći isti trening ${fmtDate(c.until)} ostaje na toj dozi umesto da raste; ostatak plana je isti.`
      );
    }
    case 'pain': {
      if (ev.level <= PAIN_LOW_MAX) {
        return same(
          `Prijavljen je blag bol (nivo ${String(ev.level)}), pa ${countWith(PAIN_LOW_DAYS, NEXT, DAYS)} nema treninga sa jakim udarom (uzbrdice, kratke brze deonice); ${resume}.`
        );
      }
      if (ev.level <= PAIN_MID_MAX) {
        return same(
          `Prijavljen je bol (nivo ${String(ev.level)}), pa su treninzi ${countWith(PAIN_MID_DAYS, NEXT, DAYS)} kraći i bez brzih deonica; ${resume}.`
        );
      }
      const pain = `Prijavljen je jak bol (nivo ${String(ev.level)}): odmor traje ${count(PAIN_HIGH_REST_DAYS, DAYS)} — javi se lekaru ili fizioterapeutu`;
      const day = `${pain}; posle toga je povratak postepen, a ${resume}.`;
      const late = `${pain}; posle povratka je prvi brzi trening svake vrste kraći — ${lighter}.`;
      return { day, late, week: late, header: day };
    }
    case 'fatigue': {
      const what =
        ev.source === 'trkac'
          ? 'Prijavljen je umor'
          : 'Opterećenje poslednjih 7 dana je znatno iznad tvoje baze';
      return same(
        `${what}, pa su treninzi ${countWith(FATIGUE_DAYS, NEXT, DAYS)} kraći i bez brzih deonica; ${resume}.`
      );
    }
    case 'goal-change': {
      const g = ev.goal;
      if (
        g.raceDate === before.header.goal.raceDate &&
        g.distanceId === before.header.goal.distanceId
      ) {
        const time =
          g.targetTimeSec === undefined
            ? 'uklonjeno'
            : `promenjeno na ${fmtClock(g.targetTimeSec)}`;
        return same(
          `Ciljno vreme je ${time}; treninzi ostaju isti jer tempa prate formu, a ne cilj.`
        );
      }
      return same(
        `Cilj je promenjen (trka ${fmtDateYear(g.raceDate)}), pa je ostatak plana složen iznova od ${fmtDate(addDays(state.today, 1))} do trke.`
      );
    }
    case 'availability-change':
      return same(
        `Dani trčanja su promenjeni, pa je ostatak plana raspoređen iznova od ${fmtDate(addDays(state.today, 1))} do trke.`
      );
    case 'form-update': {
      const old = fmtClock(raceTimeSec(before.header.form.paceVdot, data.distanceM));
      const now = fmtClock(raceTimeSec(ev.vdot, data.distanceM));
      return same(
        `Procena forme se promenila (${old} → ${now} na distanci trke): ${paceShift(before, c.doc)}; treninzi ostaju isti.`
      );
    }
    default:
      return same('');
  }
}

const textOf = (day: PlanDay | undefined): string => day?.workout?.text ?? 'odmor';

const isFast = (day: PlanDay | undefined): boolean =>
  day?.workout != null &&
  (day.workout.kind === 'quality' || day.workout.kind === 'test' || day.workout.workSec > 0);

function dayWhat(
  ev: PlanEvent,
  before: PlanDay | undefined,
  after: PlanDay,
  c: Candidate
): Change['what'] {
  if (ev.kind === 'availability-change' || ev.kind === 'goal-change') return 'raspored';
  if (c.repeatDayId === after.id) return 'doza-ponovljena';
  if (after.workout === null) return 'odmor';
  if (isFast(before) && !isFast(after)) return 'kvalitet-u-lagano';
  return 'skraceno';
}

/** Razlike između dokumenta pre i posle događaja, svaka sa objašnjenjem. Prazno = događaj ništa ne menja. */
function describe(
  before: PlanDoc,
  c: Candidate,
  ev: PlanEvent,
  state: RunnerState,
  data: DistanceData
): Change[] {
  const after = c.doc;
  const oldByDate = new Map(allDays(before).map((d) => [d.date, d] as const));
  const differs = (day: PlanDay): boolean => {
    const previous = oldByDate.get(day.date);
    if (previous === undefined) return day.workout !== null;
    return canonical(previous.workout) !== canonical(day.workout);
  };
  const last = allDays(after).reduce(
    (max, day) => (differs(day) && day.date > max ? day.date : max),
    c.until
  );
  const text = explain(ev, before, c, state, data, last);
  const changes: Change[] = [];
  const base = { eventId: ev.id, until: c.until };
  const beforeCtx = paceCtxOf(before.header);
  const afterCtx = paceCtxOf(after.header);

  const h0 = before.header;
  const h1 = after.header;
  if (canonical(h0.goal) !== canonical(h1.goal)) {
    changes.push({
      ...base,
      scope: 'zaglavlje',
      what: 'cilj',
      before: `trka ${fmtDateYear(h0.goal.raceDate)}${h0.goal.targetTimeSec === undefined ? '' : `, cilj ${fmtClock(h0.goal.targetTimeSec)}`}`,
      after: `trka ${fmtDateYear(h1.goal.raceDate)}${h1.goal.targetTimeSec === undefined ? '' : `, cilj ${fmtClock(h1.goal.targetTimeSec)}`}`,
      reason: text.header
    });
  }
  if (canonical(h0.paces) !== canonical(h1.paces)) {
    changes.push({
      ...base,
      scope: 'zaglavlje',
      what: 'tempa',
      before: `prag ${fmtPace(h0.paces.T)}, tempo trke ${fmtPace(h0.paces.RP)}`,
      after: `prag ${fmtPace(h1.paces.T)}, tempo trke ${fmtPace(h1.paces.RP)}`,
      reason: text.header
    });
  }
  if (
    canonical([h0.decisions.runDays, h0.decisions.longDay]) !==
    canonical([h1.decisions.runDays, h1.decisions.longDay])
  ) {
    changes.push({
      ...base,
      scope: 'zaglavlje',
      what: 'raspored',
      before: `${count(h0.decisions.runDays.length, DAYS)} trčanja nedeljno`,
      after: `${count(h1.decisions.runDays.length, DAYS)} trčanja nedeljno`,
      reason: text.header
    });
  }
  const codes = (list: readonly Warning[]): string => list.map((w) => w.code).join(',');
  if (codes(h0.warnings) !== codes(h1.warnings)) {
    changes.push({
      ...base,
      scope: 'zaglavlje',
      what: 'upozorenje',
      before: `${String(h0.warnings.length)} u zaglavlju`,
      after: `${String(h1.warnings.length)} u zaglavlju`,
      reason: text.header
    });
  }

  const weekChanges: Change[] = [];
  for (const week of after.weeks) {
    const old = before.weeks.find((w) => w.start === week.start);
    if (
      old !== undefined &&
      old.targetLoad !== week.targetLoad &&
      addDays(week.start, 6) > state.today
    ) {
      const km0 = weekCost(old, h0.goal.raceDate, beforeCtx).km;
      const km1 = weekCost(week, h1.goal.raceDate, afterCtx).km;
      if (km0 !== km1) {
        weekChanges.push({
          ...base,
          scope: 'nedelja',
          weekIndex: week.index,
          what: 'obim',
          before: `${fmtNumber(km0)} km`,
          after: `${fmtNumber(km1)} km`,
          reason: text.week,
          until: last
        });
      }
    }
    for (const day of week.days) {
      if (!differs(day)) continue;
      const previous = oldByDate.get(day.date);
      const inWindow = day.date <= c.until;
      changes.push({
        ...base,
        scope: 'dan',
        dayId: day.id,
        weekIndex: week.index,
        what: dayWhat(ev, previous, day, c),
        before: textOf(previous),
        after: textOf(day),
        reason: inWindow ? text.day : text.late,
        until: inWindow ? c.until : last
      });
    }
  }
  changes.push(...weekChanges);
  return changes;
}

export const replan: ReplanFn = (doc, state, events, data) => {
  if (doc.header.protected) return { doc, changes: [] };
  const applied = new Set(doc.header.appliedEvents);
  const todo = sortEvents(events).filter((e) => e.kind !== 'none' && !applied.has(e.id));
  let current = doc;
  const changes: Change[] = [];
  for (const ev of todo) {
    const candidate = candidateFor(current, state, ev, data);
    if (candidate === null) continue;
    const diff = describe(current, candidate, ev, state, data);
    if (diff.length === 0) continue;
    const h = candidate.doc.header;
    current = {
      ...candidate.doc,
      header: {
        ...h,
        form: { ...h.form, current: state.form.current, raceDay: state.form.raceDay },
        appliedEvents: [...h.appliedEvents, ev.id]
      }
    };
    changes.push(...diff);
  }
  return changes.length === 0 ? { doc, changes: [] } : { doc: current, changes };
};
