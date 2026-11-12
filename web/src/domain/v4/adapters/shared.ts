/* V4 ADAPTERI — ZAJEDNIČKO ČITANJE (SPEC § 9.1): razrešen dan starog plana (posle `alts` i `moves`, isto kao
   aplikacija danas), trčanja iz `log`/`vanPlana`, trening iz `structure`/`session`/km i sastavljanje `PlanDoc`.
   Samo čita: ulaz se nikad ne menja. Bez sata i nasumičnosti; isto stanje → isti dokument. */
import { addDays, isValidDate, weekdayOf } from '../engine/dates';
import { ZONE_SHARE } from '../engine/constants';
import { paceCtxOf, summarize } from '../engine/load';
import type {
  Decisions,
  FormPoint,
  IsoDate,
  JsonValue,
  KmSplit,
  Lap,
  PainFlag,
  Paces,
  PlanDay,
  PlanDoc,
  PlanHeader,
  PlanWeek,
  Run,
  RunnerFacts,
  RunnerProfile,
  SingleStep,
  Step,
  StimulusTag,
  Target,
  WeekIntent,
  Weekday,
  Workout,
  WorkoutKind,
  ZoneId
} from '../engine/types';
import { ENGINE_VERSION, PLAN_DOC_VERSION } from '../engine/types';
import { paceAtShare, raceTimeSec, zonePaces } from '../engine/vdot';
import {
  isRec,
  isoPrefix,
  num,
  rest as restOf,
  str,
  toJson,
  type ReadDay,
  type ReadState,
  type ReadWeek,
  type Rec
} from './read';
import { LONG_BLOCK_ZONES, TAG_CUE, ZONE_CUE, stimulusFor, type Cue } from './stimuli';

/* ------------------------------------------------------------------ razrešen dan (kao `resolvePlan` aplikacije) */

export interface Resolved {
  day: ReadDay;
  week: ReadWeek;
  weekIndex: number;
  origDate: IsoDate;
  /** Važeći datum posle `moves`. */
  date: IsoDate;
  /** Dan ima ispravno pomeranje (`moves[id]` je datum). */
  moved: boolean;
  test: boolean;
  alt: Rec | null;
  rest: boolean;
  tag: string | undefined;
  km: number | null;
  desc: string | null;
  /** Važeći propis; nema ga kad ručna izmena menja tip, km ili opis. */
  structure: Rec | null;
  session: Rec | null;
  strides: JsonValue | undefined;
  runWalk: JsonValue | undefined;
  finish: JsonValue | undefined;
  mlr: boolean;
  snaga: boolean;
}

const sameKm = (a: unknown, b: number | null): boolean => (a ?? null) === b;

/** Struktura sme da ostane uz izmenu samo kad su tip, km i opis isti kao u originalu (pravilo aplikacije). */
function keepsStructure(alt: Rec, day: ReadDay): boolean {
  return (
    !day.rest &&
    alt['tag'] === day.tag &&
    sameKm(alt['km'], day.km) &&
    alt['desc'] === (day.desc ?? '')
  );
}

/** Razrešeni dani hronološki po planu (redosled nedelja i dana iz plana). */
export function resolveDays(state: ReadState): Resolved[] {
  const out: Resolved[] = [];
  const byDate = new Map<IsoDate, Resolved>();
  state.plan.weeks.forEach((week, weekIndex) => {
    for (const day of week.days) {
      const raw = day.raw;
      const alt = state.alts[day.id] ?? null;
      const origDate = addDays(week.start, day.dow);
      const structure = isRec(raw['structure']) ? raw['structure'] : null;
      const session = isRec(raw['session']) ? raw['session'] : null;
      const r: Resolved = {
        day,
        week,
        weekIndex,
        origDate,
        date: origDate,
        moved: false,
        test: Boolean(raw['test']),
        alt,
        rest: day.rest,
        tag: day.tag,
        km: day.km,
        desc: day.desc,
        structure,
        session,
        strides: raw['strides'] ? toJson(raw['strides']) : undefined,
        runWalk: raw['runWalk'] !== undefined ? toJson(raw['runWalk']) : undefined,
        finish: raw['finish'] ? toJson(raw['finish']) : undefined,
        mlr: raw['mlr'] === true,
        snaga: false
      };
      if (alt !== null) {
        r.finish = undefined;
        r.strides = undefined;
        r.rest = alt['tag'] === 'odmor';
        r.tag = r.rest ? undefined : (str(alt['tag']) ?? undefined);
        r.km = r.rest ? null : num(alt['km']);
        r.desc = str(alt['desc']);
        if (alt['rw']) r.runWalk = toJson(alt['rw']);
        r.snaga = Boolean(alt['snaga']) && !r.rest;
        if (!keepsStructure(alt, day)) {
          r.structure = null;
          r.session = null;
        }
      }
      if (!r.test) {
        const mv = state.moves[day.id];
        const target = typeof mv === 'string' && isValidDate(mv) ? mv : null;
        r.moved = target !== null;
        r.date = target ?? origDate;
        const occupant = byDate.get(r.date);
        if (occupant !== undefined && occupant !== r) r.date = origDate;
        byDate.set(r.date, r);
      }
      out.push(r);
    }
  });
  return out;
}

