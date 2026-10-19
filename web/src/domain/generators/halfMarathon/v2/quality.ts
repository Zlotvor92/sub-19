/* H12 — izbor doze kvaliteta po slotu (jedino mesto); početni nivo; H11 plafon ograničava izbor; H5/H7 doza
   rasterećenja i tapera; H17/HI10 početnik — prvi nivo, T kontinuirano od 1,5 km i umesto lestvice faze čiji
   prvi nivo ne staje u plafon. Stanje slota = poslednji izbor slota u ne-rasteretnoj nedelji izgradnje (test
   H16 i nedelja bez kvaliteta ga ne menjaju). */

import { HM_V2_POLICY as P, type PlanRule } from './policy.ts';
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
  /** HI10: poslednja doza u zoni T iz ne-rasteretne nedelje izgradnje [m] (0 = nema); čita je samo
      rasterećenje i taper početnika. */
  t: number;
}

export const INITIAL_QUALITY: QualityState = { q1: null, q2: null, t: 0 };

/** H10: lestvica slota po fazi izgradnje (4–6 dana); 3 dana (`quality` 1): jedan kvalitet — baza T
    kontinuirano, razvoj T cruise, specifično RP (bez I i R). */
export function ladderFor(phase: Phase, slot: 'q1' | 'q2', quality: 1 | 2 = 2): LadderId {
  if (quality === 1)
    return phase === 'base' ? 'T_continuous' : phase === 'development' ? 'T_cruise' : 'RP';
  if (phase === 'base') return slot === 'q1' ? 'R' : 'T_continuous';
  if (phase === 'development') return slot === 'q1' ? 'I' : 'T_cruise';
  return slot === 'q1' ? 'RP' : 'T_cruise';
}

/** H5: lestvica jedinog kvaliteta rasterećenja (T slot Q2): baza T kontinuirano, inače T cruise. */
export const deloadLadder = (phase: Phase): 'T_continuous' | 'T_cruise' =>
  phase === 'base' ? 'T_continuous' : 'T_cruise';

/** H5/HI6: slot čiju poslednju dozu rasterećenje smanjuje i na čijem je danu — T slot Q2; 3 dana jedini
    slot Q1. */
export const deloadSlot = (quality: 1 | 2): 'q1' | 'q2' => (quality === 1 ? 'q1' : 'q2');

/** H12: prelaz faze koji nosi dozu — T cruise ≥ poslednje T kontinuirano; RP ≥ poslednje I (4–6 dana) ili
    poslednje T (3 dana, HI6); HI10: T kontinuirano početnika posle T cruise ≥ poslednje T (ista zona). */
