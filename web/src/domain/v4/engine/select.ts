/* V4 — IZBOR TRENINGA I KORACI (SPEC § 4.3–4.6): doza mesta, kandidat iz biblioteke, koraci iz doze, tekst.
   „Recept" je odluka o danu pre nego što postane `Workout`; isti recept koriste `plan`, `replan` i spremnost. */
import {
  EASY_DISTANCE_STEP_M,
  EASY_DURATION_STEP_SEC,
  LADDER_TOLERANCE_SEC,
  LONG_BLOCK_MAX_SHARE,
  RPE_STAND,
  RPE_WALK,
  WORK_DISTANCE_STEP_M,
  WORK_DURATION_STEP_SEC
} from './constants';
import { fillText, fmtDistance, fmtDuration, fmtKm, fmtMinutes } from './format';
import { type PaceCtx, singleStepCost, stepsCost, summarize, zonePace } from './load';
import type {
  Decisions,
  DistanceData,
  Extent,
  MainSet,
  PhaseId,
  RecoverySpec,
  Seconds,
  SingleStep,
  Step,
  StimulusTag,
  Template,
  WeekKind,
  Workout,
  WorkoutDef,
  WorkUnit,
  ZoneId
} from './types';
import { raceTimeSec } from './vdot';

export interface BuildCtx {
  data: DistanceData;
  decisions: Decisions;
  pace: PaceCtx;
  /** Šablon plana (faktor doze rasterećenja); `null` kad ga podaci više nemaju (preuzet plan). */
  template: Template | null;
}

export type Place = 'long' | 'quality';

/** Mesto u nameri nedelje: podražaj, redni broj pojavljivanja (§ 4.4) i faza. */
export interface SlotRef {
  place: Place;
  stimulus: StimulusTag;
  index: number;
  phase: PhaseId;
  workoutId?: string;
}

export type Recipe =
  | { type: 'rest' }
  | { type: 'easy'; sec: Seconds }
  | { type: 'addon'; sec: Seconds; def: WorkoutDef }
  | { type: 'long'; sec: Seconds; def: WorkoutDef | null; dose: Seconds; slot: SlotRef | null }
  | { type: 'quality'; def: WorkoutDef; dose: Seconds; slot: SlotRef }
  | { type: 'test'; def: WorkoutDef; slot: SlotRef };

export const REST: Recipe = { type: 'rest' };

/** Lagani i dugi se zadaju dužinom kad lagani tempo nije sporiji od praga prikaza (§ 5.5). */
export function byDistance(ctx: BuildCtx): boolean {
  return ctx.pace.paces.easy <= ctx.data.presentation.byDurationAboveSecPerKm;
}

const roundTo = (value: number, step: number): number => Math.round(value / step) * step;

/* ------------------------------------------------------------------ doza (§ 4.4) */

const isDosed = (main: MainSet): boolean =>
  main.kind === 'continuous' ||
  main.kind === 'split' ||
  main.kind === 'reps' ||
  main.kind === 'ladder' ||
  main.kind === 'finish-block' ||
  main.kind === 'progressive';

export function mainZone(main: MainSet): ZoneId | null {
  return main.kind === 'all-out' ? null : main.zone;
}

/** Doza mesta pre budžeta: `dosePct × plafon`, ili lestvica napredovanja kad šablon ne zada `dosePct`. */
export function slotDose(
  slot: SlotRef,
  dosePct: number | undefined,
  weekKind: WeekKind,
  ctx: BuildCtx
): Seconds {
  const cap = ctx.decisions.doseCapSec[slot.stimulus];
  if (cap === undefined) return 0;
  if (dosePct !== undefined) return dosePct * cap;
  const ladder = ctx.data.safety.progression[slot.stimulus];
  const step = weekKind === 'recovery' ? Math.max(0, slot.index - 1) : slot.index;
  const pct = ladder === undefined ? 1 : Math.min(1, ladder.startPct + ladder.stepPct * step);
  const factor = weekKind === 'recovery' ? (ctx.template?.recovery.doseFactor ?? 1) : 1;
  return pct * cap * factor;
}

/* ------------------------------------------------------------------ izbor (§ 4.5) */

export interface PickFlags {
  noHighImpact: boolean;
}

