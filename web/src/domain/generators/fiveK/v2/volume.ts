/* JEDINO mesto koje određuje ciljni km nedelje (trkačka nedelja: gornja granica, v. week.ts). */

import {
  asAthlete,
  FIVE_K_V2_POLICY as P,
  rulesOf,
  type Athlete,
  type RunDaysCount
} from './policy.ts';
import { weekQuality } from './quality.ts';
import type { PaceModel, Phase, WeekFrame } from './types.ts';
import { easyCount, longCapKm, weekLengths } from './lengths.ts';
import type { WeekDose } from './workouts.ts';

export { longCapKm } from './lengths.ts';

const floor1 = (x: number): number => Math.floor(x * 10 + 1e-9) / 10;
const round1 = (x: number): number => Math.round(x * 10) / 10;

export interface VolumePlan {
  startKm: number;
  peakKm: number;
  /** 2.2.0: najveći nedeljni cilj koji izabrani broj dana nosi (v. capacityKm). */
  capacityKm: number;
  /** Trenutni obim je bio veći od kapaciteta, pa plan kreće od kapaciteta. */
  startCapped: boolean;
  /** Ciljevi po nedelji; za trkačku nedelju GORNJA GRANICA (2.3.0: cilj = zbir planiranih dana). */
  targets: number[];
}

/**
 * Vrh obima (jedna funkcija, 2.3.0: tri člana):
 * - peakCapFactor × start: rast obima u jednom ciklusu ograničen na +30% (2.4.0 početnik +20%;
 *   heuristika konzervativnog rasta);
 * - kapacitet izabranog broja dana (capacityKm);
 * - apsolutni vrh po broju dana (days[n].maxWeekKm: 3 → 40, 4 → 50, 5 → 65; heuristika).
 */
export function peakKm(startKm: number, capacity: number, a: Athlete | RunDaysCount): number {
  const r = rulesOf(asAthlete(a));
  return Math.min(floor1(startKm * r.peakCapFactor), capacity, r.maxWeekKm);
}

/** Probne nedelje kapaciteta: sve vrste ne-trkačkih nedelja koje generate gradi, prva nedelja faze
    (prev = null) i, za naizmenični jedan kvalitet, druga vrsta (prev.kind). */
function probes(a: Athlete): { f: WeekFrame; prev: WeekDose | null }[] {
  const frame = (phase: Phase, o: Partial<WeekFrame> = {}): WeekFrame => ({
    index: 5,
    startDate: '2026-01-05',
    endDate: '2026-01-11',
    phase,
    deload: false,
    taperStep: null,
    test: false,
    ...o
  });
  const alt = (kind: WeekDose['kind']): WeekDose => ({
    main: null,
    t: null,
    same: 1,
    kind,
    feel: {}
  });
  const prevs = [null, alt('R'), alt('HILLS'), alt('FARTLEK_T')];
  const out: { f: WeekFrame; prev: WeekDose | null }[] = [];
  for (const phase of ['base', 'peak', 'sharpen'] as const) {
    for (const prev of phase === 'sharpen' ? [null] : prevs) out.push({ f: frame(phase), prev });
    out.push({ f: frame(phase, { deload: true }), prev: null });
  }
  out.push({ f: frame('taper', { taperStep: 1 }), prev: null });
  out.push({ f: frame('taper', { taperStep: 2 }), prev: null });
  if (a.beginner) out.push({ f: frame('base', { index: 1 }), prev: null });
  if (a.feel)
    for (const phase of ['base', 'peak'] as const)
      out.push({ f: frame(phase, { test: true }), prev: null });
  return out;
}

const feasibleCache = new Map<string, { lo: number; ok: boolean[] }>();

/**
 * 2.4.1 (Odluka 2): tabela izvodljivih ciljeva — JEDINO mesto. Cilj t (od minimuma nedelje do
 * apsolutnog vrha, korak 0,1 km) je izvodljiv ako STVARNA konstrukcija nedelje — weekQuality +
 * weekLengths, iste funkcije kao generate — ni u jednoj probnoj nedelji (probes()) ne daje lagan > dugi
 * dok dugi stoji na plafonu (udeo dana ili vreme). Nedelja koja se uopšte ne može sastaviti (kvalitet ne
 * staje, lagan < minimum) nije pitanje kapaciteta i ne obara cilj; isto i nedelja u kojoj je dugi
 * sabijen minimumom laganih (donja granica obima). Rezultat se pamti po (tempo, trkač).
 */
function feasibility(p: PaceModel, a: Athlete): { lo: number; ok: boolean[] } {
  const key = JSON.stringify([p, a]);
  const hit = feasibleCache.get(key);
  if (hit) return hit;
  const r = rulesOf(a);
  const list = probes(a);
  const lo = Math.round(r.minWeekKm * 10);
  const hi = Math.round(r.maxWeekKm * 10);
  const ok: boolean[] = [];
  for (let k = lo; k <= hi; k++) {
    const t = k / 10;
    ok.push(
      list.every(({ f, prev }) => {
        const s = weekQuality(f, t, p, prev, a);
        if (!s.ok) return true;
        const qualityKm = (s.q1 ? s.q1.km : 0) + (s.q2 ? s.q2.km : 0);
        const L = weekLengths(
          t,
          qualityKm,
          easyCount(a, s.q1 !== null, s.q2 !== null),
          f.phase,
          p,
          a
        );
        if (L.shares.some((x) => x + 1e-9 < L.easyMin)) return true;
        return !(L.capped && L.longKm + 1e-9 >= longCapKm(t, p, a));
      })
    );
  }
  const out = { lo, ok };
  feasibleCache.set(key, out);
  return out;
}

