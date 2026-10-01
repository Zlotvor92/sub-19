/* Imena i oznake dana/nedelje — čiste funkcije, bez DOM-a. */

import type { DayTag } from '../state';
import type { ResolvedDay } from './types';

export const TAG_LABELS: Readonly<Record<DayTag, string>> = {
  lako: 'Lako',
  rw: 'Trčanje/hod',
  tempo: 'Tempo',
  int: 'Intervali',
  lr: 'Dugo (LR)',
  snaga: 'Snaga',
  odmor: 'Odmor',
  trka: 'TRKA',
  test: 'Test'
};

const hasOwn = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

/** Ime tipa dana; nepoznat tip je „Trening". Vlastita svojstva, ne nasleđena („constructor"). */
export function tagName(t: string | undefined | null): string {
  return t && hasOwn(TAG_LABELS, t) ? TAG_LABELS[t as DayTag] : 'Trening';
}

/** `''` za tip koji nije poznat — tip iz uvezenog backupa nikad ne ide dalje neproveren. */
export function safeTag(t: string | undefined | null): DayTag | '' {
  return t && hasOwn(TAG_LABELS, t) ? (t as DayTag) : '';
}

/**
 * Šta je dan — za oznaku na kartici. Ručno izmenjen dan (`hasAlt`) i dalje nosi ORIGINALNU sesiju
 * (potrebna za predikciju/lap-detekciju), ali za PRIKAZ je zastarela: piramida promenjena u obično
 * lako trčanje ne sme da se prikazuje kao „Piramida".
 */
export function sessKind(
  d: Pick<ResolvedDay, 'rest' | 'tag' | 'session'>,
  hasAlt: boolean
): string {
  if (d.rest) return tagName('odmor');
  if (hasAlt) return tagName(d.tag);
  return d.session?.kind ? d.session.kind : tagName(d.tag);
}

/** Oznaka dana: vrsta + „ + Snaga" kad je uz trčanje dodata snaga. */
export function dayLabel(
  d: Pick<ResolvedDay, 'rest' | 'tag' | 'session' | 'snaga'>,
  hasAlt: boolean
): string {
  return sessKind(d, hasAlt) + (d.snaga ? ' + Snaga' : '');
}

export type WeekPhase = 'DELOAD' | 'TRKA' | 'TAPER' | 'BAZA' | 'RAZVOJ' | 'VRHUNAC' | '';

/**
 * Faza nedelje za prikaz. Rasterećenje se prepoznaje po ZASTAVICI `deload` ILI po prefiksu „DELOAD" u
 * `focus` (ručno pisan plan ima „DELOAD (intenzitetski) — …"). Preostale faze po udelu plana.
 */
export function weekPhase(
  w: { w: number; deload?: boolean; focus?: string } | null | undefined,
  totalWeeks: number
): WeekPhase {
  if (!w) return '';
  if (w.deload || /^DELOAD/i.test(String(w.focus || ''))) return 'DELOAD';
  const n = w.w;
  const T = totalWeeks || 1;
  if (n >= T) return 'TRKA';
  if (n >= T - 1) return 'TAPER';
  const frac = n / T;
  if (frac <= 0.3) return 'BAZA';
  if (frac <= 0.65) return 'RAZVOJ';
  return 'VRHUNAC';
}

export interface RpeTarget {
  min: number;
  max: number;
  txt: string;
}

const RPE_TARGET: Partial<Record<DayTag, RpeTarget>> = {
  lako: { min: 3, max: 4, txt: 'Razgovorno — možeš da pričaš u punim rečenicama' },
  rw: { min: 3, max: 4, txt: 'Razgovorno — deo za trčanje mora ostati lagan' },
  lr: { min: 4, max: 5, txt: 'Razgovorno do postojano' },
  tempo: { min: 7, max: 8, txt: 'Prijatno teško — kratke rečenice' },
  int: { min: 8, max: 9, txt: 'Teško — ubrzano disanje, bez pričanja' },
  test: { min: 9, max: 10, txt: 'Skoro maksimalno' },
  trka: { min: 9, max: 10, txt: 'Maksimalno' }
};

/** Ciljni napor (RPE) po tipu dana; `null` za odmor i snagu. */
export function rpeTarget(
  d: Pick<ResolvedDay, 'rest' | 'tag'> | null | undefined
): RpeTarget | null {
  if (!d || d.rest) return null;
  if (d.tag === 'snaga' || !d.tag) return null;
  return RPE_TARGET[d.tag] ?? null;
}
