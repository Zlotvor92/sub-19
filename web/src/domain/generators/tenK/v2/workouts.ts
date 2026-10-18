/* D10 — lestvice i „ista doza druge strukture" (D31: T kontinuirano početnika od 1,5 km); D14 — WU/CD (po
   pojasu obima) i oporavci; struktura treninga (blokovi, segmenti, km/trajanje); D26 RPE kvaliteta; D27
   test 5 km. Jedino mesto sastava treninga. Km WU/CD/oporavka po srednjem E. */

import { midEasy, raceTimeForVdot } from './paces.ts';
import { TEN_K_V2_POLICY as P } from './policy.ts';
import type {
  BlockSpec,
  Dose,
  LadderId,
  Paces,
  QualityType,
  Rpe,
  Segment,
  Structure,
  Workout,
  WorkZone
} from './types.ts';

/* ---------- Lestvice i strukture (D10) ---------- */

export const zoneOf = (ladder: LadderId | 'RP_sharpener'): WorkZone =>
  ladder === 'R'
    ? 'R'
    : ladder === 'I'
      ? 'I'
      : ladder === 'RP' || ladder === 'RP_sharpener'
        ? 'RP'
        : 'T';

export function doseOf(s: Structure): number {
  if (s.form === 'continuous') return Math.round(s.km * 1000);
  return s.form === 'reps' ? s.reps * s.repM : s.repsM.reduce((a, m) => a + m, 0);
}

export function sameStructure(a: Structure, b: Structure): boolean {
  if (a.form === 'continuous') return b.form === 'continuous' && doseOf(a) === doseOf(b);
  if (a.form === 'reps') return b.form === 'reps' && a.reps === b.reps && a.repM === b.repM;
  return b.form === 'pyramid' && a.repsM.join() === b.repsM.join();
}

/** Metraže deonica strukture redom (prazno za kontinuirano). */
export function repsOf(s: Structure): number[] {
  if (s.form === 'continuous') return [];
  return s.form === 'reps' ? Array<number>(s.reps).fill(s.repM) : [...s.repsM];
}

/** Nivoi lestvice kao strukture, rastućom dozom. `beginner` (D31): T kontinuirano počinje od 1,5 km. */
export function ladderLevels(ladder: LadderId, beginner = false): Structure[] {
  const l = P.ladders;
  if (ladder === 'T_continuous')
    return [...(beginner ? [P.beginner.tFirstKm] : []), ...l.T_continuous].map((km) => ({
      form: 'continuous',
      km
    }));
  const reps =
    ladder === 'R' ? l.R : ladder === 'T_cruise' ? l.T_cruise : ladder === 'I' ? l.I : l.RP;
  return reps.map((r) => ({ form: 'reps', reps: r.reps, repM: r.repM }));
}

/** Tačne podele doze na repsMin..repsMax jednakih deonica (deljivih sa `roundM`), rastućim brojem deonica. */
function equalSplits(
  doseM: number,
  minRepM: number,
  maxRepM: number,
  repsMax: number = P.alternatives.repsMax,
  roundM: number = P.alternatives.roundM
): Structure[] {
  const a = P.alternatives;
  const out: Structure[] = [];
  for (let k = a.repsMin; k <= repsMax; k++) {
    if (doseM % k !== 0) continue;
    const repM = doseM / k;
    if (repM % roundM === 0 && repM >= minRepM && repM <= maxRepM)
      out.push({ form: 'reps', reps: k, repM });
  }
  return out;
}

/** D22 (T) / D30 (RP): 2–5 jednakih deonica ≥ `minRepM` (T 1000 m, RP 800 m) deljivih sa 100 m, a kad
    takvih nema sa 50 m. */
function splitsOf(doseM: number, minRepM: number): Structure[] {
  const a = P.alternatives;
  const splits = equalSplits(doseM, minRepM, doseM);
  return splits.length > 0
    ? splits
    : equalSplits(doseM, minRepM, doseM, a.repsMax, a.roundFallbackM);
}

/**
 * Sve strukture iste doze za lestvicu (D10): nivo lestvice sa tom dozom (ako postoji) pa strukture po
 * pravilu. T: kontinuirano ↔ 2–5 jednakih deonica ≥ 1000 m deljivih sa 100 m, a kad takvih nema sa 50 m
 * (D22); RP: isto pravilo sa deonicama ≥ 800 m, bez kontinuiranog (D30); I: do 6 jednakih deonica 800–1200 m ili
 * piramida 1200 + 1000 + 800 m; R: deonice 200 / 300 / 400 m (D22). Prihvataju se samo tačne podele (doza
 * se ne menja).
 */
