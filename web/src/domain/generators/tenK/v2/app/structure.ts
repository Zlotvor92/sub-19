/* 10K v2 → aplikacija: trening v2 → `WorkoutStructure` formata razmene, blok po blok (`workout.blocks`) uz segmente istim
   redom (`workout.segments`). Ništa se ne preračunava: km, trajanje, tempo, osnova (zadato/procenjeno) i RPE prelaze
   doslovno iz v2. Jedina odluka je ŠTA je propisan tempo, a šta procena:
   - plan po osećaju (D26): tempo T/I/R/RP je „orijentir (procena)" iz procene VDOT-a, a trening vodi RPE — rad kvaliteta
     nosi RPE (`effort`) i tempo kao procenu (`estimatePaceSec`, ne `paceSec`); ubrzanja i trka plana po osećaju isto
     (procena, v2 im ne daje RPE);
   - test 5 km (D27): trajanje je procena vremena 5 km iz VDOT-a plana → tempo je procena;
   - lagani delovi (E) su propisan opseg (`paceRange`), oporavak je džog srednjim E. */

import { midEasy } from '../paces.ts';
import type { Paces, Segment, Workout } from '../types.ts';
import type { StructureBlock, StructureStep, WorkoutStructure } from './types.ts';

const KIND: Readonly<Record<Segment['kind'], StructureStep['kind']>> = {
  warmup: 'warmup',
  cooldown: 'cooldown',
  easy: 'easy',
  long: 'long',
  rep: 'work',
  continuous: 'work',
  recovery: 'recovery',
  stride: 'stride',
  race: 'race',
  test: 'test'
};

function stepOf(s: Segment, w: Workout, p: Paces, feel: boolean): StructureStep {
  const kind = KIND[s.kind];
  const work = kind === 'work';
  const estimate =
    kind === 'test' ||
    (work && w.rpe !== undefined) ||
    (feel && (kind === 'stride' || kind === 'race'));
  return {
    kind,
    zone: s.zone,
    km: s.km,
    sec: s.sec,
    paceSec: estimate ? null : s.paceSecPerKm,
    ...(estimate ? { estimatePaceSec: s.paceSecPerKm } : {}),
    // Lagani delovi su u v2 opseg E (sredina je osnova km/trajanja).
    ...(s.zone === 'E' && s.paceSecPerKm === midEasy(p)
      ? { paceRange: { fast: p.E.fast, slow: p.E.slow } }
      : {}),
    kmBasis: s.kmBasis,
    secBasis: s.secBasis,
    ...(work && w.rpe ? { effort: { rpeMin: w.rpe.min, rpeMax: w.rpe.max, cue: w.rpe.cue } } : {})
  };
}

const mismatch = (w: Workout): Error =>
  new Error(`10K v2: segmenti treninga „${w.title}" ne odgovaraju blokovima.`);

/** Struktura dana iz treninga v2. `feel` = plan po osećaju (`plan.paceBasis`). */
export function workoutStructure(w: Workout, p: Paces, feel: boolean): WorkoutStructure {
  const blocks: StructureBlock[] = [];
  let i = 0;
  const take = (): StructureStep => {
    const s = w.segments[i++];
    if (!s) throw mismatch(w);
    return stepOf(s, w, p, feel);
  };
  for (const b of w.blocks) {
    if (b.kind === 'reps') {
      const work = take();
      const rest = b.reps > 1 ? take() : undefined;
      // Ostala ponavljanja su ista (isti blok v2); preskaču se posle provere broja.
      for (let k = 1; k < b.reps; k++) {
        take();
        if (k < b.reps - 1) take();
      }
      blocks.push({ reps: b.reps, step: work, ...(rest ? { recovery: rest } : {}) });
    } else if (b.kind === 'pyramid') {
      // Piramida: deonice različite dužine — svaka deonica i svaki oporavak je svoj blok, istim redom.
      b.repsM.forEach((_, k) => {
        if (k > 0) blocks.push({ reps: 1, step: take() });
        blocks.push({ reps: 1, step: take() });
      });
    } else blocks.push({ reps: 1, step: take() });
  }
  if (i !== w.segments.length) throw mismatch(w);
  return {
    title: w.title,
    blocks,
    km: w.km,
    sec: w.sec,
    kmBasis: w.kmBasis,
    secBasis: w.secBasis,
    ...(w.rpe ? { rpe: { min: w.rpe.min, max: w.rpe.max, txt: w.rpe.cue } } : {})
  };
}
