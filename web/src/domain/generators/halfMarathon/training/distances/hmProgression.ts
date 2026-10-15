/* Polumaraton — progresija praga i HM ritma po stazi pripreme.

   Dve staze:
   - `first` (prvi polumaraton / bez potvrđenog iskustva sa kvalitetom: beginner,
     returning, developing): kraći blokovi, duži oporavak, manji zbir rada.
   - `performance` (iskusan, polumaraton na rezultat): duži pragovski blokovi i HM
     ritam od faze vrhunca, kratak oporavak koji drži ritam.

   Svaka sesija se gradi iz CILJNIH MINUTA RADA, ne iz udela nedelje: zbir rada,
   dužina bloka i oporavak su eksplicitni i rastu kroz ciklus. Gornje granice ostaju
   one koje već važe za sve planove: T ≤ 10 % nedelje po treningu, RP ≤ 20 % nedelje
   i ≤ `racePaceBudget.maxKm`, kontinuirani prag ≤ `tempoMaxSec`, nedeljni omotač
   brzog rada (`maxWorkSec`). Progresija nikad ne menja propisani tempo.

   INTERNE HEURISTIKE (nisu objavljeni pragovi): ciljne minute, dužine blokova,
   oporavci i taper udeli ispod. Usmerene su redom veličine javnih programa
   (B.A.A. Half Level 1–3: odvojeni pragovski/intervalni dani i simulacije tempa
   trke; uobičajeni „cruise" format: ponavljanja na pragu uz ~1 min laganog
   trčanja) i moraju se potvrditi sa ljudskim trenerom na primerima. */

import { sessInt, sessTempo, wuCdForVolume } from '../sessions/build';
import { sessDesc } from '../sessions/calc';
import type { Intensity, QualityReadiness, SessionDay } from '../types';
import type { Phase } from './types';

export type HmTrack = 'first' | 'performance';

export const hmTrack = (readiness?: QualityReadiness): HmTrack =>
  readiness === 'experienced' ? 'performance' : 'first';

interface Ramp {
  /** Ciljne minute rada na početku/kraju progresije. */
  startMin: number;
  endMin: number;
  /** Željena dužina jednog bloka [min] na početku/kraju progresije. */
  blockStartMin: number;
  blockEndMin: number;
}

interface TrackPolicy {
  t: Ramp;
  rp: Ramp;
  /** Oporavak između pragovskih blokova [s] prema dužini bloka. */
  tRestSec(blockSec: number): number;
  /** Oporavak između blokova HM ritma [s] — lagano trčanje, ritam ostaje neprekidan. */
  rpRestSec(blockSec: number): number;
  /** Drugi pragovski dan u specifičnoj fazi: udeo ciljnih T minuta (održavanje). */
  tMaintenance: number;
}

export const HM_TRACKS: Readonly<Record<HmTrack, TrackPolicy>> = {
  first: {
    t: { startMin: 12, endMin: 22, blockStartMin: 4, blockEndMin: 10 },
    rp: { startMin: 10, endMin: 26, blockStartMin: 6, blockEndMin: 14 },
    tRestSec: (b) => (b <= 360 ? 75 : 90),
    rpRestSec: () => 90,
    tMaintenance: 0.7
  },
  performance: {
    t: { startMin: 18, endMin: 30, blockStartMin: 7, blockEndMin: 15 },
    rp: { startMin: 16, endMin: 34, blockStartMin: 9, blockEndMin: 20 },
    tRestSec: (b) => (b <= 480 ? 60 : b <= 720 ? 75 : 90),
    rpRestSec: (b) => (b <= 720 ? 60 : 75),
    tMaintenance: 0.75
  }
};

/** Nedeljni omotač brzog rada (udeo vremena trčanja na T-ili-brže, M upola, −10 % uz dugu
 *  ≥ 90 min). Zajednički podrazumevani je 13 % samo za iskusne; HM ga zamenjuje jer HM
 *  priprema nosi dva radna sistema (prag + HM ritam), a prvi HM dobija sopstveni, niži omotač
 *  umesto da stoji bez nedeljnog zbira. Interna heuristika. */
export const HM_WEEKLY_FAST_SHARE: Readonly<Record<HmTrack, number>> = {
  first: 0.12,
  performance: 0.14
};

