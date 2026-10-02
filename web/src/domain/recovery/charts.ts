/* GEOMETRIJA GRAFIKONA OPORAVKA (HRV, puls u miru, masa, bol). Čisto: brojevi → tačke; crtanje je u komponenti.
   Koordinate su u prostoru SVG-a (viewBox 340 × visina). */

import { addDays, diffDays, parseIsoDate, type IsoDate } from '../date';
import type { PainRecord, WeightRecord, WellnessRecord } from '../state/types';
import { rollingBase } from './view';

export interface Pt {
  x: number;
  y: number;
}

export interface SeriesModel<T> {
  width: number;
  height: number;
  left: number;
  right: number;
  bottom: number;
  top: number;
  items: Array<{ rec: T; value: number; x: number; y: number }>;
  base: Pt[];
  baseValues: number[];
}

type Geometry = { W: number; H: number; L: number; R: number; B: number; T: number };
const SERIES_GEO: Geometry = { W: 340, H: 156, L: 30, R: 8, B: 132, T: 28 };

/**
 * Niz merenja kroz vreme sa klizavom sedmodnevnom osnovom. `range` bira raspon ose: HRV je procentualan (±6%), puls u miru se
 * kreće u uskom pojasu (44–48), pa mu je raspon ±2 otkucaja (tesno skaliranje bi od dva otkucaja razlike napravilo planinu).
 * `null` kad ima manje od 4 tačke (grafikon se tada ne crta).
 */
export function seriesModel(
  records: readonly WellnessRecord[],
  field: 'hrv' | 'pulsUMiru',
  range: 'percent' | 'beats'
): SeriesModel<WellnessRecord> | null {
  const v = records.filter((x) => x && typeof x[field] === 'number');
  if (v.length < 4) return null;
  const { W, H, L, R, B, T } = SERIES_GEO;
  const vals = v.map((x) => x[field] as number);
  const lo = range === 'percent' ? Math.min(...vals) * 0.94 : Math.min(...vals) - 2;
  const hi = range === 'percent' ? Math.max(...vals) * 1.06 : Math.max(...vals) + 2;
  const X = (i: number): number => L + (v.length === 1 ? 0 : (i / (v.length - 1)) * (W - L - R));
  const Y = (y: number): number => B - ((y - lo) / Math.max(hi - lo, 1)) * (B - T);
  const baseValues = rollingBase(vals);
  return {
    width: W,
    height: H,
    left: L,
    right: R,
    bottom: B,
    top: T,
    items: v.map((rec, i) => ({ rec, value: vals[i] as number, x: X(i), y: Y(vals[i] as number) })),
    base: baseValues.map((b, i) => ({ x: X(i), y: Y(b) })),
    baseValues
  };
}

export interface WeightModel {
  width: number;
  height: number;
  left: number;
  right: number;
  bottom: number;
  top: number;
  /** Vrednosti na osi (5 podeoka, od najmanje). */
  ticks: Array<{ value: number; y: number }>;
  /** Tri oznake datuma na osi (početak, sredina, kraj). */
  dateLabels: Array<{ date: IsoDate; x: number }>;
  items: Array<{ rec: WeightRecord; x: number; y: number }>;
}

/**
 * Masa kroz vreme. X-OSA JE VREME, NE NEDELJA PLANA: merenja pre početka plana (masa se meri i van priprema) bi se klemovala
 * na N1 i slagala u jednu uspravnu liniju. Osa ide od prvog merenja do danas (ili poslednjeg merenja, ako je kasnije), a kraća
 * od sedam dana se proširuje za po tri dana. `null` kad nema merenja.
 */
export function weightModel(list: readonly WeightRecord[], today: IsoDate): WeightModel | null {
  const act = list
    .filter((a) => a && parseIsoDate(a.date) && Number.isFinite(a.kg))
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!act.length) return null;
  const W = 340;
  const H = 168;
  const L = 30;
  const R = 8;
  const B = 146;
  const T = 26;
  const vals = act.map((a) => a.kg);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  const pad = Math.max((max - min) * 0.15, 1);
  min = Math.floor(min - pad);
  max = Math.ceil(max + pad);
  if (max - min < 2) max = min + 2;
  let d0 = act[0]?.date as IsoDate;
  let d1 = act[act.length - 1]?.date as IsoDate;
  if (today > d1 && today > d0) d1 = today;
  if (diffDays(d0, d1) < 7) {
    d0 = addDays(d0, -3);
    d1 = addDays(d1, 3);
  }
  const span = Math.max(1, diffDays(d0, d1));
  const X = (dt: string): number =>
    L + Math.max(0, Math.min(1, diffDays(d0, dt as IsoDate) / span)) * (W - L - R);
  const Y = (v: number): number =>
    B - ((Math.max(min, Math.min(max, v)) - min) / (max - min)) * (B - T);
  return {
    width: W,
    height: H,
    left: L,
    right: R,
    bottom: B,
    top: T,
    ticks: [0, 1, 2, 3, 4].map((k) => {
      const value = min + ((max - min) * k) / 4;
      return { value, y: Y(value) };
    }),
    dateLabels: [0, 0.5, 1].map((f) => {
      const date = addDays(d0, Math.round(span * f));
      return { date, x: X(date) };
    }),
    items: act.map((rec) => ({ rec, x: X(rec.date), y: Y(rec.kg) }))
  };
}

export interface PainModel {
  width: number;
  height: number;
  left: number;
  right: number;
  bottom: number;
  top: number;
  /** Prva i poslednja oznaka datuma na osi. */
  from: IsoDate;
  to: IsoDate;
  yOf: (v: number) => number;
  items: Array<{ rec: PainRecord; x: number; y: number }>;
}

/** Bol (0–10) kroz vreme, od prvog unosa do danas (ili poslednjeg unosa, ako je kasnije). `null` bez unosa. */
export function painModel(list: readonly PainRecord[], today: IsoDate): PainModel | null {
  const es = list
    .filter((e) => e && parseIsoDate(e.date))
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!es.length) return null;
  const W = 340;
  const H = 160;
  const L = 22;
  const R = 8;
  const B = 136;
  const T = 26;
  const d0 = es[0]?.date as IsoDate;
  const last = es[es.length - 1]?.date as IsoDate;
  const d1 = last > today ? last : today;
  const span = Math.max(diffDays(d0, d1), 1);
  const X = (d: string): number => L + (diffDays(d0, d as IsoDate) / span) * (W - L - R);
  const Y = (v: number): number => B - (v / 10) * (B - T);
  return {
    width: W,
    height: H,
    left: L,
    right: R,
    bottom: B,
    top: T,
    from: d0,
    to: d1,
    yOf: Y,
    items: es.map((rec) => ({ rec, x: X(rec.date), y: Y(rec.pain) }))
  };
}
