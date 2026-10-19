/* H12 — izbor doze kvaliteta po slotu (jedino mesto); početni nivo; H11 plafon ograničava izbor; H5/H7 doza
   rasterećenja i tapera. Stanje slota = poslednji izbor slota u ne-rasteretnoj nedelji izgradnje. */

import { HM_V2_POLICY as P } from './policy.ts';
import type { Dose, LadderId, Paces, Phase, Structure, WorkZone } from './types.ts';
import {
  doseOf,
  ladderLevels,
  repsOf,
  sameStructure,
  structureKm100,
  structuresForDose,
  tFloorStructure,
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

/** H10: lestvica slota po fazi izgradnje. */
export function ladderFor(phase: Phase, slot: 'q1' | 'q2'): LadderId {
  if (phase === 'base') return slot === 'q1' ? 'R' : 'T_continuous';
  if (phase === 'development') return slot === 'q1' ? 'I' : 'T_cruise';
  return slot === 'q1' ? 'RP' : 'T_cruise';
}

/** H5: lestvica jedinog kvaliteta rasterećenja (T slot Q2): baza T kontinuirano, inače T cruise. */
export const deloadLadder = (phase: Phase): 'T_continuous' | 'T_cruise' =>
  phase === 'base' ? 'T_continuous' : 'T_cruise';

/** H12: prelaz faze koji nosi dozu — T cruise ≥ poslednje T kontinuirano; RP ≥ poslednje I. */
export function carries(from: LadderId, to: LadderId): boolean {
  return (from === 'T_continuous' && to === 'T_cruise') || (from === 'I' && to === 'RP');
}

/** H11: plafon zone za trening, u metrima, za ciljni obim nedelje. */
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

/** H12: početni nivo — najviši nivo lestvice ≤ 60 % plafona zone (H11) za cilj nedelje, najmanje prvi nivo.
    null = ni prvi nivo ne staje u plafon. */
export function startLevel(ladder: LadderId, targetKm: number): Structure | null {
  const levels = ladderLevels(ladder);
  const cap = capM(zoneOf(ladder), targetKm);
  if (doseOf(levels[0]!) > cap) return null;
  const limit = P.startLevel.capShare * cap + 1e-6;
  return levels.filter((s) => doseOf(s) <= limit).pop() ?? levels[0]!;
}

/**
 * H12 za jedan slot. null = ni ista doza ne staje u plafon pri ovom cilju (cilj nije izvodljiv).
 * - prvi put: početni nivo;
 * - prelaz faze: I posle R kreće od početnog nivoa; T cruise ≥ poslednje T kontinuirano (ista zona);
 *   RP ≥ max(početni nivo, poslednje I) — najmanji takav nivo; ako ne staje u plafon, ista doza druge
 *   strukture;
 * - ista lestvica: sledeći nivo ako staje u plafon, inače ista doza druge strukture (ako ne postoji —
 *   ponavljanje, H10).
 * `allowDrop` (samo kad nedelja nije izvodljiva NI PRI JEDNOM cilju uz „doza ne pada"): doza koja ne
 * staje u plafon spušta se na najviši nivo lestvice koji staje — plafon H11 ispred H12 (pouka 12).
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
  const start = startLevel(ladder, targetKm);
  const drop = (): Dose | null => {
    const lv = allowDrop ? levels.filter((s) => doseOf(s) <= cap).pop() : undefined;
    return lv ? pick(ladder, lv, 'drop') : null;
  };
  if (!prev) return start ? pick(ladder, start, 'start') : null;
  if (prev.ladder === ladder) {
    const next = nextLevel(ladder, prev.doseM);
    if (next && doseOf(next) <= cap) return pick(ladder, next, 'next');
    if (prev.doseM > cap) return drop();
    const alt = otherStructure(ladder, prev.doseM, prev.structure, p);
    return alt ? pick(ladder, alt, 'alt') : pick(ladder, prev.structure, 'repeat');
  }
  if (!carries(prev.ladder, ladder)) return start ? pick(ladder, start, 'transition') : null;
  const newZone = zoneOf(prev.ladder) !== zoneOf(ladder);
  const lo = Math.max(prev.doseM, newZone && start ? doseOf(start) : 0);
  const lv = levels.find((s) => doseOf(s) >= lo);
  if (lv && doseOf(lv) <= cap) return pick(ladder, lv, 'transition');
  if (prev.doseM > cap) return drop();
  const s =
    otherStructure(ladder, prev.doseM, prev.structure, p) ??
    structuresForDose(ladder, prev.doseM)[0];
  return s ? pick(ladder, s, 'transition') : null;
}

export interface Picks {
  q1: Dose;
  q2: Dose;
}

/** Slotovi nedelje izgradnje. null = nedelja nije izvodljiva pri ovom cilju. */
export function pickBuild(
  state: QualityState,
  phase: Phase,
  targetKm: number,
  p: Paces,
  allowDrop = false
): Picks | null {
  const q1 = pickSlot(state.q1, ladderFor(phase, 'q1'), targetKm, p, allowDrop);
  if (!q1) return null;
  const q2 = pickSlot(state.q2, ladderFor(phase, 'q2'), targetKm, p, allowDrop);
  return q2 ? { q1, q2 } : null;
}

/** Stanje posle nedelje izgradnje. */
export function advance(picks: Picks): QualityState {
  const slot = (d: Dose): SlotState => ({
    ladder: d.ladder as LadderId,
    doseM: d.doseM,
    structure: d.structure
  });
  return { q1: slot(picks.q1), q2: slot(picks.q2) };
}

/** H5/H7: ≈ share × poslednja doza — najviši nivo lestvice ≤ share × poslednja i ≥ najmanja doza; ispod
    najnižeg nivoa → `floor` (najmanja doza). Jedna funkcija za konstruktor i validator (pouka 24). */
export function reducedStructure(
  ladder: LadderId,
  lastM: number,
  share: number,
  floor: Structure
): Structure {
  const limit = share * lastM + 1e-6;
  const lv = ladderLevels(ladder).filter((s) => doseOf(s) <= limit && doseOf(s) >= doseOf(floor));
  return lv[lv.length - 1] ?? floor;
}

/** H5: najmanja T doza rasterećenja i tapera kao struktura (2,0 km; T cruise 2 × 1000 m). */
export const tMinStructure = (ladder: 'T_continuous' | 'T_cruise', minKm: number): Structure =>
  tFloorStructure(ladder, Math.round(minKm * 1000));

/** H5: jedini kvalitet rasterećenja — T ≈ 60 % poslednje doze T slota (Q2), lestvica faze, min 2,0 km.
    null = ne staje u plafon H11 (izgradnja: nije izvodljivo; druga pretraga: bez kvaliteta). */
export function deloadDose(state: QualityState, phase: Phase): Dose {
  const ladder = deloadLadder(phase);
  const s = reducedStructure(
    ladder,
    state.q2?.doseM ?? 0,
    P.deload.tShare,
    tMinStructure(ladder, P.deload.tMinKm)
  );
  return pick(ladder, s, 'deload');
}

/** H7: taper — RP i T (cruise), svaki ≈ 60 % poslednje doze zone (naniže; min 2 × 2000 m RP, 2,0 km T). */
export function taperDoses(state: QualityState): Picks {
  const t = P.taper;
  const rpFloor: Structure = { form: 'reps', reps: t.rpMin.reps, repM: t.rpMin.repM };
  const rp = reducedStructure('RP', state.q1?.doseM ?? 0, t.doseShare, rpFloor);
  const tt = reducedStructure(
    'T_cruise',
    state.q2?.doseM ?? 0,
    t.doseShare,
    tMinStructure('T_cruise', t.tMinKm)
  );
  return { q1: pick('RP', rp, 'taper'), q2: pick('T_cruise', tt, 'taper') };
}