/** Taper: udeo KRAJNJE ciljne doze (nivo vrhunca). Prva taper nedelja ~60 %/45 %,
 *  poslednja ~40 %/25 % — obim rada pada, tempo ostaje. */
export const HM_TAPER = {
  transition: { rp: 0.6, t: 0.45 },
  final: { rp: 0.4, t: 0.25 }
} as const;

/** Shortest continuous T/RP work that is still a session, not a token effort [km]. */
export const MIN_CONTINUOUS_KM = 1.5;
const INTENSITY: Readonly<Record<Intensity, number>> = { kons: 0.85, std: 1, agr: 1 };
const lerp = (r: Ramp, p: number, key: 'min' | 'block'): number =>
  key === 'min'
    ? r.startMin + (r.endMin - r.startMin) * p
    : r.blockStartMin + (r.blockEndMin - r.blockStartMin) * p;
const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

export interface HmCycle {
  qualW: number;
  /** Poslednja radna kvalitetna nedelja (pre tapera). */
  lastWorkingQualW: number;
  /** Prva kvalitetna nedelja faze vrhunca — od nje počinje HM ritam. */
  rpStartQualW: number;
}

export function hmCycle(
  qualW: number,
  qualWeeks: number,
  taperW: number,
  phase: (qualW: number, qualWeeks: number) => Phase
): HmCycle {
  const lastWorkingQualW = Math.max(1, qualWeeks - taperW - 1);
  let rpStartQualW = lastWorkingQualW;
  for (let q = 1; q <= lastWorkingQualW; q++)
    if (phase(q, qualWeeks) !== 'threshold') {
      rpStartQualW = q;
      break;
    }
  return { qualW, lastWorkingQualW, rpStartQualW };
}

/** Napredak praga: od prve kvalitetne do poslednje radne nedelje. */
export const thresholdProgress = (c: HmCycle): number =>
  clamp01((c.qualW - 1) / Math.max(1, c.lastWorkingQualW - 1));

/** Napredak HM ritma: od početka faze vrhunca do poslednje radne nedelje. */
export const racePaceProgress = (c: HmCycle): number =>
  clamp01((c.qualW - c.rpStartQualW) / Math.max(1, c.lastWorkingQualW - c.rpStartQualW));

export interface HmDoseInput {
  track: HmTrack;
  vol: number;
  intensity?: Intensity | undefined;
  /** Preostali nedeljni omotač brzog rada za ovaj dan [s]; samo smanjuje. */
  maxWorkSec?: number | undefined;
}

export interface HmBlocks {
  reps: number;
  repM: number;
}

/** Blok sme da bude do 25 % duži od željenog da bi zbir pogodio cilj (nikad kraći). */
const BLOCK_STRETCH = 1.25;

/** Celi blokovi najbliži cilju; ≥ 2 bloka, nikad iznad tvrde granice. Dužina bloka je
 *  između željene i +25 % (zaokruživanje ne skraćuje blok); kraća je samo kad dva
 *  željena bloka ne staju u granicu, i nikad ispod `minRepM`. */
export function fitBlocks(
  targetKm: number,
  blockKm: number,
  hardKm: number,
  minRepM: number
): HmBlocks | null {
  const hardM = hardKm * 1000 + 1e-6;
  const wanted = Math.max(minRepM, Math.round(blockKm * 10) * 100);
  if (2 * wanted > hardM) {
    const repM = Math.floor(hardM / 2 / 100) * 100;
    return repM >= minRepM ? { reps: 2, repM } : null;
  }
  let best: (HmBlocks & { miss: number }) | null = null;
  for (let repM = wanted; repM <= wanted * BLOCK_STRETCH + 1e-6; repM += 100) {
    if (2 * repM > hardM) break;
    const reps = Math.min(
      Math.max(2, Math.round((targetKm * 1000) / repM)),
      Math.floor(hardM / repM)
    );
    const miss = Math.abs(reps * repM - targetKm * 1000);
    // Ties keep the shorter (planned) block.
    if (!best || miss < best.miss - 1e-6) best = { reps, repM, miss };
  }
  return best && { reps: best.reps, repM: best.repM };
}

