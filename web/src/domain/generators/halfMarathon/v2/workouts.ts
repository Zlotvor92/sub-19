/* H10 — lestvice i „ista doza druge strukture"; H14 — WU/CD (po pojasu obima) i oporavci; struktura treninga
   (blokovi, segmenti, km/trajanje); H16 — RPE kvaliteta i test 5 km. Jedino mesto sastava treninga. Km
   WU/CD/oporavka po srednjem E. */

import { midEasy, raceTimeForVdot } from './paces.ts';
import { HM_V2_POLICY as P } from './policy.ts';
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

/* ---------- Lestvice i strukture (H10) ---------- */

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

/** Nivoi lestvice kao strukture, rastućom dozom. `beginner` (H17, HI10): T kontinuirano počinje od 1,5 km. */
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
  repsMax: number,
  roundM: number
): Structure[] {
  const out: Structure[] = [];
  for (let k = P.alternatives.repsMin; k <= repsMax; k++) {
    if (doseM % k !== 0) continue;
    const repM = doseM / k;
    if (repM % roundM === 0 && repM >= minRepM && repM <= maxRepM)
      out.push({ form: 'reps', reps: k, repM });
  }
  return out;
}

/** H10 (pouka 11): 2–5 jednakih deonica ≥ `minRepM` (T 1000 m, RP 2000 m) deljivih sa 100 m, a kad takvih
    nema sa 50 m. */
function splitsOf(doseM: number, minRepM: number): Structure[] {
  const a = P.alternatives;
  const splits = equalSplits(doseM, minRepM, doseM, a.repsMax, a.roundM);
  return splits.length > 0
    ? splits
    : equalSplits(doseM, minRepM, doseM, a.repsMax, a.roundFallbackM);
}

/**
 * Pouka 27 (HI5): piramida od `n` deonica u opsegu zone [minM, maxM] sa korakom `stepM` i zbirom `doseM`.
 * Polazi od simetrične piramide (min, min + korak, … vrh … , min), pa razliku do zbira raspoređuje po korak na
 * deonice najbliže vrhu (pri istoj dužini kasnija), u opsegu zone. null = nema takve piramide (ili su sve
 * deonice jednake). Npr. I 5000 m, 5 deonica → 800-1000-1200-1200-800; I 2000 m, 2 → 800-1200.
 */
export function stepPyramid(
  doseM: number,
  n: number,
  minM: number,
  maxM: number,
  stepM: number
): number[] | null {
  const reps = Array.from({ length: n }, (_, i) =>
    Math.min(maxM, minM + stepM * Math.min(i, n - 1 - i))
  );
  let diff = doseM - reps.reduce((x, m) => x + m, 0);
  if (diff % stepM !== 0) return null;
  while (diff !== 0) {
    const up = diff > 0;
    let k = -1;
    reps.forEach((m, i) => {
      if (up ? m + stepM > maxM : m - stepM < minM) return;
      if (k < 0 || (up ? m >= reps[k]! : m <= reps[k]!)) k = i;
    });
    if (k < 0) return null;
    reps[k] = reps[k]! + (up ? stepM : -stepM);
    diff += up ? -stepM : stepM;
  }
  return reps.every((m) => m === reps[0]) ? null : reps;
}

/**
 * Sve strukture iste doze za lestvicu (H10): nivo lestvice sa tom dozom (ako postoji) pa strukture po
 * pravilu. T: kontinuirano ↔ 2–5 jednakih deonica ≥ 1000 m; RP: 2–5 jednakih deonica ≥ 2000 m ili
 * kontinuirano do 10 km; I: do 6 jednakih deonica 800–1200 m ili piramida 1200 + 1000 + 800 m; R: deonice
 * 200 / 300 / 400 m. Prihvataju se samo tačne podele (doza se ne menja).
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
    for (const s of splitsOf(doseM, a.tRepMinM)) push(s);
  } else if (ladder === 'I') {
    for (const s of equalSplits(doseM, a.iRepMinM, a.iRepMaxM, a.iRepsMax, a.roundM)) push(s);
    push({ form: 'pyramid', repsM: a.iPyramidM });
    // Pouka 27 (HI5): jednake deonice bez druge strukture iste doze → piramida (korak 200 m, isti zbir).
    if (out.length === 1 && out[0]!.form === 'reps') {
      const pyr = stepPyramid(doseM, out[0]!.reps, a.iRepMinM, a.iRepMaxM, a.pyramidStepM);
      if (pyr) push({ form: 'pyramid', repsM: pyr });
    }
  } else if (ladder === 'RP') {
    for (const s of splitsOf(doseM, a.rpRepMinM)) push(s);
    if (doseM <= a.rpContinuousMaxKm * 1000) push({ form: 'continuous', km: doseM / 1000 });
  } else
    for (const repM of a.rRepM)
      if (doseM % repM === 0) push({ form: 'reps', reps: doseM / repM, repM });
  return out;
}

/** H5/H7: najmanja T doza rasterećenja i tapera (2,0 km) kao struktura lestvice — T kontinuirano 2,0 km;
    T cruise (nema nivo 2,0 km) prva podela na deonice ≥ 1000 m (2 × 1000 m). */
