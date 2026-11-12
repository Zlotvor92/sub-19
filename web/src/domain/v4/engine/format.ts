/* V4 — OBLIKOVANJE ZA ČOVEKA (§ 14.2): decimalni zarez, datumi „17. 11.", množina kroz jednu funkciju. */
import { dayNumber, weekdayOf } from './dates';
import type { IsoDate, Meters, SecPerKm, Seconds } from './types';

export type Forms = readonly [one: string, few: string, many: string];

export const WEEKS: Forms = ['nedelja', 'nedelje', 'nedelja'];
export const DAYS: Forms = ['dan', 'dana', 'dana'];
export const WORKOUTS: Forms = ['trening', 'treninga', 'treninga'];
export const KM: Forms = ['kilometar', 'kilometra', 'kilometara'];

/** Oblik imenice uz broj: 1 nedelja, 2 nedelje, 5 nedelja, 11 nedelja, 21 nedelja, 22 nedelje. */
export function pluralForm(n: number, forms: Forms): string {
  const abs = Math.abs(Math.round(n));
  const last = abs % 10;
  const lastTwo = abs % 100;
  if (last === 1 && lastTwo !== 11) return forms[0];
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return forms[1];
  return forms[2];
}

/** Broj sa imenicom u pravom obliku. */
export function count(n: number, forms: Forms): string {
  return `${fmtNumber(n)} ${pluralForm(n, forms)}`;
}

/** Pridev + broj + imenica: „prvi dan", „prva 3 dana", „prvih 11 dana". */
export function countWith(n: number, adjective: Forms, noun: Forms): string {
  if (n === 1) return `${adjective[0]} ${noun[0]}`;
  return `${pluralForm(n, adjective)} ${count(n, noun)}`;
}

export const FIRST: Forms = ['prvi', 'prva', 'prvih'];
export const NEXT: Forms = ['naredni', 'naredna', 'narednih'];

/** Broj sa decimalnim zarezom, najviše `digits` decimala, bez nula na kraju. */
export function fmtNumber(value: number, digits = 1): string {
  const scale = 10 ** digits;
  const rounded = Math.round(value * scale) / scale;
  const fixed = rounded.toFixed(digits);
  const text = fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
  return text.replace('.', ',');
}

export function fmtKm(meters: Meters): string {
  return `${fmtNumber(meters / 1000)} km`;
}

/** Dužina deonice: ispod 1 km u metrima („400 m"), inače u km. */
export function fmtDistance(meters: Meters): string {
  return meters < 1000 ? `${String(Math.round(meters))} m` : fmtKm(meters);
}

const two = (n: number): string => String(n).padStart(2, '0');

/** Trajanje deonice ili oporavka: „20 s", „8 min", „1:30 min". */
export function fmtDuration(sec: Seconds): string {
  const s = Math.round(sec);
  if (s < 60) return `${String(s)} s`;
  if (s % 60 === 0) return `${String(s / 60)} min`;
  return `${String(Math.floor(s / 60))}:${two(s % 60)} min`;
}

/** Trajanje treninga, zaokruženo na minut: „43 min", „1 h 45 min". */
export function fmtMinutes(sec: Seconds): string {
  const min = Math.round(sec / 60);
  if (min < 100) return `${String(min)} min`;
  const rest = min % 60;
  return rest === 0
    ? `${String(Math.floor(min / 60))} h`
    : `${String(Math.floor(min / 60))} h ${String(rest)} min`;
}

/** Vreme trke: „22:30" ili „1:41:00". */
export function fmtClock(sec: Seconds): string {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${String(h)}:${two(m)}:${two(s % 60)}` : `${String(m)}:${two(s % 60)}`;
}

/** „4:40" */
export function fmtPaceBare(secPerKm: SecPerKm): string {
  const s = Math.round(secPerKm);
  return `${String(Math.floor(s / 60))}:${two(s % 60)}`;
}

/** „4:40/km" */
export function fmtPace(secPerKm: SecPerKm): string {
  return `${fmtPaceBare(secPerKm)}/km`;
}

/** „17. 11." */
export function fmtDate(iso: IsoDate): string {
  return `${String(Number(iso.slice(8, 10)))}. ${String(Number(iso.slice(5, 7)))}.`;
}

/** „17. 11. 2026." */
export function fmtDateYear(iso: IsoDate): string {
  return `${fmtDate(iso)} ${iso.slice(0, 4)}.`;
}

/** „14–20. 12." u istom mesecu, inače „28. 12. – 3. 1." */
export function fmtDateRange(from: IsoDate, to: IsoDate): string {
  if (from === to) return fmtDate(from);
  if (from.slice(0, 7) === to.slice(0, 7))
    return `${String(Number(from.slice(8, 10)))}–${fmtDate(to)}`;
  return `${fmtDate(from)} – ${fmtDate(to)}`;
}

const WEEKDAY_SHORT = ['pon', 'uto', 'sre', 'čet', 'pet', 'sub', 'ned'] as const;

export function fmtWeekday(iso: IsoDate): string {
  return Number.isFinite(dayNumber(iso)) ? WEEKDAY_SHORT[weekdayOf(iso)] : '';
}

/** Zamena `{ključ}` u šablonu teksta; nepoznat ključ ostaje prazan. */
export function fillText(template: string, values: Readonly<Record<string, string>>): string {
  return template
    .replace(/\{(\w+)\}/g, (_all, key: string) => values[key] ?? '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