/** Dan je ručno menjan (izmena ili pomeranje) — `origin: 'manual'`. */
export const isManual = (r: Resolved): boolean => r.alt !== null || r.moved;

/* ------------------------------------------------------------------ vrsta i namera dana */

/** Stari `tag` → vrsta treninga. `mlr` (srednje dugo radnim danom) je lagan dan, ne drugi dugi u nedelji. */
export function kindOf(tag: string | undefined, mlr: boolean): WorkoutKind {
  switch (tag) {
    case 'lako':
    case 'rw':
      return 'easy';
    case 'lr':
      return mlr ? 'easy' : 'long';
    case 'tempo':
    case 'int':
      return 'quality';
    case 'trka':
      return 'race';
    case 'test':
      return 'test';
    default:
      return 'other';
  }
}

const blocksOf = (structure: Rec | null): Rec[] =>
  structure !== null && Array.isArray(structure['blocks'])
    ? (structure['blocks'] as unknown[]).filter(isRec)
    : [];

const stepOf = (block: Rec): Rec | null => (isRec(block['step']) ? block['step'] : null);

/** Zone rada (koraci `work`) iz strukture ili sesije. */
function workZones(r: Resolved): string[] {
  const zones: string[] = [];
  for (const block of blocksOf(r.structure)) {
    const step = stepOf(block);
    const zone = step === null ? null : str(step['zone']);
    if (step !== null && step['kind'] === 'work' && zone !== null) zones.push(zone);
  }
  if (r.session !== null) {
    const zone = str(r.session['zone']) ?? str(r.session['purpose']);
    if (zone !== null) zones.push(zone);
  }
  return zones;
}

const hasStrides = (r: Resolved): boolean =>
  r.strides !== undefined || blocksOf(r.structure).some((b) => stepOf(b)?.['kind'] === 'stride');

/** Opšta namera dana (§ 9.3). */
export function cueOf(r: Resolved): Cue | null {
  if (r.rest) return null;
  const kind = kindOf(r.tag, r.mlr);
  const zones = workZones(r);
  if (kind === 'quality') {
    for (const zone of zones) {
      const cue = ZONE_CUE[zone];
      if (cue !== undefined) return cue;
    }
    return TAG_CUE[r.tag ?? ''] ?? null;
  }
  if (kind === 'test') return 'kontrola';
  if (kind === 'long') {
    if (zones.some((z) => LONG_BLOCK_ZONES.includes(z))) return 'dugi-rp';
    if (r.session !== null && r.session['type'] === 'prog') return 'dugi-progresivno';
    return 'dugi';
  }
  if (kind === 'easy' && hasStrides(r)) return 'ubrzanja';
  return null;
}

/* ------------------------------------------------------------------ koraci treninga */

const ZONES: readonly ZoneId[] = ['E', 'M', 'T', 'I', 'R', 'RP'];
const STAND: Target = { type: 'effort', rpe: 1 };

function zoneTarget(zone: string | null): Target | null {
  if (zone === null) return null;
  if (zone === 'MP') return { type: 'zone', zone: 'M' };
  if (zone === 'jog') return { type: 'zone', zone: 'E' };
  if (zone === 'test') return { type: 'allOut' };
  return (ZONES as readonly string[]).includes(zone)
    ? { type: 'zone', zone: zone as ZoneId }
    : null;
}

const meters = (km: number | null): number => (km === null ? 0 : Math.round(km * 1000));