/**
 * Kapacitet [km] (2.4.1, Odluka 2): najveći izvodljiv cilj ≤ apsolutnog vrha (days[n].maxWeekKm), v.
 * feasibility(). Rupe ispod njega ne spuštaju kapacitet (2.4.0 je kapacitet „zatvarao naniže" — prvi
 * neizvodljiv cilj − 0,1 km); nedelja čiji cilj padne u rupu dobija fitTargetKm(). Ako nijedan cilj nije
 * izvodljiv: minimum nedelje.
 */
export function capacityKm(p: PaceModel, days: Athlete | RunDaysCount): number {
  const { lo, ok } = feasibility(p, asAthlete(days));
  const k = ok.lastIndexOf(true);
  return (lo + Math.max(k, 0)) / 10;
}

/**
 * 2.4.1 (Odluka 2): cilj nedelje u rupi izvodljivih → najveći izvodljiv cilj ≤ želje (deterministička
 * pretraga naniže, korak 0,1 km). Ispod minimuma nedelje, ili kad ispod želje nema izvodljivog cilja,
 * želja ostaje (konstrukcija/validator prijavljuju). JEDINO mesto korekcije cilja zbog rupa.
 */
export function fitTargetKm(wish: number, p: PaceModel, days: Athlete | RunDaysCount): number {
  const { lo, ok } = feasibility(p, asAthlete(days));
  const k = Math.round(wish * 10) - lo;
  if (k < 0 || k >= ok.length || ok[k]) return wish;
  for (let j = k - 1; j >= 0; j--) if (ok[j]) return (lo + j) / 10;
  return wish;
}

/**
 * Start = min(trenutni obim, kapacitet). 2.4.1: svaki cilj (start, izgradnja, rasterećenje, taper) prolazi
 * kroz fitTargetKm (rupe izvodljivih ciljeva); rast se računa od stvarnog cilja. Izgradnja: +maxBuildGrowth (2.4.0 početnik 5%) od poslednje
 * ne-rasteretne nedelje izgradnje, do peakKm(start). Oštrenje drži obim. Rasterećenje ≈ deloadFactor ×
 * prethodna nedelja. Taper je udeo vrha (vrh = najveći cilj izgradnje); trkačka nedelja: gornja
 * granica = udeo vrha.
 */
export function planVolume(
  frames: readonly WeekFrame[],
  currentKm: number,
  p: PaceModel,
  days: Athlete | RunDaysCount
): VolumePlan {
  const a = asAthlete(days);
  const growth = rulesOf(a).maxBuildGrowth;
  const capacity = capacityKm(p, a);
  const fit = (t: number): number => fitTargetKm(t, p, a);
  const startKm = fit(Math.min(round1(currentKm), capacity));
  const cap = peakKm(startKm, capacity, a);
  const targets: number[] = [];
  let lastBuild: number | null = null;
  for (const f of frames) {
    if (f.phase === 'taper' || f.phase === 'race') break;
    let t: number;
    if (f.deload) t = round1((targets[targets.length - 1] ?? startKm) * P.volume.deloadFactor);
    else if (lastBuild === null) t = startKm;
    else if (f.phase === 'sharpen') t = lastBuild;
    else t = Math.min(floor1(lastBuild * (1 + growth)), cap);
    t = fit(t);
    if (!f.deload) lastBuild = t;
    targets.push(t);
  }
  const peak = Math.max(...targets);
  for (const f of frames) {
    if (f.phase === 'taper')
      targets.push(fit(round1(peak * P.volume.taperFactors[(f.taperStep ?? 1) - 1]!)));
    else if (f.phase === 'race') targets.push(round1(peak * P.volume.raceWeekFactor));
  }
  return {
    startKm,
    peakKm: peak,
    capacityKm: capacity,
    startCapped: round1(currentKm) > capacity,
    targets
  };
}

/** 2.5.0: donja granica cilja adaptirane nedelje = min(cilj nedelje u planu generatora, donja granica
    ulaza za broj dana — 12/15/25 km): smanjenje (pauza, izvršenje, rasterećenje, taper od manjeg vrha)
    ne pravi nedelju manju i od originalne i od najmanjeg podržanog obima, jer takva nedelja ne prima
    kvalitet ni lagane dane ≥ minimuma (heuristika). Za nepromenjen cilj je bez dejstva (cilj ≥ granice). */
export function adaptFloorKm(originalKm: number, a: Athlete): number {
  return Math.min(originalKm, rulesOf(a).weeklyKm.min);
}

