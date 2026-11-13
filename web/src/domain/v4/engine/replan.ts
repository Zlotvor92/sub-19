/* V4 — `replan` (SPEC § 6.3–6.4, § 10): najmanja dovoljna promena po događaju. Bez događaja vraća ulazni dokument.
   Dan u prozoru se gradi iznova iz namere + odluka (isti prolaz kao `plan`); svaka razlika dobija objašnjenje. */
import {
  PACE_UPDATE_AFTER_RESULT_VDOT,
  PAIN_CONTINUE_MAX,
  PAIN_DOCTOR_AFTER_DAYS,
  PAIN_HIGH_REST_DAYS,
  PAIN_LEVEL_MAX,
  PAIN_LOW_DAYS,
  PAIN_LOW_MAX,
  PAIN_LOW_REST_DAYS,
  PAIN_MID_DAYS,
  PAIN_MID_LONG_DAYS,
  PAIN_MID_MAX,
  PAIN_MID_REST_DAYS,
  PAIN_STOP_FROM,
  VDOT_MAX,
  VDOT_MIN,
  PAUSE_FULL_REPLAN_DAYS,
  PAUSE_MIN_DAYS,
  FATIGUE_DAYS,
  MISSED_LOOKAHEAD_DAYS,
  NO_FAST_DAYS_AFTER_EFFORT,
  RESTORE_AFTER_RAMP_DAYS,
  RESTORE_PEAK_AFTER_DAYS,
  RETURN_LONG_JUMP_SEC,
  RETURN_LONG_JUMP_SHARE,
  RETURN_WEEK_JUMP_SHARE,
  PAIN_FIRST_ZONE_MAX_DAYS,
  PAIN_MID_DOSE_FACTOR
} from './constants';
import { buildCtx, doneDayIds, isMutable, runPass } from './build';
import { addDays, isValidDate, mondayOf } from './dates';
import {
  assignDays,
  decideCaps,
  decideDoseBase,
  decideLongMax,
  decidePeak,
  decideWarmup,
  longStepOf,
  minEasyOf,
  decide
} from './decide';
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
  NEXT
} from './format';
import { warnings, weekCost } from './guard';
import { paceCtxOf, summarize } from './load';
import { adjustRaceDay, skeleton } from './plan';
import { adjustmentWindow, effortRampDays, pauseLength, pauseRampDays } from './readiness';
import { mainZone, realize } from './select';
import { lastLongAfterEffort, lastLongBefore, normalizeAvailability } from './state';
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
  Transfer,
  Warning
} from './types';
import { effortResult, raceTimeSec, zonePaces } from './vdot';

type EventOf<K extends PlanEvent['kind']> = Extract<PlanEvent, { kind: K }>;

/** Kandidat posle jednog događaja: novi dokument, poslednji dan na koji promena utiče i dan ponovljene doze. */
interface Candidate {
  doc: PlanDoc;
  until: IsoDate;
  repeatDayId?: string;
  /** Propušten ključni trening: šta je propušteno i šta plan radi (R8) — rečenica ide trkaču i kad se treninzi
      ne menjaju. */
  missed?: { day: PlanDay; weekIndex: number; meaning: string; action: string };
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
  /* Rezultat provere forme ili pripremne trke IZ PLANA: samo § 14.1 (3 dana bez brzog), bez rampe i × 0,8. */
  /* E5 (krug 5): kratka trka van plana (do `safety.shortEffortSec`) se oporavlja kao planirana provera — samo
     § 14.1, bez rampe */
  const short = data.safety.shortEffortSec;
  const planned =
    allDays(doc).some((d) => d.id === run.dayId && d.workout?.kind === 'test') ||
    (short !== undefined && run.durationSec <= short);
  /* K1: rezultat je deonica punog napora; aktivnost iz koje se ona ne može izdvojiti nije dokaz forme. */
  const result = effortResult(run);
  const durationSec = result?.durationSec ?? run.durationSec;
  const adj: Adjustment = {
    kind: 'effort',
    source: ev.id,
    date: run.date,
    durationSec,
    lastLongSec: lastLongAfterEffort(state, run.date, durationSec),
    ...(planned ? { planned: true } : {})
  };
  let header = withAdjustment(doc.header, adj);
  if (result !== null) {
    const vdot = state.form.current.vdot;
    const moved = Math.abs(vdot - header.form.paceVdot) >= PACE_UPDATE_AFTER_RESULT_VDOT;
    /* O4: posle prvog usvojenog rezultata tempa više nisu „po osećaju" (bez obzira na razliku) i upozorenje
       `nema-podataka` nestaje. */
    if (moved || header.paces.byFeel) {
      const paceVdot = moved ? vdot : header.form.paceVdot;
      header = {
        ...header,
        form: {
          ...header.form,
          paceVdot,
          pacesUpdatedOn: moved ? state.today : header.form.pacesUpdatedOn,
          ...(transferOf(state, header) !== undefined
            ? { transfer: transferOf(state, header) }
            : {})
        },
        paces: zonePaces(
          paceVdot,
          data.distanceM,
          false,
          data.safety.intervalPaceFloor,
          transferOf(state, header)
        ),
        warnings: header.warnings.filter(
          (w) =>
            w.code !== 'nema-podataka' ||
            (state.load.seeded && state.profile.weeklyKm === undefined)
        )
      };
    }
  }
  const window = adjustmentWindow(adj);
  if (window === null) return null;
  /* Z1 (krug 7): i posle oporavka od NEPLANIRANE trke izlazak bez skoka (planirana provera nije prekid) */
  const built = runPass({ ...doc, header }, state, data, { window, rechainFrom: null });
  /* povratak posle prekida (pauza, bol) još traje — i tada izlazak bez skoka (s26) */
  const returning = (header.adjustments ?? []).some((a) => {
    if (a.kind !== 'pause' && a.kind !== 'pain') return false;
    const w = adjustmentWindow(a);
    return w !== null && addDays(w.rampEnd, 28) >= state.today;
  });
  if (planned && !returning) return { doc: built, until: window.rampEnd };
  const smooth = smoothExit(built, doc, window.rampEnd, state, data);
  return { doc: smooth.doc, until: smooth.until > window.rampEnd ? smooth.until : window.rampEnd };
}

/** Dugi sa završnim delom u tempu (blok ili progresija). */
const hasBlock = (day: PlanDay | undefined): boolean =>
  day?.workout != null && day.workout.kind === 'long' && day.workout.workSec > 0;

const MISSED_MEANING = {
  block:
    'To je bio jedan od glavnih treninga u tempu trke, pa je specifična priprema tanja nego što je planirano',
  long: 'Dugi trening nosi izdržljivost za drugu polovinu trke',
  quality: 'To je bio glavni brzi trening te nedelje'
} as const;

