/* Maraton v2 → aplikacija: formatiranje teksta prikaznih modela (iste vrednosti kao `marathon/format`,
   posebna kopija). */

import { isIsoDate, weekdayIndex } from './date.ts';

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Sekunde → `m:ss` ili `h:mm:ss`; nevažeće vreme daje „—". */
export function fmtClock(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return '—';
  const total = Math.round(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}

/** Broj sa zarezom kao decimalnim znakom i bez završnih nula; nebrojevna vrednost daje „—". */
export function fmtNum(n: unknown, dec = 1): string {
  if (n == null || typeof n === 'boolean' || typeof n === 'object') return '—';
  const x = +(n as number);
  if (!Number.isFinite(x)) return '—';
  const v = (Math.round(x * 10 ** dec) / 10 ** dec).toFixed(dec);
  return (v.includes('.') ? v.replace(/\.?0+$/, '') : v).replace('.', ',');
}

export const fmtKm = (n: unknown): string => fmtNum(n, 1);

/** „07.03." iz `YYYY-MM-DD`; nevažeći datum daje „—". */
export function fmtDayMonth(iso: string | null | undefined): string {
  if (!isIsoDate(iso)) return '—';
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
}

const DOW_SHORT = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'] as const;

/** Dan u nedelji iz datuma; nevažeći datum daje „—". */
export function dowShort(iso: string | null | undefined): string {
  return isIsoDate(iso) ? (DOW_SHORT[weekdayIndex(iso)] ?? '—') : '—';
}

/** Trajanje: „45 s", „2 min", „1:30 min" (celi minuti bez sekundi). */
export function fmtDuration(sec: number): string {
  if (sec < 60) return `${Math.round(sec)} s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s ? `${m}:${pad2(s)} min` : `${m} min`;
}
