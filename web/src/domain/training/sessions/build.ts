/* Konstruktori dana sa sesijom. Svaki vraća `SessionDay` čiji su `km` i `desc`
   IZVEDENI iz sesije (`sessKm`/`sessDesc`). */

import { r1 } from '../../format';
import type {
  FartlekSession,
  IntervalSession,
  ProgressionSession,
  PyramidSession,
  SessionDay,
  TempoSession
} from '../types';
import { sessDesc, sessKm } from './calc';

export function sessInt(
  dow: number,
  wuKm: number,
  reps: number,
  repM: number,
  paceSec: number,
  restSec: number,
  cdKm: number,
  kind: string
): SessionDay {
  const session: IntervalSession = {
    type: 'int',
    kind,
    wuKm,
    reps,
    repM,
    paceSec,
    restSec,
    cdKm,
    overrides: {}
  };
  return {
    dow,
    tag: kind === 'Tempo isprekidan' ? 'tempo' : 'int',
    km: sessKm(session),
    desc: sessDesc(session),
    session
  };
}

export function sessTempo(
  dow: number,
  wuKm: number,
  qKm: number,
  paceSec: number,
  cdKm: number,
  kind: string
): SessionDay {
  const session: TempoSession = { type: 'tempo', kind, wuKm, qKm, paceSec, cdKm, overrides: {} };
  return { dow, tag: 'tempo', km: sessKm(session), desc: sessDesc(session), session };
}

export function sessPyramid(
  dow: number,
  wuKm: number,
  reps: number[],
  paceSec: number,
  restSec: number,
  cdKm: number,
  kind: string
): SessionDay {
  const session: PyramidSession = {
    type: 'pyramid',
    kind,
    wuKm,
    reps,
    paceSec,
    restSec,
    cdKm,
    overrides: {}
  };
  return { dow, tag: 'int', km: sessKm(session), desc: sessDesc(session), session };
}

/** Fartlek po McMillan smernici: vremenski surge-ovi, pa nema pouzdane lap-detekcije po distanci. */
export function sessFartlek(
  dow: number,
  wuKm: number,
  n: number,
  surgeSec: number,
  easySec: number,
  paceSec: number,
  cdKm: number,
  easyPaceSec: number
): SessionDay {
  const session: FartlekSession = {
    type: 'fartlek',
    kind: 'Fartlek',
    wuKm,
    cdKm,
    reps: n,
    repSec: surgeSec,
    restSec: easySec,
    paceSec,
    easyPaceSec,
    overrides: {}
  };
  return { dow, tag: 'int', km: sessKm(session), desc: sessDesc(session), session };
}

/** Progresivno: prve 2/3 lako, poslednja trećina na `endPaceSec`. `kind` razdvaja
 *  završetak na pragu od završetka na tempu trke (iz imena se izvodi zona). */
export function sessProg(
  dow: number,
  totalKm: number,
  endPaceSec: number,
  easyPaceSec: number,
  kind: string = 'Progresivno'
): SessionDay {
  const session: ProgressionSession = {
    type: 'prog',
    kind,
    qKm: totalKm,
    paceSec: endPaceSec,
    easyPaceSec,
    wuKm: 0,
    cdKm: 0,
    overrides: {}
  };
  return { dow, tag: 'tempo', km: sessKm(session), desc: sessDesc(session), session };
}

/**
 * Zagrevanje/smirivanje skalirano OBIMOM (nije odluka po distanci): 2 km
 * zagrevanja je isto pogrešno za 11 km/ned bez obzira na to koja je trka.
 */
export function wuCdForVolume(vol: number): [wu: number, cd: number] {
  return [Math.max(1, Math.min(2, r1(vol * 0.055))), Math.max(0.8, Math.min(1.5, r1(vol * 0.04)))];
}

/** Deload „oštrina": kratka serija 200 m umesto potpunog brisanja kvaliteta. */
export function mkDeloadSharpness(dow: number, vol: number, pR: number): SessionDay {
  const [wu, cd] = wuCdForVolume(vol);
  const n = Math.max(4, Math.min(8, Math.round(vol * 0.12)));
  return sessInt(
    dow,
    r1(Math.max(wu * 0.7, 1)),
    n,
    200,
    pR,
    120,
    r1(Math.max(cd * 0.7, 0.8)),
    'Oštrina'
  );
}