/** 2.5.0: deo koraka adaptacije koji određuje obim (AdaptStep iz types.ts). */
export interface VolumeStep {
  firstWeek: number;
  fromWeek: number;
  startKm: number | null;
  pauseRemainder: boolean;
  restart: boolean;
}

const isBuildFrame = (f: WeekFrame): boolean =>
  f.phase === 'base' || f.phase === 'peak' || f.phase === 'sharpen';

/**
 * 2.5.0: ciljevi posle koraka adaptacije — JEDINO mesto odluke o obimu adaptiranog plana; isti rekurent
 * kao planVolume (rasterećenje × deloadFactor prethodne, oštrenje drži, rast ≤ maxBuildGrowth do
 * peakKm, fitTargetKm), samo od nedelje fromWeek i sa tempom te nedelje (`ctx`):
 * - startKm (pauza / izvršenje / „više od plana"): cilj nedelje fromWeek, rast dalje od njega; pauza i
 *   ostatak tekuće nedelje (firstWeek);
 * - nov start (restart): vrh = peakKm(startKm); inače peakKm(start plana);
 * - taper i trkačka nedelja od firstWeek: udeo vrha, gde je vrh = najveći cilj izgradnje od poslednjeg
 *   starta (startKm u izgradnji), a ako je startKm zadat u taperu: min(vrh, startKm);
 * - svaki cilj ≥ adaptFloorKm (pauza: ostatak tekuće nedelje ≤ njenog cilja).
 * Bez koraka (ili koraka bez promene) ciljevi su isti kao planVolume.
 */
export function adaptVolume(
  frames: readonly WeekFrame[],
  base: VolumePlan,
  steps: readonly VolumeStep[],
  ctx: (week: number) => { p: PaceModel; a: Athlete }
): { targets: number[]; peakKm: number; startRefKm: number } {
  const targets = [...base.targets];
  let startRef = base.startKm;
  let peakRef = base.peakKm;
  let resetFrom = 1;
  let tailCap: number | null = null;
  /** Nedelje sa ciljem koraka (osnov rasta i kad su rasteretne). */
  const resets = new Set<number>();
  const fitAt = (w: number, t: number): number => {
    const { p, a } = ctx(w);
    const floor = adaptFloorKm(base.targets[w - 1]!, a);
    return fitTargetKm(Math.min(Math.max(t, floor), capacityKm(p, a)), p, a);
  };
  for (const s of steps) {
    const n = s.fromWeek;
    const { p, a } = ctx(Math.min(n, frames.length));
    if (s.restart && s.startKm !== null) startRef = s.startKm;
    const cap = peakKm(startRef, capacityKm(p, a), a);
    const growth = rulesOf(a).maxBuildGrowth;
    const r = s.firstWeek;
    if (s.pauseRemainder && s.startKm !== null && r < n && isBuildFrame(frames[r - 1]!))
      targets[r - 1] = fitAt(r, Math.min(s.startKm, targets[r - 1]!));
    let lastBuild: number | null = null;
    for (let i = 0; i < n - 1 && i < frames.length; i++)
      if (isBuildFrame(frames[i]!) && (!frames[i]!.deload || resets.has(i + 1)))
        lastBuild = targets[i]!;
    for (let i = n - 1; i < frames.length && isBuildFrame(frames[i]!); i++) {
      const f = frames[i]!;
      let t: number;
      if (i === n - 1 && s.startKm !== null) t = s.startKm;
      // Rasterećenje: deloadFactor × poslednja ne-rasteretna nedelja (u generatoru je to uvek prethodna;
      // prisilno rasterećenje odmah posle redovnog se ne sabija dvaput).
      else if (f.deload)
        t = round1((lastBuild ?? targets[i - 1] ?? startRef) * P.volume.deloadFactor);
      else if (lastBuild === null) t = startRef;
      else if (f.phase === 'sharpen') t = lastBuild;
      else t = Math.min(floor1(lastBuild * (1 + growth)), cap);
      t = fitAt(i + 1, t);
      // Cilj koraka je osnov daljeg rasta i kad je nedelja rasteretna (obim pre pauze/smanjenja ne važi).
      if (!f.deload || (i === n - 1 && s.startKm !== null)) lastBuild = t;
      targets[i] = t;
    }
    if (s.startKm !== null) {
      resets.add(n);
      if (n <= frames.length && isBuildFrame(frames[n - 1]!)) {
        resetFrom = n;
        tailCap = null;
      } else tailCap = Math.min(peakRef, s.startKm);
    }
    const build = targets.filter((_, i) => i >= resetFrom - 1 && isBuildFrame(frames[i]!));
    peakRef = tailCap ?? Math.max(...build);
    for (let i = r - 1; i < frames.length; i++) {
      const f = frames[i]!;
      if (f.phase === 'taper')
        targets[i] = fitAt(i + 1, round1(peakRef * P.volume.taperFactors[(f.taperStep ?? 1) - 1]!));
      else if (f.phase === 'race') targets[i] = round1(peakRef * P.volume.raceWeekFactor);
    }
  }
  return { targets, peakKm: peakRef, startRefKm: startRef };
}