function passes(
  def: WorkoutDef,
  slot: SlotRef,
  dose: Seconds | null,
  ctx: BuildCtx,
  flags: PickFlags
): boolean {
  const r = def.requires;
  const vdot = ctx.pace.vdot;
  if (r.minVdot !== undefined && vdot < r.minVdot) return false;
  if (r.maxVdot !== undefined && vdot > r.maxVdot) return false;
  if (r.minBaseLoad !== undefined && ctx.decisions.baseLoad < r.minBaseLoad) return false;
  if (r.phases !== undefined && !r.phases.includes(slot.phase)) return false;
  if (r.levels !== undefined && !r.levels.includes(ctx.decisions.level)) return false;
  if (r.minRunDays !== undefined && ctx.decisions.runDays.length < r.minRunDays) return false;
  if (r.needsKnownPaces === true && ctx.pace.paces.byFeel) return false;
  if (flags.noHighImpact && def.impact === 'visok') return false;
  if (dose !== null && isDosed(def.main)) {
    if (dose < minDoseOf(def, ctx)) return false;
    if (r.maxDoseSec !== undefined && dose > r.maxDoseSec) return false;
  }
  return true;
}

/** Najmanja doza za koju unos ima smisla: plafon distance, zahtev unosa i najmanji oblik (deonice, lestvica). */
export function minDoseOf(def: WorkoutDef, ctx: BuildCtx): Seconds {
  const { main } = def;
  let shape = 0;
  if (main.kind === 'reps') shape = (main.minReps - 0.5) * extentSec(main.rep, main.zone, ctx);
  if (main.kind === 'ladder' && main.reps[0] !== undefined) {
    shape = extentSec(main.reps[0], main.zone, ctx) - LADDER_TOLERANCE_SEC;
  }
  return Math.max(ctx.data.safety.minDoseSec, def.requires.minDoseSec ?? 0, shape);
}

function fitsPlace(def: WorkoutDef, place: Place): boolean {
  if (place === 'long') return def.kind === 'long';
  return (
    def.kind === 'quality' ||
    def.kind === 'test' ||
    (def.kind === 'easy' && def.main.kind === 'add-on')
  );
}

/** Kandidati mesta redom iz biblioteke; `dose: null` preskače proveru raspona doze. */
export function candidates(
  slot: SlotRef,
  dose: Seconds | null,
  ctx: BuildCtx,
  flags: PickFlags
): WorkoutDef[] {
  return ctx.data.library.filter(
    (def) =>
      def.stimulus === slot.stimulus &&
      fitsPlace(def, slot.place) &&
      passes(def, slot, dose, ctx, flags)
  );
}

/** Izbor: zadat `workoutId` ako prolazi, inače `kandidati[i mod broj]`; `null` = nema kandidata. */
export function pickDef(
  slot: SlotRef,
  dose: Seconds | null,
  ctx: BuildCtx,
  flags: PickFlags
): WorkoutDef | null {
  if (slot.workoutId !== undefined) {
    const fixed = ctx.data.library.find((def) => def.id === slot.workoutId);
    if (
      fixed !== undefined &&
      fitsPlace(fixed, slot.place) &&
      passes(fixed, slot, dose, ctx, flags)
    ) {
      return fixed;
    }
  }
  const list = candidates(slot, dose, ctx, flags);
  return list.length === 0 ? null : (list[slot.index % list.length] ?? null);
}

export function easyDef(ctx: BuildCtx): WorkoutDef | null {
  return ctx.data.library.find((d) => d.kind === 'easy' && d.main.kind === 'steady') ?? null;
}

/** Lagan dugi: unos `long` sa `steady`, po mogućstvu istog podražaja. */
export function steadyLongDef(ctx: BuildCtx, stimulus: StimulusTag | null): WorkoutDef | null {
  const steady = ctx.data.library.filter((d) => d.kind === 'long' && d.main.kind === 'steady');
  return steady.find((d) => d.stimulus === stimulus) ?? steady[0] ?? null;
}

/* ------------------------------------------------------------------ koraci (§ 4.3) */

const zoneStep = (role: SingleStep['role'], zone: ZoneId, extent: Extent): SingleStep => ({
  role,
  target: { type: 'zone', zone },
  extent
});

function recoveryStep(spec: RecoverySpec): SingleStep {
  if (spec.mode === 'dzog') return zoneStep('recovery', 'E', spec.extent);
  return {
    role: 'recovery',
    target: { type: 'effort', rpe: spec.mode === 'hod' ? RPE_WALK : RPE_STAND },
    extent: spec.extent
  };
}

const RECOVERY_WORD: Readonly<Record<RecoverySpec['mode'], string>> = {
  dzog: 'džog',
  hod: 'hod',
  stajanje: 'pauze'
};

const fmtExtent = (extent: Extent): string =>
  'distanceM' in extent ? fmtDistance(extent.distanceM) : fmtDuration(extent.durationSec);

const fmtRecovery = (spec: RecoverySpec): string =>
  `${fmtExtent(spec.extent)} ${RECOVERY_WORD[spec.mode]}`;