export function tFloorStructure(ladder: 'T_continuous' | 'T_cruise', doseM: number): Structure {
  const all = structuresForDose(ladder, doseM);
  return ladder === 'T_cruise' ? (all.find((s) => s.form === 'reps') ?? all[0]!) : all[0]!;
}

/* ---------- Segmenti (H14) ---------- */

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

/** H14: WU/CD [s] po pojasu trenutnog obima iz ulaza (0,1 km); isti za ceo plan. */
export interface WarmupCooldown {
  warmupSec: number;
  cooldownSec: number;
}

/** `beginner` (H17): uvek prvi pojas (15/10 min). */
export function warmupCooldown(currentWeeklyKm: number, beginner = false): WarmupCooldown {
  const km10 = Math.round(currentWeeklyKm * 10);
  const bands = P.workout.warmupCooldown;
  const band = beginner ? bands[0]! : bands.filter((b) => Math.round(b.fromKm * 10) <= km10).pop()!;
  return { warmupSec: band.warmupSec, cooldownSec: band.cooldownSec };
}

/** H16: RPE zone rada (plan po osećaju). */
export function rpeOf(zone: WorkZone): Rpe {
  const r = P.feel.rpe[zone];
  return { min: r.min, max: r.max, cue: r.cue };
}

/** H14: oporavak posle deonice (sekunde ili metri džoga). I: 1:1 vreme, naniže na 15 s, max 4:00; T cruise
    i RP po dužini deonice; oštrenje 2:00 (H8). */
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
  const table = ladder === 'RP' ? w.rpRecovery : w.tCruiseRecovery;
  return { sec: table.find((x) => repM <= x.maxRepM)!.sec };
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

/** Trening kvaliteta: WU + rad + CD po pojasu obima (H14); `feel` → RPE zone (H16). */
export function qualityWorkout(dose: Dose, p: Paces, wc: WarmupCooldown, feel = false): Workout {
  const zone = dose.zone;
  const pace = p[zone];
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

/** Pouka 32: trajanje dana kvaliteta [s] — WU + rad + oporavci + CD, sporim krajem tempa zone gde postoji
    opseg (džog oporavka zadat metrima ide sporim E; WU/CD i ostali oporavci su zadati vremenom, zone rada
    imaju jedan tempo). Drugi član plafona zone (quality.ts) ga poredi sa trajanjem dugog iste nedelje. */
export function qualityDaySec(dose: Dose, p: Paces, wc: WarmupCooldown): number {
  const s = dose.structure;
  const pace = p[dose.zone];
  const work = s.form === 'continuous' ? Math.round(s.km * pace) : 0;
  const reps = repsOf(s);
  const rec = reps.slice(0, -1).reduce((a, m) => {
    const r = recoveryOf(dose.ladder, m, p);
    return a + ('m' in r ? Math.round((r.m / 1000) * p.E.slow) : r.sec);
  }, 0);
  const repSec = reps.reduce((a, m) => a + Math.round((m / 1000) * pace), 0);
  return wc.warmupSec + wc.cooldownSec + work + repSec + rec;
}

/** H16: test 5 km — WU + 5 km kontrolisano maksimalno + CD (H14). Trajanje testa = procena vremena 5 km iz
    (procenjenog) VDOT-a (HI11). Računa se u obim nedelje, nije doza kvaliteta. */
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

/** H8: lagan trening zadat vremenom (35 min E). */
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

/** H8: dan pred trku — 20 min E + 4 × 20 s ubrzanja (R tempo; oporavak isti metraž džogom, H14). */
export function eveWorkout(p: Paces, strides = true): Workout {
  const q = P.raceWeek;
  const st = q.eveStrides;
  // A4 (H18): dan pred trku u periodu bola — bez ubrzanja (samo 20 min E).
  if (!strides)
    return assemble(
      'easy',
      null,
      `Lagano ${Math.round(q.eveEasySec / 60)} min`,
      [{ kind: 'easy_time', sec: q.eveEasySec }],
      [timeEasy('easy', q.eveEasySec, p)],
      null
    );
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

/** H8: oštrenje trkačke nedelje — WU + 2 × 2000 m RP (2:00) + CD (WU/CD po H14). */
export function sharpenerWorkout(p: Paces, wc: WarmupCooldown, feel = false): Workout {
  const s = P.raceWeek.sharpener;
  return qualityWorkout(
    {
      ladder: 'RP_sharpener',
      zone: 'RP',
      doseM: s.reps * s.repM,
      structure: { form: 'reps', reps: s.reps, repM: s.repM },
      step: 'sharpener'
    },
    p,
    wc,
    feel
  );
}

/** H8: trka 21,1 km + WU 10 min + CD 10 min (van obima nedelje). */
export function raceWorkout(p: Paces, raceSec: number): Workout {
  const q = P.raceWeek;
  return assemble(
    'race',
    null,
    `Trka ${fmtKm(q.raceKm)} km (WU ${q.raceWarmupSec / 60} min + CD ${q.raceCooldownSec / 60} min)`,
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
