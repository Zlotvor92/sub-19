/* Konstrukcija treninga iz strukture. Km i trajanje se RAČUNAJU iz komponenti:
   - distanca zadata u km → km 'exact', vreme 'estimated' (iz tempa);
   - vreme zadato u s     → vreme 'exact', km 'estimated' (iz tempa);
   - lagano (E) se računa sredinom E opsega; oporavak ('jog') sporijom granicom E. */

import { FIVE_K_V2_POLICY as P } from './policy.ts';
import type {
  Basis,
  BlockSpec,
  Paces,
  QualityBudgets,
  QualityType,
  Segment,
  Workout,
  WorkoutKind,
  Zone
} from './types.ts';

const r2 = (x: number): number => Math.round(x * 100) / 100;
const floorHalf = (x: number): number => Math.floor(x * 2 + 1e-9) / 2;

function paceOf(zone: Zone | 'jog', p: Paces): number {
  if (zone === 'jog') return p.E.slow;
  if (zone === 'E') return Math.round((p.E.fast + p.E.slow) / 2);
  return p[zone];
}

function byKm(kind: Segment['kind'], zone: Zone | 'jog', km: number, p: Paces): Segment {
  const pace = paceOf(zone, p);
  return {
    kind,
    zone,
    km: r2(km),
    sec: Math.round(km * pace),
    paceSecPerKm: pace,
    kmBasis: 'exact',
    secBasis: 'estimated'
  };
}

function bySec(kind: Segment['kind'], zone: Zone | 'jog', sec: number, p: Paces): Segment {
  const pace = paceOf(zone, p);
  return {
    kind,
    zone,
    km: r2(sec / pace),
    sec: Math.round(sec),
    paceSecPerKm: pace,
    kmBasis: 'estimated',
    secBasis: 'exact'
  };
}

function segmentsOf(b: BlockSpec, p: Paces): Segment[] {
  switch (b.kind) {
    case 'warmup':
    case 'cooldown':
    case 'easy':
    case 'long':
      return [byKm(b.kind, 'E', b.km, p)];
    case 'continuous':
      return [byKm('continuous', b.zone, b.km, p)];
    case 'progression':
      return b.steps.map((s) => byKm('progression', s.zone, s.km, p));
    case 'race':
      return [byKm('race', 'RP', b.km, p)];
    case 'reps': {
      const out: Segment[] = [];
      const kind = b.stride ? 'stride' : 'rep';
      for (let i = 0; i < b.reps; i++) {
        out.push(
          'km' in b.rep ? byKm(kind, b.zone, b.rep.km, p) : bySec(kind, b.zone, b.rep.sec, p)
        );
        if (i < b.reps - 1)
          out.push(
            'km' in b.recovery
              ? byKm('recovery', 'jog', b.recovery.km, p)
              : bySec('recovery', 'jog', b.recovery.sec, p)
          );
      }
      return out;
    }
  }
}

const WORK_KINDS: ReadonlySet<Segment['kind']> = new Set(['rep', 'continuous', 'progression']);

export function buildWorkout(
  kind: WorkoutKind,
  qualityType: QualityType | null,
  title: string,
  blocks: readonly BlockSpec[],
  p: Paces
): Workout {
  const segments = blocks.flatMap((b) => segmentsOf(b, p));
  const workKm: Record<Zone, number> = { E: 0, T: 0, I: 0, R: 0, RP: 0 };
  const maxBoutSec: Record<Zone, number> = { E: 0, T: 0, I: 0, R: 0, RP: 0 };
  for (const s of segments) {
    if (s.zone === 'jog') continue;
    if (WORK_KINDS.has(s.kind)) workKm[s.zone] = r2(workKm[s.zone] + s.km);
    if (WORK_KINDS.has(s.kind) || s.kind === 'stride')
      maxBoutSec[s.zone] = Math.max(maxBoutSec[s.zone], s.sec);
  }
  // Uzastopni progresivni koraci iste zone su jedan kontinuirani blok.
  let run: { zone: Zone; sec: number } | null = null;
  for (const s of segments) {
    if (s.kind === 'progression' && s.zone !== 'jog') {
      run =
        run && run.zone === s.zone
          ? { zone: s.zone, sec: run.sec + s.sec }
          : { zone: s.zone, sec: s.sec };
      maxBoutSec[run.zone] = Math.max(maxBoutSec[run.zone], run.sec);
    } else run = null;
  }
  const basis = (k: 'kmBasis' | 'secBasis'): Basis =>
    segments.some((s) => s[k] === 'estimated') ? 'estimated' : 'exact';
  return {
    kind,
    qualityType,
    title,
    blocks,
    segments,
    km: r2(segments.reduce((a, s) => a + s.km, 0)),
    sec: segments.reduce((a, s) => a + s.sec, 0),
    kmBasis: basis('kmBasis'),
    secBasis: basis('secBasis'),
    workKm,
    maxBoutSec
  };
}