function unitOf(by: WorkUnit | undefined, ctx: BuildCtx): WorkUnit {
  return by ?? (byDistance(ctx) ? 'duzina' : 'trajanje');
}

/** Komad rada doze `sec` u jedinici mesta: 60 s ili 500 m (§ 4.3). */
function workExtent(sec: Seconds, zone: ZoneId, unit: WorkUnit, ctx: BuildCtx): Extent {
  if (unit === 'trajanje') {
    return { durationSec: Math.max(WORK_DURATION_STEP_SEC, roundTo(sec, WORK_DURATION_STEP_SEC)) };
  }
  const meters = (sec / zonePace(zone, ctx.pace.paces)) * 1000;
  return { distanceM: Math.max(WORK_DISTANCE_STEP_M, roundTo(meters, WORK_DISTANCE_STEP_M)) };
}

function extentSec(extent: Extent, zone: ZoneId, ctx: BuildCtx): Seconds {
  return 'durationSec' in extent
    ? extent.durationSec
    : (extent.distanceM * zonePace(zone, ctx.pace.paces)) / 1000;
}

/** `n` komada rada sa oporavkom posle svakog osim poslednjeg. */
function repeated(n: number, work: SingleStep, recovery: SingleStep): Step[] {
  if (n <= 1) return [work];
  return [{ repeat: n - 1, steps: [work, recovery] }, work];
}

interface Main {
  steps: Step[];
  values: Record<string, string>;
}

function ladderMain(
  main: Extract<MainSet, { kind: 'ladder' }>,
  dose: Seconds,
  ctx: BuildCtx
): Main {
  const steps: Step[] = [];
  const parts: string[] = [];
  let total = 0;
  for (const rep of main.reps) {
    const sec = extentSec(rep, main.zone, ctx);
    if (steps.length > 0 && total + sec > dose + LADDER_TOLERANCE_SEC) break;
    if (steps.length > 0) steps.push(recoveryStep(main.recovery));
    steps.push(zoneStep('work', main.zone, rep));
    parts.push(fmtExtent(rep));
    total += sec;
  }
  return {
    steps,
    values: { n: String(parts.length), rep: parts.join(' – '), rec: fmtRecovery(main.recovery) }
  };
}

/** Glavni deo treninga iz doze (§ 4.3); vraća i vrednosti za tekst. */
function mainSteps(main: MainSet, dose: Seconds, cap: Seconds, ctx: BuildCtx): Main {
  switch (main.kind) {
    case 'continuous': {
      const extent = workExtent(dose, main.zone, unitOf(main.by, ctx), ctx);
      return {
        steps: [zoneStep('work', main.zone, extent)],
        values: { n: '1', rep: fmtExtent(extent) }
      };
    }
    case 'split': {
      const pieces = Math.max(1, Math.round(main.pieces));
      const extent = workExtent(dose / pieces, main.zone, unitOf(main.by, ctx), ctx);
      return {
        steps: repeated(pieces, zoneStep('work', main.zone, extent), recoveryStep(main.recovery)),
        values: { n: String(pieces), rep: fmtExtent(extent), rec: fmtRecovery(main.recovery) }
      };
    }
    case 'reps': {
      const repSec = extentSec(main.rep, main.zone, ctx);
      const wanted = repSec > 0 ? Math.round(dose / repSec) : main.minReps;
      const fits = repSec > 0 ? Math.floor((cap + LADDER_TOLERANCE_SEC) / repSec) : main.maxReps;
      const n = Math.max(1, main.minReps, Math.min(main.maxReps, wanted, fits));
      return {
        steps: repeated(n, zoneStep('work', main.zone, main.rep), recoveryStep(main.recovery)),
        values: { n: String(n), rep: fmtExtent(main.rep), rec: fmtRecovery(main.recovery) }
      };
    }
    case 'ladder':
      return ladderMain(main, dose, ctx);
    case 'all-out':
      return {
        steps: [
          { role: 'work', target: { type: 'allOut' }, extent: { distanceM: main.distanceM } }
        ],
        values: { rep: fmtDistance(main.distanceM), n: '1' }
      };
    default:
      return { steps: [], values: {} };
  }
}

/** Lagani deo zadat trajanjem `sec`: dužina na 0,5 km ili trajanje na 5 min (§ 5.5).
    `down`: zaokruživanje naniže (dugi — da zaokruživanje ne pređe plafon ni korak rasta). */
