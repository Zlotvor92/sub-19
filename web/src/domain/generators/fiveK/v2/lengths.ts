/* 2.4.0: dužine dugog i laganih — JEDINO mesto (bez zavisnosti od kvaliteta, da ga koriste i
   week.ts, kapacitet u volume.ts i provera mesta za kvalitet u feel.ts). */

import {
  asAthlete,
  FIVE_K_V2_POLICY as P,
  rulesOf,
  type Athlete,
  type RunDaysCount
} from './policy.ts';
import type { PaceModel, Phase } from './types.ts';

const r2 = (x: number): number => Math.round(x * 100) / 100;
const floor1 = (x: number): number => Math.floor(x * 10 + 1e-9) / 10;
const floorHalf = (x: number): number => Math.floor(x * 2 + 1e-9) / 2;

/** Raspodela ostatka na lagane dane (jednako, poslednji uzima zaokruživanje). 2.4.0: ako ukupno staje
    u n × `cap`, a poslednji deo zbog zaokruživanja prelazi `cap`, višak ide ostalima (po 0,01 km). */
export function splitEasy(remainder: number, n: number, cap = Infinity): number[] {
  if (n <= 0) return [];
  const share = floor1(remainder / n);
  const over = r2(remainder - share * (n - 1) - cap);
  const add = n > 1 && over > 1e-9 ? Math.ceil((over / (n - 1)) * 100 - 1e-9) / 100 : 0;
  const s = r2(share + add);
  return [...Array<number>(n - 1).fill(s), r2(remainder - s * (n - 1))];
}

/** Dugi trk [km] za ciljni km nedelje: min(udeo dana × cilj naniže na longStepKm, longMaxSec (90 min;
    2.4.0 početnik 60 min) sporijom granicom E na 0,5 km). */
export function longCapKm(targetKm: number, p: PaceModel, a: Athlete | RunDaysCount): number {
  const { longMaxShare, longStepKm, longMaxSec } = rulesOf(asAthlete(a));
  const share = Math.floor((targetKm * longMaxShare) / longStepKm + 1e-9) * longStepKm;
  return Math.min(Math.round(share * 10) / 10, floorHalf(longMaxSec / p.E.slow));
}

/** 2.4.0: broj laganih dana nedelje = lagani dani šablona + kvalitetni dan bez kvaliteta (q2 u
    rasterećenju/taperu 2; q1 u nedelji samo sa ubrzanjima). */
export function easyCount(a: Athlete, hasQ1: boolean, hasQ2: boolean): number {
  const r = rulesOf(a);
  return r.easyDays + (hasQ1 ? 0 : 1) + (r.qualityDays === 2 && !hasQ2 ? 1 : 0);
}

/**
 * Dužine dugog i laganih (JEDINO mesto, jedan prolaz; koristi ga i kapacitet u volume.ts):
 * dugi = min(longCapKm(cilj), cilj − kvalitet − n × min. lagan na 0,1 km); lagan = (cilj − kvalitet −
 * dugi) / n. Ako je lagan > dugi: capped (lagan = dugi, planirano < cilj) — 2.4.0: kapacitet to
 * isključuje za svaki cilj ≤ kapaciteta kad dugi stoji na plafonu, pa je ovo samo zaštita.
 */
export function weekLengths(
  target: number,
  qualityKm: number,
  nEasy: number,
  phase: Phase,
  p: PaceModel,
  a: Athlete
): { longKm: number; shares: number[]; capped: boolean; easyMin: number } {
  const easyMin = phase === 'taper' ? P.easy.taperMinKm : P.easy.minKm;
  // 2.2.0: treći član na 0,1 km (ne 0,5): sa 0,5 km mala rasteretna nedelja (13 km) dobija dugi 3 km i
  // lagane 3,2 km, tj. lagan > dugi.
  const longKm = Math.min(longCapKm(target, p, a), floor1(target - qualityKm - nEasy * easyMin));
  const rest = r2(target - qualityKm - longKm);
  const capped = rest > nEasy * longKm + 1e-9;
  return {
    longKm,
    shares: capped ? Array<number>(nEasy).fill(longKm) : splitEasy(rest, nEasy, longKm),
    capped,
    easyMin
  };
}
