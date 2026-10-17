/* D12 — izbor doze kvaliteta po slotu (jedino mesto); D16 početni nivo; D11 plafon ograničava izbor;
   D5/D7 doza rasterećenja i tapera; D18 jedan kvalitet (3 dana). Stanje slota = izbor poslednje
   ne-rasteretne nedelje izgradnje. `quality` = broj kvalitetnih dana iz tabele D17 (1 ili 2). */

import { TEN_K_V2_POLICY as P } from './policy.ts';
import type { Dose, LadderId, Paces, Phase, Structure, WorkZone } from './types.ts';
import {
  doseOf,
  ladderLevels,
  repsOf,
  sameStructure,
  structureKm100,
  structuresForDose,
  zoneOf
} from './workouts.ts';

export interface SlotState {
  ladder: LadderId;
  doseM: number;
  structure: Structure;
}

export interface QualityState {
  q1: SlotState | null;
  q2: SlotState | null;
}

export const INITIAL_QUALITY: QualityState = { q1: null, q2: null };

/** D10: lestvica slota po fazi izgradnje (4–6 dana); D18: jedan kvalitet — baza T kontinuirano, razvoj
    T cruise, specifično RP (bez I i R). */
export function ladderFor(phase: Phase, slot: 'q1' | 'q2', quality: 1 | 2): LadderId {
  if (quality === 1)
    return phase === 'base' ? 'T_continuous' : phase === 'development' ? 'T_cruise' : 'RP';
  if (phase === 'base') return slot === 'q1' ? 'R' : 'T_continuous';
  if (phase === 'development') return slot === 'q1' ? 'I' : 'T_cruise';
  return slot === 'q1' ? 'RP' : 'T_cruise';
}

/** D5/D18: lestvica jedinog kvaliteta rasterećenja (T): baza T kontinuirano, inače T cruise. */
export const deloadLadder = (phase: Phase): LadderId =>
  phase === 'base' ? 'T_continuous' : 'T_cruise';

/** Slot čiju poslednju dozu rasterećenje smanjuje (i na čijem je danu): T slot Q2; 3 dana jedini slot Q1. */
export const deloadSlot = (quality: 1 | 2): 'q1' | 'q2' => (quality === 1 ? 'q1' : 'q2');

/** D12/D18: prelaz faze koji nosi dozu — T cruise ≥ poslednje T kontinuirano; RP ≥ poslednje I (4–6
    dana) ili poslednje T (3 dana). */
export function carries(from: LadderId, to: LadderId): boolean {
  return (
    (from === 'T_continuous' && to === 'T_cruise') ||
    (to === 'RP' && (from === 'I' || from === 'T_continuous' || from === 'T_cruise'))
  );
}

/** D11: plafon zone za trening, u metrima, za ciljni obim nedelje. */
export function capM(zone: WorkZone, targetKm: number): number {
  return Math.floor(P.caps[zone] * targetKm * 1000 + 1e-6);
}

const pick = (ladder: LadderId, s: Structure, step: Dose['step']): Dose => ({
  ladder,
  zone: zoneOf(ladder),
  doseM: doseOf(s),
  structure: s,
  step
});

/** Druga struktura iste doze: najbliža prethodnoj po km rada + oporavka (nedelja zadržava obim), pa
    manje deonica, pa redosled pravila. null = druge strukture nema. */
export function otherStructure(
  ladder: LadderId,
  doseM: number,
  prev: Structure,
  p: Paces
): Structure | null {
  const base = structureKm100(ladder, prev, p);
  const reps = (s: Structure): number => Math.max(1, repsOf(s).length);
  const opts = structuresForDose(ladder, doseM).filter((x) => !sameStructure(x, prev));
  let best: Structure | null = null;
  for (const s of opts) {
    if (!best) {
      best = s;
      continue;
    }
    const d = Math.abs(structureKm100(ladder, s, p) - base);
    const db = Math.abs(structureKm100(ladder, best, p) - base);
    if (d < db || (d === db && reps(s) < reps(best))) best = s;
  }
  return best;
}

