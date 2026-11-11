/* HM v3 — treninzi u obliku plana v2 (Workout/Segment): km se izvode iz minuta rada i tempa zone. */

import { midEasy, round1 } from './fromV2/paces.ts';
import { HM_V2_POLICY as P } from './fromV2/policy.ts';
import type { Paces, QualityType, Segment, SegmentKind, Workout, WorkZone } from './fromV2/types.ts';
import { f1 } from './scale.ts';
import type { Form, QZone } from './templates.ts';

export interface Ctx {
  p: Paces;
  wuSec: number;
  cdSec: number;
  feel: boolean;
}

export const mmss = (s: number): string =>
  `${Math.floor(Math.round(s) / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;
const mins = (s: number): string => `${Math.round(s / 60)} min`;

function seg(kind: SegmentKind, zone: Segment['zone'], km: number, pace: number): Segment {
  const k = round1(km);
  const sec = Math.round(k * pace);
  return {
    kind,
    zone,
    km: k,
    sec,
    paceSecPerKm: pace,
    kmBasis: 'estimated',
    secBasis: 'estimated'
  };
}

function make(
  kind: Workout['kind'],
  qt: QualityType | null,
  title: string,
  segs: Segment[]
): Workout {
  const workKm: Record<WorkZone, number> = { T: 0, I: 0, R: 0, RP: 0 };
  const maxBoutSec: Record<WorkZone, number> = { T: 0, I: 0, R: 0, RP: 0 };
  for (const s of segs)
    if ((s.kind === 'rep' || s.kind === 'continuous') && s.zone in workKm) {
      const z = s.zone as WorkZone;
      workKm[z] = round1(workKm[z] + s.km);
      maxBoutSec[z] = Math.max(maxBoutSec[z], s.sec);
    }
  return {
    kind,
    qualityType: qt,
    title,
    blocks: [],
    segments: segs,
    km: round1(segs.reduce((a, s) => a + s.km, 0)),
    sec: segs.reduce((a, s) => a + s.sec, 0),
    kmBasis: 'estimated',
    secBasis: 'estimated',
    workKm,
    maxBoutSec,
    dose: null
  };
}

/** Rad treninga [s] (deonice i kontinuirani blokovi zona rada). */
export const workSec = (w: Workout): number =>
  w.segments
    .filter((s) => (s.kind === 'rep' || s.kind === 'continuous') && s.zone !== 'E')
    .reduce((a, s) => a + s.sec, 0);

export function easy(km: number, c: Ctx, strides = 0): Workout {
  const t = `Lagano ${f1(km)} km${strides ? `, na kraju ${strides} × 20 s ubrzanja` : ''}`;
  return make('easy', null, t, [seg('easy', 'E', km, midEasy(c.p))]);
}

export function easyTime(sec: number, c: Ctx, strides = 0): Workout {
  const t = `Lagano ${mins(sec)}${strides ? ` + ${strides} × 20 s ubrzanja` : ''}`;
  return make('easy', null, t, [seg('easy', 'E', sec / midEasy(c.p), midEasy(c.p))]);
}

export function long(
  km: number,
  role: 'easy' | 'prog' | 'block' | 'down',
  blockKm: number,
  c: Ctx
): Workout {
  const e = midEasy(c.p);
  if (role === 'block' && blockKm > 0) {
    const t = `Dugi ${f1(km)} km: ${f1(km - blockKm)} lagano + ${f1(blockKm)} km tempom trke (${mmss(c.p.RP)}/km)`;
    return make('long', null, t, [
      seg('long', 'E', km - blockKm, e),
      seg('continuous', 'RP', blockKm, c.p.RP)
    ]);
  }
  if (role === 'prog') {
    const t = `Dugi ${f1(km)} km, poslednja 3 km progresivno do tempa trke`;
    return make('long', null, t, [
      seg('long', 'E', km - 3, e),
      seg('long', 'E', 3, (e + c.p.RP) / 2)
    ]);
  }
  return make('long', null, `Dugi ${f1(km)} km lagano`, [seg('long', 'E', km, e)]);
}

const LABEL: Record<QZone, string> = { T: 'T', I: 'I', R: 'R', RP: 'RP' };
const QT: Record<QZone, QualityType> = { T: 'T_cruise', I: 'I', R: 'R', RP: 'RP' };

function frame(work: Segment[], c: Ctx): Segment[] {
  const e = midEasy(c.p);
  return [seg('warmup', 'E', c.wuSec / e, e), ...work, seg('cooldown', 'E', c.cdSec / e, e)];
}

function rpeOf(z: QZone, c: Ctx): string {
  if (!c.feel) return '';
  const r = P.feel.rpe[z];
  return ` · RPE ${r.min === r.max ? r.min : `${r.min}–${r.max}`} (${r.cue})`;
}

/** Kvalitet zone `z` sa `sec` rada (već u plafonu) i oblikom `f`. Zaokruženje naniže: rad ≤ zadatog. */
export function quality(z: QZone, sec: number, f: Form, c: Ctx): Workout {
  const pace = c.p[z];
  const e = midEasy(c.p);
  const km = sec / pace;
  const work: Segment[] = [];
  let inner: string;
  if (f === 'c') {
    const k = Math.max(1, Math.floor(km * 2) / 2);
    work.push(seg('continuous', z, k, pace));
    inner = `${LABEL[z]} ${f1(k)} km u komadu`;
  } else {
    const minN = z === 'R' ? 4 : 2;
    const step = z === 'RP' && km >= 4 ? 500 : 100;
    const fit = 'n' in f ? f.n : Math.floor((km * 1000) / f.m);
    const n = Math.max(minN, fit);
    const repM =
      'm' in f && fit >= minN ? f.m : Math.max(200, Math.floor((km * 1000) / n / step) * step);
    const recM = z === 'R' ? repM : 0;
    const recSec =
      z === 'T' ? (repM <= 1600 ? 60 : 90) : z === 'RP' ? (repM <= 3000 ? 90 : 120) : 120;
    for (let i = 0; i < n; i++) {
      work.push(seg('rep', z, repM / 1000, pace));
      if (i < n - 1) work.push(seg('recovery', 'jog', recM ? recM / 1000 : recSec / e, e));
    }
    inner = `${LABEL[z]} ${n} × ${repM} m (oporavak ${recM ? `${recM} m` : mmss(recSec)} džog)`;
  }
  const t = `WU ${mins(c.wuSec)} + ${inner} + CD ${mins(c.cdSec)}${rpeOf(z, c)}`;
  return make('quality', QT[z], t, frame(work, c));
}

/** Usponi: `reps` × `sec` uzbrdo, nazad lagano (rad u zoni R po vremenu). */
export function hills(reps: number, sec: number, c: Ctx): Workout {
  const e = midEasy(c.p);
  const work: Segment[] = [];
  for (let i = 0; i < reps; i++) {
    work.push({ ...seg('rep', 'R', sec / c.p.I, c.p.I), sec });
    if (i < reps - 1) work.push(seg('recovery', 'jog', (sec * 1.5) / e, e));
  }
  const t = `WU ${mins(c.wuSec)} + usponi ${reps} × ${sec} s uzbrdo (nazad lagano) + CD ${mins(c.cdSec)}`;
  return make('quality', 'R', t, frame(work, c));
}

/** Provera forme: pripremna trka / test na distanci `km` tempom `pace`. */
export function test(km: number, pace: number, title: string, c: Ctx): Workout {
  const e = midEasy(c.p);
  return make('test', null, `WU 15 min + ${title} + CD 10 min`, [
    seg('warmup', 'E', 900 / e, e),
    seg('test', 'test', km, pace),
    seg('cooldown', 'E', 600 / e, e)
  ]);
}

export function race(c: Ctx): Workout {
  const e = midEasy(c.p);
  const rw = P.raceWeek;
  return make('race', null, 'Trka — polumaraton', [
    seg('warmup', 'E', rw.raceWarmupSec / e, e),
    seg('race', 'RP', rw.raceKm, c.p.RP),
    seg('cooldown', 'E', rw.raceCooldownSec / e, e)
  ]);
}

/** H8/G5: oštrenje trkačke nedelje — 2 jednake deonice RP, ukupno ≤ 12 min rada. */
export function sharpener(c: Ctx): Workout {
  const s = P.raceWeek.sharpener;
  const repM = Math.min(
    s.repM,
    Math.floor(((s.maxWorkSec / c.p.RP) * 1000) / s.reps / s.roundM) * s.roundM
  );
  return quality('RP', (s.reps * repM * c.p.RP) / 1000 + 1, { n: s.reps }, c);
}
