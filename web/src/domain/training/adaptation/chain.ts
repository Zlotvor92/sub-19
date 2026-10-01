/* LANAC FORME (VDOT): čista funkcija IZMERENIH vrednosti i njihovih datuma.

   Stari kod je glačanje računao u trenutku unosa nad `currentVdot()` — POSLEDNJIM elementom niza, ne
   prethodnom sesijom po datumu. Dve posledice: (1) PONOVNI UNOS ISTIH PODATAKA JE DIZAO VDOT (48.1 →
   50.1 → 51.3 → 52.0 za iste podatke), (2) ispravka starije sesije je gurala u kraj niza i proglašavala
   najnovijom. Sada se lanac računa iznova: sortira se po datumu, kreće od početnog VDOT-a, pa je ponovni
   unos istih podataka IDENTIČAN rezultat, a ispravka starije sesije prepravlja i sve posle nje. */

import { r1 } from '../../format';
import { VDOT_ALPHA, type VdotSessionClass } from '../constants/heuristics';
import { ZONE_FOR_KIND } from '../vdot/zoneForKind';
import { vdotPossible } from '../vdot/limits';
import { idToString } from '../../state/ids';
import type { VdotRecord } from '../../state/types';

/** Koliko se veruje jednom merenju. */
export function smoothVdot(
  prev: number,
  measured: number,
  cls: VdotSessionClass
): { vdot: number; alpha: number } {
  const alpha = VDOT_ALPHA[cls] || VDOT_ALPHA.default;
  return { vdot: r1(prev + alpha * (measured - prev)), alpha };
}

/** Zona iz naziva reda predikcije („N5 · Intervali" → 'I'); `undefined` kad naziv nema zonu. */
export function zoneForPredLabel(label: string | null | undefined) {
  if (!label) return null;
  const kind = label.split(' · ')[1];
  return kind != null ? ZONE_FOR_KIND[kind] : null;
}

/**
 * Tip sesije za glačanje. Test na 3 km se prepoznaje po ID-ju (nema PRED red u planu), sve ostalo po
 * zoni PRED reda. Repeticije su ODVOJENE od intervala: 200 m sa punim odmorom i 1000 m sa 90 s kaskanja
 * nisu ni izbliza jednako pouzdan pokazatelj forme.
 */
export function sessionClassFor(
  isT3k: boolean,
  predLabel: string | null | undefined
): VdotSessionClass {
  if (isT3k) return 'test';
  const z = zoneForPredLabel(predLabel);
  if (z === 'R') return 'rep';
  if (z === 'I') return 'int';
  if (z === 'T' || z === 'M') return 'tempo';
  return 'default';
}

type Entry = VdotRecord & { alpha?: number; nemoguce?: true };

/** Poređenje zapisa: po datumu, pa po ID-ju (stabilno pri istom datumu). */
function byDateThenId(a: Entry, b: Entry): number {
  const A = String((a && a.ts) || '');
  const B = String((b && b.ts) || '');
  if (A !== B) return A < B ? -1 : 1;
  return idToString(a.id) < idToString(b.id) ? -1 : 1;
}

/**
 * Preračun celog lanca iz izmerenih vrednosti. Ne mutira ulaz.
 *  - NEMOGUĆE MERENJE SE PRESKAČE, ne glača: izmereno 89 sa α=0,60 bi pomerilo formu sa 48,6 na 73,5 i
 *    tu je ostavilo zauvek (lanac se odatle nastavlja).
 *  - Zapis bez `measured` (stari backup) nosi samo gotov `vdot` — uzima se kakav jeste, ali i on mora da
 *    bude moguć.
 */
export function recomputeVdotChain(
  entries: readonly VdotRecord[],
  baseline: number | null,
  classify: (id: string) => VdotSessionClass
): VdotRecord[] {
  const sorted: Entry[] = entries.map((e) => ({ ...e })).sort(byDateThenId);
  let current = baseline;
  for (const e of sorted) {
    if (!e) continue;
    if (e.measured != null && Number.isFinite(e.measured) && !vdotPossible(e.measured)) {
      /* (baseline može biti null samo ako plan nema polaznu tačku — tada nema šta da se „vrati") */
      e.vdot = current;
      e.prev = current;
      e.delta = 0;
      e.nemoguce = true;
      continue;
    }
    if (e.measured == null || !Number.isFinite(e.measured)) {
      if (vdotPossible(e.vdot)) current = e.vdot;
      continue;
    }
    const prev = current as number;
    const p = smoothVdot(prev, e.measured, classify(e.id as string));
    e.prev = prev;
    e.vdot = p.vdot;
    e.alpha = p.alpha;
    e.delta = Math.round((p.vdot - prev) * 10) / 10;
    current = p.vdot;
  }
  return sorted;
}

/** Forma sada = VDOT poslednjeg zapisa u lancu (lanac je sortiran po datumu), ili `null`. */
export function currentVdot(chain: readonly VdotRecord[]): number | null {
  const last = chain[chain.length - 1];
  return chain.length && last ? last.vdot : null;
}