/** PROPUŠTEN KLJUČNI TRENING (§ 6.4, krug 2: R8). Ključan je dugi ili prvi podražaj nedelje gradnje/vrha.
    (a) trkač uvek dobija rečenicu; (b) propušten dugi sa blokom ili vršni kvalitet: sledeći dugi u nedelji
    gradnje/vrha dobija blok na prethodnom koraku lestvice (ne većem), a ako takve nedelje nema — nije
    nadoknadivo; (c) više propuštenih dugih zaredom: sledeći dugi ≤ poslednji odrađen + korak, bez bloka, a lanac
    dugog dalje ide od stvarno odrađenog. Inače: sledeći isti trening ostaje na propuštenoj dozi ili dužini. */
/** R1 + R6 (krug 6): propušten trening ne kvari ostatak plana. Iz ishoda ostaju samo izmene u naredne
    `MISSED_LOOKAHEAD_DAYS` dana, van poslednje dve nedelje pred trku (sužavanje) i nedelje trke, i ne na laganim danima
    (rep od ± 5 min); dugi ne postaje kraći od prvobitnog (nadoknada nikad na račun sledećeg dugog). */
function guardMissed(
  c: Candidate | null,
  original: PlanDoc,
  state: RunnerState,
  data: DistanceData
): Candidate | null {
  if (c === null) return null;
  const pace = paceCtxOf(original.header);
  const ctxB = buildCtx(c.doc.header, data);
  let lengthKept = false;
  const n = original.weeks.length;
  const last = addDays(state.today, MISSED_LOOKAHEAD_DAYS);
  /* zašto je ciljni dan vraćen (za rečenicu trkaču) */
  let why: string | null = null;
  const weeks = c.doc.weeks.map((w, i): PlanWeek => {
    const old = original.weeks[i];
    if (old === undefined || old.start !== w.start) return w;
    const taper = w.index >= n - 2;
    return {
      ...w,
      days: w.days.map((d): PlanDay => {
        const o = old.days.find((x) => x.id === d.id);
        if (o === undefined || canonical(o.workout) === canonical(d.workout)) return d;
        const target = d.id === c.repeatDayId;
        if (taper) {
          if (target) why = 'poslednje dve nedelje pred trku su za odmor';
          return o;
        }
        if (d.date > last) {
          if (target) why = 'nadoknada važi samo u naredne dve nedelje';
          return o;
        }
        if (o.workout?.kind === 'easy' && d.workout?.kind === 'easy') return o;
        if (o.workout?.kind === 'long' && d.workout?.kind === 'long') {
          const was = summarize(o.workout, pace).durationSec;
          if (summarize(d.workout, pace).durationSec < was - 60) {
            /* sadržaj izmene ostaje (bez bloka / manji blok), dužina je prvobitna */
            const sameContent =
              d.workout.workSec === o.workout.workSec &&
              d.workout.libraryId === o.workout.libraryId;
            if (sameContent) {
              if (target) why = 'propušten trening se ne nadoknađuje produžavanjem sledećeg dugog';
              return o;
            }
            const def = data.library.find((x) => x.id === d.workout?.libraryId) ?? null;
            /* zaokruživanje dana (0,5 km) ne sme da ga spusti ispod prvobitnog */
            const dose = d.workout.workSec;
            const at = (extraKm: number): ReturnType<typeof realize> =>
              realize(
                {
                  type: 'long',
                  sec: Math.ceil((was + extraKm * ctxB.pace.paces.easy) / 60) * 60,
                  def,
                  dose,
                  slot: null
                },
                ctxB
              );
            const first = at(0.25);
            const workout =
              first !== null && summarize(first, pace).durationSec >= was - 60 ? first : at(0.75);
            if (workout === null) return d;
            if (target) lengthKept = true;
            return { ...d, workout };
          }
        }
        return d;
      })
    };
  });
  let action: string | null =
    why === null || c.missed === undefined
      ? null
      : `sledeći ${c.missed.day.workout?.kind === 'long' ? 'dugi' : 'isti trening'} ostaje kako je planiran — ${String(why)}`;
  if (lengthKept && why === null) {
    const now = weeks.flatMap((w) => w.days).find((d) => d.id === c.repeatDayId);
    const was = original.weeks.flatMap((w) => w.days).find((d) => d.id === c.repeatDayId);
    const less = (now?.workout?.workSec ?? 0) < (was?.workout?.workSec ?? 0);
    const kept = c.missed?.action ?? '';
    if (now !== undefined)
      action = kept.includes('prethodnom koraku')
        ? `${kept}; dužina ostaje prvobitna`
        : `sledeći dugi (${fmtDate(now.date)}) ostaje prvobitne dužine${(now.workout?.workSec ?? 0) === 0 ? ', bez brzog završnog dela' : less ? ', sa kraćim završnim delom u tempu trke' : ''} — propušten trening se ne nadoknađuje produžavanjem sledećeg dugog`;
  }
  const missed = action !== null && c.missed !== undefined ? { ...c.missed, action } : c.missed;
  return { ...c, doc: { ...c.doc, weeks }, ...(missed === undefined ? {} : { missed }) };
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
  const days = allDays(doc);
  const ctx = paceCtxOf(doc.header);
  const future = (d: PlanDay): boolean =>
    d.date > state.today && d.date > day.date && isMutable(d, doc.header, state.today, done);
  const weekOf = (d: PlanDay): PlanWeek | undefined =>
    doc.weeks.find((w) => w.days.some((x) => x.id === d.id));
  const nextLong = days.find((d) => future(d) && d.workout?.kind === 'long');
  const nextBuildLong = days.find((d) => {
    const kind = weekOf(d)?.intent.kind;
    return future(d) && d.workout?.kind === 'long' && (kind === 'build' || kind === 'peak');
  });
  const base = (meaning: string, action: string): NonNullable<Candidate['missed']> => ({
    day,
    weekIndex: week.index,
    meaning,
    action
  });
  const notice = (meaning: string, action: string): Candidate => ({
    doc,
    until: ev.date,
    missed: base(meaning, action)
  });
  const build = (
    adj: Adjustment,
    target: PlanDay,
    info: NonNullable<Candidate['missed']>,
    rechainLongFrom: number | null = null
  ): Candidate => ({
    doc: runPass({ ...doc, header: withAdjustment(doc.header, adj) }, state, data, {
      window: rechainLongFrom === null ? { from: target.date, to: target.date } : null,
      rechainFrom: null,
      rechainLongFrom
    }),
    until: target.date,
    repeatDayId: target.id,
    missed: info
  });

  /* (c) Dugi propušten više puta zaredom: lanac ide od poslednjeg stvarno odrađenog dugog. */
  if (isLong) {
    const longDays = days.filter((d) => d.workout?.kind === 'long' && d.date <= day.date);
    let streak = 0;
    for (let i = longDays.length - 1; i >= 0; i -= 1) {
      const d = longDays[i];
      if (d === undefined || done.has(d.id)) break;
      streak += 1;
    }
    if (streak >= 2 && nextLong !== undefined) {
      const lastDone = lastLongBefore(state, addDays(state.today, 1));
      const from = lastDone > 0 ? lastDone : doc.header.decisions.longStartSec;
      const lengthSec = from + longStepOf(data.safety, doc.header.paces.easy);
      const targetWeek = weekOf(nextLong);
      return build(
        { kind: 'repeat', source: ev.id, dayId: nextLong.id, lengthSec, noBlock: true },
        nextLong,
        base(
          `Dugi trening je propušten ${String(streak)} puta zaredom, pa se dužina više ne nastavlja tamo gde je plan stao`,
          `sledeći dugi (${fmtDate(nextLong.date)}) kreće od poslednjeg odrađenog i nema brzi završni deo, a zatim opet raste korak po korak`
        ),
        (targetWeek?.index ?? week.index) + 1
      );
    }
  }

  /* (b) Propušten dugi sa blokom ili vršni kvalitet. */
  const block = hasBlock(day);
  const peakQuality = !isLong && week.intent.kind === 'peak';
  if (block || peakQuality) {
    if (nextBuildLong === undefined) {
      return notice(
        MISSED_MEANING.block,
        'do trke više nema nedelje u kojoj bi mogao da se nadoknadi — poslednje dve nedelje su za odmor, pa plan ostaje isti'
      );
    }
    const earlier = [...days].reverse().find((d) => d.date < day.date && hasBlock(d));
    const planned = nextBuildLong.workout?.workSec ?? 0;
    const sample = block ? day : (earlier ?? (planned > 0 ? nextBuildLong : undefined));
    const stimulus = sample?.workout?.stimulus ?? null;
    const ladder = stimulus === null ? undefined : data.safety.progression[stimulus];
    const cap = stimulus === null ? undefined : doc.header.decisions.doseCapSec[stimulus];
    const start = ladder === undefined || cap === undefined ? 0 : ladder.startPct * cap;
    const previousStep = earlier?.workout?.workSec ?? start;
    const wanted = block
      ? Math.min(missed.workSec, Math.max(planned, previousStep))
      : planned > 0
        ? planned
        : previousStep;
    const defId = sample?.workout?.libraryId;
    if (wanted <= 0 || defId === undefined || (wanted === planned && !block)) {
      return notice(
        MISSED_MEANING.block,
        `sledeći dugi (${fmtDate(nextBuildLong.date)}) već nosi završni deo u tempu trke, pa se zbog ovog treninga ništa ne menja`
      );
    }
    const lengthSec = block ? Math.round(summarize(missed, ctx).durationSec) : undefined;
    return build(
      {
        kind: 'repeat',
        source: ev.id,
        dayId: nextBuildLong.id,
        blockSec: Math.round(wanted),
        blockDefId: defId,
        ...(lengthSec === undefined ? {} : { lengthSec })
      },
      nextBuildLong,
      base(
        MISSED_MEANING.block,
        `sledeći dugi (${fmtDate(nextBuildLong.date)}) nosi završni deo u tempu trke na prethodnom koraku, ne na većem`
      )
    );
  }

  /* Ostalo: sledeći isti trening u 14 dana ostaje na propuštenoj dozi ili dužini. */
  const last = addDays(day.date, MISSED_LOOKAHEAD_DAYS);
  const target = days.find(
    (d) =>
      future(d) &&
      d.date <= last &&
      d.workout !== null &&
      d.workout.kind === missed.kind &&
      (isLong || d.workout.stimulus === missed.stimulus)
  );
  const meaning = isLong ? MISSED_MEANING.long : MISSED_MEANING.quality;
  if (target === undefined) {
    return notice(
      meaning,
      'u naredne dve nedelje nema istog treninga na kom bi se nadoknadio, pa plan ostaje isti'
    );
  }
  /* S7: kad je sledeći isti trening već kraći (rasterećenje) ili manje doze, nema šta da „ostane" — plan je isti. */
  const next = isLong ? summarize(target.workout, ctx).durationSec : (target.workout?.workSec ?? 0);
  const was = isLong ? summarize(missed, ctx).durationSec : missed.workSec;
  const already = next <= was;
  if (already) {
    /* M8d (krug 5): obrazloženje prema planu — „iste dužine" kad nije kraći (s10) */
    const equal = Math.abs(next - was) < 60;
    const how = isLong ? (equal ? 'iste dužine' : 'kraći') : equal ? 'iste doze' : 'manji';
    return notice(
      meaning,
      /* Y4 (krug 7): bez „plan ostaje isti" — drugi događaj može da promeni isti dan (s11, s12) */
      `sledeći isti trening (${fmtDate(target.date)}) je po planu ${how}, pa se zbog ovoga ne produžava`
    );
  }
  const adj: Adjustment = isLong
    ? {
        kind: 'repeat',
        source: ev.id,
        dayId: target.id,
        lengthSec: Math.round(summarize(missed, ctx).durationSec)
      }
    : { kind: 'repeat', source: ev.id, dayId: target.id, workSec: missed.workSec };
  return build(
    adj,
    target,
    base(
      meaning,
      `sledeći isti trening (${fmtDate(target.date)}) ostaje na ${isLong ? 'toj dužini' : 'toj dozi'} umesto da raste`
    )
  );
}

