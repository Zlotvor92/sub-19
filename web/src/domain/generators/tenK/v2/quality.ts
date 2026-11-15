/* D12 — izbor doze kvaliteta po slotu (jedino mesto); D16 početni nivo (početnik: prvi nivo, D28); D11
   plafon ograničava izbor; D5/D7 doza rasterećenja i tapera; D18 jedan kvalitet (3 dana, početnik); D31
   početnik — T kontinuirano od 1,5 km i umesto lestvice faze čiji prvi nivo ne staje u plafon. Stanje
   slota = poslednji izbor slota u ne-rasteretnoj nedelji izgradnje (test D27 i nedelja bez kvaliteta ga ne
   menjaju). `quality` = broj kvalitetnih dana iz pravila plana (1 ili 2). */

import { capShare, type PlanRule, startShare, TEN_K_V2_POLICY as P } from './policy.ts';
import type { Dose, LadderId, Paces, Phase, Structure, WeekLimits, WorkZone } from './types.ts';
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
  /** D31: poslednja doza u zoni T iz ne-rasteretne nedelje izgradnje [m] (0 = nema); čita je samo
      rasterećenje i taper početnika. */
  t: number;
  /** D34: najveća I doza iz ne-rasteretne nedelje izgradnje (pri istoj dozi poslednja struktura) — doza i struktura I
      održavanja (null = nema). */
  i: SlotState | null;
}

export const INITIAL_QUALITY: QualityState = { q1: null, q2: null, t: 0, i: null };

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
    dana) ili poslednje T (3 dana); D31: T kontinuirano početnika posle T cruise ≥ poslednje T (ista zona). */
export function carries(from: LadderId, to: LadderId): boolean {
  return (
    (from === 'T_continuous' && to === 'T_cruise') ||
    (from === 'T_cruise' && to === 'T_continuous') ||
    (to === 'RP' && (from === 'I' || from === 'T_continuous' || from === 'T_cruise'))
  );
}

/** G2 (P8): lestvice zone (T: kontinuirano i cruise). */
const ZONE_LADDERS: Readonly<Record<WorkZone, readonly LadderId[]>> = {
  T: ['T_continuous', 'T_cruise'],
  I: ['I'],
  R: ['R'],
  RP: ['RP']
};

/** G2 (P8): doza prvog nivoa lestvice zone [m] — najmanja među lestvicama zone (`beginner`: lestvice početnika, D31). */
export function zoneFloorM(zone: WorkZone, beginner: boolean): number {
  return Math.min(...ZONE_LADDERS[zone].map((l) => doseOf(ladderLevels(l, beginner)[0]!)));
}

/** D11/D33 + G2 (P8) + G4 (P8 dopuna): plafon zone za trening, u metrima, za ciljni obim nedelje = max(udeo (policy.capShare) × cilj;
    doza prvog nivoa lestvice zone) — najniži nivo uvek staje. JEDINI plafon zone (konstruktor i validator). */
export function capM(
  zone: WorkZone,
  targetKm: number,
  beginner: boolean,
  p: Paces,
  k3 = true
): number {
  const floor = zoneFloorM(zone, beginner);
  // S3 (P8 završetak, D49): plafon T početnika = max(udeo × cilj; beginner.tCapMinKm) — lestvica napreduje do 3,0 km i pri
  // malom obimu (G4 minuti i dalje ograničavaju; najniži nivo i dalje staje).
  const shareFloor =
    beginner && zone === 'T' ? Math.max(floor, Math.round(P.beginner.tCapMinKm * 1000)) : floor;
  const share = Math.max(Math.floor(capShare(zone, targetKm) * targetKm * 1000 + 1e-6), shareFloor);
  const range = doseRangeSec(zone, targetKm, beginner, p.vdot);
  // G4 (P8 dopuna, D43): plafon jednog treninga u minutima rada po tempu zone te nedelje (najniži nivo i dalje staje);
  // K3-A: gornja granica opsega zamenjuje minute G4 (I VDOT < 40: 18 min; RP: 30 min = G4).
  const min = range ? range.hi : minutesCapSec(zone, targetKm, p.vdot);
  const g4 =
    min === null
      ? share
      : Math.min(share, Math.max(floor, Math.floor((min / p[zone]) * 1000 + 1e-6)));
  // K3-A (10k-v2.15.0): I sa donjom granicom opsega — plafon je gornja granica opsega u minutima (umesto udela D11), ali
  // ne iznad plafona RP iste nedelje (prelaz I → RP nosi dozu, D12; bez toga RP spušta dozu ispod I). RP: plafon ostaje
  // udeo D33 i G4 (30 min = gornja granica opsega) — sa samo minutima taper (60 %) ne bi stao u plafon (K3-10K § K3-A).
  // `k3` false (nedelja u kojoj bi K3-A stvorio nedelju pouke 35, pickBuild): plafon kao pre K3-A, ne iznad gornje granice.
  if (!range || range.lo <= 0 || zone !== 'I' || !k3) return g4;
  const hi = Math.max(floor, Math.floor((range.hi / p[zone]) * 1000 + 1e-6));
  return Math.min(hi, Math.max(floor, capM('RP', targetKm, beginner, p)));
}

