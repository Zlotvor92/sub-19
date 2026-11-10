/* Konstrukcija treninga iz strukture. Km i trajanje se RAČUNAJU iz komponenti:
   - distanca zadata u km → km 'exact', vreme 'estimated' (iz tempa);
   - vreme zadato u s     → vreme 'exact', km 'estimated' (iz tempa);
   - lagano (E) se računa sredinom E opsega; oporavak ('jog') sporijom granicom E;
   - 2.4.0: deo po osećaju (blok sa `effort`) nema brojčani tempo (paceSecPerKm = null); km/trajanje
     su procenjeni sredinom E opsega (vreme × E tempo). */

import { daysRule, FIVE_K_V2_POLICY as P, type RunDaysCount } from './policy.ts';
import { userText } from './text.ts';
import type {
  Basis,
  BlockSpec,
  Effort,
  PaceModel,
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

/** E tempo (sredina opsega): lagano i procena km dela po osećaju. */
export const easyPaceOf = (p: PaceModel): number => Math.round((p.E.fast + p.E.slow) / 2);

function paceOf(zone: Zone | 'jog', p: PaceModel): number {
  if (zone === 'jog') return p.E.slow;
  if (zone === 'E') return easyPaceOf(p);
  if (p.vdot === null)
    throw new Error(`Plan po osećaju nema tempo zone ${zone} (nedostaje effort).`);
  return p[zone];
}

/** 2.4.0: deo sa `effort` je po osećaju — procena E tempom, bez brojčanog tempa. */
function feelOf(
  zone: Zone | 'jog',
  p: PaceModel,
  effort: Effort | undefined
): { pace: number; shown: number | null; effort?: Effort } {
  if (!effort || zone === 'jog') return { pace: paceOf(zone, p), shown: paceOf(zone, p) };
  return { pace: easyPaceOf(p), shown: null, effort };
}

function byKm(
  kind: Segment['kind'],
  zone: Zone | 'jog',
  km: number,
  p: PaceModel,
  effort?: Effort
): Segment {
  const f = feelOf(zone, p, effort);
  return {
    kind,
    zone,
    km: r2(km),
    sec: Math.round(km * f.pace),
    paceSecPerKm: f.shown,
    kmBasis: 'exact',
    secBasis: 'estimated',
    ...(f.effort ? { effort: f.effort } : {})
  };
}

function bySec(
  kind: Segment['kind'],
  zone: Zone | 'jog',
  sec: number,
  p: PaceModel,
  effort?: Effort
): Segment {
  const f = feelOf(zone, p, effort);
  return {
    kind,
    zone,
    km: r2(sec / f.pace),
    sec: Math.round(sec),
    paceSecPerKm: f.shown,
    kmBasis: 'estimated',
    secBasis: 'exact',
    ...(f.effort ? { effort: f.effort } : {})
  };
}

function segmentsOf(b: BlockSpec, p: PaceModel): Segment[] {
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
      return [byKm('race', 'RP', b.km, p, b.effort)];
    case 'test':
      return [byKm('test', 'RP', b.km, p, b.effort)];
    case 'reps': {
      const out: Segment[] = [];
      const kind = b.stride ? 'stride' : 'rep';
      for (let i = 0; i < b.reps; i++) {
        out.push(
          'km' in b.rep
            ? byKm(kind, b.zone, b.rep.km, p, b.effort)
            : bySec(kind, b.zone, b.rep.sec, p, b.effort)
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
  p: PaceModel
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
    // 5k-v2.11.0 (Z2): naslov u formatu teksta korisniku (text.userText).
    title: userText(title),
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

/** 5k-v2.13.0 (P4 S1): udeo I (uključujući RP) za cilj nedelje — poslednji red `iMaxShareByTargetKm` sa fromKm ≤ cilj. */
export function iMaxShareOf(targetKm: number): number {
  let share: number = P.quality.iMaxShareByTargetKm[0].share;
  for (const r of P.quality.iMaxShareByTargetKm) if (targetKm + 1e-9 >= r.fromKm) share = r.share;
  return share;
}

/** Budžet [km] = udeo × cilj nedelje, zaokružen NANIŽE na 10 m (zaokruživanje ne sme da probije udeo). */
export function qualityBudgets(targetKm: number): QualityBudgets {
  const floor2 = (x: number): number => Math.floor(x * 100 + 1e-9) / 100;
  return {
    I: floor2(targetKm * iMaxShareOf(targetKm)),
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

/** 5k-v2.15.0 (P8 c): budžet prvog I treninga posle R faze = budžet I × firstIShareOfBudget, naniže na 10 m (konstruktor
    sa rezultatom i po osećaju, validator PEAK_MAIN_FLOOR). */
export const firstIBudget = (budgetI: number): number =>
  Math.floor(budgetI * P.quality.firstIShareOfBudget * 100 + 1e-9) / 100;

/** 5k-v2.15.0 (P8 b, G2): zona rada vrste kvaliteta (granica rasterećenja/tapera po zoni). */
export function capZoneOf(type: QualityType): 'I' | 'RP' | 'T' | 'R' {
  if (type === 'R' || type === 'R_sharpen') return 'R';
  if (type === 'I') return 'I';
  if (type === 'T_short' || type === 'T_cruise') return 'T';
  return 'RP';
}

/** 5k-v2.15.0 (P8 G2): budžet [km] najnižeg nivoa lestvice vrste (najmanji smislen trening po pravilima: minReps ×
    najkraće dozvoljeno ponavljanje na tempu; kratak T: shortTMinKm / shortTShareOfBudget); Infinity = nema ga. */
export function firstLevelBudget(
  type: QualityType,
  p: Paces,
  phase: Phase,
  _targetKm = 0
): number {
  const q = P.quality;
  const reps = (opts: readonly number[], pace: number, min: number, maxSec: number, minSec = 0): number => {
    const ok = opts.filter((o) => o * pace <= maxSec + 1e-9 && o * pace + 1e-9 >= minSec);
    return ok.length ? Math.round(Math.min(...ok) * min * 100) / 100 : Infinity;
  };
  switch (type) {
    case 'R':
      return reps(q.repOptionsKm.R, p.R, q.minReps.R, q.rRepMaxSec);
    case 'R_sharpen':
      return reps(q.repOptionsKm.Rsharpen, p.R, q.minReps.R, q.rRepMaxSec);
    case 'I':
      return reps(q.repOptionsKm.I, p.I, q.minReps.I, q.iRepMaxSec, q.iRepMinSec);
    case 'RP':
      return reps(q.repOptionsKm.RP, p.RP, q.minReps.RP, q.iRepMaxSec);
    case 'T_cruise':
      return reps(q.repOptionsKm.Tcruise, p.T, q.minReps.T, tMaxSec(phase));
    case 'T_short':
      return Math.ceil((q.shortTMinKm / q.shortTShareOfBudget) * 100) / 100;
    case 'RP_sharpener':
      return q.raceSharpener.reps * q.raceSharpener.minRepKm;
    default:
      return Infinity;
  }
}

/** 5k-v2.15.0 (P8 dopuna G4): plafon jednog treninga u km = minuti rada (quality.minuteCap) / tempo zone; Infinity za
    vrste bez plafona (R, oštrenje trkačke nedelje — G5). */
export function minuteCapKm(type: QualityType, p: Paces): number {
  const m = P.quality.minuteCap;
  const km = (min: number, pace: number): number => Math.floor(((min * 60) / pace) * 100 + 1e-9) / 100;
  if (type === 'I') return km(p.vdot < m.iSlowVdot ? m.iSlowMin : m.iMin, p.I);
  if (type === 'RP') return km(m.rpMin, p.RP);
  if (type === 'T_short' || type === 'T_cruise') return km(m.tMin, p.T);
  return Infinity;
}

/** 5k-v2.15.0 (P8 G2, G4) — JEDNA funkcija plafona zone (sa rezultatom): min(max(udeo × cilj, prvi nivo), minuti);
    u trkačkoj nedelji bez prvog nivoa (G5). Kratak T: budžet je osnov za udeo (rad = udeo × budžet). */
export function zoneBudget(type: QualityType, budget0: number, p: Paces, phase: Phase): number {
  const first = phase === 'race' ? 0 : firstLevelBudget(type, p, phase);
  const cap = minuteCapKm(type, p);
  const capB = type === 'T_short' ? cap / P.quality.shortTShareOfBudget : cap;
  return Math.min(Math.max(budget0, Number.isFinite(first) ? first : 0), capB);
}

/** 5k-v2.15.0 (P8 b, G2): budžet sesije pod granicom zone `capWork` (rad u km; kratak T: rad = udeo budžeta, pa
    budžet = rad / shortTShareOfBudget) — min(budžet, max(granica, prvi nivo lestvice)). Bez granice: budžet. JEDINO
    mesto (rasterećenje i taper, sa rezultatom). */
export function cappedBudget(
  type: QualityType,
  budgetKm: number,
  capWork: number | undefined,
  p: Paces,
  phase: Phase
): number {
  if (capWork === undefined) return budgetKm;
  const cap = type === 'T_short' ? capWork / P.quality.shortTShareOfBudget : capWork;
  const floor2 = (x: number): number => Math.floor(x * 100 + 1e-9) / 100;
  return Math.min(budgetKm, Math.max(floor2(cap), firstLevelBudget(type, p, phase)));
}

export interface RepChoice {
  reps: number;
  repKm: number;
  /** 2.4.0 (Odluka 3): udeo oporavka I/RP (vreme ponavljanja ×); bez njega recovery.iTimeRatio / rpTimeRatio. */
  recRatio?: number;
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
  recRatio?: number;
}

const workOf = (c: RepChoice): number => Math.round(c.reps * c.repKm * 100) / 100;
/** 2.10.3 (08k, pouka 23): zadržana PRETHODNA doza staje u plafon trajanja ponavljanja na TEKUĆEM tempu (kao validator
    R_REP); posle sporijeg rezultata isti metri traju duže. */
const repFits = (c: { repKm: number }, paceSecPerKm: number, maxSec: number): boolean =>
  c.repKm * paceSecPerKm <= maxSec + 1e-9;

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

const recRatioOf = (type: 'I' | 'RP', c: RepChoice): number =>
  c.recRatio ?? (type === 'I' ? P.quality.recovery.iTimeRatio : P.quality.recovery.rpTimeRatio);

/** I ili RP ponavljanja iz izabranog para (oporavak vremenom, zaokružen). */
export function intervalSession(
  type: 'I' | 'RP',
  c: RepChoice,
  targetKm: number,
  p: Paces
): SessionResult & { ok: true } {
  const pace = type === 'I' ? p.I : p.RP;
  const band = warmupBand(targetKm);
  const recSec = roundRecoverySec(c.repKm * pace * recRatioOf(type, c));
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
      `T: ${t.reps} × ${m(t.repKm)} (oporavak ${rec} s)`,
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
  budget0: number,
  targetKm: number,
  p: Paces,
  phase: Phase,
  progression?: { prev: PrevDose | null }
): SessionResult {
  // 5k-v2.15.0 (P8 G2, G4): plafon zone = min(max(udeo × cilj nedelje, prvi nivo lestvice vrste), plafon minuta).
  const budgetKm = zoneBudget(type, budget0, p, phase);
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
      // 5k-v2.12.0 (T4): glavni I (vrhunac) / RP (oštrenje) trkača sa rezultatom — prvo najmanji korak naviše sa radom
      // ≥ peakMainMinShare budžeta; nema ga u ponudi → postojeći prag mainMinShareOfBudget (ne naglo, bez odbijanja).
      const c = progression
        ? ((phase === 'peak' || phase === 'sharpen'
            ? chooseProgressiveReps(...args, q.peakMainMinShare, progression.prev, 'strict')
            : null) ??
          chooseProgressiveReps(...args, q.mainMinShareOfBudget, progression.prev, 'strict'))
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
      // 5k-v2.15.0 (P8 dopuna G5): 2 jednake deonice, dužina deljiva sa 100 m (≥ 400 m), ukupno ≤ 12 min rada.
      const s = q.raceSharpener;
      // Budžet bira dužinu, ali ne ispod 400 m (najniži nivo); granica su minuti (G5).
      const byMin = Math.min(s.maxWorkSec / s.reps, q.iRepMaxSec) / p.RP;
      const fl = (x: number): number => Math.floor(x / s.stepKm + 1e-9) * s.stepKm;
      const repKm = Math.min(Math.max(fl(budgetKm / s.reps), s.minRepKm), fl(byMin));
      if (repKm + 1e-9 < s.minRepKm) return fail('Oštrenje RP');
      const c: RepChoice = { reps: s.reps, repKm: Math.round(repKm * 10) / 10 };
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
    default:
      // 2.4.0: treninzi po osećaju se grade u feel.ts.
      return { ok: false, message: `${type}: gradi se u feel.ts.` };
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
  /** 2.3.0, 3 dana u bazi: vrsta jedinog kvaliteta ove nedelje (naizmenično R/T). 2.4.0: i vrsta po
      osećaju (feel.ts) za naizmenične nedelje sa jednim kvalitetom. */
  kind?: 'R' | 'T' | FeelKind;
  /** 2.4.0: poslednja doza po vrsti treninga po osećaju u ovoj fazi (feel.ts). */
  feel?: Partial<Record<FeelKind, FeelDose>>;
  /** 2.4.0 (feel.ts): ključ nedeljne doze baze (baseDoseKey) za brojanje iste doze. */
  key?: string;
  /** 5k-v2.14.0 (P5 F2): R oštrenja (drugi kvalitet oštrenja) — za nedelju zadržane doze. */
  rs?: RepChoice;
}

/** 2.4.0: vrste kvaliteta bez brojčanog tempa (feel.ts); RP_SHORT = početnik sa rezultatom (VDOT RP). */
export type FeelKind = 'HILLS' | 'TEMPO' | 'FARTLEK_I' | 'FARTLEK_T' | 'FARTLEK_RP' | 'RP_SHORT';

/** 2.4.0: doza po osećaju: `reps` × `len` (s; za RP_SHORT km). */
export interface FeelDose {
  reps: number;
  len: number;
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
/** 2.4.0: oblik T bloka treninga — ponavljanja (> 1) = 'cruise', inače 'continuous'. */
export function tFormOf(w: Workout): TDose['form'] {
  return w.blocks.some((b) => b.kind === 'reps' && b.zone === 'T' && b.reps > 1)
    ? 'cruise'
    : 'continuous';
}

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

/** 5k-v2.14.0 (P5 F2, Odluka 10): napomena nedelje zadržane doze. */
export const HOLD_NOTE =
  'Doza kvaliteta ostaje kao prethodne nedelje: poslednja dva zahtevna treninga su bila preteška ili preskočena.';

/** 5k-v2.14.0 (P5 F2): zadržana doza ponavljanja — ista kao prethodna, ako staje u budžet nedelje i u najduže
    ponavljanje na tekućem tempu (pouka 23); inače null (postojeći izbor). */
function heldReps(
  prev: RepChoice | null,
  budgetKm: number,
  pace: number,
  maxSec: number
): RepChoice | null {
  return prev && workOf(prev) <= budgetKm + 1e-9 && repFits(prev, pace, maxSec) ? prev : null;
}

/** 5k-v2.14.0 (P5 F2): zadržan T — isti kao prethodni, ako staje u budžet i plafon T bloka faze. */
function heldT(prev: TDose | null, budgetKm: number, phase: Phase, p: Paces): TDose | null {
  return prev && tWork(prev) <= budgetKm + 1e-9 && Math.round(prev.repKm * p.T) <= tMaxSec(phase)
    ? prev
    : null;
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
  prev: WeekDose | null,
  hold = false
): WeekQuality {
  const q = P.quality;
  const rArgs = [b.R, q.repOptionsKm.R, p.R, q.minReps.R, q.maxReps.R, q.rRepMaxSec, 0] as const;
  const pm = prev?.main ?? null;
  const fits = (c: RepChoice, budget: number): boolean =>
    workOf(c) <= budget + 1e-9 && workOf(c) + 1e-9 >= budget * q.mainMinShareOfBudget;
  // 5k-v2.14.0 (P5 F2): nedelja zadržane doze — R i T kao prethodne nedelje (kad staju u budžet nedelje).
  const hr = hold ? heldReps(pm, b.R, p.R, q.rRepMaxSec) : null;
  const ht = hold ? heldT(prev?.t ?? null, b.T, 'base', p) : null;
  if (hr && ht)
    return {
      ok: true,
      q1: repsRSession('R', hr, targetKm, p).workout,
      q2: tSession(ht, targetKm, p).workout,
      easyStrides: true,
      stridesOnly: false,
      notes: [HOLD_NOTE],
      dose: { main: hr, t: ht, same: (prev?.same ?? 0) + 1 }
    };
  let r =
    chooseProgressiveReps(...rArgs, q.mainMinShareOfBudget, pm, pm ? 'grow' : 'base') ??
    (pm && fits(pm, b.R) && repFits(pm, p.R, q.rRepMaxSec) ? pm : null) ??
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
    notes: rDropNotes(b.R, pm, r),
    dose: { main: r, t, same }
  };
}

/** 2.8.0 (N2b, MASTER pouke 12/32): plafon R nedelje (budžet R = udeo × cilj) je ispod prethodne R doze — R pada na
    najveću strukturu koja staje; napomena (validator: upozorenje DOSE_DROPPED, isti plafon qualityBudgets). */
function rDropNotes(budgetR: number, pm: RepChoice | null, r: RepChoice): string[] {
  return pm && workOf(r) + 1e-9 < workOf(pm) && budgetR + 1e-9 < workOf(pm)
    ? [
        `R: manje nego prošle nedelje (${km(workOf(pm))} km) jer obim nedelje dozvoljava najviše ${km(budgetR)} km R — najveća podela koja staje.`
      ]
    : [];
}

/** 5k-v2.15.0 (P8 G3): da li ponuda ima veću dozu od `prev` (ponavljanja ≤ maxReps, trajanje u granicama) — tada
    dozu drži obim nedelje (budžet), inače kraj ponude. Napomena tvrdi samo ono što važi. */
function biggerInOffer(type: 'I' | 'RP', p: Paces, prev: PrevDose): boolean {
  const q = P.quality;
  const isI = type === 'I';
  const pace = isI ? p.I : p.RP;
  const w = workOf(prev);
  return (isI ? q.repOptionsKm.I : q.repOptionsKm.RP).some(
    (o) =>
      o * pace <= q.iRepMaxSec + 1e-9 &&
      o * pace + 1e-9 >= (isI ? q.iRepMinSec : 0) &&
      o * (isI ? q.maxReps.I : q.maxReps.RP) > w + 1e-9
  );
}

const why = (budget: boolean): string =>
  budget ? 'obim nedelje ne dozvoljava više' : 'to je najveća doza ovog treninga u planu';

const altNote = (what: string, c: RepChoice, budget = true): string =>
  `${what}: ista količina kao prošle nedelje (${why(budget)}), ${c.recRatio !== undefined ? 'kraći oporavak' : 'drugačija podela'}.`;

/**
 * 2.4.0 (Odluka 3): ista doza druge strukture za glavni I (vrhunac) / RP (oštrenje) kad ponuda nema viši
 * nivo u budžetu: (a) druga ponavljanja — rad ≥ prethodnog i ≥ 70% budžeta, ≤ budžet (npr. 2 × 700 →
 * 3 × 500); (b) ako ih nema (npr. brz trkač, mali budžet, I ≥ 2 min), ista ponavljanja sa kraćim
 * oporavkom (quality.denser: udeo − korak, ne ispod minimuma; drugačiji zaokružen oporavak). Nema ni
 * toga → null.
 */
function altMain(type: 'I' | 'RP', budgetKm: number, p: Paces, prev: PrevDose): RepChoice | null {
  const q = P.quality;
  const isI = type === 'I';
  const other = chooseProgressiveReps(
    budgetKm,
    isI ? q.repOptionsKm.I : q.repOptionsKm.RP,
    isI ? p.I : p.RP,
    isI ? q.minReps.I : q.minReps.RP,
    isI ? q.maxReps.I : q.maxReps.RP,
    q.iRepMaxSec,
    isI ? q.iRepMinSec : 0,
    q.mainMinShareOfBudget,
    prev,
    'alt'
  );
  if (other) return other;
  const w = workOf(prev);
  if (w > budgetKm + 1e-9 || w + 1e-9 < budgetKm * q.mainMinShareOfBudget) return null;
  const pace = isI ? p.I : p.RP;
  // 5k-v2.13.0 (P4, pouka 23): zadržane dužine ponavljanja staju u iRepMaxSec na TEKUĆEM tempu (posle sporijeg rezultata
  // isti metri traju duže; kao validator I_REP i baza R).
  if (!repFits(prev, pace, q.iRepMaxSec)) return null;
  const ratio = recRatioOf(type, prev) - q.denser.step;
  if (ratio + 1e-9 < q.denser.minRatio[type]) return null;
  const sec = (r: number): number => roundRecoverySec(prev.repKm * pace * r);
  if (sec(ratio) === sec(recRatioOf(type, prev))) return null;
  return { reps: prev.reps, repKm: prev.repKm, recRatio: ratio };
}

/**
 * Vrhunac (Odluka 5): glavni I NEOPADAJUĆI — najmanji rad veći od prethodnog; 2.4.0 (Odluka 3): ako
 * ponuda nema viši nivo, ista doza druge strukture (altMain); tek ako ni nje nema, I se drži (ako je i
 * dalje u [70%, 100%] budžeta), a T menja strukturu (cruise ↔ kontinuirano) da par ne bude identičan.
 * Drugi kvalitet: cruise kad T budžet prima ≥ minReps × najkraća opcija, inače kontinuirani T.
 */
function peakWeek(
  b: QualityBudgets,
  targetKm: number,
  p: Paces,
  prev: WeekDose | null,
  hold = false,
  test = false
): WeekQuality {
  const q = P.quality;
  const shortest0 = Math.min(...q.repOptionsKm.Tcruise);
  const tOf = (): TDose | null =>
    b.T + 1e-9 >= q.minReps.T * shortest0
      ? cruiseOf(b.T, 'peak', p)
      : tContinuousStart(b.T, 'peak', p);
  // 5k-v2.14.0 (P5 F1): nedelja kontrolnog trčanja (plan sa rezultatom) — test umesto I, drugi kvalitet T kao vrhunac;
  // stanje I slota ostaje iz nedelje pre testa (progresija se nastavlja od njega).
  if (test) {
    const t = (hold ? heldT(prev?.t ?? null, b.T, 'peak', p) : null) ?? tOf();
    if (!t)
      return { ok: false, message: `T: budžet ${km(b.T)} km nije dovoljan uz kontrolno trčanje.` };
    // 5k-v2.15.0 (P8 dopuna G7): test je jedini kvalitet nedelje — drugi dan lagan, stanje T slota ostaje.
    void t;
    return {
      ok: true,
      q1: testRun(targetKm, p),
      q2: null,
      easyStrides: true,
      stridesOnly: false,
      notes: [P.feel.resultTestWeekNote],
      dose: prev ? { ...prev } : { main: null, t: null, same: 1 }
    };
  }
  // 5k-v2.14.0 (P5 F2): nedelja zadržane doze — I i T kao prethodne nedelje.
  const hi = hold ? heldReps(prev?.main ?? null, b.I, p.I, q.iRepMaxSec) : null;
  const hts = hold ? heldT(prev?.t ?? null, b.T, 'peak', p) : null;
  if (hi && hts)
    return {
      ok: true,
      q1: intervalSession('I', hi, targetKm, p).workout,
      q2: tSession(hts, targetKm, p).workout,
      easyStrides: false,
      stridesOnly: false,
      notes: [HOLD_NOTE],
      dose: { main: hi, t: hts, same: 1 }
    };
  const up = qualitySession('I', b.I, targetKm, p, 'peak', { prev: prev?.main ?? null });
  let i: SessionResult & { ok: true };
  let held = false;
  const notes: string[] = [];
  const pm = prev?.main;
  const alt = !up.ok && pm ? altMain('I', b.I, p, pm) : null;
  if (up.ok) i = up;
  else if (alt) {
    i = intervalSession('I', alt, targetKm, p);
    notes.push(altNote('Vrhunac (I)', alt, biggerInOffer('I', p, pm!)));
  } else {
    const w = pm ? workOf(pm) : 0;
    // 5k-v2.13.0 (P4, pouka 23): zadržan I i dalje staje u iRepMaxSec na tekućem tempu.
    if (
      !pm ||
      w > b.I + 1e-9 ||
      w + 1e-9 < b.I * q.mainMinShareOfBudget ||
      !repFits(pm, p.I, q.iRepMaxSec)
    )
      return { ok: false, message: up.message };
    i = intervalSession('I', pm, targetKm, p);
    held = true;
    notes.push(
      `Vrhunac: I ostaje isti kao prošle nedelje (${biggerInOffer('I', p, pm) ? 'obim nedelje ne dozvoljava više ni drugačiju podelu' : 'to je najveća doza ovog treninga u planu'}); T se menja.`
    );
  }
  let t = tOf();
  if (held && t && prev?.t && sameT(t, prev.t)) t = tOther(prev.t, b.T, 'peak', p);
  if (!t)
    return {
      ok: false,
      message: `T: budžet ${km(b.T)} km nije dovoljan${held ? ' za promenu strukture uz zadržan I' : ''}.`
    };
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
  prev: WeekDose | null,
  hold = false
): WeekQuality {
  const q = P.quality;
  const rArgs = [b.R, q.repOptionsKm.R, p.R, q.minReps.R, q.maxReps.R, q.rRepMaxSec, 0] as const;
  const pm = prev?.main ?? null;
  const pt = prev?.t ?? null;
  // 5k-v2.14.0 (P5 F2): nedelja zadržane doze — vrsta na redu (naizmenično R/T) sa poslednjom dozom te vrste.
  if (hold) {
    const want0: 'R' | 'T' = prev?.kind === 'R' ? 'T' : 'R';
    const hr = want0 === 'R' ? heldReps(pm, b.R, p.R, q.rRepMaxSec) : null;
    const ht = want0 === 'T' ? heldT(pt, b.T, 'base', p) : null;
    if (hr)
      return single(repsRSession('R', hr, targetKm, p).workout, [HOLD_NOTE], {
        main: hr,
        t: pt,
        same: 1,
        kind: 'R'
      });
    if (ht)
      return single(tSession(ht, targetKm, p).workout, [HOLD_NOTE], {
        main: pm,
        t: ht,
        same: 1,
        kind: 'T'
      });
  }
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
      kind === want
        ? []
        : [`Osnovna faza: ${want} nema mesta u obimu nedelje — umesto njega ${kind}.`];
    if (kind === 'R') {
      const r = pickR();
      if (r)
        return single(
          repsRSession('R', r, targetKm, p).workout,
          [...notes, ...rDropNotes(b.R, pm, r)],
          {
            main: r,
            t: pt,
            same: 1,
            kind: 'R'
          }
        );
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
  prev: WeekDose | null,
  hold = false,
  test = false
): WeekQuality {
  // 5k-v2.14.0 (P5 F1): kontrolno trčanje je jedini kvalitet nedelje; stanje I slota ostaje (progresija od njega).
  if (test) return single(testRun(targetKm, p), [P.feel.resultTestWeekNote], prev);
  // 5k-v2.14.0 (P5 F2): zadržana doza — isti I kao prethodne nedelje.
  const hi = hold ? heldReps(prev?.main ?? null, b.I, p.I, P.quality.iRepMaxSec) : null;
  if (hi)
    return single(intervalSession('I', hi, targetKm, p).workout, [HOLD_NOTE], {
      main: hi,
      t: null,
      same: 1
    });
  const up = qualitySession('I', b.I, targetKm, p, 'peak', { prev: prev?.main ?? null });
  if (up.ok) return single(up.workout, [], { main: up.choice!, t: null, same: 1 });
  const pm = prev?.main;
  const alt = pm ? altMain('I', b.I, p, pm) : null;
  if (!alt) return { ok: false, message: up.message };
  return single(intervalSession('I', alt, targetKm, p).workout, [altNote('Vrhunac (I)', alt, biggerInOffer('I', p, pm!))], {
    main: alt,
    t: null,
    same: 1
  });
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
      cappedBudget(
        type,
        r2(budgetOf(type) * P.quality.deloadBudgetScale),
        f.qcap?.[capZoneOf(type)],
        p,
        f.phase
      ),
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
          ? `Rasterećenje: ${main} nema mesta u obimu nedelje — umesto njega ${type === 'R' ? 'R' : 'kratak T'}, uz ubrzanja.`
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
      `Rasterećenje: ${main}, kratak T (bar ${P.quality.shortTMinKm} km) ni R (bar ${minR} km) nemaju mesta u obimu nedelje — kvalitet nedelje su samo ubrzanja ${so.reps} × ${so.sec} s na laganom.`
    ],
    dose: null
  };
}

/**
 * Kvalitet nedelje treninga sa rezultatom (VDOT tempo, iskusan trkač); poziva ga samo weekQuality
 * (quality.ts), jedino mesto odluke o dozi kvaliteta.
 * 2.3.0: broj kvaliteta iz tabele `days` (3 dana: jedan — baza R/T naizmenično, vrhunac I, oštrenje i
 * taper RP; 4 i 5 dana: dva, kao 2.2.0). Rasterećenje: deloadWeek. QUALITY_INFEASIBLE (ok: false)
 * samo kad nijedna opcija ne staje.
 */
export function vdotWeekQuality(
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
    // 5k-v2.14.0 (P5 F2, Odluka 10): nedelja zadržane doze (steps.holdWeek); (F1) kontrolno trčanje u vrhuncu.
    const hold = f.hold === true;
    if (f.phase === 'base')
      return one ? baseWeekOne(b, targetKm, p, prev, hold) : baseWeek(b, targetKm, p, prev, hold);
    // 5k-v2.15.0 (P8 c): prvi I posle R faze — budžet I × firstIShareOfBudget (periodize.firstPeakIWeek).
    const bp = f.firstI ? { ...b, I: firstIBudget(b.I) } : b;
    if (f.phase === 'peak')
      return one
        ? peakWeekOne(bp, targetKm, p, prev, hold, f.test)
        : peakWeek(bp, targetKm, p, prev, hold, f.test);
    // 2.3.0: RP strogo raste; ako ponuda nema viši nivo u budžetu, ista ili veća doza druge strukture
    // (isto kao I u vrhuncu, 2.2.0 Odluka 5). Ranije: QUALITY_INFEASIBLE (npr. 15 km, 10 ned).
    const pm = prev?.main ?? null;
    const hrp = hold ? heldReps(pm, b.I, p.RP, P.quality.iRepMaxSec) : null;
    const hrs = hold ? heldReps(prev?.rs ?? null, b.R, p.R, P.quality.rRepMaxSec) : null;
    if (hrp && (one || hrs)) {
      const dose: WeekDose = { main: hrp, t: null, same: 1, ...(hrs ? { rs: hrs } : {}) };
      const w = intervalSession('RP', hrp, targetKm, p).workout;
      if (one) return single(w, [HOLD_NOTE], dose);
      return {
        ok: true,
        q1: w,
        q2: repsRSession('R_sharpen', hrs!, targetKm, p).workout,
        easyStrides: false,
        stridesOnly: false,
        notes: [HOLD_NOTE],
        dose
      };
    }
    let rp = qualitySession('RP', b.I, targetKm, p, 'sharpen', { prev: pm });
    const notes: string[] = [];
    if (!rp.ok && pm) {
      const alt = altMain('RP', b.I, p, pm);
      if (alt) {
        rp = intervalSession('RP', alt, targetKm, p);
        notes.push(altNote('Oštrenje (RP)', alt, biggerInOffer('RP', p, pm)));
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
      dose: { ...dose, ...(rs.choice ? { rs: rs.choice } : {}) }
    };
  }
  // 5k-v2.15.0 (P8 b): taper — RP i T pod granicom tapera (f.qcap), ne ispod prvog nivoa lestvice.
  const rp = qualitySession('RP', cappedBudget('RP', b.I, f.qcap?.RP, p, f.phase), targetKm, p, f.phase);
  if (!rp.ok) return rp;
  const tp =
    taperWeeks > 1
      ? `Smanjenje obima pred trku (${f.taperStep}. od ${taperWeeks} nedelje)`
      : 'Smanjenje obima pred trku';
  if (one) return single(rp.workout, [`${tp}: jedan kvalitet.`], null);
  if (f.taperStep === 1) {
    const t = qualitySession(
      'T_short',
      cappedBudget('T_short', b.T, f.qcap?.T, p, f.phase),
      targetKm,
      p,
      f.phase
    );
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
    notes: ['Smanjenje obima pred trku (2. od 2 nedelje): jedan kvalitet.'],
    dose: null
  };
}

/** Kontrolno trčanje (Odluka 5): WU, 3 km maksimalno ravnomerno, CD. Ne ulazi u udele I/T/R. 5k-v2.14.0 (P5 F1): isti
    test i u planu sa rezultatom (ovde da ga koriste oba izbora kvaliteta; feel.ts ga uvozi). */
export function testRun(targetKm: number, p: PaceModel): Workout {
  const band = warmupBand(targetKm);
  const e = P.feel.effort.test;
  const rpe = e.rpeMin === e.rpeMax ? `RPE ${e.rpeMin}` : `RPE ${e.rpeMin}–${e.rpeMax}`;
  return buildWorkout(
    'quality',
    'TEST_3K',
    `Kontrolno trčanje: ${P.feel.test.km} km ${e.cue} (${rpe})`,
    [
      { kind: 'warmup', km: band.warmupKm },
      { kind: 'test', km: P.feel.test.km, effort: e },
      { kind: 'cooldown', km: band.cooldownKm }
    ],
    p
  );
}

/** Lagan trk; `strides` = ubrzanja (podrazumevano quality.strides, 2.3.0 i stridesOnly 6 × 20 s). */
export function easyRun(
  totalKm: number,
  p: PaceModel,
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
    stride: true,
    // 2.4.0: bez rezultata ubrzanja su po osećaju; sa rezultatom R tempo (i za početnika).
    ...(p.vdot === null ? { effort: P.feel.effort.strides } : {})
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

export function longRun(totalKm: number, p: PaceModel): Workout {
  return buildWorkout(
    'long',
    null,
    `Dugi lagano ${km(totalKm)} km`,
    [{ kind: 'long', km: totalKm }],
    p
  );
}

/**
 * 5k-v2.15.0 (P8 d) — JEDINO mesto WU/CD trkačkog dana: pojas za vrh obima plana (`peakKm`, warmupBand), pa ako bi
 * trkački dan (WU + 5 km + CD) bio ≥ najdužeg treninga plana (`longestKm`), prvi pojas, pa warmup.raceMin; ni tada
 * kraći → raceMin (ne može se izbeći). Konstruktor (generate) i validator (WARMUP) čitaju istu funkciju.
 */
export function raceWarmup(
  peakKm: number,
  longestKm: number
): { warmupKm: number; cooldownKm: number } {
  const race = P.paces.raceDistanceM / 1000;
  const min = P.warmup.raceMin;
  for (const b of [warmupBand(peakKm), P.warmup.bands[0], min])
    if (b.warmupKm + race + b.cooldownKm + 1e-9 < longestKm)
      return { warmupKm: b.warmupKm, cooldownKm: b.cooldownKm };
  return { warmupKm: min.warmupKm, cooldownKm: min.cooldownKm };
}

/** 2.4.0: bez rezultata trka je po osećaju (trajanje procenjeno E tempom — gornja granica). 5k-v2.15.0: WU/CD iz
    raceWarmup. */
export function raceDay(p: PaceModel, band: { warmupKm: number; cooldownKm: number }): Workout {
  return buildWorkout(
    'race',
    null,
    'Trka 5K',
    [
      { kind: 'warmup', km: band.warmupKm },
      {
        kind: 'race',
        km: P.paces.raceDistanceM / 1000,
        ...(p.vdot === null ? { effort: P.feel.effort.race } : {})
      },
      { kind: 'cooldown', km: band.cooldownKm }
    ],
    p
  );
}
