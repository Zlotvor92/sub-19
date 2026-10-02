/* PRIKAZ TRKE: referentne vrednosti plana, napredak ka cilju, geometrija grafikona (VDOT, predikcija kroz plan, prosečan tempo).

   Referentne vrednosti (početni VDOT, cilj, distanca) dolaze ISKLJUČIVO iz `meta` plana. Stari kod je za planove bez njih
   padao na vlasnikove tvrdo kodovane brojeve (PB 20:37, cilj 19:30) — na tuđem planu to je bilo pogrešno; ovde ih nema. */

import type { LogEntry, VdotRecord } from '../state/types';
import { planBaselineVdot } from '../plan/baseline';
import { sessKind } from '../plan/describe';
import type { ResolvedPlan } from '../plan/types';
import type { PredictionSummary } from '../training/prediction/summary';
import type { PredictionRow } from '../training/types';
import { raceTimeForVdot } from '../training/vdot/racePrediction';

const fin = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

export interface RaceRefs {
  /** Polazna forma plana (VDOT iz PB-a); `null` ako plan nema polaznu tačku. */
  baselineVdot: number | null;
  goalVdot: number | null;
  /** Ciljno vreme (s); `null` kad plan nema cilj. */
  goalSec: number | null;
  raceDistM: number;
  raceName: string;
}

export function raceRefs(meta: Readonly<Record<string, unknown>> | null | undefined): RaceRefs {
  const m = meta ?? {};
  return {
    baselineVdot: planBaselineVdot(m),
    goalVdot: fin(m['goalVdot']) ? m['goalVdot'] : fin(m['vdotGoal']) ? m['vdotGoal'] : null,
    goalSec: fin(m['goalSec']) ? m['goalSec'] : fin(m['predictedSec']) ? m['predictedSec'] : null,
    raceDistM: fin(m['raceDistM']) && m['raceDistM'] ? m['raceDistM'] : 5000,
    raceName: typeof m['raceName'] === 'string' && m['raceName'] ? m['raceName'] : 'trke'
  };
}

/**
 * Koliko je od puta „polazna forma → cilj" pređeno. Polazna tačka je vreme koje odgovara POČETNOM VDOT-u (ista referenca koju crta
 * VDOT grafikon). Vraća i vrednosti van [0, 1]: ispod nule znači da je predikcija sporija od polazne.
 */
export function goalShare(sec: number | null, refs: RaceRefs): number | null {
  if (sec == null || refs.goalSec == null || refs.baselineVdot == null) return null;
  const base = raceTimeForVdot(refs.baselineVdot, refs.raceDistM);
  if (!Number.isFinite(base) || base <= refs.goalSec) return null;
  return (base - sec) / (base - refs.goalSec);
}

export type RingTone = 'none' | 'good' | 'behind';

export interface HeroRing {
  /** Vreme u prstenu; `null` — nema unosa. */
  sec: number | null;
  share: number;
  tone: RingTone;
  /** Natpis ispod imena: „37% do cilja", „cilj dostignut", „iza polazne", „još nema unosa". */
  sub: string;
}

/** Prsten heroja. Prazan prsten je INFORMACIJA (ništa se nije pomerilo), ne greška. */
export function heroRing(sec: number | null, refs: RaceRefs): HeroRing {
  const u = goalShare(sec, refs);
  const reached = sec != null && refs.goalSec != null && sec <= refs.goalSec;
  const tone: RingTone = sec == null ? 'none' : reached || (u != null && u > 0) ? 'good' : 'behind';
  const sub =
    sec == null
      ? 'još nema unosa'
      : reached
        ? 'cilj dostignut'
        : u == null
          ? ''
          : u <= 0
            ? 'iza polazne'
            : `${Math.round(u * 100)}% do cilja`;
  return { sec, share: u ?? 0, tone, sub };
}

/* ------------------------------ VDOT kroz vreme ------------------------------ */

export interface VdotTrendModel {
  width: number;
  height: number;
  left: number;
  right: number;
  bottom: number;
  top: number;
  goalY: number;
  baseY: number;
  items: Array<{ rec: VdotRecord; x: number; y: number }>;
}

/** Trend forme. Raspon ose obuhvata polaznu formu, cilj i sve izmerene vrednosti (±1). `null` ispod dva zapisa. */
export function vdotTrendModel(
  log: readonly VdotRecord[],
  baseline: number,
  goal: number
): VdotTrendModel | null {
  const vl = log
    .filter((e) => e && fin(e.vdot) && typeof e.ts === 'string')
    .slice()
    .sort((a, b) => (String(a.ts) < String(b.ts) ? -1 : 1));
  if (vl.length < 2) return null;
  const W = 340;
  const H = 166;
  const L = 32;
  const R = 8;
  const B = 142;
  const T = 26;
  const vals = vl.map((e) => e.vdot as number);
  const lo = Math.min(baseline, goal, ...vals) - 1;
  const hi = Math.max(baseline, goal, ...vals) + 1;
  const X = (i: number): number => L + (vl.length === 1 ? 0 : (i / (vl.length - 1)) * (W - L - R));
  const Y = (v: number): number => B - ((v - lo) / (hi - lo)) * (B - T);
  return {
    width: W,
    height: H,
    left: L,
    right: R,
    bottom: B,
    top: T,
    goalY: Y(goal),
    baseY: Y(baseline),
    items: vl.map((rec, i) => ({ rec, x: X(i), y: Y(rec.vdot as number) }))
  };
}

/* ------------------------------ predikcija kroz plan ------------------------------ */

