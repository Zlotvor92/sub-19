/* V4 — DATUMI. Kalendarski dan `YYYY-MM-DD`; računa se preko rednog broja dana (bez sata i vremenske zone). */
import type { IsoDate, Weekday } from './types';

const DAY_MS = 86_400_000;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Redni broj dana od 1. 1. 1970; `NaN` za neispravan zapis. */
export function dayNumber(iso: IsoDate): number {
  const m = ISO_RE.exec(iso);
  if (m === null) return Number.NaN;
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS);
}

export function fromDayNumber(n: number): IsoDate {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

/** Postoji li taj dan u kalendaru (2026-02-30 ne postoji). */
export function isValidDate(iso: unknown): iso is IsoDate {
  if (typeof iso !== 'string') return false;
  const n = dayNumber(iso);
  return Number.isFinite(n) && fromDayNumber(n) === iso;
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  return fromDayNumber(dayNumber(iso) + days);
}

/** `a − b` u danima. */
export function diffDays(a: IsoDate, b: IsoDate): number {
  return dayNumber(a) - dayNumber(b);
}

/** 0 = ponedeljak … 6 = nedelja. */
export function weekdayOf(iso: IsoDate): Weekday {
  const n = (((dayNumber(iso) + 3) % 7) + 7) % 7;
  return toWeekday(n);
}

export function toWeekday(n: number): Weekday {
  switch (n) {
    case 1:
      return 1;
    case 2:
      return 2;
    case 3:
      return 3;
    case 4:
      return 4;
    case 5:
      return 5;
    case 6:
      return 6;
    default:
      return 0;
  }
}

export function mondayOf(iso: IsoDate): IsoDate {
  return addDays(iso, -weekdayOf(iso));
}

export function maxDate(a: IsoDate, b: IsoDate): IsoDate {
  return a >= b ? a : b;
}

export function minDate(a: IsoDate, b: IsoDate): IsoDate {
  return a <= b ? a : b;
}
