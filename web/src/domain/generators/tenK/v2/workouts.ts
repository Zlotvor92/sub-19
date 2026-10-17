/* D10 — lestvice i „ista doza druge strukture"; D14 — WU/CD i oporavci; struktura treninga (blokovi,
   segmenti, km/trajanje). Jedino mesto sastava treninga. Km WU/CD/oporavka po srednjem E. */

import { midEasy } from './paces.ts';
import { TEN_K_V2_POLICY as P } from './policy.ts';
import type {
  BlockSpec,
  Dose,
  LadderId,
  Paces,
  QualityType,
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
  return s.form === 'continuous' ? Math.round(s.km * 1000) : s.reps * s.repM;
}

export function sameStructure(a: Structure, b: Structure): boolean {
  return a.form === 'continuous'
    ? b.form === 'continuous' && doseOf(a) === doseOf(b)
    : b.form === 'reps' && a.reps === b.reps && a.repM === b.repM;
}

/** Nivoi lestvice kao strukture, rastućom dozom. */
export function ladderLevels(ladder: LadderId): Structure[] {
  const l = P.ladders;
  if (ladder === 'T_continuous') return l.T_continuous.map((km) => ({ form: 'continuous', km }));
  const reps =
    ladder === 'R' ? l.R : ladder === 'T_cruise' ? l.T_cruise : ladder === 'I' ? l.I : l.RP;
  return reps.map((r) => ({ form: 'reps', reps: r.reps, repM: r.repM }));
}

/** Tačne podele doze na 2–5 jednakih deonica (deonica deljiva sa 100 m), rastućim brojem deonica. */
function equalSplits(doseM: number, minRepM: number, maxRepM: number): Structure[] {
  const a = P.alternatives;
  const out: Structure[] = [];
  for (let k = a.repsMin; k <= a.repsMax; k++) {
    if (doseM % k !== 0) continue;
    const repM = doseM / k;
    if (repM % a.roundM === 0 && repM >= minRepM && repM <= maxRepM)
      out.push({ form: 'reps', reps: k, repM });
  }
  return out;
}

/**
 * Sve strukture iste doze za lestvicu (D10): nivo lestvice sa tom dozom (ako postoji) pa strukture po
 * pravilu. T: kontinuirano ↔ 2–5 jednakih deonica; I: deonice 800–1200 m; RP: 2–5 jednakih deonica;
 * R: deonice 200 ↔ 300 m. Prihvataju se samo tačne podele (doza se ne menja).
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
    for (const s of equalSplits(doseM, a.roundM, doseM)) push(s);
  } else if (ladder === 'I') for (const s of equalSplits(doseM, a.iRepMinM, a.iRepMaxM)) push(s);
  else if (ladder === 'RP') for (const s of equalSplits(doseM, a.roundM, doseM)) push(s);
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

/** D14: oporavak posle deonice (sekunde ili metri džoga). */
export function recoveryOf(
  ladder: LadderId | 'RP_sharpener',
  repM: number,
  p: Paces
): { m: number } | { sec: number } {
  const w = P.workout;
  if (ladder === 'R') return { m: repM };
  if (ladder === 'I') return { sec: Math.min(Math.round((repM / 1000) * p.I), w.iRecoveryMaxSec) };
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
  const rec = recoverySegment(recoveryOf(ladder, s.repM, p), p);
  return (s.reps * s.repM) / 10 + (s.reps - 1) * Math.round(rec.km * 100);
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
    if ((s.kind === 'rep' || s.kind === 'continuous') && s.zone !== 'E' && s.zone !== 'jog') {
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

/** Trening kvaliteta: WU 15 min + rad + CD 10 min (D14). */
export function qualityWorkout(dose: Dose, p: Paces): Workout {
  const w = P.workout;
  const zone = dose.zone;
  const pace = paceOf(zone, p);
  const s = dose.structure;
  const blocks: BlockSpec[] = [{ kind: 'warmup', sec: w.warmupSec }];
  const segments: Segment[] = [timeEasy('warmup', w.warmupSec, p)];
  let main: string;
  if (s.form === 'continuous') {
    blocks.push({ kind: 'continuous', zone, km: s.km });
    segments.push(
      seg('continuous', zone, s.km, Math.round(s.km * pace), pace, 'exact', 'estimated')
    );
    main = `${zone} ${fmtKm(s.km)} km kontinuirano`;
  } else {
    const rec = recoveryOf(dose.ladder, s.repM, p);
    blocks.push({ kind: 'reps', zone, reps: s.reps, rep: { m: s.repM }, recovery: rec });
    for (let i = 0; i < s.reps; i++) {
      if (i > 0) segments.push(recoverySegment(rec, p));
      segments.push(
        seg(
          'rep',
          zone,
          s.repM / 1000,
          Math.round((s.repM / 1000) * pace),
          pace,
          'exact',
          'estimated'
        )
      );
    }
    main = `${zone} ${s.reps} × ${s.repM} m (oporavak ${fmtRec(rec)})`;
  }
  blocks.push({ kind: 'cooldown', sec: w.cooldownSec });
  segments.push(timeEasy('cooldown', w.cooldownSec, p));
  const qualityType: QualityType =
    dose.ladder === 'RP_sharpener'
      ? 'RP_sharpener'
      : zone === 'T'
        ? s.form === 'continuous'
          ? 'T_continuous'
          : 'T_cruise'
        : zone;
  const title = `WU 15 min + ${main} + CD 10 min`;
  return assemble('quality', qualityType, title, blocks, segments, dose);
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

/** D8: dan pred trku — 20 min E + 4 × 20 s ubrzanja (R tempo; oporavak isti metraž džogom, D14 R). */
export function eveWorkout(p: Paces): Workout {
  const q = P.raceWeek;
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

/** D8: oštrenje trkačke nedelje — WU + reps × 1000 m RP (90 s) + CD. */
export function sharpenerWorkout(reps: number, p: Paces): Workout {
  const s = P.raceWeek.sharpener;
  return qualityWorkout(
    {
      ladder: 'RP_sharpener',
      zone: 'RP',
      doseM: reps * s.repM,
      structure: { form: 'reps', reps, repM: s.repM },
      step: 'sharpener'
    },
    p
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