/* ---------- Budžeti i veličine ---------- */

/** Budžet [km] = udeo × cilj nedelje, zaokružen NANIŽE na 10 m (zaokruživanje ne sme da probije udeo). */
export function qualityBudgets(targetKm: number): QualityBudgets {
  const floor2 = (x: number): number => Math.floor(x * 100 + 1e-9) / 100;
  return {
    I: floor2(targetKm * P.quality.iMaxShare),
    T: floor2(targetKm * P.quality.tMaxShare),
    R: floor2(targetKm * P.quality.rMaxShare)
  };
}

/** Zagrevanje/hlađenje za ciljni km nedelje (poslednji pojas čiji je prag ≤ cilj). */
export function warmupBand(targetKm: number): { warmupKm: number; cooldownKm: number } {
  let band: { warmupKm: number; cooldownKm: number } = P.warmup.bands[0];
  for (const b of P.warmup.bands) if (targetKm >= b.fromWeekKm) band = b;
  return { warmupKm: band.warmupKm, cooldownKm: band.cooldownKm };
}

export interface RepChoice {
  reps: number;
  repKm: number;
}

/**
 * Izbor ponavljanja iz ponude (redosled = preferencija): broj = ⌊budžet / dužina⌋ (najviše maxReps);
 * dozvoljene su samo opcije sa ≥ minReps i trajanjem ponavljanja u [minRepSec, maxRepSec].
 * Bira se PRVA opcija koja popuni ≥ repFillShare budžeta; ako nijedna, ona sa najvećim ukupnim radom.
 * Jedan prolaz kroz fiksnu ponudu — bez iterativnog smanjivanja ili dopunjavanja.
 */
export function chooseReps(
  budgetKm: number,
  options: readonly number[],
  paceSecPerKm: number,
  minReps: number,
  maxReps: number,
  maxRepSec: number,
  minRepSec = 0
): RepChoice | null {
  let best: RepChoice | null = null;
  for (const repKm of options) {
    const sec = repKm * paceSecPerKm;
    if (sec > maxRepSec || sec < minRepSec) continue;
    const reps = Math.min(maxReps, Math.floor(budgetKm / repKm + 1e-9));
    if (reps < minReps) continue;
    if (reps * repKm + 1e-9 >= budgetKm * P.quality.repFillShare) return { reps, repKm };
    if (!best || reps * repKm > best.reps * best.repKm + 1e-9) best = { reps, repKm };
  }
  return best;
}

/** Prethodni glavni kvalitet iste faze (ulaz za progresiju doze). */
export interface PrevDose {
  reps: number;
  repKm: number;
}

const workOf = (c: RepChoice): number => Math.round(c.reps * c.repKm * 100) / 100;

/**
 * 2.1.0 progresija doze. Nabraja dozvoljene parove (dužina iz ponude × broj ponavljanja u
 * [minReps, min(maxReps, ⌊budžet/dužina⌋)], trajanje ponavljanja u [minRepSec, maxRepSec]) i bira
 * rad ≥ floorShare × budžet, strogo veći od `prev` (bez `prev`: bilo koji ≥ prag):
 * - 'strict' (vrhunac I, oštrenje RP): najmanji takav rad (ostavlja mesta za sledeće nedelje),
 *   pri jednakom radu ranija (duža) opcija; nema ga → null;
 * - 'base' (baza R; strogi rast nije zahtev, zahtev je drugačiji par): prva (najduža) dužina iz
 *   ponude sa najmanje ponavljanja čiji je rad ≥ prag i ≥ rad `prev`, a struktura ≠ `prev`; nema ga →
 *   bez `prev` najveći rad (i ispod praga), sa `prev` najveći rad druge strukture.
 * Jedno nabrajanje fiksne ponude — bez petlje smanjivanja/dopune.
 */