function roleOf(kind: unknown): SingleStep['role'] {
  if (kind === 'warmup' || kind === 'cooldown' || kind === 'recovery') return kind;
  if (kind === 'work' || kind === 'stride') return 'work';
  return 'steady';
}

/** Korak strukture v2 → korak V4 (dužinom; stajanje bez dužine trajanjem). `null` = ne može se verno preneti. */
function structureStep(
  step: Rec,
  role: SingleStep['role'],
  pace: number | null
): SingleStep | null {
  const km = num(step['km']);
  const sec = num(step['sec']);
  const kind = step['kind'];
  let target = zoneTarget(str(step['zone']));
  if (kind === 'test' || kind === 'race') target = { type: 'allOut' };
  if (role === 'work' && pace !== null) target = { type: 'pace', secPerKm: pace };
  if (km !== null && km > 0) {
    return {
      role,
      target: target ?? { type: 'zone', zone: 'E' },
      extent: { distanceM: meters(km) }
    };
  }
  if (role === 'recovery' && sec !== null && sec > 0) {
    return { role, target: STAND, extent: { durationSec: Math.round(sec) } };
  }
  return null;
}

function fromStructure(structure: Rec, pace: number | null): Step[] | null {
  const steps: Step[] = [];
  for (const block of blocksOf(structure)) {
    const raw = stepOf(block);
    if (raw === null) return null;
    const step = structureStep(raw, roleOf(raw['kind']), pace);
    if (step === null) return null;
    const reps = Math.max(1, Math.round(num(block['reps']) ?? 1));
    const recRaw = isRec(block['recovery']) ? block['recovery'] : null;
    const rec = recRaw === null ? null : structureStep(recRaw, 'recovery', null);
    if (recRaw !== null && rec === null) return null;
    if (reps === 1) steps.push(step);
    else if (rec === null) steps.push({ repeat: reps, steps: [step] });
    else steps.push({ repeat: reps - 1, steps: [step, rec] }, step);
  }
  return steps.length > 0 ? steps : null;
}

/** Stara sesija (`wuKm`, `reps × repM` ili `qKm`, `cdKm`); oporavak dobija ostatak km dana. */
function fromSession(s: Rec, totalM: number): Step[] | null {
  const wu = meters(num(s['wuKm']));
  const cd = meters(num(s['cdKm']));
  const reps = num(s['reps']);
  const repSec = num(s['repSec']);
  const paceSec = num(s['paceSec']);
  /* fartlek: deonice trajanjem → dužina iz tempa deonice */
  const repM =
    num(s['repM']) ??
    (repSec !== null && paceSec !== null && paceSec > 0
      ? Math.round((repSec * 1000) / paceSec)
      : null);
  const qKm = num(s['qKm']);
  const zone = zoneTarget(str(s['zone']));
  const target: Target =
    zone ??
    (paceSec !== null && paceSec > 0
      ? { type: 'pace', secPerKm: paceSec }
      : { type: 'zone', zone: 'T' });
  const steps: Step[] = [];
  if (wu > 0)
    steps.push({ role: 'warmup', target: { type: 'zone', zone: 'E' }, extent: { distanceM: wu } });
  const ladder = Array.isArray(s['reps'])
    ? (s['reps'] as unknown[]).map(num).filter((x): x is number => x !== null && x > 0)
    : [];
  const pieces =
    ladder.length > 0
      ? ladder.map(Math.round)
      : reps !== null && Number.isInteger(reps) && reps >= 1 && repM !== null && repM > 0
        ? Array.from({ length: reps }, () => Math.round(repM))
        : [];
  if (pieces.length > 0) {
    const n = pieces.length;
    const restSec = num(s['restSec']);
    const left = totalM - wu - cd - pieces.reduce((a, b) => a + b, 0);
    const per =
      n > 1 && restSec !== null && restSec > 0 && left >= n - 1 ? Math.floor(left / (n - 1)) : 0;
    const work = (m: number): SingleStep => ({ role: 'work', target, extent: { distanceM: m } });
    const rec: SingleStep = {
      role: 'recovery',
      target: { type: 'zone', zone: 'E' },
      extent: { distanceM: per }
    };
    const uniform = pieces.every((m) => m === pieces[0]);
    if (uniform && n > 1 && per > 0)
      steps.push({ repeat: n - 1, steps: [work(pieces[0] ?? 0), rec] }, work(pieces[0] ?? 0));
    else if (uniform)
      steps.push(n === 1 ? work(pieces[0] ?? 0) : { repeat: n, steps: [work(pieces[0] ?? 0)] });
    else
      pieces.forEach((m, i) => steps.push(...(i < n - 1 && per > 0 ? [work(m), rec] : [work(m)])));
  } else if (qKm !== null && qKm > 0) {
    steps.push({ role: 'work', target, extent: { distanceM: meters(qKm) } });
  } else {
    return null;
  }
  if (cd > 0)
    steps.push({
      role: 'cooldown',
      target: { type: 'zone', zone: 'E' },
      extent: { distanceM: cd }
    });
  return steps;
}

