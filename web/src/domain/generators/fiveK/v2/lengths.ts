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
const ceil1 = (x: number): number => Math.ceil(x * 10 - 1e-9) / 10;

/** 5k-v2.12.0 (T1): nedelja na koju važi pravilo „lagan prema dugom" — izgradnja bez rasterećenja (JEDINO mesto opsega;
    konstruktor, kapacitet, mešovita nedelja i validator). */
export const easyVsLongWeek = (phase: Phase, deload: boolean): boolean =>
  !deload && (phase === 'base' || phase === 'peak' || phase === 'sharpen');

/** 5k-v2.12.0 (T1): najkraći lagan trening [km] — JEDINO mesto: taper i trkačka taperMinKm; izgradnja bez rasterećenja
    max(easy.minKm, easy.minSec bržom granicom E naviše na 0,1 km — trening traje ≥ minSec i sa ubrzanjima, jer je
    lagan deo na sredini opsega E); inače easy.minKm. */
export function easyMinKm(phase: Phase, p: PaceModel, deload = false): number {
  if (phase === 'taper' || phase === 'race') return P.easy.taperMinKm;
  return easyVsLongWeek(phase, deload)
    ? Math.max(P.easy.minKm, ceil1(P.easy.minSec / p.E.fast))
    : P.easy.minKm;
}

/** 5k-v2.12.0 (T1): najduži lagan trening uz dugi `longKm` — JEDINO mesto: izgradnja bez rasterećenja
    ⌊easy.buildMaxShareOfLong × dugi⌋ na 0,1 km; inače dugi (lagan ≤ dugi). */
export function easyCapKm(longKm: number, phase: Phase, deload = false): number {
  return easyVsLongWeek(phase, deload) ? floor1(longKm * P.easy.buildMaxShareOfLong) : longKm;
}

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
 * dugi) / n. Ako je lagan > granice laganog (easyCapKm): capped (lagan = granica, planirano < cilj) — 2.4.1:
 * kapacitet i fitTargetKm (volume.ts) to isključuju za svaki cilj plana kad dugi stoji na plafonu (samo zaštita).
 * 5k-v2.12.0 (T1): u nedelji izgradnje bez rasterećenja granica laganog je 0,8 × dugi, a minimum easyMinKm; kad
 * granica uz n laganih padne ispod minimuma, nedelja ima lagan dan manje (odmor; `shares` kraći od `nEasy`). Dugi
 * nikad preko longCapKm (ne produžava se radi ostatka). Kapacitet obima ostaje pravilo „lagan ≤ dugi" (`overLong`):
 * višak preko 0,8 × dugi je planirano < cilj uz upozorenje i preporuku (više dana / manji obim), ne niži cilj.
 */
export function weekLengths(
  target: number,
  qualityKm: number,
  nEasy: number,
  phase: Phase,
  p: PaceModel,
  a: Athlete,
  deload = false
): { longKm: number; shares: number[]; capped: boolean; overLong: boolean; easyMin: number } {
  const easyMin = easyMinKm(phase, p, deload);
  // 2.2.0: treći član na 0,1 km (ne 0,5): sa 0,5 km mala rasteretna nedelja (13 km) dobija dugi 3 km i
  // lagane 3,2 km, tj. lagan > dugi. 2.4.1: i udeo dana (longCapKm) je na 0,1 km za sve brojeve dana.
  const longOf = (n: number): number =>
    Math.min(longCapKm(target, p, a), floor1(target - qualityKm - n * easyMin));
  let n = nEasy;
  if (easyVsLongWeek(phase, deload))
    while (n > 0 && easyCapKm(longOf(n), phase, deload) + 1e-9 < easyMin) n--;
  const longKm = longOf(n);
  const cap = easyCapKm(longKm, phase, deload);
  const rest = r2(target - qualityKm - longKm);
  const capped = rest > n * cap + 1e-9;
  return {
    longKm,
    shares: capped ? Array<number>(n).fill(cap) : splitEasy(rest, n, cap),
    capped,
    // Kapacitet (volume.feasibility) gleda samo lagan > dugi; granica T1 (0,8 × dugi) daje planirano < cilj.
    overLong: rest > n * longKm + 1e-9,
    easyMin
  };
}

/**
 * 2.5.0 (Odluka 4): dužine u periodu bola — JEDINO mesto. Dugi na danu bola ≤ adapt.painLongMaxSec
 * sporijom granicom E (na 0,5 km); lagan na danu bola × adapt.painEasyFactor naniže na 0,1 km, ne ispod
 * minimuma; svaki lagan ≤ dugi nedelje (`longKm` = dugi posle ograničenja, null ako dugog nema).
 */
export function painLongKm(longKm: number, p: PaceModel): number {
  return Math.min(longKm, floorHalf(P.adapt.painLongMaxSec / p.E.slow));
}

export function limitedEasyKm(
  km: number,
  inPain: boolean,
  longKm: number | null,
  easyMin: number
): number {
  const k = inPain ? Math.max(easyMin, floor1(km * P.adapt.painEasyFactor)) : km;
  return longKm === null ? k : Math.min(k, longKm);
}
