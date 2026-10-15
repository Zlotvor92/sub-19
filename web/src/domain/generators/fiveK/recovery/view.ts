/* Kopija za generator `fiveK` (prenos procene stanja u generatore). Izvor: aplikacioni kod u trenutku prenosa
   (`5f56a52`); dalje se razvija samo ovde. */
/* PROCENA OPORAVKA: jutarnja merenja sa sopstvenom osnovom i tonovi signala, pojas opterećenja. Čiste funkcije. */

import type { WellnessRecord } from '../exchange';
import { ACWR_MAX, ACWR_RETURN } from './constants';

/* ------------------------------ jutarnja merenja ------------------------------ */

export interface WellnessDay extends WellnessRecord {
  hrvBaza7?: number;
  hrvOdstupanje?: number;
  pulsBaza7?: number;
  pulsOdstupanje?: number;
}

const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);

/**
 * Zapis oporavka za dati dan, sa 7-dnevnim prosekom HRV-a i pulsa u miru (pojedinačna vrednost HRV-a ne znači ništa bez
 * sopstvene osnove). Osnova traži bar 3 prethodna dana sa merenjem.
 */
export function wellnessFor(
  wellness: Readonly<Record<string, WellnessRecord>> | null | undefined,
  date: string | null | undefined
): WellnessDay | null {
  if (!wellness || !date) return null;
  const z = Object.prototype.hasOwnProperty.call(wellness, date) ? wellness[date] : undefined;
  if (!z) return null;
  const keys = Object.keys(wellness)
    .filter((k) => k < date)
    .sort()
    .slice(-7);
  const mean = (field: 'hrv' | 'pulsUMiru'): number | null => {
    const v = keys.map((k) => num(wellness[k]?.[field])).filter((x): x is number => x != null);
    return v.length >= 3 ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
  };
  const out: WellnessDay = { ...z };
  const hBase = mean('hrv');
  const pBase = mean('pulsUMiru');
  const hrv = num(z.hrv);
  const rhr = num(z.pulsUMiru);
  if (hBase != null && hrv != null) {
    out.hrvBaza7 = hBase;
    out.hrvOdstupanje = Math.round(((hrv - hBase) / hBase) * 1000) / 10;
  }
  if (pBase != null && rhr != null) {
    out.pulsBaza7 = pBase;
    out.pulsOdstupanje = Math.round((rhr - pBase) * 10) / 10;
  }
  return out;
}

/** Poslednjih `days` dana merenja, od najstarijeg. */
export function wellnessSeries(
  wellness: Readonly<Record<string, WellnessRecord>> | null | undefined,
  days = 60
): WellnessRecord[] {
  const w = wellness ?? {};
  return Object.keys(w)
    .sort()
    .slice(-days)
    .map((k) => w[k])
    .filter((x): x is WellnessRecord => !!x);
}

export type Tone = 'red' | 'amber' | 'green' | 'neutral';

/** Boja odstupanja od osnove u PROCENTIMA; `inverse` za puls u miru (rast je lošiji). */
export function deviationTone(p: number | null | undefined, inverse = false): Tone {
  if (p == null) return 'neutral';
  const v = inverse ? -p : p;
  if (v <= -10) return 'red';
  if (v <= -5) return 'amber';
  return 'green';
}

export const sleepTone = (h: number): Tone => (h < 6 ? 'red' : h < 7 ? 'amber' : 'green');
export const freshnessTone = (f: number): Tone => (f < -10 ? 'red' : f < 0 ? 'amber' : 'green');

/** Klizna sedmodnevna osnova (prosek poslednjih do 7 vrednosti, uključujući tekuću) — isprekidana linija na grafikonu. */
export function rollingBase(values: readonly number[]): number[] {
  return values.map((_, i) => {
    const seg = values.slice(Math.max(0, i - 6), i + 1);
    return seg.reduce((a, b) => a + b, 0) / seg.length;
  });
}

/* ------------------------------ opterećenje ------------------------------ */

/** Skala trake ide do 2,0 — granica 1,5 (na kojoj rizik naglo raste) mora biti UNUTAR slike. */
export const ACWR_SCALE = 2;
export const ACWR_HIGH = 1.5;
export const acwrPosition = (v: number): number =>
  Math.max(0, Math.min(100, (v / ACWR_SCALE) * 100));

export type AcwrBand = 'low' | 'ok' | 'high' | 'danger';
export function acwrBand(ratio: number): AcwrBand {
  if (ratio < ACWR_RETURN) return 'low';
  if (ratio <= ACWR_MAX) return 'ok';
  return ratio <= ACWR_HIGH ? 'high' : 'danger';
}

/** Odnos na TAČNO dve decimale sa zarezom („0,80", „1,30" su granice pojasa); `—` kad ga nema. */
export const acwrText = (v: number | null | undefined): string =>
  v == null || !Number.isFinite(v) ? '—' : v.toFixed(2).replace('.', ',');