export function structuresForDose(ladder: LadderId, doseM: number): Structure[] {
  const out: Structure[] = [];
  const push = (s: Structure): void => {
    if (doseOf(s) === doseM && !out.some((x) => sameStructure(x, s))) out.push(s);
  };
  for (const s of ladderLevels(ladder)) if (doseOf(s) === doseM) push(s);
  const a = P.alternatives;
  if (ladder === 'T_continuous' || ladder === 'T_cruise') {
    push({ form: 'continuous', km: doseM / 1000 });
    for (const s of splitsOf(doseM, a.repMinM)) push(s);
  } else if (ladder === 'I') {
    for (const s of equalSplits(doseM, a.iRepMinM, a.iRepMaxM, a.iRepsMax)) push(s);
    push({ form: 'pyramid', repsM: a.iPyramidM });
  } else if (ladder === 'RP') for (const s of splitsOf(doseM, a.rpRepMinM)) push(s);
  else
    for (const repM of a.rRepM)
      if (doseM % repM === 0) push({ form: 'reps', reps: doseM / repM, repM });
  return out;
}

/* ---------- Segmenti (D14) ---------- */

const km100 = (km: number): number => Math.round(km * 100);
const fromSec = (sec: number, pace: number): number => Math.round((sec * 100) / pace) / 100;

function seg(
  kind: Segment['kind'],
  zone: Segment['zone'],
  km: number,
  sec: number,
  pace: number,
  kmBasis: Segment['kmBasis'],
  secBasis: Segment['secBasis']
): Segment {
  return { kind, zone, km, sec, paceSecPerKm: pace, kmBasis, secBasis };
}

const timeEasy = (kind: 'warmup' | 'cooldown' | 'easy', sec: number, p: Paces): Segment =>
  seg(kind, 'E', fromSec(sec, midEasy(p)), sec, midEasy(p), 'estimated', 'exact');

const distEasy = (kind: 'easy' | 'long', km: number, p: Paces): Segment =>
  seg(kind, 'E', km, Math.round(km * midEasy(p)), midEasy(p), 'exact', 'estimated');

const paceOf = (zone: WorkZone, p: Paces): number => p[zone];

/** D14: WU/CD [s] po pojasu trenutnog obima iz ulaza (0,1 km); isti za ceo plan. */
export interface WarmupCooldown {
  warmupSec: number;
  cooldownSec: number;
}

/** D14; D28: početnik uvek prvi pojas (`firstBand`). */
export function warmupCooldown(currentWeeklyKm: number, firstBand = false): WarmupCooldown {
  const km10 = Math.round(currentWeeklyKm * 10);
  const bands = P.workout.warmupCooldown;
  const band = firstBand
    ? bands[0]!
    : bands.filter((b) => Math.round(b.fromKm * 10) <= km10).pop()!;
  return { warmupSec: band.warmupSec, cooldownSec: band.cooldownSec };
}

/** D26: RPE kvaliteta po zoni rada (plan po osećaju). */
export function rpeOf(zone: WorkZone): Rpe {
  const r = P.feel.rpe[zone];
  return { min: r.min, max: r.max, cue: r.cue };
}

/** D14: oporavak posle deonice (sekunde ili metri džoga). I: 1:1 vreme, naniže na 15 s, max 4:00. */
export function recoveryOf(
  ladder: LadderId | 'RP_sharpener',
  repM: number,
  p: Paces
): { m: number } | { sec: number } {
  const w = P.workout;
  if (ladder === 'R') return { m: repM };
  if (ladder === 'I') {
    const step = w.iRecoveryStepSec;
    const sec = Math.floor((repM * p.I) / 1000 / step + 1e-9) * step;
    return { sec: Math.min(sec, w.iRecoveryMaxSec) };
  }
  if (ladder === 'RP_sharpener') return { sec: P.raceWeek.sharpener.recoverySec };
  if (ladder === 'RP') {
    const r = w.rpRecovery.find((x) => repM <= x.maxRepM) ?? w.rpRecovery[w.rpRecovery.length - 1]!;
    return { sec: r.sec };
  }
  return { sec: w.tCruiseRecoverySec };
}

function recoverySegment(rec: { m: number } | { sec: number }, p: Paces): Segment {
  const pace = midEasy(p);
  return 'm' in rec
    ? seg(
        'recovery',
        'jog',
        rec.m / 1000,
        Math.round((rec.m / 1000) * pace),
        pace,
        'exact',
        'estimated'
      )
    : seg('recovery', 'jog', fromSec(rec.sec, pace), rec.sec, pace, 'estimated', 'exact');
}

/** Km rada + oporavka strukture [0,01 km] (bez WU/CD) — osnov izbora među strukturama iste doze. */
export function structureKm100(ladder: LadderId, s: Structure, p: Paces): number {
  if (s.form === 'continuous') return Math.round(s.km * 100);
  const reps = repsOf(s);
  return reps.reduce(
    (a, m, i) =>
      a +
      m / 10 +
      (i < reps.length - 1 ? Math.round(recoverySegment(recoveryOf(ladder, m, p), p).km * 100) : 0),
    0
  );
}

