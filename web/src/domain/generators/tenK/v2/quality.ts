/* D12 — izbor doze kvaliteta po slotu (jedino mesto); D11 plafon ograničava izbor; D5/D7 doza
   rasterećenja i tapera. Stanje slota = izbor poslednje ne-rasteretne nedelje izgradnje. */

import { TEN_K_V2_POLICY as P } from './policy.ts';
import type { Dose, LadderId, Paces, Phase, Structure, WorkZone } from './types.ts';
import {
  doseOf,
  ladderLevels,
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

/** D10: lestvica slota po fazi izgradnje. */
export function ladderFor(phase: Phase, slot: 'q1' | 'q2'): LadderId {
  if (phase === 'base') return slot === 'q1' ? 'R' : 'T_continuous';
  if (phase === 'development') return slot === 'q1' ? 'I' : 'T_cruise';
  return slot === 'q1' ? 'RP' : 'T_cruise';
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
  const reps = (s: Structure): number => (s.form === 'continuous' ? 1 : s.reps);
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

/**
 * D12 za jedan slot. null = ni ista doza ne staje u plafon pri ovom cilju (cilj nije izvodljiv).
 * - prvi put: prvi nivo lestvice;
 * - prelaz faze: T cruise ≥ poslednje T kontinuirano, RP ≥ poslednje I (najmanji takav nivo; ako ne
 *   staje u plafon — ista doza druge strukture); I posle R kreće od prvog nivoa;
 * - ista lestvica: sledeći nivo ako staje u plafon, inače ista doza druge strukture (ako ne postoji —
 *   ponavljanje, D10).
 * `allowDrop` (samo kad nedelja nije izvodljiva NI PRI JEDNOM cilju uz „doza ne pada"): doza koja ne
 * staje u plafon spušta se na najviši nivo lestvice koji staje — plafon D11 ispred D12 (opreznije).
 */
export function pickSlot(
  prev: SlotState | null,
  ladder: LadderId,
  targetKm: number,
  p: Paces,
  allowDrop = false
): Dose | null {
  const cap = capM(zoneOf(ladder), targetKm);
  const levels = ladderLevels(ladder);
  const first = levels[0]!;
  const drop = (): Dose | null => {
    const lv = allowDrop ? levels.filter((s) => doseOf(s) <= cap).pop() : undefined;
    return lv ? pick(ladder, lv, 'drop') : null;
  };
  if (!prev) return doseOf(first) <= cap ? pick(ladder, first, 'start') : null;
  if (prev.ladder !== ladder) {
    const carry =
      (prev.ladder === 'T_continuous' && ladder === 'T_cruise') ||
      (prev.ladder === 'I' && ladder === 'RP');
    if (!carry) return doseOf(first) <= cap ? pick(ladder, first, 'transition') : null;
    const lv = levels.find((s) => doseOf(s) >= prev.doseM);
    if (lv && doseOf(lv) <= cap) return pick(ladder, lv, 'transition');
    if (prev.doseM > cap) return drop();
    const s =
      otherStructure(ladder, prev.doseM, prev.structure, p) ??
      structuresForDose(ladder, prev.doseM)[0];
    return s ? pick(ladder, s, 'transition') : null;
  }
  const next = nextLevel(ladder, prev.doseM);
  if (next && doseOf(next) <= cap) return pick(ladder, next, 'next');
  if (prev.doseM > cap) return drop();
  const alt = otherStructure(ladder, prev.doseM, prev.structure, p);
  return alt ? pick(ladder, alt, 'alt') : pick(ladder, prev.structure, 'repeat');
}

/** Oba slota nedelje izgradnje. */
export function pickBuild(
  state: QualityState,
  phase: Phase,
  targetKm: number,
  p: Paces,
  allowDrop = false
): { q1: Dose; q2: Dose } | null {
  const q1 = pickSlot(state.q1, ladderFor(phase, 'q1'), targetKm, p, allowDrop);
  const q2 = pickSlot(state.q2, ladderFor(phase, 'q2'), targetKm, p, allowDrop);
  return q1 && q2 ? { q1, q2 } : null;
}

export function advance(picks: { q1: Dose; q2: Dose }): QualityState {
  const slot = (d: Dose): SlotState => ({
    ladder: d.ladder as LadderId,
    doseM: d.doseM,
    structure: d.structure
  });
  return { q1: slot(picks.q1), q2: slot(picks.q2) };
}

/** ≈ share × poslednja doza, nivo lestvice naniže; ispod najnižeg nivoa → `floor` (min). */
function reduced(ladder: LadderId, lastM: number, share: number, floor: Structure): Structure {
  const limit = share * lastM + 1e-6;
  const lv = ladderLevels(ladder).filter((s) => doseOf(s) <= limit && doseOf(s) >= doseOf(floor));
  return lv[lv.length - 1] ?? floor;
}

/** D5: jedini kvalitet rasterećenja — T ≈ 60 % poslednje T doze (lestvica faze), min 2,0 km. */
export function pickDeload(state: QualityState, phase: Phase, targetKm: number): Dose | null {
  const ladder = ladderFor(phase, 'q2');
  const lastT = state.q2?.doseM ?? 0;
  const minM = Math.round(P.deload.tMinKm * 1000);
  const floor = ladderLevels(ladder).find((s) => doseOf(s) === minM)!;
  const s = reduced(ladder, lastT, P.deload.tShare, floor);
  return doseOf(s) <= capM('T', targetKm) ? pick(ladder, s, 'deload') : null;
}

/** D7: taper — RP i T, svaki ≈ 60 % poslednje doze zone (naniže; min 2 × 1000 m RP, 2,0 km T). */
export function pickTaper(state: QualityState, targetKm: number): { q1: Dose; q2: Dose } | null {
  const t = P.taper;
  const rpFloor: Structure = { form: 'reps', reps: t.rpMin.reps, repM: t.rpMin.repM };
  const tMinM = Math.round(t.tMinKm * 1000);
  const tFloor = ladderLevels('T_cruise').find((s) => doseOf(s) === tMinM)!;
  const rp = reduced('RP', state.q1?.doseM ?? 0, t.doseShare, rpFloor);
  const tt = reduced('T_cruise', state.q2?.doseM ?? 0, t.doseShare, tFloor);
  if (doseOf(rp) > capM('RP', targetKm) || doseOf(tt) > capM('T', targetKm)) return null;
  return { q1: pick('RP', rp, 'taper'), q2: pick('T_cruise', tt, 'taper') };
}
