/* F9 · SLOJ APLIKACIJA ↔ V4: RUČNA IZMENA DANA IZ POSTOJEĆEG LISTA „Izmeni trening" → `Workout` (korak 7, § 2d).
   List daje oznaku, km, opis i (opciono) tempo; ovde se to prevodi u trening V4 sa izričitim podacima korisnika
   (tempo samo kad ga je korisnik uneo — motor ga nikad ne proizvodi). Čista funkcija. */
import type { Step, Target, Workout, WorkoutKind } from '../../domain/v4/engine';

export interface AltInput {
  tag: string;
  km: number | null;
  desc: string;
  /** s/km, kad ga je korisnik uneo. */
  pace?: number | null;
}

const KIND: Readonly<Record<string, WorkoutKind>> = {
  lako: 'easy',
  lr: 'long',
  int: 'quality',
  tempo: 'quality',
  trka: 'race',
  test: 'test'
};

const TARGET: Readonly<Record<string, Target>> = {
  lako: { type: 'zone', zone: 'E' },
  lr: { type: 'zone', zone: 'E' },
  int: { type: 'zone', zone: 'I' },
  tempo: { type: 'zone', zone: 'T' },
  trka: { type: 'allOut' },
  test: { type: 'allOut' }
};

/** `odmor` → `null` (dan odmora); ostalo → trening jednog ravnomernog dela dužine `km` (bez km: samo opis). */
export function workoutFromAlt(a: AltInput): Workout | null {
  if (a.tag === 'odmor') return null;
  const kind = KIND[a.tag] ?? 'other';
  const target: Target =
    a.pace != null && Number.isFinite(a.pace) && a.pace > 0
      ? { type: 'pace', secPerKm: a.pace }
      : (TARGET[a.tag] ?? { type: 'zone', zone: 'E' });
  const steps: Step[] =
    a.km != null && Number.isFinite(a.km) && a.km > 0
      ? [{ role: 'steady', target, extent: { distanceM: Math.round(a.km * 1000) } }]
      : [];
  return { kind, stimulus: null, workSec: 0, steps, text: a.desc };
}