export interface PredictionChartModel {
  width: number;
  height: number;
  left: number;
  right: number;
  bottom: number;
  top: number;
  /** Podeoci ose (minuti), od najnižeg. */
  ticks: Array<{ minutes: number; y: number }>;
  goalY: number | null;
  /** Plan (referenca): jedna tačka po redu plana. */
  planLine: Array<{ x: number; y: number }>;
  /** Ostvareno: redovi sa predikcijom, do zadnjeg unosa (crvena linija staje tamo, kao i broj iznad). */
  entries: Array<{ index: number; x: number; y: number; pred: number }>;
  tests: Array<{ x: number; y: number }>;
}

/**
 * Predikcija kroz plan. Osa je DINAMIČKA: ranije tvrdo kodovana na 17,8–22,8 min, pa su se HM/maratonska vremena (220–231 min)
 * klemovala uz gornju ivicu u ravnu liniju. `null` kad nema nijedne vrednosti.
 */
export function predictionChartModel(
  rows: ReadonlyArray<Pick<PredictionRow, 'p5k' | 'w'>>,
  summary: Pick<PredictionSummary, 'rows' | 'tests' | 'lastRow'>,
  goalSec: number | null
): PredictionChartModel | null {
  const W = 340;
  const H = 168;
  const L = 36;
  const R = 8;
  const B = 144;
  const T = 26;
  const goalMin = goalSec != null ? goalSec / 60 : null;
  const vals: number[] = [];
  rows.forEach((r) => {
    if (fin(r.p5k)) vals.push(r.p5k / 60);
  });
  summary.rows.forEach((x) => {
    if (fin(x.pred)) vals.push(x.pred / 60);
  });
  if (goalMin != null) vals.push(goalMin);
  if (!vals.length) return null;
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  const pad = Math.max((hi - lo) * 0.12, 0.35);
  lo -= pad;
  hi += pad;
  if (hi - lo < 0.1) hi = lo + 0.1;
  const nP = rows.length;
  const X = (i: number): number => L + (nP <= 1 ? 0 : i / (nP - 1)) * (W - L - R);
  const Y = (m: number): number => B - ((Math.max(lo, Math.min(hi, m)) - lo) / (hi - lo)) * (B - T);
  const lastIdx = summary.lastRow ? summary.rows.indexOf(summary.lastRow) : -1;
  const entries = summary.rows
    .map((x, i) => ({ p: x.pred, i }))
    .filter((x): x is { p: number; i: number } => x.p != null && (lastIdx < 0 || x.i <= lastIdx))
    .map((x) => ({ index: x.i, x: X(x.i), y: Y(x.p / 60), pred: x.p }));
  return {
    width: W,
    height: H,
    left: L,
    right: R,
    bottom: B,
    top: T,
    ticks: [0, 0.25, 0.5, 0.75, 1].map((f) => {
      const minutes = lo + (hi - lo) * f;
      return { minutes, y: Y(minutes) };
    }),
    goalY: goalMin != null ? Y(goalMin) : null,
    planLine: rows.map((r, i) => ({ x: X(i), y: Y((r.p5k ?? 0) / 60) })),
    entries,
    tests: summary.tests
      .filter((t) => t.pred != null)
      .map((t) => {
        let i = rows.findIndex((r) => r.w >= t.r.w);
        if (i < 0) i = nP - 1;
        return { x: X(i), y: Y((t.pred as number) / 60) };
      })
  };
}

/* ------------------------------ prosečan tempo ------------------------------ */

export interface RunPoint {
  date: string;
  /** s/km. */
  t: number;
  km: number;
  sec: number;
  kind: string;
}

/** Odrađena trčanja sa kilometražom i vremenom, od najstarijeg. */
export function completedRuns(
  plan: ResolvedPlan,
  log: Readonly<Record<string, LogEntry>>,
  alts: Readonly<Record<string, unknown>>
): RunPoint[] {
  const runs: RunPoint[] = [];
  for (const w of plan.weeks)
    for (const d of w.days) {
      const l = log[d.id];
      if (l && l.status === 'done' && (l.km ?? 0) > 0 && (l.sec ?? 0) > 0) {
        const km = l.km as number;
        const sec = l.sec as number;
        runs.push({
          date: l.ts || d.date || '',
          t: sec / km,
          km,
          sec,
          kind: sessKind(d, !!alts[d.id])
        });
      }
    }
  return runs.sort((a, b) => (a.date < b.date ? -1 : 1));
}

export interface PaceChartModel {
  width: number;
  height: number;
  left: number;
  right: number;
  bottom: number;
  top: number;
  ticks: Array<{ sec: number; y: number }>;
  items: Array<{ run: RunPoint; x: number; y: number }>;
}

/** Tempo svakog trčanja kroz vreme (gore = brže). `null` bez trčanja. */
export function paceChartModel(runs: readonly RunPoint[]): PaceChartModel | null {
  if (!runs.length) return null;
  const W = 340;
  const H = 168;
  const L = 38;
  const R = 10;
  const B = 144;
  const T = 28;
  let lo = Math.min(...runs.map((r) => r.t)) - 15;
  let hi = Math.max(...runs.map((r) => r.t)) + 15;
  if (hi - lo < 50) {
    const m = (hi + lo) / 2;
    lo = m - 25;
    hi = m + 25;
  }
  const X = (i: number): number =>
    runs.length > 1 ? L + (i / (runs.length - 1)) * (W - L - R) : L + (W - L - R) / 2;
  const Y = (v: number): number => T + ((v - lo) / (hi - lo)) * (B - T);
  return {
    width: W,
    height: H,
    left: L,
    right: R,
    bottom: B,
    top: T,
    ticks: [lo + (hi - lo) * 0.12, (lo + hi) / 2, hi - (hi - lo) * 0.12].map((sec) => ({
      sec,
      y: Y(sec)
    })),
    items: runs.map((run, i) => ({ run, x: X(i), y: Y(run.t) }))
  };
}
