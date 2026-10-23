/* 5K v2 → sat (intervals.icu → Garmin): dan plana → tekst u sintaksi intervals.icu, IZ STRUKTURE dana (ne iz teksta).

   Iste konvencije kao izvoz ostalih generatora (posebna kopija vrednosti, ne uvoz):
   - `m` su minuti, metri se pišu `500mtr`; opseg tempa ide SPORIJI pa BRŽI, jedinica jednom na kraju;
   - ponavljanja: zaglavlje „Radni deo Nx" sa praznim redom pre i posle bloka, pa poslednja deonica bez oporavka;
   - oporavak nije lagan tempo: kaskanje 6:30–7:30/km (ili sporije od laganog), hod 9:00–13:00/km;
   - KORAK BEZ BROJČANOG CILJA SE NE ŠALJE: deo po osećaju (RPE bez tempa) ili trčanje/hodanje bez tempa obara strukturu
     na satu, pa se takav dan preskače i broji u `skipped` (pregled to prijavljuje); trka i test 3 km se ne šalju.
   Deo zadat distancom ide kao distanca, deo zadat vremenom kao vreme (osnova `kmBasis`/`secBasis` iz v2). */

import { addDays, type IsoDate } from './date.ts';
import type {
  ResolvedDay,
  ResolvedPlan,
  StructureBlock,
  StructureStep,
  WatchBatch,
  WatchEvent
} from './types.ts';

export const EASY_RANGE_SEC = 40;
export const JOG_FROM = 390;
export const JOG_TO = 450;
export const WALK_FROM = 540;
export const WALK_TO = 780;
export const WORKOUT_ID_PREFIX = 'sub19-';

const clock = (x: number): string =>
  `${Math.floor(x / 60)}:${String(Math.round(x % 60)).padStart(2, '0')}`;

/** Tempo u sintaksi intervals.icu (opseg: sporiji-brži). */
function icuPace(a: number, b?: number): string {
  return b != null && b !== a
    ? `${clock(Math.max(a, b))}-${clock(Math.min(a, b))}/km Pace`
    : `${clock(a)}/km Pace`;
}
function icuDuration(sec: number): string {
  return sec % 60 === 0 ? `${sec / 60}m` : `${Math.round(sec)}s`;
}
function icuDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}mtr` : `${Math.round(km * 100) / 100}km`;
}

const LABEL: Readonly<Record<StructureStep['kind'], string>> = {
  warmup: 'Zagrevanje',
  cooldown: 'Hlađenje',
  easy: 'Lagano',
  long: 'Dugo trčanje',
  work: 'Radni deo',
  recovery: 'Oporavak',
  stride: 'Ubrzanja',
  race: 'Trka',
  test: 'Test',
  run: 'Trčanje',
  walk: 'Hod'
};

/** Cilj koraka; `null` kad korak nema brojčani cilj (dan se tada ne šalje). */
function target(s: StructureStep): string | null {
  if (s.kind === 'walk') return icuPace(WALK_FROM, WALK_TO);
  if (s.kind === 'recovery') {
    const easy = s.paceSec ?? JOG_FROM;
    return icuPace(Math.max(JOG_FROM, easy), Math.max(JOG_TO, easy + EASY_RANGE_SEC));
  }
  if (s.paceRange) return icuPace(s.paceRange.slow, s.paceRange.fast);
  if (s.paceSec != null) return icuPace(s.paceSec);
  // Trčanje run/walk: procena iz uobičajenog laganog tempa → lagan raspon kao kod ostalih generatora.
  if (s.kind === 'run' && s.estimatePaceSec != null)
    return icuPace(s.estimatePaceSec, s.estimatePaceSec + EASY_RANGE_SEC);
  return null;
}

/** Mera koraka: propisana veličina (distanca ili vreme). */
function measure(s: StructureStep): string | null {
  if (s.secBasis === 'exact' && s.sec != null && s.sec > 0) return icuDuration(s.sec);
  if (s.km != null && s.km > 0) return icuDistance(s.km);
  if (s.sec != null && s.sec > 0) return icuDuration(s.sec);
  return null;
}

function line(s: StructureStep, label = ''): string | null {
  const m = measure(s);
  const t = target(s);
  if (!m || !t) return null;
  return `- ${label ? `${label} ` : ''}${m} ${t}`;
}

function block(b: StructureBlock): string | null {
  const work = line(b.step);
  if (!work) return null;
  const name = LABEL[b.step.kind];
  if (b.reps <= 1) return `${name}\n${work}`;
  const rest = b.recovery
    ? line(b.recovery, b.recovery.kind === 'walk' ? 'Pauza hod' : 'Oporavak kaskanje')
    : null;
  if (b.recovery && !rest) return null;
  const head = `${name} ${b.reps - 1}x\n${work}${rest ? `\n${rest}` : ''}`;
  return `${head}\n\n${b.step.kind === 'run' ? 'Poslednje trčanje' : 'Poslednja deonica'}\n${work}`;
}

type DayForWatch = Pick<ResolvedDay, 'rest' | 'tag' | 'structure'>;

/** Tekst jednog dana; `null` kad dan nema strukturu ili neki deo nema brojčani cilj. */
export function dayWorkoutText(d: DayForWatch | null | undefined): string | null {
  if (!d || d.rest || !d.structure) return null;
  const sections: string[] = [];
  for (const b of d.structure.blocks) {
    const t = block(b);
    if (!t) return null;
    sections.push(t);
  }
  return sections.length ? sections.join('\n\n') : null;
}

const NOT_SENT = new Set(['trka', 'test', 'snaga']);

/** Dani od danas do `daysAhead` unapred iz strukture v2. `vdot` se ne koristi: tempo je u strukturi dana. */
export function workoutsForWatch(
  plan: Pick<ResolvedPlan, 'weeks'>,
  today: string,
  daysAhead: number
): WatchBatch {
  const until = addDays(today as IsoDate, daysAhead || 14);
  const events: WatchEvent[] = [];
  let skipped = 0;
  for (const w of plan.weeks)
    for (const d of w.days) {
      if (!d.date || d.date < today || d.date > until || d.test) continue;
      if (d.rest || (d.tag && NOT_SENT.has(d.tag))) continue;
      const text = dayWorkoutText(d);
      if (!text) {
        skipped++;
        continue;
      }
      events.push({
        date: d.date,
        externalId: `${WORKOUT_ID_PREFIX}${d.id}`,
        name: d.structure?.title ?? 'Trening',
        description: text
      });
    }
  return { events, skipped };
}
