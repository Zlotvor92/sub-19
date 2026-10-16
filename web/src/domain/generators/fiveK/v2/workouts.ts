/* Konstrukcija treninga iz strukture. Km i trajanje se RAČUNAJU iz komponenti:
   - distanca zadata u km → km 'exact', vreme 'estimated' (iz tempa);
   - vreme zadato u s     → vreme 'exact', km 'estimated' (iz tempa);
   - lagano (E) se računa sredinom E opsega; oporavak ('jog') sporijom granicom E. */

import { daysRule, FIVE_K_V2_POLICY as P, type RunDaysCount } from './policy.ts';
import type {
  Basis,
  BlockSpec,
  Paces,
  Phase,
  QualityBudgets,
  QualityType,
  Segment,
  WeekFrame,
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
 * - 'base' (baza R): 2.2.0 R raste do budžeta — prva (najduža) dužina ≥ dužine `prev`, sa najmanje
 *   ponavljanja, čiji je rad ≥ prag i STROGO veći od `prev` (bez skraćivanja ponavljanja radi rasta,
 *   inače bi rast davao 9 × 150 m); nema ga → rad se drži: prva dužina sa radom ≥ prag i ≥ `prev`,
 *   struktura ≠ `prev`; nema ni toga → bez `prev` najveći rad (i ispod praga), sa `prev` najveći rad
 *   druge strukture;
 * - 'grow': samo prvi korak iz 'base' (rast); nema ga → null;
 * - 'alt' (2.3.0, Odluka 6): samo drugi korak iz 'base' — druga struktura sa radom ≥ prag i ≥ `prev`
 *   (doza ne pada); nema je → null.
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
  mode: 'strict' | 'base' | 'grow' | 'alt'
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
  const grow = all.find(
    (c) =>
      workOf(c) >= floor &&
      workOf(c) > prevWork + 1e-9 &&
      (prev === null || c.repKm + 1e-9 >= prev.repKm)
  );
  if (mode !== 'alt' && (grow || mode === 'grow')) return grow ?? null;
  const next = all.find((c) => workOf(c) >= floor && workOf(c) >= prevWork - 1e-9 && !same(c));
  if (next || mode === 'alt') return next ?? null;
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

/** I ili RP ponavljanja iz izabranog para (oporavak vremenom, zaokružen). */
function intervalSession(
  type: 'I' | 'RP',
  c: RepChoice,
  targetKm: number,
  p: Paces
): SessionResult & { ok: true } {
  const q = P.quality;
  const pace = type === 'I' ? p.I : p.RP;
  const band = warmupBand(targetKm);
  const recSec = roundRecoverySec(
    c.repKm * pace * (type === 'I' ? q.recovery.iTimeRatio : q.recovery.rpTimeRatio)
  );
  const blocks: BlockSpec[] = [
    { kind: 'warmup', km: band.warmupKm },
    { kind: 'reps', zone: type, reps: c.reps, rep: { km: c.repKm }, recovery: { sec: recSec } },
    { kind: 'cooldown', km: band.cooldownKm }
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

/** R ponavljanja iz izabranog para (oporavak ista distanca lagano). */
function repsRSession(
  type: 'R' | 'R_sharpen',
  c: RepChoice,
  targetKm: number,
  p: Paces
): SessionResult & { ok: true } {
  const band = warmupBand(targetKm);
  const blocks: BlockSpec[] = [
    { kind: 'warmup', km: band.warmupKm },
    {
      kind: 'reps',
      zone: 'R',
      reps: c.reps,
      rep: { km: c.repKm },
      recovery: { km: c.repKm * P.quality.recovery.rDistanceRatio }
    },
    { kind: 'cooldown', km: band.cooldownKm }
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

/** T doza: kontinuirani blok (reps = 1) ili cruise ponavljanja. */
export interface TDose {
  form: 'continuous' | 'cruise';
  reps: number;
  repKm: number;
}

/** 2.2.0 (Uslov 2): jedini plafon T bloka, po fazi. Trkačka nedelja nema T. */
export function tMaxSec(phase: Phase): number {
  return phase === 'race' ? 0 : P.quality.tContinuousMaxSec[phase];
}

/** Najduži dozvoljen kontinuirani T [km]: min(T budžet, plafon faze), na 0,5 km. */
function tContinuousTop(budgetKm: number, phase: Phase, p: Paces): number {
  return Math.min(floorHalf(budgetKm), floorHalf(tMaxSec(phase) / p.T));
}

/** Početni kontinuirani T: min(udeo budžeta, plafon faze), na 0,5 km; ispod minimuma → null. */
export function tContinuousStart(budgetKm: number, phase: Phase, p: Paces): TDose | null {
  const q = P.quality;
  const len = floorHalf(Math.min(budgetKm * q.shortTShareOfBudget, tMaxSec(phase) / p.T));
  return len + 1e-9 >= q.shortTMinKm ? { form: 'continuous', reps: 1, repKm: len } : null;
}

function tSession(t: TDose, targetKm: number, p: Paces): SessionResult & { ok: true } {
  const band = warmupBand(targetKm);
  const wu: BlockSpec = { kind: 'warmup', km: band.warmupKm };
  const cd: BlockSpec = { kind: 'cooldown', km: band.cooldownKm };
  if (t.form === 'continuous')
    return {
      ok: true,
      workout: buildWorkout(
        'quality',
        'T_short',
        `T: ${km(t.repKm)} km kontinuirano`,
        [wu, { kind: 'continuous', zone: 'T', km: t.repKm }, cd],
        p
      ),
      choice: null
    };
  const rec = P.quality.recovery.tCruiseSec;
  return {
    ok: true,
    workout: buildWorkout(
      'quality',
      'T_cruise',
      `T cruise: ${t.reps} × ${m(t.repKm)} (oporavak ${rec} s)`,
      [
        wu,
        { kind: 'reps', zone: 'T', reps: t.reps, rep: { km: t.repKm }, recovery: { sec: rec } },
        cd
      ],
      p
    ),
    choice: { reps: t.reps, repKm: t.repKm }
  };
}

/**
 * Kvalitetni trening zadate vrste iz budžeta (km rada); `phase` određuje plafon T bloka.
 * `progression` (2.1.0): za glavni kvalitet ne-rasteretne nedelje izgradnje (R baza, I vrhunac,
 * RP oštrenje) — prethodna doza iste faze (null u prvoj nedelji faze). Bez njega: chooseReps.
 */
export function qualitySession(
  type: QualityType,
  budgetKm: number,
  targetKm: number,
  p: Paces,
  phase: Phase,
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
      return repsRSession(type, c, targetKm, p);
    }
    case 'I':
    case 'RP': {
      const isI = type === 'I';
      const args = [
        budgetKm,
        isI ? q.repOptionsKm.I : q.repOptionsKm.RP,
        isI ? p.I : p.RP,
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
      return intervalSession(type, c, targetKm, p);
    }
    case 'T_cruise': {
      const c = chooseReps(
        budgetKm,
        q.repOptionsKm.Tcruise,
        p.T,
        q.minReps.T,
        q.maxReps.T,
        tMaxSec(phase)
      );
      if (!c) return fail('T cruise');
      return tSession({ form: 'cruise', ...c }, targetKm, p);
    }
    case 'T_short': {
      const t = tContinuousStart(budgetKm, phase, p);
      if (!t) return fail('Kratak T');
      return tSession(t, targetKm, p);
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

/* ---------- 2.2.0: kvalitet nedelje (jedino mesto odluke o dozi) ---------- */

/** Doza poslednje ne-rasteretne nedelje iste faze (ulaz za progresiju sledeće). */
export interface WeekDose {
  /** Glavni kvalitet: R (baza), I (vrhunac), RP (oštrenje). 3 dana u bazi: poslednji R (null pre prvog). */
  main: RepChoice | null;
  /** Drugi kvalitet T (baza, vrhunac); null u oštrenju. 3 dana u bazi: poslednji T. */
  t: TDose | null;
  /** Broj uzastopnih ne-rasteretnih nedelja faze sa ovom istom dozom (baza, Odluka 3). */
  same: number;
  /** 2.3.0, 3 dana u bazi: vrsta jedinog kvaliteta ove nedelje (naizmenično R/T). */
  kind?: 'R' | 'T';
}

export type WeekQuality =
  | {
      ok: true;
      /** null = rasteretna nedelja samo sa ubrzanjima (stridesOnly, Odluka 5 iz 2.3.0). */
      q1: Workout | null;
      q2: Workout | null;
      easyStrides: boolean;
      stridesOnly: boolean;
      notes: string[];
      dose: WeekDose | null;
    }
  | { ok: false; message: string };

const sameT = (a: TDose, b: TDose): boolean =>
  a.form === b.form && a.reps === b.reps && Math.abs(a.repKm - b.repKm) < 1e-9;
const tWork = (t: TDose): number => workOf(t);
/** Nedeljna doza baze: R km, oblik T i T km (R smena 6 × 400 / 8 × 300 nije promena doze). */
export const baseDoseKey = (rKm: number, tForm: TDose['form'], tKm: number): string =>
  `${r2(rKm)}|${tForm}|${r2(tKm)}`;

function cruiseOf(budgetKm: number, phase: Phase, p: Paces): TDose | null {
  const q = P.quality;
  const c = chooseReps(
    budgetKm,
    q.repOptionsKm.Tcruise,
    p.T,
    q.minReps.T,
    q.maxReps.T,
    tMaxSec(phase)
  );
  return c ? { form: 'cruise', ...c } : null;
}

/**
 * Promena strukture T (kontinuirano ↔ cruise). Ako drugi oblik ne staje u budžet: kontinuirani blok
 * kraći (pa duži) za tStepKm. Nijedno → null.
 */
function tOther(prev: TDose, budgetKm: number, phase: Phase, p: Paces): TDose | null {
  const q = P.quality;
  const top = tContinuousTop(budgetKm, phase, p);
  if (prev.form === 'cruise')
    return top + 1e-9 >= q.shortTMinKm ? { form: 'continuous', reps: 1, repKm: top } : null;
  const cruise = cruiseOf(budgetKm, phase, p);
  if (cruise) return cruise;
  for (const len of [prev.repKm - q.tStepKm, prev.repKm + q.tStepKm])
    if (len + 1e-9 >= q.shortTMinKm && len <= top + 1e-9)
      return { form: 'continuous', reps: 1, repKm: len };
  return null;
}

/**
 * Baza (Odluka 3), jedan prolaz:
 * - R raste do budžeta (chooseProgressiveReps 'grow': duže ili isto ponavljanje, veći rad); bez rasta
 *   R se drži (isti par ako je i dalje u [70%, 100%] budžeta);
 * - T kontinuirano raste za tStepKm do min(T budžet, plafon baze); na limitu prelazi u cruise (T obim
 *   raste kroz ponavljanja); cruise raste ('base' mode: veći rad ili druga struktura ≥ prethodnog rada);
 * - ako ni R ni T nisu promenjeni, R menja strukturu uz isti rad ('base' mode), jer isti par dve
 *   nedelje zaredom nije dozvoljen (QUALITY_REPEAT);
 * - ista doza (baseDoseKey) najviše baseSameDoseMaxWeeks nedelja zaredom, pa promena strukture T.
 */
function baseWeek(
  b: QualityBudgets,
  targetKm: number,
  p: Paces,
  prev: WeekDose | null
): WeekQuality {
  const q = P.quality;
  const rArgs = [b.R, q.repOptionsKm.R, p.R, q.minReps.R, q.maxReps.R, q.rRepMaxSec, 0] as const;
  const pm = prev?.main ?? null;
  const fits = (c: RepChoice, budget: number): boolean =>
    workOf(c) <= budget + 1e-9 && workOf(c) + 1e-9 >= budget * q.mainMinShareOfBudget;
  let r =
    chooseProgressiveReps(...rArgs, q.mainMinShareOfBudget, pm, pm ? 'grow' : 'base') ??
    (pm && fits(pm, b.R) ? pm : null) ??
    chooseProgressiveReps(...rArgs, q.mainMinShareOfBudget, pm, 'base');
  if (!r) return { ok: false, message: `R ponavljanja: budžet ${km(b.R)} km nije dovoljan.` };
  const top = tContinuousTop(b.T, 'base', p);
  const pt = prev?.t ?? null;
  const cont = (len: number): TDose | null =>
    len + 1e-9 >= q.shortTMinKm ? { form: 'continuous', reps: 1, repKm: len } : null;
  const cruise = (from: TDose | null): TDose | null => {
    const c = chooseProgressiveReps(
      b.T,
      q.repOptionsKm.Tcruise,
      p.T,
      q.minReps.T,
      q.maxReps.T,
      tMaxSec('base'),
      0,
      q.repFillShare,
      from && from.form === 'cruise' ? from : null,
      'base'
    );
    return c ? { form: 'cruise', ...c } : null;
  };
  let t: TDose | null;
  if (!pt) t = tContinuousStart(b.T, 'base', p);
  else if (pt.form === 'continuous') {
    const len = Math.min(pt.repKm + q.tStepKm, top);
    t = len > pt.repKm + 1e-9 ? cont(len) : (cruise(null) ?? cont(len));
  } else t = cruise(pt) ?? (tWork(pt) <= b.T + 1e-9 ? pt : null);
  if (!t) return { ok: false, message: `T: budžet ${km(b.T)} km nije dovoljan.` };
  // 2.3.0 (Odluka 6): isti par → R druge strukture BEZ pada doze; nema je → R se drži, T menja strukturu.
  if (pm && pt && sameT(t, pt) && r.reps === pm.reps && Math.abs(r.repKm - pm.repKm) < 1e-9) {
    const alt = chooseProgressiveReps(...rArgs, q.mainMinShareOfBudget, pm, 'alt');
    if (alt) r = alt;
    else t = tOther(t, b.T, 'base', p) ?? t;
  }
  const rKm = workOf(r);
  const prevKey = pm && pt ? baseDoseKey(workOf(pm), pt.form, tWork(pt)) : null;
  let same = baseDoseKey(rKm, t.form, tWork(t)) === prevKey ? prev!.same + 1 : 1;
  if (same > q.baseSameDoseMaxWeeks) {
    const alt = tOther(t, b.T, 'base', p);
    if (alt) {
      t = alt;
      same = baseDoseKey(rKm, t.form, tWork(t)) === prevKey ? prev!.same + 1 : 1;
    }
  }
  return {
    ok: true,
    q1: repsRSession('R', r, targetKm, p).workout,
    q2: tSession(t, targetKm, p).workout,
    easyStrides: true,
    stridesOnly: false,
    notes: [],
    dose: { main: r, t, same }
  };
}

/**
 * Vrhunac (Odluka 5): glavni I NEOPADAJUĆI — najmanji rad veći od prethodnog; ako ponuda nema viši
 * nivo, I se drži (ako je i dalje u [70%, 100%] budžeta), a T menja strukturu (cruise ↔ kontinuirano)
 * da par ne bude identičan. Drugi kvalitet: cruise kad T budžet prima ≥ minReps × najkraća opcija,
 * inače kontinuirani T.
 */
function peakWeek(
  b: QualityBudgets,
  targetKm: number,
  p: Paces,
  prev: WeekDose | null
): WeekQuality {
  const q = P.quality;
  const up = qualitySession('I', b.I, targetKm, p, 'peak', { prev: prev?.main ?? null });
  let i: SessionResult & { ok: true };
  let held = false;
  if (up.ok) i = up;
  else {
    const pm = prev?.main;
    const w = pm ? workOf(pm) : 0;
    if (!pm || w > b.I + 1e-9 || w + 1e-9 < b.I * q.mainMinShareOfBudget)
      return { ok: false, message: up.message };
    i = intervalSession('I', pm, targetKm, p);
    held = true;
  }
  const shortest = Math.min(...q.repOptionsKm.Tcruise);
  let t =
    b.T + 1e-9 >= q.minReps.T * shortest
      ? cruiseOf(b.T, 'peak', p)
      : tContinuousStart(b.T, 'peak', p);
  if (held && t && prev?.t && sameT(t, prev.t)) t = tOther(prev.t, b.T, 'peak', p);
  if (!t)
    return {
      ok: false,
      message: `T: budžet ${km(b.T)} km nije dovoljan${held ? ' za promenu strukture uz zadržan I' : ''}.`
    };
  const notes = held
    ? ['Vrhunac: I zadržan (ponuda nema viši nivo u budžetu); T menja strukturu.']
    : [];
  return {
    ok: true,
    q1: i.workout,
    q2: tSession(t, targetKm, p).workout,
    easyStrides: false,
    stridesOnly: false,
    notes,
    dose: { main: i.choice!, t, same: 1 }
  };
}

/** Rezultat jednog kvaliteta nedelje (3 dana) bez drugog kvaliteta. */
/** 3 dana: jedini kvalitet; lagan dan uvek sa ubrzanjima (Odluka 1, 2.3.0). */
const single = (q1: Workout, notes: string[], dose: WeekDose | null): WeekQuality => ({
  ok: true,
  q1,
  q2: null,
  easyStrides: true,
  stridesOnly: false,
  notes,
  dose
});

/**
 * 2.3.0, 3 dana, baza: jedini kvalitet je naizmenično R / T (prva nedelja R). R raste do budžeta ili
 * se drži, bez pada (Odluka 6); T kontinuirano +tStepKm do limita, pa cruise. Ako izabrana vrsta ne
 * staje, uzima se druga (napomena); isti trening kao prethodne nedelje → druga struktura iste vrste.
 */
function baseWeekOne(
  b: QualityBudgets,
  targetKm: number,
  p: Paces,
  prev: WeekDose | null
): WeekQuality {
  const q = P.quality;
  const rArgs = [b.R, q.repOptionsKm.R, p.R, q.minReps.R, q.maxReps.R, q.rRepMaxSec, 0] as const;
  const pm = prev?.main ?? null;
  const pt = prev?.t ?? null;
  const fits = (c: RepChoice): boolean =>
    workOf(c) <= b.R + 1e-9 && workOf(c) + 1e-9 >= b.R * q.mainMinShareOfBudget;
  const pickR = (): RepChoice | null => {
    if (!pm) return chooseProgressiveReps(...rArgs, q.mainMinShareOfBudget, null, 'base');
    const c =
      chooseProgressiveReps(...rArgs, q.mainMinShareOfBudget, pm, 'grow') ?? (fits(pm) ? pm : null);
    // Isti R kao prethodna nedelja (R dve nedelje zaredom) → druga struktura bez pada doze; nema je →
    // nema R (isti trening dve nedelje zaredom nije dozvoljen, QUALITY_REPEAT).
    if (c && prev?.kind === 'R' && c === pm)
      return chooseProgressiveReps(...rArgs, q.mainMinShareOfBudget, pm, 'alt');
    return c;
  };
  const pickT = (): TDose | null => {
    // Prvi T: tContinuousStart; ako 70% budžeta ne prima minimum, a ceo budžet prima — minimum (1 km).
    if (!pt)
      return (
        tContinuousStart(b.T, 'base', p) ??
        (tContinuousTop(b.T, 'base', p) + 1e-9 >= q.shortTMinKm
          ? { form: 'continuous', reps: 1, repKm: q.shortTMinKm }
          : null)
      );
    const top = tContinuousTop(b.T, 'base', p);
    let t: TDose | null;
    if (pt.form === 'continuous') {
      const len = Math.min(pt.repKm + q.tStepKm, top);
      t =
        len > pt.repKm + 1e-9
          ? { form: 'continuous', reps: 1, repKm: len }
          : (cruiseOf(b.T, 'base', p) ??
            (len + 1e-9 >= q.shortTMinKm ? { ...pt, repKm: len } : null));
    } else {
      const c = chooseProgressiveReps(
        b.T,
        q.repOptionsKm.Tcruise,
        p.T,
        q.minReps.T,
        q.maxReps.T,
        tMaxSec('base'),
        0,
        q.repFillShare,
        pt,
        'base'
      );
      t = c ? { form: 'cruise', ...c } : tWork(pt) <= b.T + 1e-9 ? pt : null;
    }
    if (t && prev?.kind === 'T' && sameT(t, pt)) t = tOther(pt, b.T, 'base', p);
    return t;
  };
  const want: 'R' | 'T' = prev?.kind === 'R' ? 'T' : 'R';
  const order: ('R' | 'T')[] = want === 'R' ? ['R', 'T'] : ['T', 'R'];
  for (const kind of order) {
    const notes =
      kind === want ? [] : [`Baza (3 dana): ${want} ne staje u budžet — ${kind} umesto njega.`];
    if (kind === 'R') {
      const r = pickR();
      if (r)
        return single(repsRSession('R', r, targetKm, p).workout, notes, {
          main: r,
          t: pt,
          same: 1,
          kind: 'R'
        });
    } else {
      const t = pickT();
      if (t)
        return single(tSession(t, targetKm, p).workout, notes, {
          main: pm,
          t,
          same: 1,
          kind: 'T'
        });
    }
  }
  return {
    ok: false,
    message: `Baza (3 dana): ni R (budžet ${km(b.R)} km) ni T (budžet ${km(b.T)} km) ne staje bez ponavljanja prethodne nedelje.`
  };
}

/**
 * 2.3.0, 3 dana, vrhunac: jedini kvalitet je I, neopadajući — najmanji rad veći od prethodnog; ako ga
 * nema, druga struktura istog ili većeg rada (nema drugog kvaliteta koji bi menjao strukturu).
 */
function peakWeekOne(
  b: QualityBudgets,
  targetKm: number,
  p: Paces,
  prev: WeekDose | null
): WeekQuality {
  const q = P.quality;
  const up = qualitySession('I', b.I, targetKm, p, 'peak', { prev: prev?.main ?? null });
  if (up.ok) return single(up.workout, [], { main: up.choice!, t: null, same: 1 });
  const pm = prev?.main;
  const alt = pm
    ? chooseProgressiveReps(
        b.I,
        q.repOptionsKm.I,
        p.I,
        q.minReps.I,
        q.maxReps.I,
        q.iRepMaxSec,
        q.iRepMinSec,
        q.mainMinShareOfBudget,
        pm,
        'alt'
      )
    : null;
  if (!alt) return { ok: false, message: up.message };
  return single(
    intervalSession('I', alt, targetKm, p).workout,
    ['Vrhunac (3 dana): I bez višeg nivoa u budžetu — ista doza, druga struktura.'],
    { main: alt, t: null, same: 1 }
  );
}

/**
 * Rasterećenje (2.2.0 Odluka 5; 2.3.0 Odluka 5): jedan glavni kvalitet; ako ne staje, kratak T
 * (≥ shortTMinKm), pa R samo ako je rad ≥ deloadSubstitute.minRKm; ako ništa od toga, kvalitet nedelje
 * su samo ubrzanja (stridesOnly) na laganom danu.
 */
function deloadWeek(
  f: WeekFrame,
  b: QualityBudgets,
  targetKm: number,
  p: Paces,
  main: QualityType
): WeekQuality {
  const budgetOf = (t: QualityType): number =>
    t === 'R' || t === 'R_sharpen' ? b.R : t === 'T_short' || t === 'T_cruise' ? b.T : b.I;
  const chain = [...new Set<QualityType>([main, 'T_short', 'R'])];
  const minR = P.quality.deloadSubstitute.minRKm;
  for (const type of chain) {
    const s = qualitySession(
      type,
      r2(budgetOf(type) * P.quality.deloadBudgetScale),
      targetKm,
      p,
      f.phase
    );
    if (!s.ok) continue;
    const sub = type !== main;
    if (sub && type === 'R' && s.workout.workKm.R + 1e-9 < minR) continue;
    return {
      ok: true,
      q1: s.workout,
      q2: null,
      easyStrides: sub,
      stridesOnly: false,
      notes: [
        sub
          ? `Rasterećenje: ${main} ne staje u budžet — ${type === 'R' ? 'R' : 'kratak T'} umesto njega, uz ubrzanja.`
          : 'Rasterećenje: jedan kratak kvalitet.'
      ],
      dose: null
    };
  }
  const so = P.quality.deloadSubstitute.stridesOnly;
  return {
    ok: true,
    q1: null,
    q2: null,
    easyStrides: false,
    stridesOnly: true,
    notes: [
      `Rasterećenje: ${main}, kratak T (≥ ${P.quality.shortTMinKm} km) ni R (≥ ${minR} km) ne staju u budžet — kvalitet nedelje su samo ubrzanja ${so.reps} × ${so.sec} s na laganom.`
    ],
    dose: null
  };
}

/**
 * Kvalitet nedelje treninga (baza, vrhunac, oštrenje, taper). JEDINO mesto odluke o dozi kvaliteta.
 * 2.3.0: broj kvaliteta iz tabele `days` (3 dana: jedan — baza R/T naizmenično, vrhunac I, oštrenje i
 * taper RP; 4 i 5 dana: dva, kao 2.2.0). Rasterećenje: deloadWeek. QUALITY_INFEASIBLE (ok: false)
 * samo kad nijedna opcija ne staje.
 */
export function weekQuality(
  f: WeekFrame,
  targetKm: number,
  p: Paces,
  prev: WeekDose | null,
  days: RunDaysCount,
  taperWeeks: number = P.phases.taperWeeks
): WeekQuality {
  const b = qualityBudgets(targetKm);
  const one = daysRule(days).qualityDays === 1;
  const main: Record<'base' | 'peak' | 'sharpen', QualityType> = {
    base: 'R',
    peak: 'I',
    sharpen: 'RP'
  };
  if (f.phase === 'base' || f.phase === 'peak' || f.phase === 'sharpen') {
    if (f.deload) {
      const d = deloadWeek(f, b, targetKm, p, main[f.phase]);
      return one && d.ok && !d.stridesOnly ? { ...d, easyStrides: true } : d;
    }
    if (f.phase === 'base')
      return one ? baseWeekOne(b, targetKm, p, prev) : baseWeek(b, targetKm, p, prev);
    if (f.phase === 'peak')
      return one ? peakWeekOne(b, targetKm, p, prev) : peakWeek(b, targetKm, p, prev);
    // 2.3.0: RP strogo raste; ako ponuda nema viši nivo u budžetu, ista ili veća doza druge strukture
    // (isto kao I u vrhuncu, 2.2.0 Odluka 5). Ranije: QUALITY_INFEASIBLE (npr. 15 km, 10 ned).
    const pm = prev?.main ?? null;
    let rp = qualitySession('RP', b.I, targetKm, p, 'sharpen', { prev: pm });
    const notes: string[] = [];
    if (!rp.ok && pm) {
      const q = P.quality;
      const alt = chooseProgressiveReps(
        b.I,
        q.repOptionsKm.RP,
        p.RP,
        q.minReps.RP,
        q.maxReps.RP,
        q.iRepMaxSec,
        0,
        q.mainMinShareOfBudget,
        pm,
        'alt'
      );
      if (alt) {
        rp = intervalSession('RP', alt, targetKm, p);
        notes.push('Oštrenje: RP bez višeg nivoa u budžetu — ista doza, druga struktura.');
      }
    }
    if (!rp.ok) return rp;
    const dose: WeekDose = { main: rp.choice!, t: null, same: 1 };
    if (one) return single(rp.workout, notes, dose);
    const rs = qualitySession('R_sharpen', b.R, targetKm, p, 'sharpen');
    if (!rs.ok) return rs;
    return {
      ok: true,
      q1: rp.workout,
      q2: rs.workout,
      easyStrides: false,
      stridesOnly: false,
      notes,
      dose
    };
  }
  const rp = qualitySession('RP', b.I, targetKm, p, f.phase);
  if (!rp.ok) return rp;
  const tp = `Taper ${f.taperStep}/${taperWeeks}`;
  if (one) return single(rp.workout, [`${tp}: jedan kvalitet (3 dana).`], null);
  if (f.taperStep === 1) {
    const t = qualitySession('T_short', b.T, targetKm, p, f.phase);
    if (!t.ok) return t;
    return {
      ok: true,
      q1: rp.workout,
      q2: t.workout,
      easyStrides: false,
      stridesOnly: false,
      notes: [`${tp}.`],
      dose: null
    };
  }
  return {
    ok: true,
    q1: rp.workout,
    q2: null,
    easyStrides: true,
    stridesOnly: false,
    notes: ['Taper 2/2: jedan kvalitet.'],
    dose: null
  };
}

/** Lagan trk; `strides` = ubrzanja (podrazumevano quality.strides, 2.3.0 i stridesOnly 6 × 20 s). */
export function easyRun(
  totalKm: number,
  p: Paces,
  withStrides: boolean,
  spec: { reps: number; sec: number; recoverySec: number } = P.quality.strides
): Workout {
  if (!withStrides)
    return buildWorkout(
      'easy',
      null,
      `Lagano ${km(totalKm)} km`,
      [{ kind: 'easy', km: totalKm }],
      p
    );
  const s = spec;
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