/** G4 (P8 dopuna, D43): plafon rada jednog treninga zone [s] — T 30 min (cilj ≥ 80 km: 40), I 20 min (VDOT < 40) / 24 min,
    RP 30 min; R bez plafona u minutima (null). */
export function minutesCapSec(zone: WorkZone, targetKm: number, vdot: number): number | null {
  const m = P.minutesCap;
  if (zone === 'T') return (targetKm + 1e-9 >= m.tBigFromKm ? m.tBigMin : m.tMin) * 60;
  if (zone === 'I') return (vdot < m.iSlowBelowVdot ? m.iSlowMin : m.iMin) * 60;
  if (zone === 'RP') return m.rpMin * 60;
  return null;
}

/** K3-A (10k-v2.15.0) — JEDINO mesto opsega rada jednog treninga zone [s] po cilju nedelje (policy.doseRange; redovan
    plan): I od iFromKm (VDOT < iSlowBelowVdot samo plafon, lo 0), RP od rp.fromKm pri VDOT ≥ rp.fromVdot; null = važi G4.
    Čitaju capM (plafon = hi), startLevel i stepLevel (donja granica lo); validator isto. */
export function doseRangeSec(
  zone: WorkZone,
  targetKm: number,
  beginner: boolean,
  vdot: number
): { lo: number; hi: number } | null {
  if (beginner) return null;
  const d = P.doseRange;
  if (zone === 'I') {
    if (targetKm + 1e-9 < d.iFromKm) return null;
    if (vdot < P.minutesCap.iSlowBelowVdot) return { lo: 0, hi: d.iSlowHi * 60 };
    let band = d.iBands[0]!;
    for (const b of d.iBands) if (targetKm + 1e-9 >= b.fromKm) band = b;
    return { lo: band.lo * 60, hi: band.hi * 60 };
  }
  if (zone === 'RP' && targetKm + 1e-9 >= d.rp.fromKm && vdot >= d.rp.fromVdot)
    return { lo: d.rp.lo * 60, hi: d.rp.hi * 60 };
  return null;
}

/** K3-A: donja granica opsega u metrima rada (0 = nema) — najmanja doza čiji rad u tempu zone dostiže lo. `k3` false =
    izbor kao pre K3-A (nedelja u kojoj bi K3-A stvorio nedelju pouke 35, pickBuild). */
export function doseLoM(
  zone: WorkZone,
  targetKm: number,
  beginner: boolean,
  p: Paces,
  k3 = true
): number {
  const r = k3 ? doseRangeSec(zone, targetKm, beginner, p.vdot) : null;
  return r && r.lo > 0 ? Math.ceil((r.lo / p[zone]) * 1000 - 1e-6) : 0;
}

/** D49 (S3): početnik, prelaz u novu zonu čiji je plafon ispod poslednje doze — najviši nivo lestvice nove zone koji
    staje u plafon (null: ni prvi ne staje, ili doza staje pa pravilo ne važi). Konstruktor i validator. */