export function carries(from: LadderId, to: LadderId): boolean {
  return (
    (from === 'T_continuous' && to === 'T_cruise') ||
    (from === 'T_cruise' && to === 'T_continuous') ||
    (to === 'RP' && (from === 'I' || from === 'T_continuous' || from === 'T_cruise'))
  );
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

/** Pouka 32: drugi član plafona zone — dan kvaliteta sa strukturom `s` lestvice `ladder` u nedelji: 'fits'
    (on i već postavljen dan kvaliteta nedelje traju ≤ dugi iste nedelje), 'over' (neki je duži od dugog) ili
    'none' (nedelja sa tim danom nema izvodljive dužine — član ne poredi, izvodljivost odlučuje pretraga
    cilja). `exempt`: sopstveni dan je najniži nivo (izuzet), drugi dan se i dalje proverava. Gradi ga week.ts
    (*DayLimit); isti predikat čita validator. */
export type DayFit = 'fits' | 'over' | 'none';
export type DayFits = (ladder: LadderId, s: Structure, exempt: boolean) => DayFit;

/** Druga struktura iste doze: najbliža prethodnoj po km rada + oporavka (nedelja zadržava obim), pa
    manje deonica, pa redosled pravila; `ok` (pouka 32) — samo strukture koje staju u trajanje dugog. null =
    druge strukture nema. */
export function otherStructure(
  ladder: LadderId,
  doseM: number,
  prev: Structure,
  p: Paces,
  ok: (s: Structure) => boolean = () => true
): Structure | null {
  const base = structureKm100(ladder, prev, p);
  const reps = (s: Structure): number => Math.max(1, repsOf(s).length);
  const opts = structuresForDose(ladder, doseM).filter((x) => !sameStructure(x, prev) && ok(x));
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

/** H12: početni nivo — najviši nivo lestvice ≤ 60 % plafona zone (H11) za cilj nedelje, najmanje prvi nivo;
    početnik (`beginner`, HI10): prvi nivo (T kontinuirano 1,5 km). null = ni prvi nivo ne staje u plafon. */
export function startLevel(ladder: LadderId, targetKm: number, beginner = false): Structure | null {
  const levels = ladderLevels(ladder, beginner);
  const cap = capM(zoneOf(ladder), targetKm);
  if (doseOf(levels[0]!) > cap) return null;
  if (beginner) return levels[0]!;
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
 * Plafon zone (pouka 32) je jedna funkcija sa dva člana: H11 udeo (`capM`) i trajanje dana ≤ dugi iste
 * nedelje (`dayFits`; najniži nivo lestvice je izuzet). Kad izbor po pravilu ne staje u drugi član, doza se
 * spušta na najviši nivo lestvice ispod njega koji staje u oba člana (najniži uvek sme) — pad doze kao
 * kapacitet (pouka 12, korak 'drop').
 * `allowDrop` (samo kad nedelja nije izvodljiva NI PRI JEDNOM cilju uz „doza ne pada"): doza koja ne
 * staje u plafon spušta se na najviši nivo lestvice koji staje — plafon H11 ispred H12 (pouka 12).
 * `oneSlot` (3 dana, HI6): prelaz T kontinuirano → T cruise koji bi ponovio istu strukturu ide pravilom iste
 * lestvice (sledeći nivo ili druga struktura) — inače bi nedelja bila identična prethodnoj (H12).
 * `beginner` (H17, HI10): lestvica početnika (T kontinuirano od 1,5 km), početni nivo = prvi nivo.
 */
export function pickSlot(
  prev: SlotState | null,
  ladder: LadderId,
  targetKm: number,
  p: Paces,
  allowDrop = false,
  oneSlot = false,
  beginner = false,
  dayFits?: DayFits
): Dose | null {
  const cap = capM(zoneOf(ladder), targetKm);
  const levels = ladderLevels(ladder, beginner);
  const start = startLevel(ladder, targetKm, beginner);
  // Izbor po pravilu staje u drugi član osim kad je duži od dugog; spuštanje bira samo nivo koji staje.
  const dur = (s: Structure): boolean => fitsDay(ladder, s, beginner, dayFits) !== 'over';
  const fits = (s: Structure): boolean => doseOf(s) <= cap && dur(s);
  const fitsDrop = (s: Structure): boolean =>
    doseOf(s) <= cap && fitsDay(ladder, s, beginner, dayFits) === 'fits';
  const drop = (): Dose | null => {
    const lv = allowDrop ? levels.filter(fitsDrop).pop() : undefined;
    return lv ? pick(ladder, lv, 'drop') : null;
  };
  // Pouka 32: najviši nivo ispod `belowM` u oba člana (najniži je izuzet od drugog).
  const durDrop = (belowM: number): Dose | null => {
    const lv = levels.filter((s) => doseOf(s) < belowM && fitsDrop(s)).pop();
    return lv ? pick(ladder, lv, 'drop') : null;
  };
  if (!prev)
    return start ? (dur(start) ? pick(ladder, start, 'start') : durDrop(doseOf(start))) : null;
  // Ista lestvica: sledeći nivo ako staje u plafon, inače ista doza druge strukture (nema je — ponavljanje).
  const progress = (): Dose | null => {
    const next = nextLevel(ladder, prev.doseM, beginner);
    if (next && fits(next)) return pick(ladder, next, 'next');
    if (prev.doseM > cap) return drop();
    const alt = otherStructure(ladder, prev.doseM, prev.structure, p, dur);
    if (alt) return pick(ladder, alt, 'alt');
    return dur(prev.structure) ? pick(ladder, prev.structure, 'repeat') : durDrop(prev.doseM);
  };
  if (prev.ladder === ladder) return progress();
  if (!carries(prev.ladder, ladder))
    return start ? (dur(start) ? pick(ladder, start, 'transition') : durDrop(doseOf(start))) : null;
  const newZone = zoneOf(prev.ladder) !== zoneOf(ladder);
  const repeats = (s: Structure): boolean =>
    oneSlot && !newZone && sameStructure(s, prev.structure);
  const lo = Math.max(prev.doseM, newZone && start ? doseOf(start) : 0);
  const lv = levels.find((s) => doseOf(s) >= lo);
  if (lv && doseOf(lv) <= cap) {
    if (!dur(lv)) return durDrop(doseOf(lv));
    return repeats(lv) ? progress() : pick(ladder, lv, 'transition');
  }
  if (prev.doseM > cap) return drop();
  // Faza 4a N6 (kao maraton MP): RP nikad ispod najnižeg nivoa (2 × 2000 m, H10) — prelaz sa niže T doze koji
  // ne staje u najniži nivo nije izvodljiv pri ovom cilju (adaptacija: A9 — jedan kvalitet doze rasterećenja
  // ili bez kvaliteta).
  if (prev.doseM < floorM(ladder, beginner)) return null;
  const all = structuresForDose(ladder, prev.doseM);
  if (all.length === 0) return null;
  const s = otherStructure(ladder, prev.doseM, prev.structure, p, dur) ?? all.filter(dur)[0];
  if (!s) return durDrop(prev.doseM);
  return repeats(s) ? progress() : pick(ladder, s, 'transition');
}

/** Faza 4a N6: pod doze lestvice [m] — RP najniži nivo (2 × 2000 m), ostale lestvice bez poda (0). Jedna funkcija
    za konstruktor (pickSlot) i validator (RP_FLOOR). */
export function floorM(ladder: LadderId, beginner = false): number {
  return ladder === 'RP' ? doseOf(ladderLevels(ladder, beginner)[0]!) : 0;
}

/** Pouka 32: drugi član plafona zone za strukturu `s` — sopstveni dan najnižeg nivoa lestvice (`beginner`:
    lestvica početnika) je izuzet; bez predikata (`dayFits` undefined) član ne postoji. Jedna funkcija za
    konstruktor i validator. */
export function fitsDay(
  ladder: LadderId,
  s: Structure,
  beginner = false,
  dayFits?: DayFits
): DayFit {
  return dayFits
    ? dayFits(ladder, s, doseOf(s) <= doseOf(ladderLevels(ladder, beginner)[0]!))
    : 'fits';
}

export interface Picks {
  q1: Dose;
  /** null: 3 dana i početnik (jedan kvalitet, H15/H17). */
  q2: Dose | null;
}

/** Izbor nedelje izgradnje: slot null = nedelja ga nema (test H16 na danu Q1, uvod ili nedelja bez kvaliteta
    početnika H17, jedan kvalitet bez Q2). */
export interface WeekPicks {
  q1: Dose | null;
  q2: Dose | null;
}

/** Prvi nivo lestvice ne staje u plafon zone (H11) cilja nedelje; `beginner`: lestvica početnika (HI10). */
export function firstLevelOverCap(ladder: LadderId, targetKm: number, beginner = false): boolean {
  return doseOf(ladderLevels(ladder, beginner)[0]!) > capM(zoneOf(ladder), targetKm);
}

/** Lestvica Q1 nedelje izgradnje: po fazi (H10, HI6); početnik (HI10) — T kontinuirano (od 1,5 km) kad prvi
    nivo lestvice faze ne staje u plafon; null = ni 1,5 km ne staje (bez kvaliteta, odstupanje H17). Jedna
    funkcija za konstruktor i validator (pouka 24). */
export function buildLadder(phase: Phase, targetKm: number, rule: PlanRule): LadderId | null {
  const l = ladderFor(phase, 'q1', rule.quality);
  if (!rule.beginner || !firstLevelOverCap(l, targetKm, true)) return l;
  return firstLevelOverCap('T_continuous', targetKm, true) ? null : 'T_continuous';
}

/** Slotovi nedelje izgradnje: Q1 i Q2 (4–6 dana) ili samo Q1 (3 dana i početnik). `skipQ1` = test na danu Q1
    (H16). Početnik: lestvica Q1 po HI10; kad ni 1,5 km ne staje u plafon, Q1 = null (nedelja bez kvaliteta).
    null = nedelja nije izvodljiva pri ovom cilju. */
export function pickBuild(
  state: QualityState,
  phase: Phase,
  targetKm: number,
  p: Paces,
  rule: PlanRule,
  allowDrop = false,
  skipQ1 = false,
  limit?: BuildLimit
): WeekPicks | null {
  const quality = rule.quality;
  const l1 = buildLadder(phase, targetKm, rule);
  let q1: Dose | null = null;
  if (!skipQ1 && l1) {
    q1 = pickSlot(state.q1, l1, targetKm, p, allowDrop, quality === 1, rule.beginner, limit?.q1);
    if (!q1) return null;
  }
  if (quality === 1) return { q1, q2: null };
  const q2 = pickSlot(
    state.q2,
    ladderFor(phase, 'q2'),
    targetKm,
    p,
    allowDrop,
    false,
    false,
    limit?.q2(q1)
  );
  return q2 ? { q1, q2 } : null;
}

/** Pouka 32: drugi član po slotu nedelje izgradnje (week.ts buildDayLimit) — Q1 prvi (sa Q2 na najnižem
    nivou lestvice), pa Q2 uz izabran Q1 (ili dan testa): oba dana ≤ dugi. */
export interface BuildLimit {
  q1: DayFits;
  q2: (q1: Dose | null) => DayFits;
}

/** Stanje posle nedelje izgradnje: slot bez izbora zadržava stanje pre nedelje (H16: progresija se posle
    testa nastavlja od stanja pre testa); `t` = poslednja doza u zoni T (HI10). */
export function advance(picks: WeekPicks, prev: QualityState): QualityState {
  const slot = (d: Dose | null, before: SlotState | null): SlotState | null =>
    d ? { ladder: d.ladder as LadderId, doseM: d.doseM, structure: d.structure } : before;
  const t = [picks.q1, picks.q2].filter((d) => d?.zone === 'T').pop();
  return { q1: slot(picks.q1, prev.q1), q2: slot(picks.q2, prev.q2), t: t ? t.doseM : prev.t };
}

/** H5/H7: ≈ share × poslednja doza — najviši nivo lestvice ≤ share × poslednja i ≥ najmanja doza; ispod
    najnižeg nivoa → `floor` (najmanja doza). Jedna funkcija za konstruktor i validator (pouka 24). */
export function reducedStructure(
  ladder: LadderId,
  lastM: number,
  share: number,
  floor: Structure,
  beginner = false,
  dayFits?: DayFits
): Structure {
  const limit = share * lastM + 1e-6;
  const lv = ladderLevels(ladder, beginner).filter(
    (s) => doseOf(s) <= limit && doseOf(s) >= doseOf(floor)
  );
  const top = lv[lv.length - 1] ?? floor;
  // Pouka 32: drugi član plafona zone — doza duža od dugog se spušta na najviši nivo koji staje (najmanja
  // doza je izuzeta).
  const fit = (s: Structure): DayFit =>
    dayFits ? dayFits(ladder, s, doseOf(s) <= doseOf(floor)) : 'fits';
  if (fit(top) !== 'over') return top;
  return lv.filter((s) => doseOf(s) < doseOf(top) && fit(s) === 'fits').pop() ?? floor;
}

/** H5: najmanja T doza rasterećenja i tapera kao struktura (2,0 km; T cruise 2 × 1000 m). */
export const tMinStructure = (ladder: 'T_continuous' | 'T_cruise', minKm: number): Structure =>
  tFloorStructure(ladder, Math.round(minKm * 1000));

/** H5: jedini kvalitet rasterećenja — T ≈ 60 % poslednje doze T slota (Q2; 3 dana jedinog slota Q1,
    HI6), lestvica faze, min 2,0 km (HI4). Početnik (HI10): ≈ 60 % poslednje T doze, min 1,5 km (u razvoju i
    specifičnoj fazi 1,5 km kontinuirano — T cruise nema taj nivo, H10). Plafon H11 proverava week.ts (ne
    staje: po pravilu neizvodljivo; druga pretraga: bez kvaliteta); `dayFits` — drugi član (pouka 32): najviši
    nivo koji staje u trajanje dugog, najmanja doza izuzeta. Jedna funkcija za konstruktor i validator. */
export function deloadDose(
  state: QualityState,
  phase: Phase,
  rule: PlanRule,
  dayFits?: DayFits
): Dose {
  const ladder = deloadLadder(phase);
  if (!rule.beginner) {
    const s = reducedStructure(
      ladder,
      state[deloadSlot(rule.quality)]?.doseM ?? 0,
      P.deload.tShare,
      tMinStructure(ladder, P.deload.tMinKm),
      false,
      dayFits
    );
    return pick(ladder, s, 'deload');
  }
  const minM = Math.round(P.beginner.tFirstKm * 1000);
  const floor =
    ladderLevels(ladder, true).find((s) => doseOf(s) === minM) ??
    structuresForDose(ladder, minM)[0]!;
  return pick(
    ladder,
    reducedStructure(ladder, state.t, P.deload.tShare, floor, true, dayFits),
    'deload'
  );
}

/** HI10: taper početnika kad RP ne staje u plafon — T kontinuirano ≈ 60 % poslednje T doze (lestvica
    početnika, min 1,5 km); `dayFits` — drugi član (pouka 32). */
export function beginnerTaperT(state: QualityState, dayFits?: DayFits): Dose {
  const floor = ladderLevels('T_continuous', true)[0]!;
  return pick(
    'T_continuous',
    reducedStructure('T_continuous', state.t, P.taper.doseShare, floor, true, dayFits),
    'taper'
  );
}

/** H7: taper — RP i T (cruise), svaki ≈ 60 % poslednje doze zone (naniže; min 2 × 2000 m RP, 2,0 km T);
    3 dana i početnik samo RP (HI6, H17). Drugi član (pouka 32, `limit`): RP prvi (sa T na najmanjoj dozi),
    pa T uz izabran RP; najmanja doza je izuzeta. */
export function taperDoses(
  state: QualityState,
  quality: 1 | 2 = 2,
  limit?: { q1: DayFits; q2: (q1: Dose) => DayFits }
): Picks {
  const t = P.taper;
  const rpFloor: Structure = { form: 'reps', reps: t.rpMin.reps, repM: t.rpMin.repM };
  const rp = pick(
    'RP',
    reducedStructure('RP', state.q1?.doseM ?? 0, t.doseShare, rpFloor, false, limit?.q1),
    'taper'
  );
  if (quality === 1) return { q1: rp, q2: null };
  const tt = reducedStructure(
    'T_cruise',
    state.q2?.doseM ?? 0,
    t.doseShare,
    tMinStructure('T_cruise', t.tMinKm),
    false,
    limit?.q2(rp)
  );
  return { q1: rp, q2: pick('T_cruise', tt, 'taper') };
}

/** Najmanja doza taper T (pouka 32: T na najmanjoj dozi dok se bira RP). */
export const taperTFloor = (): Dose =>
  pick('T_cruise', tMinStructure('T_cruise', P.taper.tMinKm), 'taper');