const ZERO = (): Record<WorkZone, number> => ({ T: 0, I: 0, R: 0, RP: 0 });

function assemble(
  kind: Workout['kind'],
  qualityType: QualityType | null,
  title: string,
  blocks: BlockSpec[],
  segments: Segment[],
  dose: Dose | null
): Workout {
  const workKm = ZERO();
  const maxBoutSec = ZERO();
  for (const s of segments)
    if (
      (s.kind === 'rep' || s.kind === 'continuous') &&
      s.zone !== 'E' &&
      s.zone !== 'jog' &&
      s.zone !== 'test'
    ) {
      workKm[s.zone] = km100(workKm[s.zone] + s.km) / 100;
      maxBoutSec[s.zone] = Math.max(maxBoutSec[s.zone], s.sec);
    }
  const total100 = segments.reduce((a, s) => a + km100(s.km), 0);
  return {
    kind,
    qualityType,
    title,
    blocks,
    segments,
    km: total100 / 100,
    sec: segments.reduce((a, s) => a + s.sec, 0),
    kmBasis: segments.every((s) => s.kmBasis === 'exact') ? 'exact' : 'estimated',
    secBasis: segments.every((s) => s.secBasis === 'exact') ? 'exact' : 'estimated',
    workKm,
    maxBoutSec,
    dose
  };
}

/* ---------- Naslovi ---------- */