export function cappedCarry(
  ladder: LadderId,
  prevDoseM: number,
  capNewM: number,
  beginner: boolean
): Structure | null {
  if (!beginner || prevDoseM <= capNewM) return null;
  return (
    ladderLevels(ladder, true)
      .filter((x) => doseOf(x) <= capNewM)
      .pop() ?? null
  );
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
export function nextLevel(ladder: LadderId, doseM: number, beginner = false): Structure | null {
  return ladderLevels(ladder, beginner).find((s) => doseOf(s) > doseM) ?? null;
}

/** D12 + K3-A: korak lestvice — sledeći nivo; ispod donje granice opsega (doseLoM) najmanji nivo ≥ donja granica kad
    staje u plafon (capM), inače sledeći nivo. JEDINO mesto koraka (konstruktor pickSlot, validator DOSE_JUMP). */
export function stepLevel(
  ladder: LadderId,
  doseM: number,
  targetKm: number,
  p: Paces,
  beginner = false,
  k3 = true
): Structure | null {
  const next = nextLevel(ladder, doseM, beginner);
  const zone = zoneOf(ladder);
  const lo = doseLoM(zone, targetKm, beginner, p, k3);
  if (!next || doseOf(next) >= lo) return next;
  const toLo = ladderLevels(ladder, beginner).find((s) => doseOf(s) >= lo);
  return toLo && doseOf(toLo) <= capM(zone, targetKm, beginner, p, k3) ? toLo : next;
}

/** D16/D37: početni nivo — najviši nivo lestvice ≤ udeo plafona zone (startShare: T i I 80 %, R i RP 60 %) za cilj nedelje, najmanje prvi
    nivo; početnik (`beginner`, D28): prvi nivo (T kontinuirano 1,5 km, D31). null = ni prvi nivo ne staje
    u plafon. */
export function startLevel(
  ladder: LadderId,
  targetKm: number,
  p: Paces,
  beginner = false,
  k3 = true
): Structure | null {
  const levels = ladderLevels(ladder, beginner);
  const cap = capM(zoneOf(ladder), targetKm, beginner, p, k3);
  if (doseOf(levels[0]!) > cap) return null;
  if (beginner) return levels[0]!;
  const limit = startShare(zoneOf(ladder)) * cap + 1e-6;
  const std = levels.filter((s) => doseOf(s) <= limit).pop() ?? levels[0]!;
  // K3-A (10k-v2.15.0): početni nivo najmanje donja granica opsega (najmanji nivo ≥ lo koji staje u plafon).
  const lo = doseLoM(zoneOf(ladder), targetKm, false, p, k3);
  if (doseOf(std) >= lo) return std;
  return levels.find((s) => doseOf(s) >= lo && doseOf(s) <= cap) ?? std;
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
 * kao ista lestvica — inače bi nedelja bila identična prethodnoj (D12). `beginner` (D28/D31): početni
 * nivo je prvi nivo lestvice, T kontinuirano od 1,5 km.
 */
export function pickSlot(
  prev: SlotState | null,
  ladder: LadderId,
  targetKm: number,
  p: Paces,
  allowDrop = false,
  oneSlot = false,
  beginner = false,
  hold = false,
  k3 = true
): Dose | null {
  const cap = capM(zoneOf(ladder), targetKm, beginner, p, k3);
  const levels = ladderLevels(ladder, beginner);
  const start = startLevel(ladder, targetKm, p, beginner, k3);
  const drop = (): Dose | null => {
    const lv = allowDrop ? levels.filter((s) => doseOf(s) <= cap).pop() : undefined;
    return lv ? pick(ladder, lv, 'drop') : null;
  };
  if (!prev) return start ? pick(ladder, start, 'start') : null;
  // Ista lestvica: sledeći nivo ako staje u plafon, inače ista doza druge strukture (nema je — ponavljanje).
  const progress = (): Dose | null => {
    // D38 (P5 F2): nedelja bez rasta doze — ista doza (druga struktura, inače ponavljanje).
    const next = hold ? null : stepLevel(ladder, prev.doseM, targetKm, p, beginner, k3);
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
  // D38: bez rasta doze — prelaz koji nosi dozu ne podiže je na početni nivo nove zone.
  const lo = Math.max(prev.doseM, newZone && start && !hold ? doseOf(start) : 0);
  const lv = levels.find((s) => doseOf(s) >= lo);
  if (lv && doseOf(lv) <= cap) return repeats(lv) ? progress() : pick(ladder, lv, 'transition');
  // D49 (S3): početnik — prelaz u novu zonu (T → RP) nosi dozu najviše do plafona nove zone: T doza iznad plafona RP
  // (plafon T početnika ≥ 3,0 km, RP 2 × 1200 m) → najviši nivo RP koji staje; to je prelaz, ne spuštanje doze.
  if (prev.doseM > cap && beginner && newZone) {
    const top = cappedCarry(ladder, prev.doseM, cap, true);
    if (top) return pick(ladder, top, 'transition');
  }
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

/** Izbor nedelje izgradnje: slot null = nedelja ga nema (test D27 na Q1, uvod ili nedelja bez kvaliteta
    početnika D28, 3 dana bez Q2). */
export interface WeekPicks {
  q1: Dose | null;
  q2: Dose | null;
  /** D49 (S3): početnik — viši nivo T nedelja ne nosi, pa doza ostaje (week.T_HELD_NOTE; validator: nedelja bez rasta). */
  held?: boolean;
}

/** Prvi nivo lestvice ne staje u plafon zone (D11) cilja nedelje; `beginner`: lestvica početnika (D31). */
export function firstLevelOverCap(
  ladder: LadderId,
  targetKm: number,
  p: Paces,
  beginner = false
): boolean {
  return doseOf(ladderLevels(ladder, beginner)[0]!) > capM(zoneOf(ladder), targetKm, beginner, p);
}

/** Lestvica Q1 nedelje izgradnje: po fazi (D10/D18); početnik (D31) — T kontinuirano (od 1,5 km) kad
    prvi nivo lestvice faze ne staje u plafon; null = ni 1,5 km ne staje (bez kvaliteta, odstupanje D28). */
export function buildLadder(
  phase: Phase,
  targetKm: number,
  rule: PlanRule,
  p: Paces
): LadderId | null {
  const l = ladderFor(phase, 'q1', rule.quality);
  if (!rule.beginner || !firstLevelOverCap(l, targetKm, p, true)) return l;
  return firstLevelOverCap('T_continuous', targetKm, p, true) ? null : 'T_continuous';
}

/** D34: I održavanja nedelje B — doza = NAJVEĆA I doza (razvoj; ne raste), ograničena plafonom I (D11) cilja nedelje:
    kad ne staje, najviši nivo lestvice I koji staje. Struktura: pri istoj dozi druga struktura iste doze kad postoji
    (naizmenično; inače ista), pri nižoj dozi nivo lestvice. null = nema I doze ili ni prvi nivo I ne staje u plafon. */
export function maintainIDoseM(maxIM: number, targetKm: number, p: Paces): number | null {
  const cap = capM('I', targetKm, false, p);
  if (maxIM <= cap) return maxIM;
  const lv = ladderLevels('I')
    .filter((s) => doseOf(s) <= cap)
    .pop();
  return lv ? doseOf(lv) : null;
}

export function pickMaintainI(state: QualityState, targetKm: number, p: Paces): Dose | null {
  const i = state.i;
  const m = i ? maintainIDoseM(i.doseM, targetKm, p) : null;
  if (!i || m === null) return null;
  if (m === i.doseM)
    return pick('I', otherStructure('I', m, i.structure, p) ?? i.structure, 'maintain');
  return pick(
    'I',
    ladderLevels('I').find((s) => doseOf(s) === m)!,
    'maintain'
  );
}

/** Slotovi nedelje izgradnje: Q1 i Q2 (4–6 dana) ili samo Q1 (3 dana i početnik, D18/D28). `skipQ1` =
    test na danu Q1 (D27). Početnik: lestvica Q1 po D31; kad ni 1,5 km ne staje u plafon, Q1 = null
    (nedelja bez kvaliteta, odstupanje D28). `weekB` (D34): Q2 = I održavanja. null = nedelja nije izvodljiva
    pri ovom cilju. */
/** D16 (60 %): početni nivo kakav je bio pre D37 — donja granica početnog nivoa T i I kad bi veći stvorio nedelju pouke 35. */
function startLevel60(ladder: LadderId, targetKm: number, p: Paces, k3 = true): Structure {
  const levels = ladderLevels(ladder);
  const limit = P.startLevel.p35FloorShare * capM(zoneOf(ladder), targetKm, false, p, k3) + 1e-6;
  return levels.filter((s) => doseOf(s) <= limit).pop() ?? levels[0]!;
}

/**
 * D37 (P5 F4, odluka organizatora P-b) — početni nivo T i I = najviši nivo ≤ 80 % plafona za koji nedelja NE postaje
 * nedelja pouke 35 (`keepsTwo`: predikat konstruktora — sa ovim izborom oba dana kvaliteta ostaju, week.qualityOverLong);
 * kad takvog nivoa iznad nivoa po 60 % nema, nivo po 60 % (startLevel60). Jedino mesto odluke početnog nivoa T/I (ovde,
 * nad izborom pickBuild); `keepsTwo` je činjenica konstrukcije, kao `can` u volume.fit10. Samo slot čija je doza
 * početni nivo zone T ili I (korak 'start' ili prelaz bez prenosa); početnik bez promene.
 */
function startWithoutP35(
  picks: WeekPicks,
  state: QualityState,
  targetKm: number,
  keepsTwo: (w: WeekPicks) => boolean,
  p: Paces,
  k3 = true
): WeekPicks {
  if (keepsTwo(picks)) return picks;
  let out = picks;
  for (const slot of ['q2', 'q1'] as const) {
    const d = out[slot];
    const prev = state[slot];
    const fromStart =
      d !== null &&
      (d.zone === 'T' || d.zone === 'I') &&
      (d.step === 'start' ||
        (d.step === 'transition' && (!prev || !carries(prev.ladder, d.ladder as LadderId))));
    if (!d || !fromStart) continue;
    const ladder = d.ladder as LadderId;
    const floor = doseOf(startLevel60(ladder, targetKm, p, k3));
    const lower = ladderLevels(ladder)
      .filter((s) => doseOf(s) < d.doseM && doseOf(s) >= floor)
      .reverse();
    let chosen: WeekPicks | null = null;
    for (const s of lower) {
      const trial = { ...out, [slot]: pick(ladder, s, d.step) };
      if (keepsTwo(trial)) {
        chosen = trial;
        break;
      }
    }
    out =
      chosen ??
      (d.doseM > floor
        ? { ...out, [slot]: pick(ladder, startLevel60(ladder, targetKm, p, k3), d.step) }
        : out);
    if (chosen) return out;
  }
  return out;
}

export function pickBuild(
  state: QualityState,
  phase: Phase,
  targetKm: number,
  p: Paces,
  rule: PlanRule,
  allowDrop = false,
  skipQ1 = false,
  weekB = false,
  hold = false,
  keepsTwo: ((w: WeekPicks) => boolean) | null = null,
  carriesAll: ((w: WeekPicks) => boolean) | null = null
): WeekPicks | null {
  const quality = rule.quality;
  const build = (k3: boolean): WeekPicks | null => {
    const l1 = buildLadder(phase, targetKm, rule, p);
    let q1: Dose | null = null;
    if (!skipQ1 && l1) {
      q1 = pickSlot(state.q1, l1, targetKm, p, allowDrop, quality === 1, rule.beginner, hold, k3);
      if (!q1) return null;
      // D49 (S3): početnik — T doza iznad poslednje T doze samo kad je nedelja nosi (`carriesAll`: činjenica konstrukcije,
      // kao `keepsTwo` — dužine izvodljive pri ovom cilju i nijedan lagan dan nije odmor); inače doza ne raste (isti
      // mehanizam kao D38: lestvica faze, pa T kontinuirano početnika — ista doza druge strukture ili ponavljanje).
      if (
        rule.beginner &&
        carriesAll &&
        !hold &&
        state.q1 &&
        q1.zone === 'T' &&
        zoneOf(state.q1.ladder) === 'T' &&
        q1.doseM > state.q1.doseM &&
        !carriesAll({ q1, q2: null })
      )
        for (const lad of [l1, 'T_continuous'] as const) {
          const h = pickSlot(state.q1, lad, targetKm, p, allowDrop, true, true, true);
          if (h && h.doseM === state.q1.doseM && carriesAll({ q1: h, q2: null }))
            return { q1: h, q2: null, held: true };
        }
    }
    if (quality === 1) return { q1, q2: null };
    const q2 = weekB
      ? pickMaintainI(state, targetKm, p)
      : pickSlot(
          state.q2,
          ladderFor(phase, 'q2', quality),
          targetKm,
          p,
          allowDrop,
          false,
          false,
          hold,
          k3
        );
    if (!q2) return null;
    return { q1, q2 };
  };
  const k3Picks = build(true);
  // D37 (P-b): veća početna doza T/I ne sme da košta drugi dan kvaliteta (pouka 35) — samo 4–6 dana (dva dana kvaliteta).
  if (!k3Picks || !keepsTwo || rule.beginner || quality === 1) return k3Picks;
  // K3-A (10k-v2.15.0): izbor sa opsegom doze; kad bi on stvorio nedelju pouke 35 (`keepsTwo`), nedelja bira kao pre K3-A
  // (k3 = false; sudar sa poukom 35, K3-10K-REPORT § K3-A). Validator prihvata oba izbora.
  if (keepsTwo(k3Picks)) return k3Picks;
  const old = build(false);
  return old
    ? startWithoutP35(old, state, targetKm, keepsTwo, p, false)
    : startWithoutP35(k3Picks, state, targetKm, keepsTwo, p);
}

/** Stanje posle nedelje izgradnje: slot bez izbora zadržava stanje pre nedelje (D27: progresija se posle
    testa nastavlja od stanja pre testa); `t` = poslednja doza u zoni T (D31). D34: I održavanja na Q2 (nedelja B) ne
    menja stanje T slota; `i` = poslednji izbor u lestvici I. */
export function advance(picks: WeekPicks, prev: QualityState): QualityState {
  const slot = (d: Dose | null, before: SlotState | null): SlotState | null =>
    d ? { ladder: d.ladder as LadderId, doseM: d.doseM, structure: d.structure } : before;
  const t = [picks.q1, picks.q2].filter((d) => d?.zone === 'T').pop();
  // D34: `i` = najveća I doza (pri istoj dozi poslednja struktura — naizmenična struktura održavanja).
  const i = [picks.q1, picks.q2].filter((d) => d?.ladder === 'I').pop() ?? null;
  return {
    q1: slot(picks.q1, prev.q1),
    q2: picks.q2?.ladder === 'I' ? prev.q2 : slot(picks.q2, prev.q2),
    t: t ? t.doseM : prev.t,
    i: i && (!prev.i || i.doseM >= prev.i.doseM) ? slot(i, prev.i) : prev.i
  };
}

/** D5/D7 + S1/S5/S6 (P8 završetak, D51): JEDINA funkcija smanjene doze (rasterećenje, taper; konstruktor i validator) —
    doza = max(najniži nivo `floorM`; najviši nivo lestvice ≤ share × poslednja doza) [m] (`beginner`: lestvica
    početnika, D31). Donja granica je ispred G5 „≤ 60 %": rasterećenje i taper ne idu ispod najniže doze. */
export function reducedDoseM(
  ladder: LadderId,
  lastM: number,
  share: number,
  floorM: number,
  beginner = false
): number {
  const limit = share * lastM + 1e-6;
  const lv = ladderLevels(ladder, beginner)
    .map(doseOf)
    .filter((m) => m <= limit && m >= floorM);
  return lv[lv.length - 1] ?? floorM;
}

/** Struktura smanjene doze (reducedDoseM): nivo lestvice te doze; ispod najnižeg nivoa → `floor` (min). */
function reduced(
  ladder: LadderId,
  lastM: number,
  share: number,
  floor: Structure,
  beginner = false
): Structure {
  const m = reducedDoseM(ladder, lastM, share, doseOf(floor), beginner);
  return (
    ladderLevels(ladder, beginner)
      .filter((s) => doseOf(s) === m)
      .pop() ?? floor
  );
}

/** D5/D31: poslednja doza koju rasterećenje smanjuje — slot rasterećenja; početnik: poslednja T doza [m]. */
export const deloadLastM = (state: QualityState, rule: PlanRule): number =>
  rule.beginner ? state.t : (state[deloadSlot(rule.quality)]?.doseM ?? 0);

/** D5: jedini kvalitet rasterećenja — T ≈ 60 % poslednje doze T slota (3 dana: jedinog slota, D18;
    lestvica faze), min 2,0 km. D31 početnik: ≈ 60 % poslednje T doze, min 1,5 km (u razvoju i specifičnoj
    fazi 1,5 km kontinuirano — T cruise nema taj nivo, D10). `refM` (A5, 10k-v2.5.2): poslednja doza iz
    reference umora pre starta (PreStartRef.tDoseM) umesto stanja. */
export function pickDeload(
  state: QualityState,
  phase: Phase,
  targetKm: number,
  rule: PlanRule,
  p: Paces,
  refM: number | null = null
): Dose | null {
  const ladder = deloadLadder(phase);
  const b = rule.beginner;
  const lastM = refM ?? deloadLastM(state, rule);
  const minM = Math.round((b ? P.beginner.tFirstKm : P.deload.tMinKm) * 1000);
  const floor =
    ladderLevels(ladder, b).find((s) => doseOf(s) === minM) ?? structuresForDose(ladder, minM)[0]!;
  const s = reduced(ladder, lastM, P.deload.tShare, floor, b);
  return doseOf(s) <= capM('T', targetKm, b, p) ? pick(ladder, s, 'deload') : null;
}

/** D7: taper — RP i T, svaki ≈ 60 % poslednje doze zone (naniže; min 2 × 1000 m RP, 2,0 km T); 3 dana
    samo RP (D18). D31 početnik: kad RP ne staje u plafon — T kontinuirano ≈ 60 % poslednje T doze (min
    1,5 km). `relax` (druga pretraga, samo kad nijedan cilj nije izvodljiv po pravilu): T otpada (4–6 dana);
    kad ni RP (početnik: ni T) ne staje u plafon D11, taper je bez kvaliteta (odstupanje D7). */
export function pickTaper(
  state: QualityState,
  targetKm: number,
  rule: PlanRule,
  p: Paces,
  relax = false,
  keepOne = false
): Picks | null | 'none' {
  const t = P.taper;
  const quality = rule.quality;
  const rpFloor: Structure = { form: 'reps', reps: t.rpMin.reps, repM: t.rpMin.repM };
  const rp = reduced('RP', state.q1?.doseM ?? 0, t.doseShare, rpFloor);
  if (doseOf(rp) > capM('RP', targetKm, rule.beginner, p)) {
    if (rule.beginner) {
      const floor = ladderLevels('T_continuous', true)[0]!;
      const tt = reduced('T_continuous', state.t, t.doseShare, floor, true);
      if (doseOf(tt) <= capM('T', targetKm, true, p) || keepOne)
        return { q1: pick('T_continuous', tt, 'taper'), q2: null };
    }
    // T3 (10K-08): posle novog starta sa kvalitetom posle povratka taper zadržava jedan kvalitet (≈ 60 % poslednje
    // doze, najmanje najniži nivo) i kad je iznad plafona D11 (week.ctx.keepTaperQuality).
    if (keepOne) return { q1: pick('RP', rp, 'taper'), q2: null };
    return relax ? 'none' : null;
  }
  if (quality === 1 || relax) return { q1: pick('RP', rp, 'taper'), q2: null };
  const tMinM = Math.round(t.tMinKm * 1000);
  const tFloor = ladderLevels('T_cruise').find((s) => doseOf(s) === tMinM)!;
  const tt = reduced('T_cruise', state.q2?.doseM ?? 0, t.doseShare, tFloor);
  if (doseOf(tt) > capM('T', targetKm, rule.beginner, p)) return null;
  return { q1: pick('RP', rp, 'taper'), q2: pick('T_cruise', tt, 'taper') };
}

/** K3-C (10k-v2.15.0) — JEDINO mesto: minuti završnog T dela dugog nedelje `index` (0 = nema): redovan plan sa 3 dana,
    ne-rasteretna nedelja specifične faze bez ograničenja adaptacije; prva takva nedelja longT.firstMin, ostale longT.min.
    `frames` = okviri nedelja plana (konstruktor) ili nedelje plana (validator) — isti podatak. */
export function longTMinOf(
  frames: readonly { index: number; phase: Phase; deload: boolean; limits?: WeekLimits }[],
  index: number,
  rule: PlanRule
): number {
  if (rule.beginner || rule.quality !== 1) return 0;
  const on = (f: { phase: Phase; deload: boolean; limits?: WeekLimits }): boolean =>
    f.phase === 'specific' && !f.deload && !f.limits;
  const f = frames.find((x) => x.index === index);
  if (!f || !on(f)) return 0;
  return frames.some((x) => x.index < index && on(x)) ? P.longT.min : P.longT.firstMin;
}

/** K3-C: završni T deo dugog [km] — `min` minuta T tempom, najviše plafon T zone (capM, D11), korak 0,1 km naniže; ispod
    longT.minKm 0 (bez T dela). Konstruktor (week.buildWeekOf) i validator (LONG_T). */
export function longTKmOf(min: number, targetKm: number, p: Paces): number {
  if (min <= 0) return 0;
  const m = Math.min(
    Math.floor(((min * 60) / p.T) * 10 + 1e-9) * 100,
    capM('T', targetKm, false, p)
  );
  const km = Math.floor(m / 100 + 1e-9) / 10;
  return km + 1e-9 >= P.longT.minKm ? km : 0;
}
