/* Opis automatskog propisa iz strukture dana — deo STAROG zajedničkog mehanizma (koristi ga samo `./finalize.ts`).
   Premešteno doslovno iz `./describe.ts` (segment 5/5), da prikazne oznake ne bi uvozile stare trenerske profile. */

import { addDays, type IsoDate } from '../date';
import { EASY_EFFORT_NOTE } from '../training/generator/formPolicy';
import { fmtClock } from '../format';
import type { Day, PlanMeta } from '../training/types';
import { sessDesc } from '../training/sessions/calc';
import { fuelText } from '../training/sessions/longRun';
import { paceForZone } from '../training/vdot/paceForZone';
import { profileFor } from '../training/distances';
import { runWalkForWeek, runWalkText } from '../training/generator/runWalk';

/** Future automatic prescriptions are described from structure, never parsed from old prose. */
export function describePrescription(d: Day, meta: PlanMeta, date?: IsoDate): string | null {
  if (d.session) return sessDesc(d.session);
  if (d.rest || d.tag === 'snaga' || d.tag === 'trka') return d.desc;
  if (d.tag === 'rw') return `${d.km} km — ${runWalkText(d.runWalk)}`;
  const vdot = meta.trainingVdot ?? meta.vdot0;
  const pace = paceForZone(vdot, d.tag === 'lr' ? 'LR' : 'E');
  const label = d.tag === 'lr' ? (d.mlr ? 'srednje-dugo' : 'LR') : 'lako';
  const h = profileFor(meta.raceDistM)?.heuristic;
  const fuel = d.tag === 'lr' && h ? fuelText(d.km, pace, h) : '';
  const finish = d.finish
    ? ` · poslednjih ${d.finish.km} km @ ${fmtClock(d.finish.paceSec)}/km (${d.finish.zone === 'M' ? 'maratonski' : 'tempo trke'})`
    : '';
  const strides = d.strides
    ? ` + ${d.strides.reps}×${d.strides.runSec} s ubrzanja (pun oporavak ${d.strides.restSec} s)`
    : '';
  const effort = meta.formPolicy?.basis === 'effort-first' ? ` · ${EASY_EFFORT_NOTE}` : '';
  const phase = meta.runWalk;
  const transitionStart =
    phase?.transitionStart ??
    (phase ? addDays(meta.start, (phase.transitionWeek - 1) * 7) : undefined);
  const rung = phase?.ladder.at(-1);
  const lastRw = rung ? runWalkForWeek(1, [rung]) : null;
  const trial =
    date &&
    transitionStart &&
    date >= transitionStart &&
    date < addDays(transitionStart, 7) &&
    lastRw &&
    !d.finish
      ? ` · Prelaz na neprekidno trčanje je probni: radi ga samo ako su poslednja run/walk trčanja bila razgovorna (napor do 5/10) i bez bola. Ako nisu, ponovi korak „${lastRw.label}" i prilagodi plan u kartici „Prema odrađenim treninzima"`
      : '';
  return `${d.km} km ${label} (Z2) @ ~${fmtClock(pace)}/km${fuel}${finish}${strides}${effort}${trial}`;
}
