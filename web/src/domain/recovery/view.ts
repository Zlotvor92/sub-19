/* PRIKAZ OPORAVKA: jutarnja merenja sa sopstvenom osnovom, masa, nivoi bola po delu tela, pojas opterećenja. Čiste funkcije. */

import { addDays, diffDays, parseIsoDate, type IsoDate } from '../date';
import { leadingNumber } from '../lib/number';
import type { LogEntry, PainRecord, WeightRecord, WellnessRecord } from '../state/types';
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

/* ------------------------------ telesna masa ------------------------------ */

export const WEIGHT_MIN = 20;
export const WEIGHT_MAX = 300;

export type WeightResult =
  { ok: true; kg: WeightRecord[]; value: number } | { ok: false; err: string };

/**
 * Ručno merenje. Za isti datum ručni unos ZAMENJUJE prethodni ručni (jedno jutarnje merenje po danu); merenje uneto uz
 * trening (`src`) ostaje. Datum u budućnosti i masa van [20, 300] se odbijaju sa razlogom.
 */
export function addWeight(
  list: readonly WeightRecord[],
  date: string,
  input: string | null | undefined,
  today: string
): WeightResult {
  if (!parseIsoDate(date)) return { ok: false, err: 'Datum nije ispravan.' };
  if (date > today) return { ok: false, err: 'Datum je u budućnosti.' };
  const kg = leadingNumber(
    String(input ?? '')
      .trim()
      .replace(',', '.')
  );
  if (!Number.isFinite(kg) || kg < WEIGHT_MIN || kg > WEIGHT_MAX)
    return { ok: false, err: `Masa mora biti između ${WEIGHT_MIN} i ${WEIGHT_MAX} kg.` };
  const value = Math.round(kg * 10) / 10;
  const next = list.filter((x) => !(x && x.src == null && x.date === date));
  next.push({ date, kg: value });
  next.sort((a, b) => (a.date < b.date ? -1 : 1));
  return { ok: true, kg: next, value };
}

export interface WeightRemoval {
  kg: WeightRecord[];
  /** Dani čiji unos u dnevniku nosi tu masu: polje `kg` se mora ukloniti (inače ga treningu vraća sinhronizacija). */
  detach: string[];
}

/** Brisanje merenja po mestu u nizu; merenje vezano za trening skida masu i sa treninga. */
export function deleteWeight(list: readonly WeightRecord[], index: number): WeightRemoval | null {
  const x = list[index];
  if (!x) return null;
  return {
    kg: list.filter((_, i) => i !== index),
    detach: x.src ? [x.src] : []
  };
}

/** Brisanje svih merenja pre datuma (merenja iz vremena pre plana). */
export function deleteWeightsBefore(list: readonly WeightRecord[], date: string): WeightRemoval {
  return {
    kg: list.filter((x) => !(x && x.date < date)),
    detach: list.filter((x) => x && x.date < date && x.src).map((x) => x.src as string)
  };
}

/** Skida polje `kg` sa unosa u dnevniku (v. `WeightRemoval.detach`). */
export function detachWeightFromLog(
  log: Readonly<Record<string, LogEntry>>,
  ids: readonly string[]
): Record<string, LogEntry> {
  const next: Record<string, LogEntry> = { ...log };
  for (const id of ids) {
    const e = next[id];
    if (e && e['kg'] != null) {
      const { kg: _kg, ...rest } = e;
      next[id] = rest;
    }
  }
  return next;
}

/* ------------------------------ bol po delu tela ------------------------------ */

/** Najnoviji nivo bola za deo tela u poslednjih `days` dana; `null` kad nema unosa. */
export function partLevel(
  pain: readonly PainRecord[] | null | undefined,
  part: string,
  today: IsoDate,
  days = 14
): number | null {
  const from = addDays(today, -days);
  const es = (pain ?? [])
    .filter((k) => k.part === part && k.date >= from && k.date <= today)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  return es[0] ? es[0].pain : null;
}

export type PainClass = '' | 'l0' | 'l1' | 'l2' | 'l3';
export const painClass = (v: number | null): PainClass =>
  v == null ? '' : v >= 6 ? 'l3' : v >= 3 ? 'l2' : v >= 1 ? 'l1' : 'l0';

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

/** Koliko dana ima od datuma do danas — za osu vremena na grafikonima. */
export const daysBetween = (from: string, to: string): number | null => {
  const a = parseIsoDate(from);
  const b = parseIsoDate(to);
  return a && b ? diffDays(a, b) : null;
};
