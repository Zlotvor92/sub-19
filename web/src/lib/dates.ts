/* PRIKAZ DATUMA (samo za ekran; domen ima svoje zapise koji ulaze u perzistirane opise). Imena dana su iz DATUMA, ne iz mesta u planu: posle zamene
   dana ispravan je dan u nedelji tek ako se računa iz efektivnog datuma. */

import { parseIsoDate, weekdayIndex } from '../domain/date';

const DOW_LONG = [
  'ponedeljak',
  'utorak',
  'sreda',
  'četvrtak',
  'petak',
  'subota',
  'nedelja'
] as const;
const DOW_INITIAL = ['P', 'U', 'S', 'Č', 'P', 'S', 'N'] as const;

/** „subota"; nevažeći datum daje „—". */
export function dowLong(iso: string | null | undefined): string {
  const d = parseIsoDate(iso);
  return d ? DOW_LONG[weekdayIndex(d)] : '—';
}

/** „Subota" (velikim slovom, za početak reda). */
export function dowLongCap(iso: string | null | undefined): string {
  const s = dowLong(iso);
  return s === '—' ? s : `${s.charAt(0).toUpperCase()}${s.slice(1)}`;
}

/** „Č" — početno slovo dana za traku dana u nedelji. */
export function dowInitial(iso: string | null | undefined): string {
  const d = parseIsoDate(iso);
  return d ? DOW_INITIAL[weekdayIndex(d)] : '—';
}

/** Dan u mesecu bez nule: „8". */
export function dayOfMonth(iso: string | null | undefined): string {
  const d = parseIsoDate(iso);
  return d ? String(Number(d.slice(8, 10))) : '—';
}