function easyExtent(sec: Seconds, ctx: BuildCtx, down = false): Extent {
  const snap = (value: number, step: number): number =>
    down ? Math.floor(value / step + 1e-6) * step : roundTo(value, step);
  if (byDistance(ctx)) {
    const meters = (sec / ctx.pace.paces.easy) * 1000;
    return { distanceM: Math.max(EASY_DISTANCE_STEP_M, snap(meters, EASY_DISTANCE_STEP_M)) };
  }
  return { durationSec: Math.max(EASY_DURATION_STEP_SEC, snap(sec, EASY_DURATION_STEP_SEC)) };
}

const fmtLen = (extent: Extent): string =>
  'distanceM' in extent ? fmtKm(extent.distanceM) : fmtMinutes(extent.durationSec);

/** Koraci dodatka (ubrzanja, kratki usponi): `count × (deonica + oporavak)`. */
export function addonSteps(def: WorkoutDef): Step[] {
  if (def.main.kind !== 'add-on') return [];
  const work = zoneStep('work', def.main.zone, def.main.rep);
  return [
    {
      repeat: Math.max(1, Math.round(def.main.count)),
      steps: [work, recoveryStep(def.main.recovery)]
    }
  ];
}

/* ------------------------------------------------------------------ recept → trening */

const FALLBACK_TEXT = { easy: 'lagano {len}', long: 'dugi {len}', quality: '{n} × {rep}' } as const;

function textOf(
  def: WorkoutDef | null,
  fallback: string,
  values: Record<string, string>,
  ctx: BuildCtx
): string {
  const template = def === null ? undefined : ctx.data.texts[def.text];
  return fillText(template ?? fallback, values);
}

function withNotes(workout: Workout, def: WorkoutDef | null, ctx: BuildCtx): Workout {
  const notes: string[] = [];
  for (const key of def?.notes ?? []) {
    const text = ctx.data.texts[key];
    if (text !== undefined) notes.push(text);
  }
  const duration = summarize(workout, ctx.pace).durationSec;
  for (const rule of ctx.data.noteRules) {
    const text = ctx.data.texts[rule.text];
    if (
      rule.kinds.includes(workout.kind) &&
      duration >= rule.minDurationSec &&
      text !== undefined
    ) {
      if (!notes.includes(text)) notes.push(text);
    }
  }
  return notes.length === 0 ? workout : { ...workout, notes };
}

function easyWorkout(sec: Seconds, ctx: BuildCtx): Workout {
  const def = easyDef(ctx);
  const extent = easyExtent(sec, ctx);
  const workout: Workout = {
    kind: 'easy',
    stimulus: null,
    ...(def === null ? {} : { libraryId: def.id }),
    workSec: 0,
    steps: [zoneStep('steady', 'E', extent)],
    text: textOf(def, FALLBACK_TEXT.easy, { len: fmtLen(extent) }, ctx)
  };
  return withNotes(workout, def, ctx);
}

function addonWorkout(sec: Seconds, def: WorkoutDef, ctx: BuildCtx): Workout {
  if (def.main.kind !== 'add-on') return easyWorkout(sec, ctx);
  const extent = easyExtent(sec, ctx);
  const extra = addonSteps(def);
  const steady = zoneStep('steady', 'E', extent);
  const workout: Workout = {
    kind: 'easy',
    stimulus: def.stimulus,
    libraryId: def.id,
    workSec: 0,
    steps: [steady, ...extra],
    text: textOf(
      def,
      FALLBACK_TEXT.easy,
      {
        len: fmtLen(extent),
        n: String(Math.max(1, Math.round(def.main.count))),
        rep: fmtExtent(def.main.rep),
        rec: fmtRecovery(def.main.recovery)
      },
      ctx
    )
  };
  return withNotes(workout, def, ctx);
}

