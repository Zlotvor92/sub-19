/* Raspored uloga nedelja: jedini vlasnik odluke „koja nedelja je šta". Važi za 4–30 nedelja.
   Kraj je fiksan unazad od trke (vrh 3 nedelje pred trku, plan ≤ 9 nedelja: 2), rasterećenja na svaku 4. nedelju
   unazad od vrha, provera forme u rasteretnoj nedelji ≈ 8 nedelja pred trku; ostatak deli osnova/razvoj po udelu. */
import type { Phase } from './types.ts';

export type Role =
  | 'build'
  | 'rest'
  | 'check'
  | 'test'
  | 'block1'
  | 'wave'
  | 'block2'
  | 'peak'
  | 'post'
  | 'taper'
  | 'race';

export interface Slot {
  index: number;
  role: Role;
  phase: Phase;
  label: string;
}

export const DEV_SHARE = 0.35; // udeo razvoja u nedeljama gradnje pre specifične faze
const INTRO_WEEKS = 2; // početnik, plan ≥ 12 nedelja

export function layout(N: number, beginner: boolean, needTest: boolean): Slot[] {
  const role: Role[] = Array.from({ length: N + 1 }, () => 'build');
  role[N] = 'race';
  role[N - 1] = 'taper';
  if (N >= 10) {
    role[N - 2] = 'post';
    role[N - 3] = 'peak';
    role[N - 4] = 'rest';
    if (beginner) role[N - 5] = 'block1';
    else {
      role[N - 5] = 'block2';
      role[N - 6] = 'wave';
      role[N - 7] = 'block1';
    }
    const rests: number[] = [];
    for (let w = N - 8; w >= 4; w -= 4) rests.push(w);
    const first = rests.length ? rests[rests.length - 1]! : N - 4;
    if (first >= 7) rests.push(4); // prvi blok bez rasterećenja najviše 5 nedelja
    for (const w of rests) if (role[w] === 'build') role[w] = 'rest';
    const check = N - 8 >= 4 ? N - 8 : N - 4;
    role[check] = 'check';
    if (needTest) {
      const t = role.findIndex((r, i) => i >= 4 && i < check && r === 'rest');
      if (t > 0) role[t] = 'test';
    }
  } else if (N >= 8) {
    role[N - 2] = 'peak';
    role[N - 3] = 'check';
    role[N - 4] = 'block1';
  } else {
    role[N - 2] = 'peak';
    if (N - 3 >= 2) role[N - 3] = 'block1';
  }

  // faze: gradnja pre prve specifične uloge = osnova + razvoj (udeo), početnik ima uvod
  const firstSpec = role.findIndex(
    (r, i) => i >= 1 && r !== 'build' && r !== 'rest' && r !== 'check' && r !== 'test'
  );
  const build = role
    .map((r, i) => (i >= 1 && i < firstSpec && r === 'build' ? i : 0))
    .filter((i) => i > 0);
  const dev = build.length >= 3 ? Math.round(build.length * DEV_SHARE) : build.length >= 2 ? 1 : 0;
  const devFrom = build[build.length - dev] ?? Infinity;
  const intro = beginner && N >= 12 ? (build[INTRO_WEEKS - 1] ?? 0) : 0;
  const baseWeeks = build.filter((i) => i < devFrom && i > intro);
  const split = baseWeeks.length >= 6 ? baseWeeks[Math.ceil(baseWeeks.length / 2)]! : Infinity;

  const slots: Slot[] = [];
  let prev: Phase = beginner && intro ? 'uvod' : 'osnova';
  let prevLabel: string = prev;
  for (let i = 1; i <= N; i++) {
    const r = role[i]!;
    let phase: Phase;
    let label: string;
    if (r === 'race') [phase, label] = ['trka', 'trka'];
    else if (r === 'taper') [phase, label] = ['taper', 'taper'];
    else if (r === 'rest' || r === 'check' || r === 'test') [phase, label] = [prev, prevLabel];
    else if (r === 'build') {
      if (i <= intro) phase = 'uvod';
      else if (i >= devFrom) phase = 'razvoj';
      else phase = 'osnova';
      label =
        phase === 'osnova' && split !== Infinity ? (i < split ? 'osnova 1' : 'osnova 2') : phase;
    } else if (r === 'block1' && N >= 10 && !beginner)
      [phase, label] = ['razvoj', 'razvoj, prvi blok u dugom'];
    else if (r === 'peak') [phase, label] = ['specifična', 'specifična, najteža nedelja'];
    else [phase, label] = ['specifična', 'specifična'];
    if (r === 'rest') label += ' — RASTEREĆENJE';
    if (r === 'check') label += ' — RASTEREĆENJE + PRIPREMNA TRKA';
    if (r === 'test') label += ' — RASTEREĆENJE + TEST';
    if (r !== 'rest' && r !== 'check' && r !== 'test')
      [prev, prevLabel] = [phase, label.split(',')[0]!];
    slots.push({ index: i, role: r, phase, label });
  }
  return slots;
}