export function chooseProgressiveReps(
  budgetKm: number,
  options: readonly number[],
  paceSecPerKm: number,
  minReps: number,
  maxReps: number,
  maxRepSec: number,
  minRepSec: number,
  floorShare: number,
  prev: PrevDose | null,
  mode: 'strict' | 'base'
): RepChoice | null {
  const all: RepChoice[] = [];
  for (const repKm of options) {
    const sec = repKm * paceSecPerKm;
    if (sec > maxRepSec || sec < minRepSec) continue;
    const most = Math.min(maxReps, Math.floor(budgetKm / repKm + 1e-9));
    for (let reps = minReps; reps <= most; reps++) all.push({ reps, repKm });
  }
  const floor = budgetKm * floorShare - 1e-9;
  const prevWork = prev ? workOf(prev) : -Infinity;
  const same = (c: RepChoice): boolean =>
    prev !== null && c.reps === prev.reps && Math.abs(c.repKm - prev.repKm) < 1e-9;
  if (mode === 'strict') {
    // Najmanji rad strogo veći od prethodnog; pri jednakom radu ranija (duža) opcija.
    let up: RepChoice | null = null;
    for (const c of all)
      if (
        workOf(c) >= floor &&
        workOf(c) > prevWork + 1e-9 &&
        (!up || workOf(c) < workOf(up) - 1e-9)
      )
        up = c;
    return up;
  }
  // `all` je poređan po ponudi (duže prvo) pa po broju ponavljanja (manje prvo).
  const next = all.find((c) => workOf(c) >= floor && workOf(c) >= prevWork - 1e-9 && !same(c));
  if (next) return next;
  let hold: RepChoice | null = null;
  for (const c of all) if (!same(c) && (!hold || workOf(c) > workOf(hold) + 1e-9)) hold = c;
  return hold;
}

/** Oporavak zadat vremenom: zaokružen na `recovery.roundSec`, najmanje jedan korak. */
export function roundRecoverySec(sec: number): number {
  const step = P.quality.recovery.roundSec;
  return Math.max(step, Math.round(sec / step) * step);
}

export type SessionResult =
  { ok: true; workout: Workout; choice: RepChoice | null } | { ok: false; message: string };

const km = (x: number): string => `${Number(x.toFixed(2))}`;
const m = (x: number): string => `${Math.round(x * 1000)} m`;

/** Kvalitetni trening zadate vrste iz budžeta (km rada). */
/**
 * `progression` (2.1.0): za glavni kvalitet ne-rasteretne nedelje izgradnje (R baza, I vrhunac,
 * RP oštrenje) — prethodna doza iste faze (null u prvoj nedelji faze). Bez njega: chooseReps.
 */