/** Pauza ≥ 14 dana: vrh iz nove baze (ne iznad starog), plafoni i najduži dugi iz njega (§ 6.3). */
function redecide(d: Decisions, state: RunnerState, data: DistanceData, easy: number): Decisions {
  const template = data.templates.find((t) => t.id === d.templateId);
  if (template === undefined) return d;
  const baseLoad = Math.round(70 * state.load.chronic) / 10;
  const peakLoad = Math.min(
    d.peakLoad,
    Math.round(decidePeak(baseLoad, template, data.safety, d.level, d.peakOverBase) * 10) / 10
  );
  return {
    ...d,
    baseLoad,
    peakLoad,
    doseCapSec: decideCaps(peakLoad, data.safety, d.level),
    ...(d.doseBaseSec === undefined ? {} : { doseBaseSec: decideDoseBase(peakLoad, data.safety) }),
    longMaxSec: Math.min(
      d.longMaxSec,
      decideLongMax(peakLoad, data.safety, d.level, d.runDays.length, easy)
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
  if (full)
    header = { ...header, decisions: redecide(header.decisions, state, data, header.paces.easy) };
  const rampEnd = addDays(ev.to, pauseRampDays(length, ev.reason));
  const built = restoreAfter(
    runPass({ ...doc, header }, state, data, {
      window: null,
      rechainFrom: currentWeekIndex(doc, state.today) + 1
    }),
    doc,
    full ? null : rampEnd
  );
  const until = full
    ? rampEnd
    : minDate(addDays(rampEnd, RESTORE_AFTER_RAMP_DAYS), lastPlanDay(doc));
  /* R2 (krug 6): izlazak iz prozora bez skoka */
  const smooth = smoothExit(built, doc, rampEnd, state, data);
  return {
    doc: full ? refreshWarnings(smooth.doc, state, data) : smooth.doc,
    until: smooth.until > until ? smooth.until : until
  };
}

const minDate = (a: IsoDate, b: IsoDate): IsoDate => (a < b ? a : b);

/** R2 (krug 6): izlazak iz prozora izmene bez skoka. Posle `end` nedelja po nedelja: dugi najviše
    `RETURN_LONG_JUMP_SHARE` / `RETURN_LONG_JUMP_SEC` iznad najvećeg od prethodnih (od prve cele nedelje posle
    događaja), nedelja najviše `RETURN_WEEK_JUMP_SHARE` — ili koliko i prvobitan plan na tom mestu (rasterećenje →
    gradnja). Nedelja koja traži više se skraćuje (dugi do granice uz zadržan blok, lagani dani srazmerno) i prozor
    se produžava; prva nedelja koja staje vraća prvobitan plan. Sužavanje i nedelja trke se ne diraju.
    Vraća plan i poslednji izmenjen dan (novi kraj prozora). */
function smoothExit(
  after: PlanDoc,
  _original: PlanDoc,
  end: IsoDate,
  state: RunnerState,
  data: DistanceData
): { doc: PlanDoc; until: IsoDate } {
  const ctxB = buildCtx(after.header, data);
  const pace = paceCtxOf(after.header);
  const race = after.header.goal.raceDate;
  const km = (w: PlanWeek): number => weekCost(w, race, pace).km;
  const longOf = (w: PlanWeek): PlanDay | undefined =>
    w.days.find((d) => d.workout?.kind === 'long');
  const longSec = (w: PlanWeek | undefined): number => {
    const day = w === undefined ? undefined : longOf(w);
    return day?.workout === undefined || day.workout === null
      ? 0
      : summarize(day.workout, pace).durationSec;
  };
  const done = doneDayIds(state);
  const weeks = [...after.weeks];
  const base = weeks.findIndex((w) => w.start > state.today);
  /* od prve nedelje koja se završava posle kraja rampe */
  const first = weeks.findIndex((w) => addDays(w.start, 6) > end);
  let until = end;
  if (base < 0 || first < 0) return { doc: after, until };
  const n = weeks.length;
  for (let i = Math.max(first, base + 1); i < n - 2; i += 1) {
    const w = weeks[i];
    if (w === undefined) break;
    const lo = Math.max(base, i - 3);
    const prev = weeks.slice(lo, i);
    const pKm = Math.max(...prev.map(km));
    const curKm = km(w);
    const curLong = longSec(w);
    /* Z1 (krug 7): posle prekida bez izuzetka prvobitnog plana (ni za nedelju) */
    const kmCap = RETURN_WEEK_JUMP_SHARE * pKm;
    /* Z1 (krug 7): dugi se meri od POSLEDNJEG dugog (ne najvećeg od tri) i važi i preko rasterećenja/provere —
       posle prekida nema izuzetka „prvobitan plan ima isti skok" */
    const lastLong =
      [...prev]
        .reverse()
        .map((x) => longSec(x))
        .find((x) => x > 0) ?? 0;
    const longCap = Math.max(RETURN_LONG_JUMP_SHARE * lastLong, lastLong + RETURN_LONG_JUMP_SEC);
    const longOver = lastLong > 0 && curLong > longCap + 60;
    const kmOver = pKm > 0 && curKm > kmCap + 0.5;
    /* povratak je gotov kod prve nedelje koja staje u granicu — dalje važi prvobitan plan */
    /* Z1 (krug 7): nedelja rasterećenja ili provere ne završava povratak — završava ga nedelja gradnje koja staje */
    if (!longOver && !kmOver) {
      if (w.intent.kind === 'recovery' || w.days.some((d) => d.workout?.kind === 'test')) continue;
      break;
    }
    /* dugi do granice (blok ostaje, ne duži od dugog) */
    const days = w.days.map((d): PlanDay => {
      if (!longOver || d.workout?.kind !== 'long' || !isMutable(d, after.header, state.today, done))
        return d;
      const def = data.library.find((x) => x.id === d.workout?.libraryId) ?? null;
      const sec = Math.round(longCap / 60) * 60;
      const workout = realize(
        { type: 'long', sec, def, dose: Math.min(d.workout.workSec, sec / 2), slot: null },
        ctxB
      );
      return workout === null ? d : { ...d, origin: 'template', workout };
    });
    /* lagani dani srazmerno do obima nedelje */
    const trimmed: PlanWeek = { ...w, days };
    const over = km(trimmed) - kmCap;
    const easy = days.filter(
      (d) => d.workout?.kind === 'easy' && isMutable(d, after.header, state.today, done)
    );
    const easyKm = easy.reduce(
      (sum, d) => sum + (d.workout === null ? 0 : summarize(d.workout, pace).km),
      0
    );
    const f = over > 0 && easyKm > 0 ? Math.max(0, 1 - over / easyKm) : 1;
    const minEasy = minEasyOf(
      data.safety,
      after.header.decisions.level,
      after.header.decisions.runDays.length
    );
    const finalDays = days.map((d): PlanDay => {
      if (f >= 1 || !easy.includes(d) || d.workout === null) return d;
      const sec = Math.max(
        minEasy,
        Math.round((summarize(d.workout, pace).durationSec * f) / 60) * 60
      );
      const workout = realize({ type: 'easy', sec }, ctxB);
      return workout === null ? d : { ...d, origin: 'template', workout };
    });
    /* lagani dani na najmanjem: ostatak viška skida dugi, ne ispod poslednjeg dugog */
    let shrunk: PlanWeek = { ...w, days: finalDays };
    const rest = km(shrunk) - kmCap;
    if (rest > 0.5) {
      shrunk = {
        ...shrunk,
        days: shrunk.days.map((d): PlanDay => {
          if (d.workout?.kind !== 'long' || !isMutable(d, after.header, state.today, done))
            return d;
          const sec = summarize(d.workout, pace).durationSec;
          const next = Math.max(lastLong, sec - rest * pace.paces.easy);
          if (next >= sec - 60) return d;
          const def = data.library.find((x) => x.id === d.workout?.libraryId) ?? null;
          const workout = realize(
            {
              type: 'long',
              sec: Math.round(next / 60) * 60,
              def,
              dose: Math.min(d.workout.workSec, next / 2),
              slot: null
            },
            ctxB
          );
          return workout === null ? d : { ...d, origin: 'template', workout };
        })
      };
    }
    /* E2: u skraćenoj nedelji dugi ≤ `shortenedLongMaxShare` nedelje (D' = udeo × ostatak / (1 − udeo)) */
    const lshare = data.safety.shortenedLongMaxShare;
    const longDay = shrunk.days.find((d) => d.workout?.kind === 'long');
    if (
      lshare !== undefined &&
      longDay?.workout != null &&
      isMutable(longDay, after.header, state.today, done)
    ) {
      const lkm = summarize(longDay.workout, pace).km;
      const others = km(shrunk) - lkm;
      const maxKm = (lshare * others) / (1 - lshare);
      if (lkm > maxKm + 0.25) {
        const sec = Math.max(lastLong, maxKm * pace.paces.easy - 30);
        const def = data.library.find((x) => x.id === longDay.workout?.libraryId) ?? null;
        const workout = realize(
          {
            type: 'long',
            sec: Math.round(sec / 60) * 60,
            def,
            dose: Math.min(longDay.workout.workSec, sec / 2),
            slot: null
          },
          ctxB
        );
        if (workout !== null)
          shrunk = {
            ...shrunk,
            days: shrunk.days.map((d) =>
              d.id === longDay.id ? { ...d, origin: 'template', workout } : d
            )
          };
      }
    }
    /* cilj nedelje prati skraćenje (nedelja je namerno manja, ne „ispod cilja") */
    const share = curKm > 0 ? Math.min(1, km(shrunk) / curKm) : 1;
    weeks[i] = {
      ...shrunk,
      targetLoad: Math.round(w.targetLoad * share),
      ...(w.volumeMin === undefined ? {} : { volumeMin: Math.round(w.volumeMin * share * 10) / 10 })
    };
    until = addDays(w.start, 6);
  }
  return { doc: { ...after, weeks }, until };
}
const lastPlanDay = (doc: PlanDoc): IsoDate => addDays(doc.header.goal.raceDate, -1);

/** E1 (krug 5): posle rampe + 14 dana vraća se PRVOBITAN plan bajt-isto; najteža nedelja ≥ 3 nedelje posle povratka
    se ne dira. `rampEnd = null`: bez vraćanja (pauza ≥ 14 dana preračunava plan). */
function restoreAfter(built: PlanDoc, original: PlanDoc, rampEnd: IsoDate | null): PlanDoc {
  if (rampEnd === null) return built;
  const back = addDays(rampEnd, RESTORE_AFTER_RAMP_DAYS);
  const peakFrom = addDays(rampEnd, RESTORE_PEAK_AFTER_DAYS);
  /* Najteža nedelja izgrađena iznova (u prozoru) → i sužavanje se gradi iznova, da silazak intenziteta
     (`safety.taper`) važi prema novoj najtežoj nedelji (dopuna 2 kruga 4, s06) */
  const peakRebuilt = original.weeks.some(
    (w) => w.intent.kind === 'peak' && w.start < peakFrom && w.start <= back
  );
  const taperFrom = addDays(original.header.goal.raceDate, -14);
  const weeks = built.weeks.map((week) => {
    const old = original.weeks.find((w) => w.start === week.start);
    if (old === undefined) return week;
    const keepPeak = old.intent.kind === 'peak' && old.start >= peakFrom;
    if (peakRebuilt && addDays(old.start, 6) >= taperFrom) return week;
    /* M4 (krug 5): pomerena provera forme ostaje i u nedelji koja se vraća na prvobitnu */
    const movedTest = (w: PlanWeek): PlanWeek => ({
      ...w,
      days: w.days.map((d) => {
        const nb = week.days.find((x) => x.id === d.id);
        return nb !== undefined && nb.workout?.kind === 'test' && d.workout?.kind !== 'test'
          ? nb
          : d;
      })
    });
    if (old.start > back || keepPeak) return movedTest(old);
    if (addDays(old.start, 6) <= back) return week;
    /* nedelja preseca granicu: dani posle nje su prvobitni */
    return {
      ...week,
      days: week.days.map((d) => (d.date > back ? (old.days.find((x) => x.id === d.id) ?? d) : d))
    };
  });
  return { ...built, weeks };
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
  if (!Number.isFinite(ev.level) || ev.level < 1 || ev.level > PAIN_LEVEL_MAX) return null;
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
  /* Nivo 4 i više: obim se posle zaštite vraća kao posle pauze — od poslednje pune nedelje pre bola, pa pravilom
     rasta (R7, R9); blag bol menja samo dane u svom prozoru. */
  /* E4 (krug 5): bol do `safety.painReturnFromLevel − 1` menja samo dane u svom prozoru (odmor, lagano, manja prva
     doza); kasnije nedelje ostaju netaknute. Od tog nivoa obim se vraća kao posle pauze. */
  const returning = ev.level >= (data.safety.painReturnFromLevel ?? PAIN_LOW_MAX + 1);
  const built = runPass({ ...doc, header }, state, data, {
    window: returning ? null : window,
    rechainFrom: returning ? currentWeekIndex(doc, state.today) + 1 : null
  });
  const until = returning
    ? minDate(addDays(window.rampEnd, RESTORE_AFTER_RAMP_DAYS), lastPlanDay(doc))
    : window.rampEnd;
  /* Z3 (krug 7): prvi rad svake zone posle bola ≤ 60 %; R2: zatim izlazak iz prozora bez skoka */
  const first = firstZoneAfterPain(
    returning ? restoreAfter(built, doc, window.rampEnd) : built,
    ev.date,
    window.rampEnd,
    state,
    data
  );
  const smooth = smoothExit(first.doc, doc, window.rampEnd, state, data);
  const end = [until, smooth.until, first.until].reduce((a, b) => (a > b ? a : b));
  return { doc: smooth.doc, until: end };
}

/** Z3 (krug 7): posle bola prvi rad SVAKE zone (kvalitet ili blok u dugom) koji se posle bola još nije pojavio ima
    `PAIN_MID_DOSE_FACTOR` (60 %) planirane doze — i kad je posle prozora zaštite (s13: blok 9 km → 5–6 km). */
function firstZoneAfterPain(
  doc: PlanDoc,
  painDate: IsoDate,
  windowEnd: IsoDate,
  state: RunnerState,
  data: DistanceData
): { doc: PlanDoc; until: IsoDate } {
  const ctxB = buildCtx(doc.header, data);
  const pace = paceCtxOf(doc.header);
  const done = doneDayIds(state);
  const last = addDays(painDate, PAIN_FIRST_ZONE_MAX_DAYS);
  const seenZones = new Set<string>();
  let until = windowEnd;
  const weeks = doc.weeks.map((w): PlanWeek => ({
    ...w,
    days: w.days.map((d): PlanDay => {
      const x = d.workout;
      if (x === null || d.date <= painDate || d.date > last || x.workSec <= 0) return d;
      if (x.kind !== 'quality' && x.kind !== 'long') return d;
      const def = data.library.find((y) => y.id === x.libraryId);
      const zone = def === undefined ? null : mainZone(def.main);
      if (def === undefined || zone === null || seenZones.has(zone)) return d;
      seenZones.add(zone);
      if (d.date <= windowEnd || !isMutable(d, doc.header, state.today, done)) return d;
      const dose = Math.round((PAIN_MID_DOSE_FACTOR * x.workSec) / 60) * 60;
      const workout =
        x.kind === 'long'
          ? realize(
              {
                type: 'long',
                sec: Math.round(summarize(x, pace).durationSec / 60) * 60,
                def,
                dose,
                slot: null
              },
              ctxB
            )
          : realize(
              {
                type: 'quality',
                def,
                dose,
                slot: { place: 'quality', stimulus: def.stimulus, index: 0, phase: w.intent.phase }
              },
              ctxB
            );
      if (workout === null) return d;
      if (d.date > until) until = d.date;
      return { ...d, origin: 'template', workout };
    })
  }));
  return { doc: { ...doc, weeks }, until };
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

/** F4-K2: lična kriva forme za nova tempa — iz tekuće procene; bez nje ostaje ona iz zaglavlja. */
function transferOf(state: RunnerState, header: PlanHeader): Transfer | undefined {
  return state.form.transfer ?? header.form.transfer;
}

function onFormUpdate(
  doc: PlanDoc,
  state: RunnerState,
  ev: EventOf<'form-update'>,
  data: DistanceData
): Candidate | null {
  if (!Number.isFinite(ev.vdot) || ev.vdot < VDOT_MIN || ev.vdot > VDOT_MAX) return null;
  const byFeel = doc.header.paces.byFeel && state.form.current.confidence === 'niska';
  const header: PlanHeader = {
    ...doc.header,
    form: {
      ...doc.header.form,
      paceVdot: ev.vdot,
      pacesUpdatedOn: ev.date,
      ...(transferOf(state, doc.header) !== undefined
        ? { transfer: transferOf(state, doc.header) }
        : {})
    },
    paces: zonePaces(
      ev.vdot,
      data.distanceM,
      byFeel,
      data.safety.intervalPaceFloor,
      transferOf(state, doc.header)
    )
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
    longMaxSec: decideLongMax(
      d.peakLoad,
      data.safety,
      d.level,
      a.runDays.length,
      doc.header.paces.easy
    )
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
    ? expandTemplate(picked.template, kept.length + weeks, data.library).slice(kept.length)
    : expandTemplate(picked.template, weeks, data.library);
  const firstIndex = (kept[kept.length - 1]?.index ?? 0) + 1;
  const shells = skeleton(tomorrow, goal.raceDate, intents, data, firstIndex, old.form.paceVdot);
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
    paces: zonePaces(
      old.form.paceVdot,
      data.distanceM,
      old.paces.byFeel,
      data.safety.intervalPaceFloor,
      old.form.transfer
    )
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
      return guardMissed(onMissed(doc, state, ev, data), doc, state, data);
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

/** Prvi dan sa brzim radom posle `after` (kvalitet, provera forme ili dugi sa blokom); `null` = nema ga do trke. */
function firstFastAfter(doc: PlanDoc, after: IsoDate): IsoDate | null {
  const day = allDays(doc).find(
    (d) => d.date > after && d.workout !== null && d.workout.kind !== 'race' && isFast(d)
  );
  return day?.date ?? null;
}

/** Provera forme koju je `replan` pomerio: dan koji je sada provera, a pre nije bio. */
function movedTest(before: PlanDoc, after: PlanDoc, today: IsoDate): IsoDate | null {
  const was = new Set(allDays(before).flatMap((d) => (d.workout?.kind === 'test' ? [d.date] : [])));
  const now = allDays(after).find(
    (d) => d.date > today && d.workout?.kind === 'test' && !was.has(d.date)
  );
  return now?.date ?? null;
}

/** Rečenica o promeni upozorenja: šta je novo i šta više ne važi (prva rečenica problema). */
function warningDelta(before: readonly Warning[], after: readonly Warning[]): string {
  const first = (w: Warning): string => w.problem.split(/(?<=\.)\s/)[0] ?? w.problem;
  const was = new Set(before.map((w) => w.code));
  const now = new Set(after.map((w) => w.code));
  const added = after.filter((w) => !was.has(w.code)).map((w) => `novo upozorenje: ${first(w)}`);
  const gone = before
    .filter((w) => !now.has(w.code))
    .map((w) => `upozorenje više ne važi: ${first(w)}`);
  return [...added, ...gone].join(' ') || 'upozorenja su ažurirana prema novom planu.';
}

/** Uslov za nastavak, prag za prekid i lekar — uz svaki prijavljen bol (R7). */
const PAIN_RULE = `Trči samo ako je bol najviše ${String(PAIN_CONTINUE_MAX)} od 10 i ne raste tokom trčanja; ako poraste na ${String(PAIN_STOP_FROM)} ili više, ili ne prolazi za ${count(PAIN_DOCTOR_AFTER_DAYS, DAYS)}, prekini trčanje i javi se lekaru ili fizioterapeutu.`;

/** Rečenice po događaju: šta se desilo → šta je promenjeno → do kada. */
function explain(
  ev: PlanEvent,
  before: PlanDoc,
  c: Candidate,
  state: RunnerState,
  data: DistanceData,
  last: IsoDate
): Explain {
  /* S9 (krug 4): „lakši nego što su bili" samo ako jeste — svaka buduća nedelja do `last` je ≤ nego pre. */
  const ctxB = paceCtxOf(before.header);
  const ctxA = paceCtxOf(c.doc.header);
  const raceDay = before.header.goal.raceDate;
  const truly = c.doc.weeks.every((w) => {
    if (addDays(w.start, 6) <= state.today || w.start > last) return true;
    const old = before.weeks.find((x) => x.start === w.start);
    return (
      old === undefined || weekCost(w, raceDay, ctxA).km <= weekCost(old, raceDay, ctxB).km + 0.5
    );
  });
  const lighter = truly
    ? `zato su treninzi do ${fmtDate(last)} lakši nego što su bili`
    : `nijedna nedelja do ${fmtDate(last)} nije veća nego pre prekida`;
  const next = fmtDate(addDays(c.until, 1));
  const resume = `od ${next} plan se nastavlja kako je bio`;
  const same = (text: string): Explain => ({
    day: text,
    late: text,
    week: text,
    header: text
  });
  /* Tekst o brzim treninzima prati plan: datum prvog brzog treninga se čita iz izgrađenog plana (R9). */
  const fastFrom = (after: IsoDate): string => {
    const date = firstFastAfter(c.doc, after);
    return date === null ? 'brzih treninga do trke nema' : `prvi brzi trening je ${fmtDate(date)}`;
  };
  switch (ev.kind) {
    case 'pause': {
      const length = pauseLength(ev.from, ev.to);
      /* S2: buduća pauza se opisuje u sadašnjem vremenu, datumi ne idu posle trke, a pauza preko dana trke
         se imenuje. */
      const raceDate = c.doc.header.goal.raceDate;
      const ongoing = ev.to > state.today;
      const what = `Pauza${PAUSE_REASON[ev.reason]} ${ongoing ? 'traje' : 'trajala je'} ${count(length, DAYS)} (${fmtDateRange(ev.from, ev.to)})`;
      if (ev.to >= raceDate) {
        const text = `${what} i pokriva dan trke (${fmtDate(raceDate)}): treninzi do trke su izostavljeni. Ako trku trčiš, upiši kraću pauzu; ako je pomeraš, promeni datum trke.`;
        return { day: text, late: text, week: text, header: text };
      }
      const rampLast = addDays(ev.to, pauseRampDays(length, ev.reason));
      const rampEnd = fmtDate(rampLast < raceDate ? rampLast : addDays(raceDate, -1));
      const test = movedTest(before, c.doc, state.today);
      /* provera koja je pala u pauzu takođe „je bila" (M4) */
      const hadTest = allDays(before).some(
        (d) =>
          d.date >= minDate(ev.from, addDays(state.today, 1)) &&
          d.date < raceDate &&
          d.workout?.kind === 'test'
      );
      const hasTest = allDays(c.doc).some(
        (d) => d.date > state.today && d.date < raceDate && d.workout?.kind === 'test'
      );
      const moved =
        test !== null
          ? ` Provera forme je pomerena na ${fmtDate(test)}`
          : hadTest && !hasTest
            ? ' Provera forme otpada: posle povratka nema nedelje rasterećenja bar 3 nedelje pred trku, a pun napor odmah posle bolesti nije dobar test forme'
            : '';
      const back = `${what}, pa je povratak postepen: treninzi su kraći do ${rampEnd}, a ${fastFrom(ev.to)}`;
      const tail = addDays(c.until, 1) < raceDate ? `; ${resume}` : '';
      const day = `${back}${tail}.${moved}`;
      const late = `${back}; i posle toga se obim vraća postepeno — ${lighter}.${moved}`;
      const header = `${what}, pa je ostatak plana preračunat od sadašnje baze; ${lighter}.${moved}`;
      return { day, late, week: late, header };
    }
    case 'result': {
      const run = state.runs.find((r) => r.id === ev.runId);
      const result = run === undefined ? null : effortResult(run);
      const what =
        run === undefined || result === null
          ? `Stigao je rezultat trke ili testa${run === undefined ? '' : ` (${fmtDate(run.date)})`}`
          : `Rezultat ${fmtDistance(result.distanceM)} za ${fmtClock(result.durationSec)} (${fmtDate(run.date)})`;
      const planned = (c.doc.header.adjustments ?? []).some(
        (x) => x.kind === 'effort' && x.planned === true && x.date === run?.date
      );
      const ramp = run === undefined ? 0 : effortRampDays(result?.durationSec ?? run.durationSec);
      const zero = run?.date ?? ev.date;
      const recovery = `oporavak traje do ${fmtDate(addDays(zero, ramp))} — treninzi su kraći i lagani, a ${fastFrom(zero)}`;
      const day = planned
        ? `${what}: provera forme je bila deo plana, pa su ${countWith(NO_FAST_DAYS_AFTER_EFFORT, NEXT, DAYS)} bez brzih deonica; ${resume}.`
        : `${what}: ${recovery}; ${resume}.`;
      const old = fmtClock(raceTimeSec(before.header.form.paceVdot, data.distanceM));
      const faster = c.doc.header.form.paceVdot > before.header.form.paceVdot;
      const raceDay = adjustRaceDay(
        state.form.raceDay,
        state.form.current.raceTimeSec,
        c.doc.header.decisions
      );
      const range = `očekivano vreme trke je sada oko ${fmtClock(raceDay.expectedSec)} (raspon ${fmtClock(raceDay.lowSec)}–${fmtClock(raceDay.highSec)})`;
      /* Z5 (krug 7): plan „po osećaju" dobija tempa iz rezultata */
      const header = before.header.paces.byFeel
        ? `${what}: tempa su sada izračunata iz ovog rezultata, umesto po osećaju; ${range}.`
        : `${what} pokazuje ${faster ? 'bolju' : 'slabiju'} formu od one po kojoj je plan pisan (${old} na distanci trke): ${paceShift(before, c.doc)}, a ${range}.`;
      const late = `${what}: ${recovery}; i posle toga je prvi brzi trening svake vrste nešto kraći — ${lighter}.`;
      return { day, late, week: late, header };
    }
    case 'missed': {
      const m = c.missed;
      const text = m?.day.workout?.text ?? '';
      return same(
        `Propušten je ključni trening „${text}" (${fmtDate(ev.date)}). ${m?.meaning ?? ''}; ${m?.action ?? 'plan ostaje isti'}.`
      );
    }
    case 'pain': {
      /* M4 (krug 5): pomerena provera forme se kaže i kod bola (s14, s15), isto kao kod bolesti */
      const testAt = movedTest(before, c.doc, state.today);
      const note = testAt === null ? '' : ` Provera forme je pomerena na ${fmtDate(testAt)}.`;
      const same = (text: string): Explain => ({
        day: text + note,
        late: text + note,
        week: text + note,
        header: text + note
      });
      if (ev.level <= PAIN_LOW_MAX) {
        return same(
          `Prijavljen je blag bol (nivo ${String(ev.level)}): ${countWith(PAIN_LOW_REST_DAYS, NEXT, DAYS)} je odmor, prvo trčanje posle toga je lagano, a do ${fmtDate(addDays(ev.date, PAIN_LOW_DAYS))} nema treninga sa jakim udarom (uzbrdice, kratke brze deonice). ${PAIN_RULE} Ako bol ne smeta, od ${next} plan ide dalje po rasporedu.`
        );
      }
      if (ev.level <= PAIN_MID_MAX) {
        return same(
          `Prijavljen je bol (nivo ${String(ev.level)}): ${countWith(PAIN_MID_REST_DAYS, NEXT, DAYS)} su odmor, zatim se do ${fmtDate(addDays(ev.date, PAIN_MID_DAYS))} trči samo lagano, bez brzih deonica i bez brzog dela u dugom; dugi je do ${fmtDate(addDays(ev.date, PAIN_MID_LONG_DAYS))} najviše tri četvrtine poslednjeg dugog, uzbrdica i kratkih brzih deonica do tada nema, a prvi brzi trening svake vrste posle toga ima manju dozu (${fastFrom(ev.date)}). ${PAIN_RULE}`
        );
      }
      const pain = `Prijavljen je jak bol (nivo ${String(ev.level)}): odmor traje ${count(PAIN_HIGH_REST_DAYS, DAYS)} — javi se lekaru ili fizioterapeutu pre prvog sledećeg trčanja`;
      const back = `posle toga je povratak postepen (${fastFrom(ev.date)}) i nastavlja se samo ako je bol najviše ${String(PAIN_CONTINUE_MAX)} od 10 i ne raste`;
      const day = `${pain}; ${back}.${note}`;
      const late = `${pain}; ${back}, a prvi brzi trening svake vrste je kraći — ${lighter}.${note}`;
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
        /* S3: rečenica govori o polju koje se stvarno promenilo. */
        if (g.targetTimeSec === before.header.goal.targetTimeSec) {
          return same('Podaci o trci su izmenjeni (naziv); datum, cilj i treninzi ostaju isti.');
        }
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
  /* M4: pomerena provera forme (prvo rasterećenje posle prozora) ne produžava prozor izmene u objašnjenju */
  const movedTestDay = (day: PlanDay): boolean =>
    day.workout?.kind === 'test' && oldByDate.get(day.date)?.workout?.kind !== 'test';
  const last = allDays(after).reduce(
    (max, day) => (differs(day) && !movedTestDay(day) && day.date > max ? day.date : max),
    c.until
  );
  /* Y4 (krug 7): datum na kraju rečenice nosi svoju tačku — bez „11. 2.." */
  const raw = explain(ev, before, c, state, data, last);
  const dot = (t: string): string => t.replace(/(\d\.)\.(?=\s|$)/g, '$1');
  const text: Explain = {
    day: dot(raw.day),
    late: dot(raw.late),
    week: dot(raw.week),
    header: dot(raw.header)
  };
  /* Jedno objašnjenje po događaju: ako promene idu i posle prozora, sve stavke nose zajedničku rečenicu. */
  const reason = last > c.until ? text.late : text.day;
  const changes: Change[] = [];
  const base = { eventId: ev.id, until: c.until };
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
      /* Z5 (krug 7): iz „po osećaju" u tempa iz rezultata — pre je „po osećaju", ne isti brojevi */
      before: h0.paces.byFeel
        ? 'po osećaju'
        : `prag ${fmtPace(h0.paces.T)}, tempo trke ${fmtPace(h0.paces.RP)}`,
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
      /* S10 (krug 4): svaka stavka promene je rečenica — koje upozorenje je dodato ili uklonjeno */
      before: codes(h0.warnings),
      after: warningDelta(h0.warnings, h1.warnings),
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
      /* Y4 (krug 7): obe strane istim tempima — nova tempa sama ne menjaju nedelju (s04: 14. nedelja posle testa) */
      const km0 = weekCost(old, h0.goal.raceDate, afterCtx).km;
      const km1 = weekCost(week, h1.goal.raceDate, afterCtx).km;
      if (km0 !== km1) {
        weekChanges.push({
          ...base,
          scope: 'nedelja',
          weekIndex: week.index,
          what: 'obim',
          before: `${fmtNumber(km0)} km`,
          after: `${fmtNumber(km1)} km`,
          reason,
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
        reason,
        until: inWindow ? c.until : last
      });
    }
  }
  changes.push(...weekChanges);
  /* Propušten ključni trening: rečenica ide trkaču i kad se nijedan trening ne menja (R8a). */
  if (c.missed !== undefined && changes.length === 0) {
    changes.push({
      ...base,
      scope: 'zaglavlje',
      weekIndex: c.missed.weekIndex,
      what: 'obavestenje',
      before: textOf(c.missed.day),
      after: 'propušteno, plan ostaje isti',
      reason: text.day
    });
  }
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
        form: {
          ...h.form,
          current: state.form.current,
          raceDay: adjustRaceDay(state.form.raceDay, state.form.current.raceTimeSec, h.decisions)
        },
        appliedEvents: [...h.appliedEvents, ev.id]
      }
    };
    changes.push(...diff);
  }
  const result = changes.length === 0 ? doc : current;
  /* R5 (krug 6): upozorenje koje pominje prošli datum („odradi proveru 28. 11.") se računa iznova — i kad se
     treninzi ne menjaju */
  return { doc: freshDatedWarnings(result, state, data), changes };
};

/** Datum „d. m." iz teksta → ISO u godini plana (od početka do trke). */
function textDates(text: string, doc: PlanDoc): IsoDate[] {
  const y0 = Number(doc.header.startDate.slice(0, 4));
  const out: IsoDate[] = [];
  for (const m of text.matchAll(/(\d{1,2})\. (\d{1,2})\./g)) {
    const dd = (m[1] ?? '').padStart(2, '0');
    const mm = (m[2] ?? '').padStart(2, '0');
    const a = `${String(y0)}-${mm}-${dd}`;
    const b = `${String(y0 + 1)}-${mm}-${dd}`;
    out.push(
      addDays(doc.header.startDate, -366) <= a &&
        a <= doc.header.goal.raceDate &&
        a >= addDays(doc.header.startDate, -60)
        ? a
        : b
    );
  }
  return out;
}

function freshDatedWarnings(doc: PlanDoc, state: RunnerState, data: DistanceData): PlanDoc {
  const stale = doc.header.warnings.filter((w) =>
    textDates(`${w.problem} ${w.meaning} ${w.proposal}`, doc).some((d) => d <= state.today)
  );
  if (stale.length === 0) return doc;
  const codes = new Set(stale.map((w) => w.code));
  const fresh = warnings({
    state,
    goal: doc.header.goal,
    data,
    decisions: doc.header.decisions,
    doc
  });
  const next = doc.header.warnings.flatMap((w) => {
    if (!codes.has(w.code)) return [w];
    const f = fresh.find((x) => x.code === w.code);
    return f === undefined ? [] : [f];
  });
  return { ...doc, header: { ...doc.header, warnings: next } };
}
