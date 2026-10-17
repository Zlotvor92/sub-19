/* Imena i oznake dana/nedelje — čiste funkcije, bez DOM-a.
   (Segment 5/5: opis automatskog propisa `describePrescription` premešten je doslovno u `./prescriptionText.ts`, jer ga
   koristi samo stari `finalize.ts`; time prikazne oznake više ne vuku stare trenerske profile u produkcioni graf.) */

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
 * Šta je dan — za oznaku na kartici. Ručno izmenjen dan (`hasAlt`) se imenuje po tipu izmene, čak i kad
 * izmena zadržava strukturu (`session`); original (`originSession`) služi samo istoriji i spajanju: piramida promenjena u obično
 * lako trčanje ne sme da se prikazuje kao „Piramida".
 */
export function sessKind(
  d: Pick<ResolvedDay, 'rest' | 'tag' | 'session' | 'structure'>,
  hasAlt: boolean
): string {
  if (d.rest) return tagName('odmor');
  if (hasAlt) return tagName(d.tag);
  /* 5k-v2: vrsta iz strukture dana (generator), inače ime tipa dana. */
  return d.session?.kind ? d.session.kind : (d.structure?.kind ?? tagName(d.tag));
}

/** Oznaka dana: vrsta + „ + Snaga" kad je uz trčanje dodata snaga. */
export function dayLabel(
  d: Pick<ResolvedDay, 'rest' | 'tag' | 'session' | 'snaga' | 'structure'>,
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
  w: { w: number; deload?: boolean; focus?: string; taper?: boolean } | null | undefined,
  totalWeeks: number
): WeekPhase {
  if (!w) return '';
  if (w.deload || /^DELOAD/i.test(String(w.focus || ''))) return 'DELOAD';
  const n = w.w;
  const T = totalWeeks || 1;
  if (n >= T) return 'TRKA';
  /* Taper je jedna nedelja (5K, 10K) ili dve (HM, maraton) — pozicija sama ne zna koliko ih ima. Izvor istine je zastavica `taper`;
     planovi napravljeni pre nje nose samo PREFIKS opisa („Taper …", v. `weekFocus`), a ručno pisan plan ni to — njemu ostaje
     pretposlednja nedelja. */
  if (n >= T - 1 || w.taper || /^Taper/i.test(String(w.focus || ''))) return 'TAPER';
  const frac = n / T;
  if (frac <= 0.3) return 'BAZA';
  if (frac <= 0.65) return 'RAZVOJ';
  return 'VRHUNAC';
}

/* Ciljni napor po tipu dana (`rpeTarget`) je trenerska smernica i od prenosa pripada generatoru distance plana
   (`domain/generators/<distanca>/plan/describe.ts`). */
