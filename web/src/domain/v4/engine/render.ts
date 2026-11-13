/* V4 — ISPIS ZA ČOVEKA (SPEC § 14.2). Čitaju ga sudije i vlasnik; provere K1–K5 rubrike se testiraju nad njim.
   Bez ISO datuma i internih izraza; brojevi sa imenicom idu kroz `count`; decimalni zarez. */
import { DEFAULT_TEXTS, FORECAST_CHANGE_MIN_SEC, ZONE_SHARE } from './constants';
import { addDays, diffDays, mondayOf } from './dates';
import {
  count,
  DAYS,
  fillText,
  fmtClock,
  fmtDate,
  fmtDateYear,
  fmtMinutes,
  fmtNumber,
  fmtPace,
  fmtPaceBare,
  fmtWeekday,
  goalStatus,
  raceBasis,
  WEEKS,
  WORKOUTS
} from './format';
import { weekCost } from './guard';
import { paceCtxOf } from './load';
import { adjustmentWindow, effortNoFastDays } from './readiness';
import { adjustRaceDay } from './plan';
import { countWeeks } from './template';
import type {
  Change,
  DistanceData,
  IsoDate,
  Paces,
  PlanDay,
  PlanDoc,
  PlanHeader,
  PlanWeek,
  Run,
  RunnerState,
  SingleStep,
  Step,
  WeekKind,
  Workout,
  ZoneId
} from './types';
import { paceAtShare } from './vdot';

export interface RenderOptions {
  /** Spisak promena posle `replan` (sa objašnjenjem). */
  changes?: readonly Change[];
  /** Zbirni red za sudiju: opterećenje u bodovima uz km i udeo brzog rada. */
  showLoad?: boolean;
}

const KIND_LABEL: Readonly<Record<WeekKind, string>> = {
  build: 'gradnja',
  recovery: 'rasterećenje',
  peak: 'vršna nedelja',
  taper: 'sužavanje pred trku',
  race: 'nedelja trke'
};
/** Nedelja gradnje u poslednje dve nedelje pred nedelju trke više nije „gradnja" (R10). */
const LATE_BUILD_WEEKS = 2;

const ZONE_NAME: Readonly<Record<ZoneId, string>> = {
  E: 'lagano',
  M: 'umereno',
  T: 'prag',
  I: 'intervali',
  R: 'brze deonice',
  RP: 'tempo trke'
};

/** Opis napora kad tempa nisu pouzdana (`byFeel`); distanca može da ga zameni tekstom `napor.<zona>`. */
const ZONE_FEEL: Readonly<Record<ZoneId, string>> = {
  E: 'možeš da pričaš u celim rečenicama',
  M: 'ravnomerno, kratke rečenice',
  T: 'ugodno teško, par reči',
  I: 'teško, ali ravnomerno do kraja',
  R: 'brzo i opušteno, pun oporavak',
  RP: 'napor koji planiraš za trku'
};

/** T5 (krug 6): `{duration}` u opisu napora je očekivano trajanje trke trkača (na 5 min). */
const feelOf = (zone: ZoneId, data: DistanceData, raceSec?: number): string => {
  const text = data.texts[`napor.${zone}`] ?? ZONE_FEEL[zone];
  const duration =
    raceSec === undefined
      ? 'koliko traje tvoja trka'
      : `oko ${fmtMinutes(Math.round(raceSec / 300) * 300)}`;
  return text.split('{duration}').join(duration);
};

/** Tekst zaglavlja ili dana trke: iz podataka distance, inače podrazumevani (`DEFAULT_TEXTS`). */
function line(data: DistanceData, key: string, values: Readonly<Record<string, string>>): string {
  return fillText(data.texts[key] ?? DEFAULT_TEXTS[key] ?? '', values);
}

function zoneHint(zone: ZoneId, paces: Paces, data: DistanceData, raceSec?: number): string {
  if (paces.byFeel) return `${ZONE_NAME[zone]}: ${feelOf(zone, data, raceSec)}`;
  if (zone === 'E') return `lagano ${fmtPaceBare(paces.easyFast)}–${fmtPace(paces.easySlow)}`;
  return `${ZONE_NAME[zone]} ${fmtPace(paces[zone])}`;
}