/** Dugi: lagan, ili lagani deo pa blok/progresija doze (blok najviše polovina dugog). */
function longWorkout(recipe: Extract<Recipe, { type: 'long' }>, ctx: BuildCtx): Workout {
  const { def } = recipe;
  const main = def?.main;
  const total = easyExtent(recipe.sec, ctx, true);
  if (
    def === null ||
    main === undefined ||
    (main.kind !== 'finish-block' && main.kind !== 'progressive') ||
    recipe.dose <= 0
  ) {
    const steadyDef =
      def !== null && def.main.kind === 'steady' ? def : steadyLongDef(ctx, def?.stimulus ?? null);
    const workout: Workout = {
      kind: 'long',
      stimulus: steadyDef?.stimulus ?? null,
      ...(steadyDef === null ? {} : { libraryId: steadyDef.id }),
      workSec: 0,
      steps: [zoneStep('steady', 'E', total)],
      text: textOf(steadyDef, FALLBACK_TEXT.long, { len: fmtLen(total) }, ctx)
    };
    return withNotes(workout, steadyDef, ctx);
  }
  const unit = unitOf(main.by, ctx);
  let block: Extent;
  let steady: Extent;
  if ('distanceM' in total && unit === 'duzina') {
    const wanted = roundTo(
      (recipe.dose / zonePace(main.zone, ctx.pace.paces)) * 1000,
      WORK_DISTANCE_STEP_M
    );
    const most =
      Math.floor((total.distanceM * LONG_BLOCK_MAX_SHARE) / WORK_DISTANCE_STEP_M) *
      WORK_DISTANCE_STEP_M;
    const meters = Math.max(WORK_DISTANCE_STEP_M, Math.min(wanted, most));
    block = { distanceM: meters };
    steady = { distanceM: Math.max(EASY_DISTANCE_STEP_M, total.distanceM - meters) };
  } else {
    const most = recipe.sec * LONG_BLOCK_MAX_SHARE;
    block = workExtent(Math.min(recipe.dose, most), main.zone, unit, ctx);
    steady = easyExtent(Math.max(0, recipe.sec - extentSec(block, main.zone, ctx)), ctx, true);
  }
  const steps: Step[] = [zoneStep('steady', 'E', steady), zoneStep('work', main.zone, block)];
  const workout: Workout = {
    kind: 'long',
    stimulus: def.stimulus,
    libraryId: def.id,
    workSec: Math.round(stepsCost(steps, ctx.pace).workSec),
    steps,
    text: textOf(
      def,
      FALLBACK_TEXT.long,
      {
        len:
          'distanceM' in total && 'distanceM' in steady && 'distanceM' in block
            ? fmtKm(steady.distanceM + block.distanceM)
            : fmtMinutes(stepsCost(steps, ctx.pace).durationSec),
        dose: fmtExtent(block),
        rep: fmtExtent(block),
        n: '1'
      },
      ctx
    )
  };
  return withNotes(workout, def, ctx);
}

function qualityWorkout(def: WorkoutDef, dose: Seconds, ctx: BuildCtx): Workout {
  const cap = ctx.decisions.doseCapSec[def.stimulus] ?? Number.POSITIVE_INFINITY;
  const main = mainSteps(def.main, dose, cap, ctx);
  const steps: Step[] = [
    zoneStep('warmup', 'E', { durationSec: ctx.decisions.warmupSec }),
    ...main.steps,
    zoneStep('cooldown', 'E', { durationSec: ctx.decisions.cooldownSec })
  ];
  const workSec = Math.round(stepsCost(main.steps, ctx.pace).workSec);
  const workout: Workout = {
    kind: def.kind === 'test' ? 'test' : 'quality',
    stimulus: def.stimulus,
    libraryId: def.id,
    workSec,
    steps,
    text: textOf(def, FALLBACK_TEXT.quality, { ...main.values, dose: fmtDuration(workSec) }, ctx)
  };
  return withNotes(workout, def, ctx);
}

/** Recept → konkretan trening (`null` = odmor). Jedina funkcija koja pravi korake dana. */
export function realize(recipe: Recipe, ctx: BuildCtx): Workout | null {
  switch (recipe.type) {
    case 'rest':
      return null;
    case 'easy':
      return easyWorkout(recipe.sec, ctx);
    case 'addon':
      return addonWorkout(recipe.sec, recipe.def, ctx);
    case 'long':
      return longWorkout(recipe, ctx);
    case 'quality':
      return qualityWorkout(recipe.def, recipe.dose, ctx);
    case 'test':
      return qualityWorkout(recipe.def, 0, ctx);
  }
}

/** Očekivano trajanje punog napora na `distanceM` po formi plana (za budžet i rampu posle testa). */
export function allOutSec(distanceM: number, ctx: BuildCtx): Seconds {
  return raceTimeSec(ctx.pace.vdot, distanceM);
}

/** Dan trke: jedan korak punog napora na dužinu cilja (§ 6.2 k. 10). */
export function raceWorkout(data: DistanceData): Workout {
  return {
    kind: 'race',
    stimulus: null,
    workSec: 0,
    steps: [{ role: 'work', target: { type: 'allOut' }, extent: { distanceM: data.distanceM } }],
    text: data.texts['race'] ?? 'trka'
  };
}

/** Opterećenje jednog koraka rada u zoni po minutu iznad laganog: `w − 1` (za budžet brzog rada). */
export function extraWeight(zone: ZoneId, ctx: BuildCtx): number {
  return singleStepCost(zoneStep('work', zone, { durationSec: 60 }), ctx.pace).load - 1;
}
