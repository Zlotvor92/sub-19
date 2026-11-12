/* V4 — ISPIS ZA ČOVEKA (SPEC § 14.2). Čitaju ga sudije i vlasnik; provere K1–K5 rubrike se testiraju nad njim.
   Bez ISO datuma i internih izraza; brojevi sa imenicom idu kroz `count`; decimalni zarez. */
import { diffDays, mondayOf } from './dates';
import {
  count,
  DAYS,
  fmtClock,
  fmtDate,
  fmtDateYear,
  fmtMinutes,
  fmtNumber,
  fmtPace,
  fmtPaceBare,
  fmtWeekday,
  WEEKS,
  WORKOUTS
} from './format';
import { weekCost } from './guard';
import { paceCtxOf } from './load';
import { countWeeks } from './template';
import type {
  Change,
  DistanceData,
  Paces,
  PlanDoc,
  RunnerState,
  Step,
  WeekKind,
  Workout,
  ZoneId
} from './types';

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

function zonesOf(steps: readonly Step[], into: ZoneId[] = []): ZoneId[] {
  for (const step of steps) {
    if ('repeat' in step) zonesOf(step.steps, into);
    else if (
      step.target.type === 'zone' &&
      step.role !== 'recovery' &&
      !into.includes(step.target.zone)
    ) {
      into.push(step.target.zone);
    }
  }
  return into;
}

function zoneHint(zone: ZoneId, paces: Paces, data: DistanceData): string {
  if (paces.byFeel) return `${ZONE_NAME[zone]}: ${data.texts[`napor.${zone}`] ?? ZONE_FEEL[zone]}`;
  if (zone === 'E') return `lagano ${fmtPaceBare(paces.easyFast)}–${fmtPace(paces.easySlow)}`;
  return `${ZONE_NAME[zone]} ${fmtPace(paces[zone])}`;
}

function paceHints(workout: Workout, paces: Paces, data: DistanceData): string {
  if (workout.kind === 'race') return '';
  const order: ZoneId[] = ['E', 'M', 'T', 'RP', 'I', 'R'];
  const used = zonesOf(workout.steps);
  return order
    .filter((z) => used.includes(z))
    .map((z) => zoneHint(z, paces, data))
    .join(' · ');
}

const percent = (share: number): string => `${fmtNumber(share * 100, 0)} %`;

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
  lines.push('');
  lines.push('FORMA');
  lines.push(
    `Polazna forma (${fmtDate(h.form.start.asOf)}): ${fmtClock(h.form.start.raceTimeSec)}`
  );
  const now = state?.form.current ?? h.form.current;
  const raceDay = state?.form.raceDay ?? h.form.raceDay;
  lines.push(
    `Današnja prognoza (${fmtDate(now.asOf)}): ${fmtClock(now.raceTimeSec)}, pouzdanost ${now.confidence}`
  );
  const gain = now.raceTimeSec - raceDay.expectedSec;
  const why =
    gain > 0
      ? ` — ${fmtClock(gain)} brže od današnje prognoze, jer plan do trke podiže obim i dodaje rad u tempu trke`
      : '';
  lines.push(
    `Očekivano na dan trke: ${fmtClock(raceDay.expectedSec)} (raspon ${fmtClock(raceDay.lowSec)}–${fmtClock(raceDay.highSec)})${why}`
  );
  lines.push('');
  lines.push(h.paces.byFeel ? 'NAPOR PO ZONAMA (tempa još nisu pouzdana)' : 'TEMPA');
  const zones: ZoneId[] = ['E', 'M', 'T', 'RP', 'I', 'R'];
  for (const zone of zones) lines.push(`- ${zoneHint(zone, h.paces, data)}`);
  if (h.warnings.length > 0) {
    lines.push('');
    lines.push('UPOZORENJA');
    for (const w of h.warnings) lines.push(`- ${w.problem} ${w.meaning} ${w.proposal}`);
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
  for (const week of doc.weeks) {
    const cost = weekCost(week, h.goal.raceDate, ctx);
    const toRace = Math.max(0, Math.round(diffDays(mondayOf(h.goal.raceDate), week.start) / 7));
    const phase = data.texts[`faza.${week.intent.phase}`];
    const label =
      phase === undefined
        ? KIND_LABEL[week.intent.kind]
        : `${phase}, ${KIND_LABEL[week.intent.kind]}`;
    const until = toRace === 0 ? 'nedelja trke' : `do trke ${count(toRace, WEEKS)}`;
    lines.push('');
    lines.push(`${String(week.index)}. NEDELJA (od ${fmtDate(week.start)}) — ${label}; ${until}`);
    for (const { day, cost: c } of cost.days) {
      const when = `${fmtWeekday(day.date)} ${fmtDate(day.date)}`;
      const w = day.workout;
      if (w === null) {
        lines.push(`  ${when}  odmor`);
        continue;
      }
      if (w.kind === 'race' && day.date === h.goal.raceDate) {
        lines.push(`  ${when}  TRKA: ${data.label}`);
        continue;
      }
      const hints = paceHints(w, h.paces, data);
      lines.push(
        `  ${when}  ${w.text} — ${fmtNumber(c.km)} km, ${fmtMinutes(c.durationSec)}${hints === '' ? '' : ` · ${hints}`}`
      );
      for (const note of w.notes ?? []) lines.push(`      napomena: ${note}`);
      for (const extra of day.extras ?? []) lines.push(`      uz to: ${extra}`);
    }
    const trainings = cost.days.filter(
      (x) => x.day.workout !== null && x.day.workout.kind !== 'race'
    ).length;
    const fast = cost.durationSec > 0 ? cost.workSec / cost.durationSec : 0;
    const load =
      options.showLoad === true
        ? `, opterećenje ${fmtNumber(cost.load, 0)} BO (cilj ${fmtNumber(week.targetLoad, 0)})`
        : '';
    lines.push(
      `  Zbir: ${fmtNumber(cost.km)} km, ${fmtMinutes(cost.durationSec)}, ${count(trainings, WORKOUTS)}, brz rad ${percent(fast)}${load}`
    );
  }
  return lines.join('\n');
}