/** Prva deonica rada u zoni koja nije lagano. */
function firstWork(steps: readonly Step[]): SingleStep | null {
  for (const step of steps) {
    if ('repeat' in step) {
      const inner = firstWork(step.steps);
      if (inner !== null) return inner;
    } else if (step.role === 'work' && step.target.type === 'zone' && step.target.zone !== 'E') {
      return step;
    }
  }
  return null;
}

const escapeRe = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Mesto oznake `{pace}` u već popunjenom tekstu: šablon se pretvara u obrazac (`{x}` → bilo šta) i poklapa. */
function paceIndex(template: string, text: string): number | null {
  if (!template.includes('{pace}')) return null;
  const [before = '', after = ''] = template.split('{pace}');
  const pattern = (part: string): string =>
    part
      .split(/\{\w+\}/)
      .map((literal) => escapeRe(literal).replace(/\s+/g, '\\s*'))
      .join('.*?');
  const match = new RegExp(`^\\s*(${pattern(before)})${pattern(after)}\\s*$`).exec(text);
  return match === null ? null : (match[1] ?? '').trimEnd().length;
}

/** Tekst treninga sa tempom zone rada — samo na mestu oznake `{pace}` iz šablona teksta (R10): unos bez oznake
    (usponi, koraci po naporu) ostaje bez tempa. Trening bez unosa biblioteke (preuzet ili ručni) dobija tempo u
    zagradi na kraju. Kad su tempa „po osećaju", red ostaje bez dodatka — opis napora po zonama je u zaglavlju.
    Lagani i dugi bez bloka su bez tempa. `Workout.text` i otisak nikad ne nose tempo. */
function withPace(workout: Workout, paces: Paces, data: DistanceData): string {
  if (workout.kind === 'race' || workout.kind === 'easy' || paces.byFeel) return workout.text;
  const step = firstWork(workout.steps);
  if (step === null || step.target.type !== 'zone' || step.target.zone === 'E') return workout.text;
  const zone = step.target.zone;
  const def = data.library.find((d) => d.id === workout.libraryId);
  if (def === undefined) return `${workout.text} (${fmtPace(paces[zone])})`;
  const template = data.texts[def.text];
  const at = template === undefined ? null : paceIndex(template, workout.text);
  if (at === null) return workout.text;
  return `${workout.text.slice(0, at)} (${fmtPace(paces[zone])})${workout.text.slice(at)}`;
}

const percent = (share: number): string => `${fmtNumber(share * 100, 0)} %`;

const pacePerKm = (timeSec: number, distanceM: number): string =>
  fmtPace((timeSec / distanceM) * 1000);

/** Istina o tempu trke (R6): po čemu se trenira, šta cilj traži i da li je u rasponu. */
function raceTruth(
  h: PlanHeader,
  raceDay: { lowSec: number; expectedSec: number; highSec: number },
  data: DistanceData
): string {
  if (h.paces.byFeel) return line(data, 'zaglavlje.po-osecaju', {});
  const values = {
    pace: fmtPace(h.paces.RP),
    low: fmtClock(raceDay.lowSec),
    high: fmtClock(raceDay.highSec),
    expected: fmtClock(raceDay.expectedSec),
    expectedPace: pacePerKm(raceDay.expectedSec, data.distanceM)
  };
  const target = h.goal.targetTimeSec;
  const second =
    target === undefined
      ? line(data, 'zaglavlje.bez-cilja', values)
      : line(data, `zaglavlje.cilj.${goalStatus(target, raceDay)}`, {
          ...values,
          goal: fmtClock(target),
          goalPace: pacePerKm(target, data.distanceM)
        });
  return [
    line(data, 'zaglavlje.tempo-trke', values),
    second,
    line(data, 'zaglavlje.tempa-prate', values),
    ...(data.safety.minZoneGapSecPerKm !== undefined &&
    Math.abs(h.paces.T - h.paces.RP) < data.safety.minZoneGapSecPerKm
      ? [line(data, 'zaglavlje.prag-tempo-trke', values)]
      : [])
  ].join(' ');
}