export function qualitySession(
  type: QualityType,
  budgetKm: number,
  targetKm: number,
  p: Paces,
  progression?: { prev: PrevDose | null }
): SessionResult {
  const q = P.quality;
  const band = warmupBand(targetKm);
  const wu: BlockSpec = { kind: 'warmup', km: band.warmupKm };
  const cd: BlockSpec = { kind: 'cooldown', km: band.cooldownKm };
  const fail = (what: string): SessionResult => ({
    ok: false,
    message: `${what}: budžet ${km(budgetKm)} km nije dovoljan za najmanji smislen trening po pravilima.`
  });

  switch (type) {
    case 'R':
    case 'R_sharpen': {
      const opts = type === 'R' ? q.repOptionsKm.R : q.repOptionsKm.Rsharpen;
      const c = progression
        ? chooseProgressiveReps(
            budgetKm,
            opts,
            p.R,
            q.minReps.R,
            q.maxReps.R,
            q.rRepMaxSec,
            0,
            q.mainMinShareOfBudget,
            progression.prev,
            'base'
          )
        : chooseReps(budgetKm, opts, p.R, q.minReps.R, q.maxReps.R, q.rRepMaxSec);
      if (!c) return fail('R ponavljanja');
      const blocks: BlockSpec[] = [
        wu,
        {
          kind: 'reps',
          zone: 'R',
          reps: c.reps,
          rep: { km: c.repKm },
          recovery: { km: c.repKm * q.recovery.rDistanceRatio }
        },
        cd
      ];
      return {
        ok: true,
        workout: buildWorkout(
          'quality',
          type,
          `R: ${c.reps} × ${m(c.repKm)} (oporavak ${m(c.repKm)} lagano)`,
          blocks,
          p
        ),
        choice: c
      };
    }
    case 'I':
    case 'RP': {
      const isI = type === 'I';
      const pace = isI ? p.I : p.RP;
      const args = [
        budgetKm,
        isI ? q.repOptionsKm.I : q.repOptionsKm.RP,
        pace,
        isI ? q.minReps.I : q.minReps.RP,
        isI ? q.maxReps.I : q.maxReps.RP,
        q.iRepMaxSec,
        isI ? q.iRepMinSec : 0
      ] as const;
      const c = progression
        ? chooseProgressiveReps(...args, q.mainMinShareOfBudget, progression.prev, 'strict')
        : chooseReps(...args);
      if (!c)
        return progression?.prev
          ? {
              ok: false,
              message: `${type}: budžet ${km(budgetKm)} km nema doze veće od prethodne nedelje (${progression.prev.reps} × ${m(progression.prev.repKm)}) u okviru ${q.mainMinShareOfBudget * 100}–100% budžeta.`
            }
          : fail(isI ? 'I ponavljanja' : 'RP ponavljanja');
      const recSec = roundRecoverySec(
        c.repKm * pace * (isI ? q.recovery.iTimeRatio : q.recovery.rpTimeRatio)
      );
      const blocks: BlockSpec[] = [
        wu,
        { kind: 'reps', zone: type, reps: c.reps, rep: { km: c.repKm }, recovery: { sec: recSec } },
        cd
      ];
      return {
        ok: true,
        workout: buildWorkout(
          'quality',
          type,
          `${type}: ${c.reps} × ${m(c.repKm)} (oporavak ${recSec} s lagano)`,
          blocks,
          p
        ),
        choice: c
      };
    }
    case 'T_cruise': {
      const c = chooseReps(
        budgetKm,
        q.repOptionsKm.Tcruise,
        p.T,
        q.minReps.T,
        q.maxReps.T,
        q.tContinuousMaxSec
      );
      if (!c) return fail('T cruise');
      const blocks: BlockSpec[] = [
        wu,
        {
          kind: 'reps',
          zone: 'T',
          reps: c.reps,
          rep: { km: c.repKm },
          recovery: { sec: q.recovery.tCruiseSec }
        },
        cd
      ];
      return {
        ok: true,
        workout: buildWorkout(
          'quality',
          type,
          `T cruise: ${c.reps} × ${m(c.repKm)} (oporavak ${q.recovery.tCruiseSec} s)`,
          blocks,
          p
        ),
        choice: c
      };
    }
    case 'T_short': {
      const len = floorHalf(Math.min(budgetKm * q.shortTShareOfBudget, q.shortTMaxSec / p.T));
      if (len < q.shortTMinKm) return fail('Kratak T');
      const blocks: BlockSpec[] = [wu, { kind: 'continuous', zone: 'T', km: len }, cd];
      return {
        ok: true,
        workout: buildWorkout('quality', type, `T: ${km(len)} km kontinuirano`, blocks, p),
        choice: null
      };
    }
    case 'RP_sharpener': {
      const s = q.raceWeekSharpener;
      const c = chooseReps(
        budgetKm,
        q.repOptionsKm.RPsharpener,
        p.RP,
        s.minReps,
        s.maxReps,
        q.iRepMaxSec
      );
      if (!c) return fail('Oštrenje RP');
      const recSec = roundRecoverySec(c.repKm * p.RP * q.recovery.rpTimeRatio);
      const blocks: BlockSpec[] = [
        wu,
        { kind: 'reps', zone: 'RP', reps: c.reps, rep: { km: c.repKm }, recovery: { sec: recSec } },
        cd
      ];
      return {
        ok: true,
        workout: buildWorkout(
          'quality',
          type,
          `Oštrenje: ${c.reps} × ${m(c.repKm)} RP (oporavak ${recSec} s lagano)`,
          blocks,
          p
        ),
        choice: c
      };
    }
  }
}

export function easyRun(totalKm: number, p: Paces, withStrides: boolean): Workout {
  if (!withStrides)
    return buildWorkout(
      'easy',
      null,
      `Lagano ${km(totalKm)} km`,
      [{ kind: 'easy', km: totalKm }],
      p
    );
  const s = P.quality.strides;
  const strides: BlockSpec = {
    kind: 'reps',
    zone: 'R',
    reps: s.reps,
    rep: { sec: s.sec },
    recovery: { sec: s.recoverySec },
    stride: true
  };
  const stridesKm = buildWorkout('easy', null, '', [strides], p).km;
  return buildWorkout(
    'easy',
    null,
    `Lagano ${km(totalKm)} km + ${s.reps} × ${s.sec} s ubrzanja`,
    [{ kind: 'easy', km: r2(totalKm - stridesKm) }, strides],
    p
  );
}

export function longRun(totalKm: number, p: Paces): Workout {
  return buildWorkout(
    'long',
    null,
    `Dugi lagano ${km(totalKm)} km`,
    [{ kind: 'long', km: totalKm }],
    p
  );
}

export function raceDay(p: Paces): Workout {
  return buildWorkout(
    'race',
    null,
    'Trka 5K',
    [
      { kind: 'warmup', km: P.warmup.race.warmupKm },
      { kind: 'race', km: P.paces.raceDistanceM / 1000 },
      { kind: 'cooldown', km: P.warmup.race.cooldownKm }
    ],
    p
  );
}