/** Najmanji nivo lestvice čija je doza > doseM (sledeći nivo; najviše 1 nivo nedeljno). */
export function nextLevel(ladder: LadderId, doseM: number): Structure | null {
  return ladderLevels(ladder).find((s) => doseOf(s) > doseM) ?? null;
}

/** D16: početni nivo — najviši nivo lestvice ≤ 60 % plafona zone (D11) za cilj nedelje, najmanje prvi
    nivo. null = ni prvi nivo ne staje u plafon. */
export function startLevel(ladder: LadderId, targetKm: number): Structure | null {
  const levels = ladderLevels(ladder);
  const cap = capM(zoneOf(ladder), targetKm);
  if (doseOf(levels[0]!) > cap) return null;
  const limit = P.startLevel.capShare * cap + 1e-6;
  return levels.filter((s) => doseOf(s) <= limit).pop() ?? levels[0]!;
}

/**
 * D12 za jedan slot. null = ni ista doza ne staje u plafon pri ovom cilju (cilj nije izvodljiv).
 * - prvi put: početni nivo (D16);
 * - prelaz faze: I posle R kreće od početnog nivoa (D16); T cruise ≥ poslednje T kontinuirano (ista
 *   zona, samo D12); RP ≥ max(početni nivo D16, poslednje I — kod 3 dana poslednje T, D18) — najmanji
 *   takav nivo; ako ne staje u plafon, ista doza druge strukture;
 * - ista lestvica: sledeći nivo ako staje u plafon, inače ista doza druge strukture (ako ne postoji —
 *   ponavljanje, D10).
 * `allowDrop` (samo kad nedelja nije izvodljiva NI PRI JEDNOM cilju uz „doza ne pada"): doza koja ne
 * staje u plafon spušta se na najviši nivo lestvice koji staje — plafon D11 ispred D12 (D12).
 * `oneSlot` (3 dana, D18): prelaz u istoj zoni (T kontinuirano → T cruise) koji bi dao isti trening ide
 * kao ista lestvica — inače bi nedelja bila identična prethodnoj (D12).
 */
export function pickSlot(
  prev: SlotState | null,
  ladder: LadderId,
  targetKm: number,
  p: Paces,
  allowDrop = false,
  oneSlot = false
): Dose | null {
  const cap = capM(zoneOf(ladder), targetKm);
  const levels = ladderLevels(ladder);
  const start = startLevel(ladder, targetKm);
  const drop = (): Dose | null => {
    const lv = allowDrop ? levels.filter((s) => doseOf(s) <= cap).pop() : undefined;
    return lv ? pick(ladder, lv, 'drop') : null;
  };
  if (!prev) return start ? pick(ladder, start, 'start') : null;
  // Ista lestvica: sledeći nivo ako staje u plafon, inače ista doza druge strukture (nema je — ponavljanje).
  const progress = (): Dose | null => {
    const next = nextLevel(ladder, prev.doseM);
    if (next && doseOf(next) <= cap) return pick(ladder, next, 'next');
    if (prev.doseM > cap) return drop();
    const alt = otherStructure(ladder, prev.doseM, prev.structure, p);
    return alt ? pick(ladder, alt, 'alt') : pick(ladder, prev.structure, 'repeat');
  };
  if (prev.ladder === ladder) return progress();
  if (!carries(prev.ladder, ladder)) return start ? pick(ladder, start, 'transition') : null;
  const newZone = zoneOf(prev.ladder) !== zoneOf(ladder);
  const repeats = (s: Structure): boolean =>
    oneSlot && !newZone && sameStructure(s, prev.structure);
  const lo = Math.max(prev.doseM, newZone && start ? doseOf(start) : 0);
  const lv = levels.find((s) => doseOf(s) >= lo);
  if (lv && doseOf(lv) <= cap) return repeats(lv) ? progress() : pick(ladder, lv, 'transition');
  if (prev.doseM > cap) return drop();
  const s =
    otherStructure(ladder, prev.doseM, prev.structure, p) ??
    structuresForDose(ladder, prev.doseM)[0];
  if (!s) return null;
  return repeats(s) ? progress() : pick(ladder, s, 'transition');
}