/** Napomene dana trke za ispis (R6): tempo iz cilja ako je u rasponu, inače iz očekivanog vremena; trkač po
    osećaju dobija opis napora bez s/km. Napomene iz podataka mogu da nose `{pace}`, `{paceFrom}`, `{paceTo}`
    (5 i 10 s sporije) i `{time}`; uz pravilo sa `byFeelText` trkač po osećaju dobija taj tekst. */
/** M3 (krug 5): prognoza dana trke za ispis — novija procena iz stanja, po istim pravilima plana. */
function raceDayShown(
  doc: PlanDoc,
  state: RunnerState | undefined
): PlanDoc['header']['form']['raceDay'] {
  const h = doc.header;
  if (state === undefined) return h.form.raceDay;
  return adjustRaceDay(state.form.raceDay, state.form.current.raceTimeSec, h.decisions);
}

export function raceNotes(
  doc: PlanDoc,
  state: RunnerState | undefined,
  data: DistanceData
): string[] {
  const h = doc.header;
  const raceDay = raceDayShown(doc, state);
  const race = doc.weeks
    .flatMap((w) => w.days)
    .find((d) => d.workout?.kind === 'race' && d.date === h.goal.raceDate);
  /* S7 (krug 4): tempo trke iz DANAŠNJE potvrđene forme (po njoj su tempa plana); cilj samo kad je sporiji. Očekivani
     napredak dobija drugu rečenicu — uslovljenu proverom forme iz plana koja je još pred trkačem. */
  /* A18 (krug 9): jedan izvor — današnja prognoza iz zaglavlja (ne posebno računanje iz VDOT-a tempa) */
  const confirmedSec = h.form.current.raceTimeSec;
  const target = h.goal.targetTimeSec;
  const fromGoal = target !== undefined && target >= confirmedSec;
  const timeSec = fromGoal ? target : confirmedSec;
  /* krug 10 (stavka 9): jedan izvor tempa trke — isti broj kao tempo trke u treninzima (zaokruživanje bez razlike) */
  const pace = fromGoal || h.paces.byFeel ? (timeSec / data.distanceM) * 1000 : h.paces.RP;
  /* krug 10 (stavka 10): pomak starta kao udeo tempa kad ga distanca daje, inače sekunde */
  const startOffset = (k: 'from' | 'to'): number => {
    const share = data.safety.raceStartPaceOffsetShare?.[k];
    if (share !== undefined) return pace * share;
    return data.safety.raceStartPaceOffsetSec?.[k] ?? (k === 'from' ? 5 : 10);
  };
  const values = {
    pace: fmtPace(pace),
    paceFrom: fmtPaceBare(pace + startOffset('from')),
    paceTo: fmtPace(pace + startOffset('to')),
    time: fmtClock(timeSec),
    basis: fromGoal ? 'tvoj cilj' : 'današnja forma',
    feel: feelOf('RP', data, raceDay.expectedSec)
  };
  const out: string[] = [
    h.paces.byFeel ? line(data, 'trka.po-osecaju', values) : line(data, 'trka.tempo', values)
  ];
  const hoped = raceBasis(target, raceDay);
  const slower = h.warnings.some((w) => w.proposal.includes('počni sporije'));
  const today = state?.today ?? h.eventsFrom;
  /* krug 10 (stavka 6): poslednja provera forme pred trkom (ne prva) */
  const check = doc.weeks
    .flatMap((w) => w.days)
    .filter((d) => d.workout?.kind === 'test' && d.date > today && d.date < h.goal.raceDate)
    .pop();
  if (!h.paces.byFeel && !slower && check !== undefined && hoped.timeSec < timeSec - 30) {
    const hopedPace = (hoped.timeSec / data.distanceM) * 1000;
    out.push(
      line(data, 'trka.ako-potvrdi', {
        check: `provera forme ${fmtDate(check.date)}`,
        pace: fmtPace(hopedPace),
        time: fmtClock(hoped.timeSec)
      })
    );
  }
  if (h.paces.byFeel && check !== undefined)
    out.push(
      `Tempo i taktiku za trku plan postavlja iz poslednje provere forme (${fmtDate(check.date)}) — do tada trči po osećaju.`
    );
  for (const note of race?.workout?.notes ?? []) {
    const rule = data.noteRules.find((r) => data.texts[r.text] === note);
    const feel = rule?.byFeelText === undefined ? undefined : data.texts[rule.byFeelText];
    out.push(fillText(h.paces.byFeel && feel !== undefined ? feel : note, values));
  }
  out.push(
    line(data, 'trka.oporavak', { days: count(effortNoFastDays(raceDay.expectedSec), DAYS) })
  );
  return out;
}

