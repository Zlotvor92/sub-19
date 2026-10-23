/* Kalendarska aritmetika nad ISO datumima (YYYY-MM-DD) bez `Date`: broj dana od 1970-01-01
   po algoritmu „days from civil" (H. Hinnant). Nezavisno od vremenske zone i sata. */

import type { IsoDate, Weekday } from './types.ts';

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const WEEKDAYS: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function daysFromCivil(y0: number, m: number, d: number): number {
  const y = m <= 2 ? y0 - 1 : y0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function civilFromDays(z0: number): [number, number, number] {
  const z = z0 + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor(
    (doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365
  );
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  return [yoe + era * 400 + (m <= 2 ? 1 : 0), m, d];
}

/** Dan od 1970-01-01, ili null ako datum nije ispravan ISO kalendarski datum. */
export function dayNumber(iso: unknown): number | null {
  if (typeof iso !== 'string') return null;
  const m = ISO.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const n = daysFromCivil(y, mo, d);
  const [y2, m2, d2] = civilFromDays(n);
  return y2 === y && m2 === mo && d2 === d ? n : null;
}

export function isoFromDayNumber(n: number): IsoDate {
  const [y, m, d] = civilFromDays(n);
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Pretpostavlja ispravan datum (proveren u input.ts). */
export function mustDay(iso: IsoDate): number {
  const n = dayNumber(iso);
  if (n === null) throw new Error(`Neispravan datum: ${iso}`);
  return n;
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  return isoFromDayNumber(mustDay(iso) + days);
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return mustDay(to) - mustDay(from);
}

/** 0 = ponedeljak … 6 = nedelja. 1970-01-01 je četvrtak. */
export function weekdayIndexOfDay(n: number): number {
  return (((n + 3) % 7) + 7) % 7;
}

export function weekdayOf(iso: IsoDate): Weekday {
  return WEEKDAYS[weekdayIndexOfDay(mustDay(iso))]!;
}

export function weekdayIndex(w: Weekday): number {
  return WEEKDAYS.indexOf(w);
}

export function isWeekday(x: unknown): x is Weekday {
  return typeof x === 'string' && (WEEKDAYS as readonly string[]).includes(x);
}

export { WEEKDAYS };