const distanceOf = (steps: readonly Step[]): number =>
  steps.reduce(
    (sum, s) =>
      'repeat' in s
        ? sum + s.repeat * distanceOf(s.steps)
        : sum + ('distanceM' in s.extent && s.target !== STAND ? s.extent.distanceM : 0),
    0
  );

/** Zbir dužina koraka = km dana do metra (otisak!): razlika ide u poslednji korak hlađenja/stalnog/zagrevanja. */
function reconcile(steps: Step[], totalM: number): Step[] | null {
  const diff = totalM - distanceOf(steps);
  if (diff === 0) return steps;
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    const s = steps[i];
    if (s === undefined || 'repeat' in s || !('distanceM' in s.extent)) continue;
    if (s.role === 'work' || s.role === 'recovery') continue;
    const next = s.extent.distanceM + diff;
    if (next < 100) return null;
    const out = [...steps];
    out[i] = { ...s, extent: { distanceM: next } };
    return out;
  }
  return null;
}

const workSecOf = (steps: readonly Step[], structure: Rec | null, session: Rec | null): number => {
  let sec = 0;
  for (const block of blocksOf(structure)) {
    const step = stepOf(block);
    if (step?.['kind'] === 'work') sec += (num(block['reps']) ?? 1) * (num(step['sec']) ?? 0);
  }
  if (sec > 0 || session === null) return Math.round(sec);
  const pace = num(session['paceSec']);
  if (pace === null) return 0;
  const workM = (s: readonly Step[]): number =>
    s.reduce(
      (m, x) =>
        'repeat' in x
          ? m + x.repeat * workM(x.steps)
          : m + (x.role === 'work' && 'distanceM' in x.extent ? x.extent.distanceM : 0),
      0
    );
  return Math.round((workM(steps) * pace) / 1000);
};

export interface BuiltWorkout {
  workout: Workout | null;
  /** Struktura/sesija nije mogla da se prenese u korake; dan je jedan stalan korak, izvor ostaje u `legacy`. */
  fallback: boolean;
}

/** Razrešen dan → trening V4 (§ 9.1). Tekst je stari opis doslovno; km koraka = stari km do metra. */
export function buildWorkout(r: Resolved, distanceId: string): BuiltWorkout {
  if (r.rest) return { workout: null, fallback: false };
  const kind = kindOf(r.tag, r.mlr);
  const totalM = meters(r.km);
  const pace = r.alt !== null ? num(r.alt['pace']) : null;
  let steps: Step[] | null = null;
  let fallback = false;
  if (totalM > 0) {
    if (r.structure !== null)
      steps = fromStructure(r.structure, pace !== null && pace > 0 ? pace : null);
    else if (r.session !== null) steps = fromSession(r.session, totalM);
    if (steps !== null) steps = reconcile(steps, totalM);
    if (steps === null) {
      fallback = r.structure !== null || r.session !== null;
      const target: Target =
        kind === 'race' || kind === 'test' ? { type: 'allOut' } : { type: 'zone', zone: 'E' };
      steps = [{ role: 'steady', target, extent: { distanceM: totalM } }];
    }
  }
  const stimulus: StimulusTag | null = stimulusFor(distanceId, cueOf(r));
  const used = steps ?? [];
  return {
    workout: {
      kind,
      stimulus,
      workSec: fallback ? 0 : workSecOf(used, r.structure, r.session),
      steps: used,
      text: r.desc ?? ''
    },
    fallback
  };
}