function headerLines(doc: PlanDoc, state: RunnerState | undefined, data: DistanceData): string[] {
  const h = doc.header;
  const weeks = countWeeks(h.startDate, h.goal.raceDate);
  const lines: string[] = [];
  const name = h.goal.raceName === undefined ? data.label : `${h.goal.raceName} (${data.label})`;
  lines.push(`PLAN: ${name}, trka ${fmtDateYear(h.goal.raceDate)}`);
  lines.push(
    `Početak ${fmtDateYear(h.startDate)} · ${count(weeks, WEEKS)} · ${count(h.decisions.runDays.length, DAYS)} trčanja nedeljno`
  );
  if (h.goal.targetTimeSec !== undefined)
    lines.push(`Ciljno vreme: ${fmtClock(h.goal.targetTimeSec)}`);
  /* Sadašnji obim koji plan pretpostavlja (R10): bazna nedelja u minutima, km po laganom tempu polazne forme. */
  const baseMin = h.decisions.baseLoad;
  const startEasy = paceAtShare(h.form.start.vdot, ZONE_SHARE.E);
  lines.push(
    line(data, 'zaglavlje.obim', {
      km: fmtNumber(h.decisions.baseKm ?? (baseMin * 60) / startEasy, 0),
      time: fmtMinutes((h.decisions.baseVolumeMin ?? baseMin) * 60)
    })
  );
  /* S11 (krug 4): dugi na plafonu ≥ 4 nedelje — zaglavlje kaže zašto ne raste dalje */
  const atCap = doc.weeks.filter(
    (w) => w.longSec > 0 && w.longSec >= h.decisions.longMaxSec - 60
  ).length;
  if (atCap >= 4) {
    lines.push(
      line(data, 'zaglavlje.dugi-plafon', {
        time: fmtMinutes(h.decisions.longMaxSec),
        weeks: count(atCap, WEEKS, 'acc')
      })
    );
  }
  /* krug 11 (stavka 19): godine i oporavak — rečenica iz teksta distance, samo kad odluka plana to nosi */
  const ageText = data.texts['zaglavlje.godine'];
  if (h.decisions.ageYears !== undefined && ageText !== undefined)
    lines.push(
      line(data, 'zaglavlje.godine', {
        age: String(h.decisions.ageYears),
        days: count(h.decisions.qualityMinGapDays ?? 0, DAYS)
      })
    );
  lines.push('');
  lines.push('FORMA');
  lines.push(
    `Polazna forma (${fmtDate(h.form.start.asOf)}): ${fmtClock(h.form.start.raceTimeSec)}`
  );
  const now = state?.form.current ?? h.form.current;
  const raceDay = raceDayShown(doc, state);
  lines.push(
    `Današnja prognoza (${fmtDate(now.asOf)}): ${fmtClock(now.raceTimeSec)}, pouzdanost ${now.confidence}`
  );
  const gain = now.raceTimeSec - raceDay.expectedSec;
  const why =
    gain > 0
      ? ` — ${fmtClock(gain)} brže od današnje prognoze, jer plan do trke podiže obim i dodaje rad u tempu trke`
      : /* krug 10 (stavka 12): nula napretka samo uz izričit razlog u zaglavlju */
        h.decisions.raceDayMaxGain === 0
        ? ' — bez računanja napretka: tek počinješ da trčiš, pa se napredak ne pretpostavlja unapred, nego se procena pomera posle prve provere forme ili trke'
        : '';
  lines.push(
    `Očekivano na dan trke: ${fmtClock(raceDay.expectedSec)} (raspon ${fmtClock(raceDay.lowSec)}–${fmtClock(raceDay.highSec)})${why}`
  );
  lines.push(...forecastChange(h, state));
  lines.push('');
  lines.push(h.paces.byFeel ? 'NAPOR PO ZONAMA (tempa još nisu pouzdana)' : 'TEMPA');
  const zones: ZoneId[] = ['E', 'M', 'T', 'RP', 'I', 'R'];
  for (const zone of zones)
    lines.push(`- ${zoneHint(zone, h.paces, data, h.form.raceDay.expectedSec)}`);
  lines.push(raceTruth(h, raceDay, data));
  if (h.warnings.length > 0) {
    lines.push('');
    lines.push('UPOZORENJA');
    for (const w of h.warnings) lines.push(`- ${w.problem} ${w.meaning} ${w.proposal}`);
  }
  return lines;
}