export interface Picks {
  q1: Dose;
  /** null kod 3 dana (D18). */
  q2: Dose | null;
}

/** Slotovi nedelje izgradnje: Q1 i Q2 (4–6 dana) ili samo Q1 (3 dana, D18). */
export function pickBuild(
  state: QualityState,
  phase: Phase,
  targetKm: number,
  p: Paces,
  quality: 1 | 2,
  allowDrop = false
): Picks | null {
  const q1 = pickSlot(
    state.q1,
    ladderFor(phase, 'q1', quality),
    targetKm,
    p,
    allowDrop,
    quality === 1
  );
  if (quality === 1) return q1 ? { q1, q2: null } : null;
  const q2 = pickSlot(state.q2, ladderFor(phase, 'q2', quality), targetKm, p, allowDrop);
  return q1 && q2 ? { q1, q2 } : null;
}

export function advance(picks: Picks): QualityState {
  const slot = (d: Dose): SlotState => ({
    ladder: d.ladder as LadderId,
    doseM: d.doseM,
    structure: d.structure
  });
  return { q1: slot(picks.q1), q2: picks.q2 ? slot(picks.q2) : null };
}

/** ≈ share × poslednja doza, nivo lestvice naniže; ispod najnižeg nivoa → `floor` (min). */
function reduced(ladder: LadderId, lastM: number, share: number, floor: Structure): Structure {
  const limit = share * lastM + 1e-6;
  const lv = ladderLevels(ladder).filter((s) => doseOf(s) <= limit && doseOf(s) >= doseOf(floor));
  return lv[lv.length - 1] ?? floor;
}

/** D5: jedini kvalitet rasterećenja — T ≈ 60 % poslednje doze T slota (3 dana: jedinog slota, D18;
    lestvica faze), min 2,0 km. */
export function pickDeload(
  state: QualityState,
  phase: Phase,
  targetKm: number,
  quality: 1 | 2
): Dose | null {
  const ladder = deloadLadder(phase);
  const lastM = state[deloadSlot(quality)]?.doseM ?? 0;
  const minM = Math.round(P.deload.tMinKm * 1000);
  const floor = ladderLevels(ladder).find((s) => doseOf(s) === minM)!;
  const s = reduced(ladder, lastM, P.deload.tShare, floor);
  return doseOf(s) <= capM('T', targetKm) ? pick(ladder, s, 'deload') : null;
}

/** D7: taper — RP i T, svaki ≈ 60 % poslednje doze zone (naniže; min 2 × 1000 m RP, 2,0 km T); 3 dana
    samo RP (D18). `relax` (druga pretraga, samo kad nijedan cilj nije izvodljiv po pravilu): T otpada
    (4–6 dana); kad ni RP ne staje u plafon D11, taper je bez kvaliteta (odstupanje D7). */
export function pickTaper(
  state: QualityState,
  targetKm: number,
  quality: 1 | 2,
  relax = false
): Picks | null | 'none' {
  const t = P.taper;
  const rpFloor: Structure = { form: 'reps', reps: t.rpMin.reps, repM: t.rpMin.repM };
  const rp = reduced('RP', state.q1?.doseM ?? 0, t.doseShare, rpFloor);
  if (doseOf(rp) > capM('RP', targetKm)) return relax ? 'none' : null;
  if (quality === 1 || relax) return { q1: pick('RP', rp, 'taper'), q2: null };
  const tMinM = Math.round(t.tMinKm * 1000);
  const tFloor = ladderLevels('T_cruise').find((s) => doseOf(s) === tMinM)!;
  const tt = reduced('T_cruise', state.q2?.doseM ?? 0, t.doseShare, tFloor);
  if (doseOf(tt) > capM('T', targetKm)) return null;
  return { q1: pick('RP', rp, 'taper'), q2: pick('T_cruise', tt, 'taper') };
}