/** Dodatne aktivnosti i polja starog dana koja V4 ne tumači. */
export function extrasOf(r: Resolved): string[] {
  const out: string[] = [];
  if (isRec(r.strides)) {
    const reps = num(r.strides['reps']);
    const sec = num(r.strides['runSec']);
    out.push(reps !== null && sec !== null ? `ubrzanja ${reps} × ${sec} s` : 'ubrzanja');
  }
  if (isRec(r.runWalk)) out.push(`hod-trk: ${str(r.runWalk['label']) ?? 'trčanje i hod'}`);
  if (r.finish !== undefined) out.push('brz završetak');
  if (r.mlr) out.push('srednje dugo trčanje');
  if (r.snaga || r.tag === 'snaga') out.push('snaga');
  return out;
}

const DAY_KNOWN = ['id', 'dow', 'rest', 'tag', 'km', 'desc'];

function legacyOf(r: Resolved): Readonly<Record<string, JsonValue>> | undefined {
  const out = restOf(r.day.raw, DAY_KNOWN);
  if (r.alt !== null) out['alt'] = toJson(r.alt);
  if (r.moved) out['move'] = r.date;
  if (r.runWalk !== undefined && r.alt?.['rw']) out['runWalk'] = r.runWalk;
  if (r.km === null && !r.rest) out['km'] = null;
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Original dana pre ručne izmene (za `base`). */
function originalOf(r: Resolved): Resolved {
  return {
    ...r,
    alt: null,
    rest: r.day.rest,
    tag: r.day.tag,
    km: r.day.km,
    desc: r.day.desc,
    structure: isRec(r.day.raw['structure']) ? r.day.raw['structure'] : null,
    session: isRec(r.day.raw['session']) ? r.day.raw['session'] : null,
    snaga: false
  };
}

/* ------------------------------------------------------------------ trčanja iz dnevnika i van plana */

const MIN_PACE = 120;
const MAX_PACE = 1800;

function splitsOf(x: unknown): KmSplit[] | undefined {
  if (!Array.isArray(x)) return undefined;
  const out: KmSplit[] = [];
  for (const row of x as unknown[]) {
    if (!isRec(row)) continue;
    const pace = num(row['paceSec']);
    if (pace === null || pace < MIN_PACE || pace > MAX_PACE) continue;
    const hr = num(row['hr']);
    out.push(hr === null ? { paceSec: pace } : { paceSec: pace, hr });
  }
  return out.length > 0 ? out : undefined;
}

/** Aplikacija čuva samo radne krugove (`laps`); ostatak trčanja ide u jedan krug `other` da opterećenje bude celo. */
function lapsOf(x: unknown, totalM: number, totalSec: number): Lap[] | undefined {
  if (!Array.isArray(x)) return undefined;
  const out: Lap[] = [];
  for (const row of x as unknown[]) {
    if (!isRec(row)) continue;
    const dist = num(row['distM']);
    const pace = num(row['paceSec']);
    if (dist === null || dist <= 0 || pace === null || pace < MIN_PACE || pace > MAX_PACE) continue;
    const hr = num(row['avgHr']);
    const lap: Lap = {
      role: 'work',
      distanceM: Math.round(dist),
      durationSec: Math.round((dist * pace) / 1000)
    };
    out.push(hr === null ? lap : { ...lap, avgHr: hr });
  }
  if (out.length === 0) return undefined;
  const leftM = totalM - out.reduce((s, l) => s + l.distanceM, 0);
  const leftSec = totalSec - out.reduce((s, l) => s + l.durationSec, 0);
  if (leftM > 0 && leftSec > 0) out.push({ role: 'other', distanceM: leftM, durationSec: leftSec });
  else if (leftM < 0 || leftSec < 0) return undefined;
  return out;
}

export interface RunCtx {
  /** Lagan tempo forme plana, s/km — trajanje kad ga stari zapis nema (`source: 'procena'`). */
  easyPace: number;
}

/** `log` (status `done`) → `Run` sa `dayId`; `vanPlana`/`vanPlanaV2` → `Run` bez `dayId` (§ 9.1). */
export function runsOf(state: ReadState, days: readonly Resolved[], ctx: RunCtx): Run[] {
  const byId = new Map(days.map((r) => [r.day.id, r]));
  const runs: Run[] = [];
  for (const id of Object.keys(state.log).sort()) {
    const entry = state.log[id];
    if (entry === undefined || entry['status'] !== 'done') continue;
    const day = byId.get(id);
    const date = isoPrefix(entry['runDate']) ?? day?.date ?? isoPrefix(entry['ts']);
    if (date === null) continue;
    const km = num(entry['km']) ?? day?.km ?? 0;
    const distanceM = Math.max(0, Math.round(km * 1000));
    const logged = num(entry['sec']);
    const durationSec =
      logged !== null && logged > 0
        ? Math.round(logged)
        : Math.round((distanceM * ctx.easyPace) / 1000);
    const run: Run = { id: `log:${id}`, date, distanceM, durationSec, dayId: id };
    if (logged === null || logged <= 0) run.source = 'procena';
    else run.source = str(entry['src']) ?? 'dnevnik';
    if (day?.tag === 'trka') run.effort = 'race';
    else if (day?.tag === 'test' || day?.test === true) run.effort = 'test';
    const hr = num(entry['hr']);
    if (hr !== null && hr > 0) run.avgHr = hr;
    const splits = splitsOf(entry['perKm']);
    if (splits !== undefined) run.splits = splits;
    const laps = lapsOf(entry['laps'], distanceM, durationSec);
    if (laps !== undefined && run.source !== 'procena') run.laps = laps;
    runs.push(run);
  }
  for (const date of Object.keys(state.vanPlana).sort()) {
    const km = num(state.vanPlana[date]);
    if (!isValidDate(date) || km === null || km <= 0) continue;
    const distanceM = Math.round(km * 1000);
    runs.push({
      id: `van:${date}`,
      date,
      distanceM,
      durationSec: Math.round((distanceM * ctx.easyPace) / 1000),
      source: 'procena'
    });
  }
  for (const key of Object.keys(state.vanPlanaV2).sort()) {
    const x = state.vanPlanaV2[key];
    if (!isRec(x)) continue;
    const date = isoPrefix(x['date']);
    const km = num(x['km']);
    if (date === null || km === null || km < 0) continue;
    const distanceM = Math.round(km * 1000);
    const sec = num(x['sec']);
    const run: Run = {
      id: `van2:${key}`,
      date,
      distanceM,
      durationSec:
        sec !== null && sec > 0 ? Math.round(sec) : Math.round((distanceM * ctx.easyPace) / 1000),
      source: sec !== null && sec > 0 ? (str(x['src']) ?? 'van-plana') : 'procena'
    };
    runs.push(run);
  }
  return runs.sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  );
}