/** Najviše ovoliko rečenica iz istorije procene forme u odeljku FORMA (krug 3). */
const HISTORY_LINES = 5;

/** Zašto se prognoza menjala (R10, krug 3): kad se živa prognoza razlikuje od one u zaglavlju za više od 20 s,
    ispis to kaže; ispod idu rečenice iz istorije procene forme — poslednjih do 5, najnovija prva. */
function forecastChange(h: PlanHeader, state: RunnerState | undefined): string[] {
  if (state === undefined) return [];
  const before = h.form.raceDay.expectedSec;
  /* T1 (krug 6): obe strane po istim pravilima plana (adjustRaceDay) — inače se poredi prilagođeno sa sirovim */
  const after = adjustRaceDay(
    state.form.raceDay,
    state.form.current.raceTimeSec,
    h.decisions
  ).expectedSec;
  const moved = Math.abs(after - before) > FORECAST_CHANGE_MIN_SEC;
  /* M8c (krug 5): koraci bez signala (pripisani napredak plana) ne menjaju prikazanu prognozu — ne prikazuju se,
     da „zašto" uvek vodi do broja u zaglavlju */
  const reasons = [
    ...new Set(
      [...state.form.history]
        .filter((x) => x.signal !== 'plan')
        .reverse()
        .map((x) => x.reason.trim())
    )
  ]
    .filter((x) => x !== '')
    .slice(0, HISTORY_LINES);
  const lines: string[] = [];
  if (moved) {
    const silent = !state.form.history.some((x) => x.date > h.form.current.asOf);
    lines.push(
      `Prognoza je ${after < before ? 'bolja' : 'slabija'} nego u prethodnom ispisu (${fmtClock(before)} → ${fmtClock(after)}).${silent ? ` Procena forme je ponovo izračunata iz trčanja posle ${fmtDate(h.form.current.asOf)}; nijedan pojedinačan trening je nije pomerio.` : ''}`
    );
  }
  if (reasons.length > 0) {
    lines.push('Zašto je prognoza ovakva (najnovije prvo):');
    for (const reason of reasons) lines.push(`- ${reason}`);
  }
  return lines;
}

function changeLines(changes: readonly Change[], doc: PlanDoc): string[] {
  if (changes.length === 0) return [];
  const lines: string[] = ['', 'PROMENE'];
  const dayDate = new Map(doc.weeks.flatMap((w) => w.days.map((d) => [d.id, d.date] as const)));
  const groups = new Map<string, Change[]>();
  for (const change of changes) {
    const list = groups.get(change.eventId) ?? [];
    list.push(change);
    groups.set(change.eventId, list);
  }
  for (const list of groups.values()) {
    const reasons = [...new Set(list.map((c) => c.reason))];
    for (const reason of reasons) {
      lines.push(reason);
      for (const c of list.filter((x) => x.reason === reason)) {
        /* Obaveštenje nema šta da uporedi: rečenica iznad je cela poruka. */
        if (c.what === 'obavestenje') continue;
        if (c.what === 'upozorenje') {
          lines.push(`- ${c.after}`);
          continue;
        }
        const date = c.dayId === undefined ? undefined : dayDate.get(c.dayId);
        const where =
          date !== undefined
            ? `${fmtWeekday(date)} ${fmtDate(date)}`
            : c.weekIndex !== undefined
              ? `${String(c.weekIndex)}. nedelja`
              : 'plan';
        lines.push(`- ${where}: ${c.before} → ${c.after}`);
      }
    }
  }
  return lines;
}