export const fmtKm = (km: number): string => km.toFixed(1).replace('.', ',');
export const fmtSec = (sec: number): string =>
  `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
const fmtRec = (rec: { m: number } | { sec: number }): string =>
  'm' in rec ? `${rec.m} m džog` : `${fmtSec(rec.sec)} džog`;

/* ---------- Treninzi ---------- */

const repSeg = (zone: WorkZone, repM: number, pace: number): Segment =>
  seg('rep', zone, repM / 1000, Math.round((repM / 1000) * pace), pace, 'exact', 'estimated');

/** Trening kvaliteta: WU + rad + CD po pojasu obima (D14); `feel` → RPE zone (D26). */
export function qualityWorkout(dose: Dose, p: Paces, wc: WarmupCooldown, feel = false): Workout {
  const zone = dose.zone;
  const pace = paceOf(zone, p);
  const s = dose.structure;
  const blocks: BlockSpec[] = [{ kind: 'warmup', sec: wc.warmupSec }];
  const segments: Segment[] = [timeEasy('warmup', wc.warmupSec, p)];
  let main: string;
  if (s.form === 'continuous') {
    blocks.push({ kind: 'continuous', zone, km: s.km });
    segments.push(
      seg('continuous', zone, s.km, Math.round(s.km * pace), pace, 'exact', 'estimated')
    );
    main = `${zone} ${fmtKm(s.km)} km kontinuirano`;
  } else if (s.form === 'reps') {
    const rec = recoveryOf(dose.ladder, s.repM, p);
    blocks.push({ kind: 'reps', zone, reps: s.reps, rep: { m: s.repM }, recovery: rec });
    for (let i = 0; i < s.reps; i++) {
      if (i > 0) segments.push(recoverySegment(rec, p));
      segments.push(repSeg(zone, s.repM, pace));
    }
    main = `${zone} ${s.reps} × ${s.repM} m (oporavak ${fmtRec(rec)})`;
  } else {
    const recs = s.repsM.slice(0, -1).map((m) => recoveryOf(dose.ladder, m, p));
    blocks.push({ kind: 'pyramid', zone, repsM: s.repsM, recoveries: recs });
    s.repsM.forEach((m, i) => {
      if (i > 0) segments.push(recoverySegment(recs[i - 1]!, p));
      segments.push(repSeg(zone, m, pace));
    });
    main = `${zone} ${s.repsM.join(' + ')} m (oporavak ${recs.map(fmtRec).join(' / ')})`;
  }
  blocks.push({ kind: 'cooldown', sec: wc.cooldownSec });
  segments.push(timeEasy('cooldown', wc.cooldownSec, p));
  const qualityType: QualityType =
    dose.ladder === 'RP_sharpener'
      ? 'RP_sharpener'
      : zone === 'T'
        ? s.form === 'continuous'
          ? 'T_continuous'
          : 'T_cruise'
        : zone;
  const title = `WU ${wc.warmupSec / 60} min + ${main} + CD ${wc.cooldownSec / 60} min`;
  const w = assemble('quality', qualityType, title, blocks, segments, dose);
  return feel ? { ...w, rpe: rpeOf(zone) } : w;
}

/** D27: test 5 km — WU (D14) + 5 km kontrolisano maksimalno + CD. Trajanje testa = procena vremena 5 km
    iz VDOT-a plana (orijentir); računa se u obim, nije doza kvaliteta (workKm 0). */
export function testWorkout(p: Paces, wc: WarmupCooldown): Workout {
  const km = P.test.km;
  const sec = raceTimeForVdot(p.vdot, km * 1000);
  return assemble(
    'test',
    null,
    `WU ${wc.warmupSec / 60} min + test ${km} km kontrolisano maksimalno + CD ${wc.cooldownSec / 60} min`,
    [
      { kind: 'warmup', sec: wc.warmupSec },
      { kind: 'test', km },
      { kind: 'cooldown', sec: wc.cooldownSec }
    ],
    [
      timeEasy('warmup', wc.warmupSec, p),
      seg('test', 'test', km, sec, Math.round(sec / km), 'exact', 'estimated'),
      timeEasy('cooldown', wc.cooldownSec, p)
    ],
    null
  );
}

export function easyWorkout(km: number, p: Paces): Workout {
  return assemble(
    'easy',
    null,
    `Lagano ${fmtKm(km)} km`,
    [{ kind: 'easy', km }],
    [distEasy('easy', km, p)],
    null
  );
}

export function longWorkout(km: number, p: Paces): Workout {
  return assemble(
    'long',
    null,
    `Dugi ${fmtKm(km)} km lagano`,
    [{ kind: 'long', km }],
    [distEasy('long', km, p)],
    null
  );
}

/** D8: lagan trening zadat vremenom (35 min E). */
export function easyTimeWorkout(sec: number, p: Paces): Workout {
  return assemble(
    'easy',
    null,
    `Lagano ${Math.round(sec / 60)} min`,
    [{ kind: 'easy_time', sec }],
    [timeEasy('easy', sec, p)],
    null
  );
}

/** D8: dan pred trku — 20 min E + 4 × 20 s ubrzanja (R tempo; oporavak isti metraž džogom, D14 R). A4:
    u periodu bola bez ubrzanja (`strides` false). */
export function eveWorkout(p: Paces, strides = true): Workout {
  const q = P.raceWeek;
  if (!strides)
    return assemble(
      'easy',
      null,
      `Lagano ${Math.round(q.eveEasySec / 60)} min`,
      [{ kind: 'easy_time', sec: q.eveEasySec }],
      [timeEasy('easy', q.eveEasySec, p)],
      null
    );
  const st = q.eveStrides;
  const strideKm = fromSec(st.sec, p.R);
  const rec = { m: Math.round(strideKm * 1000) };
  const segments: Segment[] = [timeEasy('easy', q.eveEasySec, p)];
  for (let i = 0; i < st.reps; i++) {
    if (i > 0) segments.push(recoverySegment(rec, p));
    segments.push(seg('stride', 'R', strideKm, st.sec, p.R, 'estimated', 'exact'));
  }
  return assemble(
    'easy',
    null,
    `Lagano ${Math.round(q.eveEasySec / 60)} min + ${st.reps} × ${st.sec} s ubrzanja`,
    [
      { kind: 'easy_time', sec: q.eveEasySec },
      { kind: 'reps', zone: 'R', reps: st.reps, rep: { sec: st.sec }, recovery: rec, stride: true }
    ],
    segments,
    null
  );
}

/** D8: oštrenje trkačke nedelje — WU + reps × 1000 m RP (90 s) + CD (WU/CD po D14). */
export function sharpenerWorkout(
  reps: number,
  p: Paces,
  wc: WarmupCooldown,
  feel = false
): Workout {
  const s = P.raceWeek.sharpener;
  return qualityWorkout(
    {
      ladder: 'RP_sharpener',
      zone: 'RP',
      doseM: reps * s.repM,
      structure: { form: 'reps', reps, repM: s.repM },
      step: 'sharpener'
    },
    p,
    wc,
    feel
  );
}

/** D8: trka 10 km + WU 15 min + CD 10 min (van obima nedelje). */
export function raceWorkout(p: Paces, raceSec: number): Workout {
  const q = P.raceWeek;
  return assemble(
    'race',
    null,
    `Trka ${q.raceKm} km (WU 15 min + CD 10 min)`,
    [
      { kind: 'warmup', sec: q.raceWarmupSec },
      { kind: 'race', km: q.raceKm },
      { kind: 'cooldown', sec: q.raceCooldownSec }
    ],
    [
      timeEasy('warmup', q.raceWarmupSec, p),
      seg('race', 'RP', q.raceKm, raceSec, Math.round(raceSec / q.raceKm), 'exact', 'estimated'),
      timeEasy('cooldown', q.raceCooldownSec, p)
    ],
    null
  );
}