const NOTE = {
  t: 'Prag: razvoj kroz duže blokove i kratak oporavak u laganom trčanju.',
  tMaint: 'Prag (održavanje): kontinuirano, kontrolisan napor.',
  rp: 'HM ritam: blokovi na ciljnom ritmu, oporavak u laganom trčanju da ritam ostane neprekidan.',
  taper: 'Taper: manje rada, isti tempo — oštrina bez umora.'
} as const;

/** Pragovski blokovi („Tempo isprekidan") prema ciljnim minutama i dužini bloka. */
export function hmThresholdBlocks(
  dow: number,
  pT: number,
  targetMin: number,
  blockMin: number,
  x: HmDoseInput,
  note: string = NOTE.t
): SessionDay | null {
  const policy = HM_TRACKS[x.track];
  const hardKm = Math.min(x.vol * 0.1, (x.maxWorkSec ?? Infinity) / pT);
  const targetKm = Math.min(hardKm, (targetMin * 60 * INTENSITY[x.intensity ?? 'std']) / pT);
  const fit = fitBlocks(targetKm, Math.min(blockMin * 60, targetMin * 30) / pT, hardKm, 1000);
  if (!fit) return null;
  const [wu, cd] = wuCdForVolume(x.vol);
  const day = sessInt(
    dow,
    wu,
    fit.reps,
    fit.repM,
    pT,
    policy.tRestSec((fit.repM / 1000) * pT),
    Math.max(cd, 1),
    'Tempo isprekidan',
    'T'
  );
  return withNote(day, note);
}

/** Kontinuirani prag za održavanje; ≤ `tempoMaxSec`, ≤ 10 % nedelje. */
export function hmContinuousThreshold(
  dow: number,
  pT: number,
  targetMin: number,
  tempoMaxSec: number,
  x: HmDoseInput,
  note: string = NOTE.tMaint
): SessionDay | null {
  const hardKm = Math.min(x.vol * 0.1, tempoMaxSec / pT, (x.maxWorkSec ?? Infinity) / pT);
  const wanted = Math.max(
    MIN_CONTINUOUS_KM,
    (targetMin * 60 * INTENSITY[x.intensity ?? 'std']) / pT
  );
  const km = Math.floor(Math.min(hardKm, wanted) * 10) / 10;
  if (km < MIN_CONTINUOUS_KM) return null;
  const [wu, cd] = wuCdForVolume(x.vol);
  return withNote(sessTempo(dow, wu, km, pT, Math.max(cd, 1), 'Tempo', 'T'), note);
}

/** Blokovi na HM ritmu („Tempo trke"). */
export function hmRacePaceBlocks(
  dow: number,
  racePace: number,
  targetMin: number,
  blockMin: number,
  maxKm: number,
  x: HmDoseInput,
  note: string = NOTE.rp
): SessionDay | null {
  const policy = HM_TRACKS[x.track];
  const hardKm = Math.min(x.vol * 0.2, maxKm, (x.maxWorkSec ?? Infinity) / racePace);
  const targetKm = Math.min(hardKm, (targetMin * 60 * INTENSITY[x.intensity ?? 'std']) / racePace);
  const fit = fitBlocks(targetKm, Math.min(blockMin * 60, targetMin * 30) / racePace, hardKm, 1000);
  if (!fit) return null;
  const [wu, cd] = wuCdForVolume(x.vol);
  const day = sessInt(
    dow,
    wu,
    fit.reps,
    fit.repM,
    racePace,
    policy.rpRestSec((fit.repM / 1000) * racePace),
    Math.max(cd, 1),
    'Tempo trke',
    'RP'
  );
  return withNote(day, note);
}

function withNote(day: SessionDay, note: string): SessionDay {
  day.session.notes = note;
  day.desc = sessDesc(day.session);
  return day;
}

/** Ciljne minute i dužina bloka za tekuću nedelju. */
export function hmTargets(
  track: HmTrack,
  c: HmCycle
): { tMin: number; tBlockMin: number; rpMin: number; rpBlockMin: number } {
  const p = HM_TRACKS[track];
  const pt = thresholdProgress(c);
  const pr = racePaceProgress(c);
  return {
    tMin: lerp(p.t, pt, 'min'),
    tBlockMin: lerp(p.t, pt, 'block'),
    rpMin: lerp(p.rp, pr, 'min'),
    rpBlockMin: lerp(p.rp, pr, 'block')
  };
}

export { NOTE as HM_NOTES };