/** Urađeno trčanje vezano za dan plana: prošli dani se ispisuju kao urađeni, tempom kakav je bio (R10). */
function doneLine(run: Run): string {
  const km = Math.round(run.distanceM / 100) / 10;
  const pace = run.distanceM > 0 ? ` (${fmtPace((run.durationSec / run.distanceM) * 1000)})` : '';
  return `urađeno ${fmtNumber(km)} km, ${fmtMinutes(run.durationSec)}${pace}`;
}

/** Ceo plan kao tekst: zaglavlje, nedelje sa danima i zbirom, upozorenja, promene (§ 14.2). */
export function renderPlan(
  doc: PlanDoc,
  state: RunnerState | undefined,
  data: DistanceData,
  options: RenderOptions = {}
): string {
  const h = doc.header;
  const ctx = paceCtxOf(h);
  const lines = headerLines(doc, state, data);
  lines.push(...changeLines(options.changes ?? [], doc));
  const today = state?.today;
  const runs = new Map<string, Run>();
  const runsByDate = new Map<IsoDate, Run>();
  for (const run of state?.runs ?? []) {
    if (run.dayId !== undefined) runs.set(run.dayId, run);
    /* A2 (krug 9b): neplanirana trka bez dayId se spaja sa planskim danom po datumu (pun napor umesto zakazanog) */
    if (run.effort !== undefined) runsByDate.set(run.date, run);
  }
  /* S9 (krug 4): dan pauze (i današnji) nije urađen trening — ispisuje se kao pauza i ne ulazi u zbir. */
  const paused = (date: string): boolean =>
    (h.adjustments ?? []).some((a) => a.kind === 'pause' && a.from <= date && date <= a.to);
  const past = (day: PlanDay): boolean =>
    today !== undefined && (day.date < today || (day.date === today && paused(day.date)));
  /* Z9 (krug 7): „vršna nedelja" je nedelja sa najvećim obimom plana (ne oznaka šablona) */
  /* krug 10 (stavka 7): nedelja koju seče prozor događaja (pauza, bol, rampa) nije „vršna" */
  const touched = (w: PlanWeek): boolean =>
    (h.adjustments ?? []).some((a) => {
      if (a.kind === 'effort' && a.planned === true) return false;
      const win = adjustmentWindow(a);
      return win !== null && win.from <= addDays(w.start, 6) && win.rampEnd >= w.start;
    });
  const kms = doc.weeks.map((w) =>
    w.intent.kind === 'race' || touched(w) ? 0 : weekCost(w, h.goal.raceDate, ctx).km
  );
  const peakAt = kms.indexOf(Math.max(...kms));
  /* krug 10 (stavka 7): faza se u ispisu ne vraća unazad (red faza = red prvog pojavljivanja u planu) */
  const order = [...new Set(doc.weeks.map((w) => w.intent.phase))];
  let phaseAt = 0;
  for (const [wi, week] of doc.weeks.entries()) {
    const cost = weekCost(week, h.goal.raceDate, ctx);
    const toRace = Math.max(0, Math.round(diffDays(mondayOf(h.goal.raceDate), week.start) / 7));
    phaseAt = Math.max(phaseAt, order.indexOf(week.intent.phase));
    const phase = data.texts[`faza.${order[phaseAt] ?? week.intent.phase}`];
    const raw: WeekKind =
      week.intent.kind === 'peak' && wi !== peakAt
        ? 'build'
        : wi === peakAt && week.intent.kind === 'build'
          ? 'peak'
          : week.intent.kind;
    const kind: WeekKind =
      raw === 'build' && toRace >= 1 && toRace <= LATE_BUILD_WEEKS ? 'taper' : raw;
    const label = phase === undefined ? KIND_LABEL[kind] : `${phase}, ${KIND_LABEL[kind]}`;
    const until = toRace === 0 ? '' : `; do trke ${count(toRace, WEEKS)}`;
    lines.push('');
    lines.push(`${String(week.index)}. NEDELJA (od ${fmtDate(week.start)}) — ${label}${until}`);
    let km = 0;
    let durationSec = 0;
    let trainings = 0;
    let hasRace = false;
    for (const { day, cost: c } of cost.days) {
      const when = `${fmtWeekday(day.date)} ${fmtDate(day.date)}`;
      const w = day.workout;
      const run = runs.get(day.id) ?? runsByDate.get(day.date);
      if (w === null) {
        lines.push(`  ${when}  odmor`);
        continue;
      }
      if (w.kind === 'race' && day.date === h.goal.raceDate) {
        hasRace = true;
        lines.push(`  ${when}  TRKA: ${data.label}`);
        for (const note of raceNotes(doc, state, data)) lines.push(`      napomena: ${note}`);
        continue;
      }
      /* R4 (krug 6): i današnji dan sa odrađenim trčanjem (trka na dan provere) je urađen, ne zakazan */
      const doneToday = day.date === today && run !== undefined;
      if (
        (past(day) || doneToday) &&
        (run !== undefined || day.date !== today || paused(day.date))
      ) {
        /* Prošao dan: šta je urađeno (ili da nije), bez prepisivanja novim tempom. */
        if (run === undefined) {
          lines.push(
            `  ${when}  ${w.text} — ${paused(day.date) ? 'pauza, bez treninga' : 'nije urađeno'}`
          );
        } else {
          /* R4 (krug 6): trka trčana na dan drugog treninga — red kaže šta je stvarno trčano */
          const what =
            run.effort === 'race' && w.kind !== 'race' ? `trka umesto „${w.text}"` : w.text;
          lines.push(`  ${when}  ${what} — ${doneLine(run)}`);
          km += Math.round(run.distanceM / 100) / 10;
          durationSec += run.durationSec;
          trainings += 1;
        }
        continue;
      }
      const text = withPace(w, h.paces, data);
      lines.push(`  ${when}  ${text} — ${fmtNumber(c.km)} km, ${fmtMinutes(c.durationSec)}`);
      for (const note of w.notes ?? []) lines.push(`      napomena: ${note}`);
      for (const extra of day.extras ?? []) lines.push(`      uz to: ${extra}`);
      km += c.km;
      /* zbir nedelje = zbir prikazanih minuta dana (K5) */
      durationSec += Math.round(c.durationSec / 60) * 60;
      trainings += 1;
    }
    const allPast = today !== undefined && addDays(week.start, 6) <= today;
    const anyPast = week.days.some(past);
    const count2 = `${count(trainings, WORKOUTS)}${hasRace ? ' + trka' : ''}`;
    /* A13 (krug 9): provera forme punim naporom je u prikazu brz rad (budžet je i dalje ne broji) */
    const testSec = week.days.reduce(
      (sum, d) => sum + (d.workout?.kind === 'test' ? d.workout.workSec : 0),
      0
    );
    const fast = cost.durationSec > 0 ? (cost.fastSec + testSec) / cost.durationSec : 0;
    const share = anyPast ? '' : `, brz rad ${percent(fast)} vremena trčanja`;
    const load =
      options.showLoad === true && !anyPast
        ? `, opterećenje ${fmtNumber(cost.load, 0)} BO (cilj ${fmtNumber(week.targetLoad, 0)})`
        : '';
    lines.push(
      `  ${allPast ? 'Urađeno' : 'Zbir'}: ${fmtNumber(km)} km, ${fmtMinutes(durationSec)}, ${count2}${share}${load}`
    );
  }
  return lines.join('\n');
}