/** `knee` (zapisi bola) → `PainFlag`. */
export function painOf(state: ReadState): PainFlag[] {
  const out: PainFlag[] = [];
  for (const k of state.knee) {
    const date = isoPrefix(k['date']);
    const level = num(k['pain']);
    if (date === null || level === null || level < 1 || level > 10) continue;
    const part = str(k['part']);
    out.push(part === null ? { date, level } : { date, level, part });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/* ------------------------------------------------------------------ sastavljanje dokumenta */

export interface FormatSpec {
  /** `PlanHeader.policyId = 'adopted:<format>'`. */
  format: string;
  policyVersion: string;
  protected: boolean;
  distanceId: string;
  distanceM: number;
  /** Forma po kojoj su stara tempa računata (VDOT). */
  vdot: number;
  profile: RunnerProfile;
}

export interface AdoptOk {
  doc: PlanDoc;
  facts: RunnerFacts;
  /** Polja plana i nedelja koja `PlanDoc` nema gde da nosi (meta, pred, qs, izlazi v2, `focus`…), doslovno. */
  carried: Readonly<Record<string, JsonValue>>;
  /** ID-jevi dana čija struktura nije preneta u korake (jedan stalan korak; izvor u `legacy`). */
  fallbackDays: string[];
}

const byDateStable = <T extends { date: IsoDate }>(xs: readonly T[]): T[] =>
  xs
    .map((x, i) => ({ x, i }))
    .sort((a, b) => (a.x.date < b.x.date ? -1 : a.x.date > b.x.date ? 1 : a.i - b.i))
    .map((e) => e.x);

function formPoint(vdot: number, distanceM: number, today: IsoDate): FormPoint {
  return {
    vdot,
    raceTimeSec: Math.round(raceTimeSec(vdot, distanceM)),
    asOf: today,
    confidence: 'srednja'
  };
}

function weekdaysBy(counts: Map<Weekday, number>, min: number): Weekday[] {
  return [...counts.entries()]
    .filter(([, n]) => n >= min)
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([d]) => d);
}

const bump = (m: Map<Weekday, number>, d: Weekday): void => {
  m.set(d, (m.get(d) ?? 0) + 1);
};

/** Ceo `PlanDoc` + činjenice iz razrešenog stanja. */
export function assemble(state: ReadState, spec: FormatSpec, today: IsoDate): AdoptOk {
  const paces: Paces = zonePaces(spec.vdot, spec.distanceM, false);
  const easyPace = paceAtShare(spec.vdot, ZONE_SHARE.E);
  const resolved = resolveDays(state);
  const runs = runsOf(state, resolved, { easyPace });
  const locked = (id: string): boolean => state.log[id]?.['lock'] === true;
  const meta = state.plan.meta;
  const raceDate = isoPrefix(meta['raceDate']) ?? resolved[resolved.length - 1]?.date ?? today;
  const startDate =
    isoPrefix(meta['start']) ??
    byDateStable(resolved)[0]?.date ??
    state.plan.weeks[0]?.start ??
    today;
  const fallbackDays: string[] = [];

  const dayOf = (r: Resolved): PlanDay => {
    const built = buildWorkout(r, spec.distanceId);
    if (built.fallback) fallbackDays.push(r.day.id);
    const manual = isManual(r);
    const day: PlanDay = {
      id: r.day.id,
      date: r.date,
      origin: manual ? 'manual' : 'adopted',
      locked: locked(r.day.id),
      workout: built.workout
    };
    if (r.date !== r.origDate) day.movedFrom = r.origDate;
    if (r.alt !== null) day.base = buildWorkout(originalOf(r), spec.distanceId).workout;
    const extras = extrasOf(r);
    if (extras.length > 0) day.extras = extras;
    const legacy = legacyOf(r);
    if (legacy !== undefined) day.legacy = legacy;
    return day;
  };

  /* Privremeno zaglavlje za račun km/opterećenja (tempa ne utiču na km preuzetih koraka). */
  const ctxHeader = { paces, form: { paceVdot: spec.vdot } } as Pick<PlanHeader, 'paces' | 'form'>;
  const ctx = paceCtxOf(ctxHeader as PlanHeader);

  const weeksDays = state.plan.weeks.map((_, i) =>
    byDateStable(resolved.filter((r) => r.weekIndex === i).map(dayOf))
  );
  const costs = weeksDays.map((days) => {
    let load = 0;
    let longSec = 0;
    let longDay: PlanDay | null = null;
    for (const d of days) {
      const w = d.workout;
      if (w === null || w.kind === 'race') continue;
      const s = summarize(w, ctx);
      load += s.load;
      if (w.kind === 'long' && s.durationSec > longSec) {
        longSec = s.durationSec;
        longDay = d;
      }
    }
    return { load: Math.round(load), longSec: Math.round(longSec), longDay };
  });
  const peakLoad = Math.max(1, ...costs.map((c) => c.load));
  const longMaxSec = Math.max(0, ...costs.map((c) => c.longSec));

  const doseCap: Record<StimulusTag, number> = {};
  const runCount = new Map<Weekday, number>();
  const longCount = new Map<Weekday, number>();
  const qualityCount = new Map<Weekday, number>();
  let warmupSec = 0;
  let cooldownSec = 0;
  for (const days of weeksDays) {
    for (const d of days) {
      const w = d.workout;
      if (w === null || w.steps.length === 0) continue;
      const dow = weekdayOf(d.date);
      bump(runCount, dow);
      if (w.kind === 'long') bump(longCount, dow);
      if (w.kind === 'quality') bump(qualityCount, dow);
      if (w.stimulus !== null && w.workSec > 0) {
        doseCap[w.stimulus] = Math.max(doseCap[w.stimulus] ?? 0, w.workSec);
      }
    }
  }
  for (const r of resolved) {
    for (const block of blocksOf(r.structure)) {
      const step = stepOf(block);
      const sec = step === null ? null : num(step['sec']);
      if (sec === null) continue;
      if (step?.['kind'] === 'warmup' && warmupSec === 0) warmupSec = Math.round(sec);
      if (step?.['kind'] === 'cooldown' && cooldownSec === 0) cooldownSec = Math.round(sec);
    }
  }
  const half = Math.max(1, Math.floor(state.plan.weeks.length / 2));
  let runDays = weekdaysBy(runCount, half).sort((a, b) => a - b);
  if (runDays.length === 0) runDays = weekdaysBy(runCount, 1).sort((a, b) => a - b);
  if (runDays.length === 0) runDays = [6];
  const longDay = weekdaysBy(longCount, 1)[0] ?? runDays[runDays.length - 1] ?? 6;
  if (!runDays.includes(longDay)) runDays = [...runDays, longDay].sort((a, b) => a - b);
  const qualityDays = weekdaysBy(qualityCount, 1).filter((d) => runDays.includes(d));

  const decisions: Decisions = {
    templateId: `adopted:${spec.format}`,
    level: 'adopted',
    baseLoad: costs[0]?.load ?? peakLoad,
    peakLoad,
    longMaxSec,
    longStartSec: costs.find((c) => c.longSec > 0)?.longSec ?? 0,
    doseCapSec: doseCap,
    warmupSec: warmupSec > 0 ? warmupSec : 900,
    cooldownSec: cooldownSec > 0 ? cooldownSec : 600,
    runDays,
    longDay,
    qualityDays
  };

  const weeks: PlanWeek[] = state.plan.weeks.map((week, i) => {
    const days = weeksDays[i] ?? [];
    const cost = costs[i] ?? { load: 0, longSec: 0, longDay: null };
    const hasRace = days.some((d) => d.workout?.kind === 'race');
    const stimuli: WeekIntent['stimuli'] = [];
    for (const d of days) {
      const w = d.workout;
      if (w === null || w.stimulus === null) continue;
      if (w.kind === 'quality' || w.kind === 'test') stimuli.push({ stimulus: w.stimulus });
    }
    const addOn = days.find((d) => d.workout?.kind === 'easy' && d.workout.stimulus !== null);
    if (addOn?.workout?.stimulus != null) stimuli.push({ stimulus: addOn.workout.stimulus });
    const longStimulus = cost.longDay?.workout?.stimulus ?? null;
    const intent: WeekIntent = {
      phase: week.phase ?? 'nepoznata',
      kind: hasRace ? 'race' : week.taper ? 'taper' : week.deload ? 'recovery' : 'build',
      loadPct: Math.round((cost.load / peakLoad) * 1000) / 1000,
      long:
        cost.longSec > 0 && longStimulus !== null && longMaxSec > 0
          ? {
              lenPct: Math.round((cost.longSec / longMaxSec) * 1000) / 1000,
              stimulus: longStimulus
            }
          : null,
      stimuli,
      source: 'inferred'
    };
    return {
      index: i + 1,
      start: week.start,
      intent,
      targetLoad: cost.load,
      longSec: cost.longSec,
      days
    };
  });

  const goalSec = num(meta['goalSec']);
  const raceName = str(meta['raceName']);
  const point = formPoint(spec.vdot, spec.distanceM, today);
  const header: PlanHeader = {
    goal: {
      distanceId: spec.distanceId,
      raceDate,
      startDate,
      ...(raceName !== null && raceName !== '' ? { raceName } : {}),
      ...(goalSec !== null && goalSec > 0 ? { targetTimeSec: Math.round(goalSec) } : {})
    },
    startDate,
    policyId: `adopted:${spec.format}`,
    policyVersion: spec.policyVersion,
    form: {
      start: point,
      current: point,
      paceVdot: spec.vdot,
      pacesUpdatedOn: today,
      raceDay: {
        lowSec: point.raceTimeSec,
        expectedSec: point.raceTimeSec,
        highSec: point.raceTimeSec
      }
    },
    paces,
    decisions,
    warnings: [],
    protected: spec.protected,
    appliedEvents: [],
    eventsFrom: today
  };

  const doc: PlanDoc = {
    schema: 'plan-doc',
    version: PLAN_DOC_VERSION,
    engineVersion: ENGINE_VERSION,
    header,
    weeks
  };
  const facts: RunnerFacts = {
    today,
    availability: { runDays, longDay },
    profile: spec.profile,
    runs,
    pauses: [],
    pain: painOf(state)
  };
  const carried: Record<string, JsonValue> = restOf(state.plan.raw, ['weeks']);
  carried['weeks'] = state.plan.weeks.map((w) => restOf(w.raw, ['days', 'start']));
  return { doc, facts, carried, fallbackDays };
}
