/* 5K v2 → aplikacija: strukturisan trening v2 → `WorkoutStructure` formata razmene (deo po deo). Ništa se ne
   preračunava: km, trajanje, tempo, napor i osnova (zadato/procenjeno) prelaze doslovno iz segmenata v2. */

import type { Effort, PaceModel, RunWalkRace, RunWalkSession, Segment, Workout } from '../types.ts';
import type { StructureBlock, StructureEffort, StructureStep, WorkoutStructure } from './types.ts';

const KIND: Readonly<Record<Segment['kind'], StructureStep['kind']>> = {
  warmup: 'warmup',
  cooldown: 'cooldown',
  easy: 'easy',
  long: 'long',
  rep: 'work',
  recovery: 'recovery',
  continuous: 'work',
  progression: 'work',
  stride: 'stride',
  race: 'race',
  test: 'test'
};

const effortOf = (e: Effort): StructureEffort => ({
  rpeMin: e.rpeMin,
  rpeMax: e.rpeMax,
  cue: e.cue
});

function stepOf(s: Segment, p: PaceModel): StructureStep {
  return {
    kind: KIND[s.kind],
    zone: s.zone,
    km: s.km,
    sec: s.sec,
    paceSec: s.paceSecPerKm,
    // Lagani delovi su u v2 opseg E (sredina je procena km/trajanja).
    ...(s.zone === 'E' && s.paceSecPerKm !== null
      ? { paceRange: { fast: p.E.fast, slow: p.E.slow } }
      : {}),
    kmBasis: s.kmBasis,
    secBasis: s.secBasis,
    ...(s.effort ? { effort: effortOf(s.effort) } : {})
  };
}

/** Blokovi iz `workout.blocks` uz segmente istim redom (generator ih pravi blok po blok, `workouts.segmentsOf`). */
export function workoutStructure(w: Workout, p: PaceModel): WorkoutStructure {
  const blocks: StructureBlock[] = [];
  let i = 0;
  const take = (): Segment => {
    const s = w.segments[i++];
    if (!s) throw new Error(`5K v2: segmenti treninga „${w.title}" ne odgovaraju blokovima.`);
    return s;
  };
  for (const b of w.blocks) {
    if (b.kind === 'progression') {
      for (let k = 0; k < b.steps.length; k++) blocks.push({ reps: 1, step: stepOf(take(), p) });
    } else if (b.kind === 'reps') {
      const work = stepOf(take(), p);
      const rest = b.reps > 1 ? stepOf(take(), p) : undefined;
      // Ostala ponavljanja su ista (isti blok); preskaču se posle provere broja.
      for (let k = 1; k < b.reps; k++) {
        take();
        if (k < b.reps - 1) take();
      }
      blocks.push({ reps: b.reps, step: work, ...(rest ? { recovery: rest } : {}) });
    } else blocks.push({ reps: 1, step: stepOf(take(), p) });
  }
  if (i !== w.segments.length)
    throw new Error(`5K v2: segmenti treninga „${w.title}" ne odgovaraju blokovima.`);
  const main = blocks.find(
    (b) => b.step.effort && ['work', 'stride', 'race', 'test'].includes(b.step.kind)
  )?.step.effort;
  return {
    title: w.title,
    blocks,
    km: w.km,
    sec: w.sec,
    kmBasis: w.kmBasis,
    secBasis: w.secBasis,
    ...(main ? { rpe: { min: main.rpeMin, max: main.rpeMax, txt: main.cue } } : {})
  };
}

const walk = (sec: number): StructureStep => ({
  kind: 'walk',
  km: null,
  sec,
  paceSec: null,
  kmBasis: 'estimated',
  secBasis: 'exact'
});

/** Sesija trčanja/hodanja (vremenska, bez tempa): hod, nivo (reps × trčanje/hod), hod. km samo procena trčanja. */
export function runWalkStructure(
  s: RunWalkSession,
  easyPace: number | null,
  projection: boolean
): WorkoutStructure {
  const run: StructureStep = {
    kind: 'run',
    km: easyPace === null ? null : Math.round((s.runSec / easyPace) * 100) / 100,
    sec: s.runSec,
    paceSec: null,
    ...(easyPace === null ? {} : { estimatePaceSec: easyPace }),
    kmBasis: 'estimated',
    secBasis: 'exact',
    effort: effortOf(s.effort)
  };
  const active: StructureBlock =
    s.continuous || s.walkSec === 0
      ? { reps: 1, step: run }
      : { reps: s.reps, step: run, recovery: walk(s.walkSec) };
  return {
    title: s.title,
    blocks: [
      { reps: 1, step: walk(s.warmupWalkSec) },
      active,
      { reps: 1, step: walk(s.cooldownWalkSec) }
    ],
    km: s.estRunKm,
    sec: s.totalSec,
    kmBasis: 'estimated',
    secBasis: 'exact',
    rpe: { min: s.effort.rpeMin, max: s.effort.rpeMax, txt: s.effort.cue },
    level: s.level,
    ...(projection ? { projection: true as const } : {})
  };
}

/** Trka plana trčanje/hodanje: distanca bez tempa (trajanje nepoznato), cilj „završiti". */
export function runWalkRaceStructure(
  r: RunWalkRace,
  level: number,
  projection: boolean
): WorkoutStructure {
  return {
    title: r.title,
    blocks: [
      { reps: 1, step: walk(r.warmupWalkSec) },
      {
        reps: 1,
        step: {
          kind: 'race',
          km: r.distanceKm,
          sec: null,
          paceSec: null,
          kmBasis: 'exact',
          secBasis: 'estimated',
          effort: effortOf(r.effort)
        }
      },
      { reps: 1, step: walk(r.cooldownWalkSec) }
    ],
    km: r.distanceKm,
    sec: null,
    kmBasis: 'exact',
    secBasis: 'estimated',
    rpe: { min: r.effort.rpeMin, max: r.effort.rpeMax, txt: r.effort.cue },
    level,
    ...(projection ? { projection: true as const } : {}),
    goal: r.goal
  };
}
