/* Imena i oznake dana/nedelje — čiste funkcije, bez DOM-a. */

import { addDays, type IsoDate } from '../date';
import { EASY_EFFORT_NOTE } from '../training/generator/formPolicy';
import type { DayTag } from '../state';
import { fmtClock } from '../format';
import type { Day, PlanMeta } from '../training/types';
import { sessDesc } from '../training/sessions/calc';
import { fuelText } from '../training/sessions/longRun';
import { paceForZone } from '../training/vdot/paceForZone';
import { profileFor } from '../training/distances';
import { runWalkForWeek, runWalkText } from '../training/generator/runWalk';
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

/** Future automatic prescriptions are described from structure, never parsed from old prose. */
export function describePrescription(d: Day, meta: PlanMeta, date?: IsoDate): string | null {
  if (d.session) return sessDesc(d.session);
  if (d.rest || d.tag === 'snaga' || d.tag === 'trka') return d.desc;
  if (d.tag === 'rw') return `${d.km} km — ${runWalkText(d.runWalk)}`;
  const vdot = meta.trainingVdot ?? meta.vdot0;
  const pace = paceForZone(vdot, d.tag === 'lr' ? 'LR' : 'E');
  const label = d.tag === 'lr' ? (d.mlr ? 'srednje-dugo' : 'LR') : 'lako';
  const h = profileFor(meta.raceDistM)?.heuristic;
  const fuel = d.tag === 'lr' && h ? fuelText(d.km, pace, h) : '';
  const finish = d.finish
    ? ` · poslednjih ${d.finish.km} km @ ${fmtClock(d.finish.paceSec)}/km (${d.finish.zone === 'M' ? 'maratonski' : 'tempo trke'})`
    : '';
  const strides = d.strides
    ? ` + ${d.strides.reps}×${d.strides.runSec} s ubrzanja (pun oporavak ${d.strides.restSec} s)`
    : '';
  const effort = meta.formPolicy?.basis === 'effort-first' ? ` · ${EASY_EFFORT_NOTE}` : '';
  const phase = meta.runWalk;
  const transitionStart =
    phase?.transitionStart ??
    (phase ? addDays(meta.start, (phase.transitionWeek - 1) * 7) : undefined);
  const rung = phase?.ladder.at(-1);
  const lastRw = rung ? runWalkForWeek(1, [rung]) : null;
  const trial =
    date &&
    transitionStart &&
    date >= transitionStart &&
    date < addDays(transitionStart, 7) &&
    lastRw &&
    !d.finish
      ? ` · Prelaz na neprekidno trčanje je probni: radi ga samo ako su poslednja run/walk trčanja bila razgovorna (napor do 5/10) i bez bola. Ako nisu, ponovi korak „${lastRw.label}" i prilagodi plan u kartici „Prema odrađenim treninzima"`
      : '';
  return `${d.km} km ${label} (Z2) @ ~${fmtClock(pace)}/km${fuel}${finish}${strides}${effort}${trial}`;
}
