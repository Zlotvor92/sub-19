/* M12 — izbor doze kvaliteta po slotu (jedino mesto); početni nivo ≤ 60 % plafona (početnik: prvi nivo, M17);
   M11 plafon ograničava izbor; M5/M7 doza rasterećenja i tapera. Stanje slota = poslednji izbor slota u
   ne-rasteretnoj nedelji izgradnje (test M16 i uvod M17 ga ne menjaju). */

import { MARATHON_V2_POLICY as P, type PlanRule } from './policy.ts';
import type { Dose, LadderId, Paces, Phase, Structure, WorkZone } from './types.ts';
import {
  doseOf,
  ladderLevels,
  longWorkout,
  qualityWorkout,
  repsOf,
  sameStructure,
  structureKm100,
  structuresForDose,
  type WarmupCooldown,
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
  /** M5: poslednja doza u zoni T iz ne-rasteretne nedelje izgradnje [m] (0 = nema). */
  t: number;
}

export const INITIAL_QUALITY: QualityState = { q1: null, q2: null, t: 0 };

/** M10: lestvica slota po fazi izgradnje; M15 3 dana (`quality` 1): jedan kvalitet — baza T kontinuirano,
    razvoj T cruise, specifično MP (bez I i R). */
export function ladderFor(phase: Phase, slot: 'q1' | 'q2', quality: 1 | 2 = 2): LadderId {
  if (quality === 1)
    return phase === 'base' ? 'T_continuous' : phase === 'development' ? 'T_cruise' : 'MP';
  if (phase === 'base') return slot === 'q1' ? 'R' : 'T_continuous';
  if (phase === 'development') return slot === 'q1' ? 'I' : 'T_cruise';
  return slot === 'q1' ? 'MP' : 'T_cruise';
}

/** M5: lestvica jedinog kvaliteta rasterećenja (T; dan Q2, 3 dana dan Q1): baza T kontinuirano, inače T cruise. */
export const deloadLadder = (phase: Phase): LadderId =>
  phase === 'base' ? 'T_continuous' : 'T_cruise';

/** M5/M15: dan jedinog kvaliteta rasterećenja — Q2 (T slot), 3 dana Q1 (jedini slot). */
export const deloadSlot = (quality: 1 | 2): 'q1' | 'q2' => (quality === 1 ? 'q1' : 'q2');

/** M12: prelaz faze koji nosi dozu — T cruise ≥ poslednje T kontinuirano; MP ≥ poslednje I (3 dana i
    početnik: poslednje T); M17: T kontinuirano početnika posle T cruise ≥ poslednje T (ista zona). */
export function carries(from: LadderId, to: LadderId): boolean {
  return (
    (from === 'T_continuous' && to === 'T_cruise') ||
    (from === 'T_cruise' && to === 'T_continuous') ||
    (to === 'MP' && (from === 'I' || from === 'T_cruise' || from === 'T_continuous'))
  );
}

/** M11: plafon zone za trening, u metrima, za ciljni obim nedelje. */
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
    manje deonica, pa redosled pravila; samo strukture koje `ok` prihvata (plafon MP sa trajanjem). null =
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

/** Pouka 14 (odluka organizatora MAR-03): drugi član plafona MP — trajanje kvalitetnog dana (WU + MP +
    oporavci + CD) ≤ trajanje dugog iste nedelje `long10` [0,1 km] (najduži dozvoljeni dugi nedelje: M13 i
    M13a). Prvi član je M11 (20 % cilja, capM). Najniži nivo MP je izuzet (MP dan tada sme biti duži od dugog
    — upozorenje pouke 14). JEDINA funkcija za konstruktor i validator (pouka 24); u taperu se ne primenjuje
    (M7a). */
export function mpFitsLong(s: Structure, long10: number, p: Paces, wc: WarmupCooldown): boolean {
  // Izuzetak (odluka organizatora MAR-03, kao minimum M7a): najniži nivo MP (2 × 3000 m) je najmanja smislena
  // MP doza — drugi član ga ne seče (prvi, 20 %, važi i za njega).
  if (doseOf(s) <= doseOf(ladderLevels('MP')[0]!)) return true;
  const d: Dose = { ladder: 'MP', zone: 'MP', doseM: doseOf(s), structure: s, step: 'next' };
  return qualityWorkout(d, p, wc).sec <= longWorkout(long10 / 10, p).sec;
}

/** Najmanji nivo lestvice čija je doza > doseM (sledeći nivo; najviše 1 nivo nedeljno); `beginner`: lestvica
    početnika (M17). */
export function nextLevel(ladder: LadderId, doseM: number, beginner = false): Structure | null {
  return ladderLevels(ladder, beginner).find((s) => doseOf(s) > doseM) ?? null;
}

/** M12: početni nivo — najviši nivo lestvice ≤ 60 % plafona zone (M11) za cilj nedelje, najmanje prvi
    nivo; početnik (`beginner`, M17): prvi nivo (T kontinuirano 1,5 km). null = ni prvi nivo ne staje u
    plafon. */
export function startLevel(ladder: LadderId, targetKm: number, beginner = false): Structure | null {
  const levels = ladderLevels(ladder, beginner);
  const cap = capM(zoneOf(ladder), targetKm);
  if (doseOf(levels[0]!) > cap) return null;
  if (beginner) return levels[0]!;
  const limit = P.startLevel.capShare * cap + 1e-6;
  return levels.filter((s) => doseOf(s) <= limit).pop() ?? levels[0]!;
}

/**
 * M12 za jedan slot. null = ni ista doza ne staje u plafon pri ovom cilju (cilj nije izvodljiv).
 * - prvi put: početni nivo;
 * - prelaz faze: I posle R kreće od početnog nivoa; T cruise ≥ poslednje T kontinuirano (ista zona);
 *   MP ≥ max(početni nivo, poslednje I) — najmanji takav nivo; ako ne staje u plafon, ista doza druge
 *   strukture;
 * - ista lestvica: sledeći nivo ako staje u plafon, inače ista doza druge strukture (ako ne postoji —
 *   ponavljanje, M10).
 * `allowDrop` (samo kad nedelja nije izvodljiva NI PRI JEDNOM cilju uz „doza ne pada"): doza koja ne staje u
 * plafon spušta se na najviši nivo lestvice koji staje — plafon M11 ispred M12.
 * `oneSlot` (3 dana, M15; početnik, M17): prelaz iste zone (T kont. ↔ T cruise) koji bi dao isti trening
 * ide pravilom iste lestvice (sledeći nivo / druga struktura) — nema identičnih nedelja (M12). `beginner`
 * (M17): početni nivo je prvi nivo lestvice, T kontinuirano od 1,5 km.
 */
export function pickSlot(
  prev: SlotState | null,
  ladder: LadderId,
  targetKm: number,
  p: Paces,
  allowDrop = false,
  oneSlot = false,
  beginner = false,
  fits?: (s: Structure) => boolean
): Dose | null {
  const cap = capM(zoneOf(ladder), targetKm);
  const levels = ladderLevels(ladder, beginner);
  // Plafon slota: M11 (doza ≤ udeo cilja) i, za MP u izgradnji, trajanje ≤ dugi (pouka 14, `fits`). MP nikad
  // ispod najnižeg nivoa (2 × 3000 m, najmanja smislena MP doza — M7a, MAR-03): prelaz sa niže T doze (M12) koji
  // ne staje u najniži nivo nije izvodljiv (adaptacija: A9 — jedan kvalitet doze rasterećenja ili bez kvaliteta).
  const floorM = ladder === 'MP' ? doseOf(levels[0]!) : 0;
  const ok = (s: Structure): boolean =>
    doseOf(s) >= floorM && doseOf(s) <= cap && (fits ? fits(s) : true);
  const start0 = startLevel(ladder, targetKm, beginner);
  const start =
    start0 && !ok(start0)
      ? (levels.filter((s) => doseOf(s) <= doseOf(start0) && ok(s)).pop() ?? null)
      : start0;
  const drop = (): Dose | null => {
    const lv = allowDrop ? levels.filter(ok).pop() : undefined;
    return lv ? pick(ladder, lv, 'drop') : null;
  };
  // Pouka 14: doza u plafonu M11 čiji bi kvalitetni dan trajao duže od dugog → najviši nivo koji staje
  // (pad doze dozvoljen kao kod kapaciteta, pouka 12; napomena).
  const longDrop = (): Dose | null => {
    const lv = levels.filter(ok).pop();
    return lv ? pick(ladder, lv, 'drop') : null;
  };
  if (!prev) return start ? pick(ladder, start, 'start') : null;
  const progress = (): Dose | null => {
    const next = nextLevel(ladder, prev.doseM, beginner);
    if (next && ok(next)) return pick(ladder, next, 'next');
    if (prev.doseM > cap) return drop();
    const alt = otherStructure(ladder, prev.doseM, prev.structure, p, ok);
    if (alt) return pick(ladder, alt, 'alt');
    return ok(prev.structure) ? pick(ladder, prev.structure, 'repeat') : longDrop();
  };
  if (prev.ladder === ladder) return progress();
  if (!carries(prev.ladder, ladder)) return start ? pick(ladder, start, 'transition') : null;
  const newZone = zoneOf(prev.ladder) !== zoneOf(ladder);
  const repeats = (s: Structure): boolean =>
    oneSlot && !newZone && sameStructure(s, prev.structure);
  const lo = Math.max(prev.doseM, newZone && start ? doseOf(start) : 0);
  const lv = levels.find((s) => doseOf(s) >= lo);
  if (lv && ok(lv)) return repeats(lv) ? progress() : pick(ladder, lv, 'transition');
  if (prev.doseM > cap) return drop();
  if (lv && doseOf(lv) <= cap && fits) return longDrop();
  const s =
    otherStructure(ladder, prev.doseM, prev.structure, p, ok) ??
    structuresForDose(ladder, prev.doseM).filter(ok)[0];
  if (!s) return fits ? longDrop() : null;
  return repeats(s) ? progress() : pick(ladder, s, 'transition');
}

/** Izbor nedelje izgradnje: slot null = nedelja ga nema (test M16 na Q1, uvod M17, nedelja početnika bez
    kvaliteta; 3 dana i početnik bez Q2). */
export interface Picks {
  q1: Dose | null;
  q2: Dose | null;
}

/** Prvi nivo lestvice ne staje u plafon zone (M11) cilja nedelje; `beginner`: lestvica početnika (M17). */
export function firstLevelOverCap(ladder: LadderId, targetKm: number, beginner = false): boolean {
  return doseOf(ladderLevels(ladder, beginner)[0]!) > capM(zoneOf(ladder), targetKm);
}

/** Lestvica Q1 nedelje izgradnje: po fazi (M10/M15); početnik (M17) — T kontinuirano (od 1,5 km) kad prvi
    nivo lestvice faze ne staje u plafon; null = ni 1,5 km ne staje (bez kvaliteta, odstupanje M17). */
export function buildLadder(phase: Phase, targetKm: number, rule: PlanRule): LadderId | null {
  const l = ladderFor(phase, 'q1', rule.quality);
  if (!rule.beginner || !firstLevelOverCap(l, targetKm, true)) return l;
  return firstLevelOverCap('T_continuous', targetKm, true) ? null : 'T_continuous';
}

/** Slotovi nedelje izgradnje: Q1 i Q2 (4–6 dana) ili samo Q1 (3 dana i početnik, `quality` 1). `skipQ1` =
    test na danu Q1 (M16). Početnik: lestvica Q1 po M17; kad ni 1,5 km ne staje u plafon, Q1 = null. null =
    nedelja nije izvodljiva pri ovom cilju. */
export function pickBuild(
  state: QualityState,
  phase: Phase,
  targetKm: number,
  p: Paces,
  rule: PlanRule,
  allowDrop = false,
  skipQ1 = false,
  mpLong: { long10: number; wc: WarmupCooldown } | null = null
): Picks | null {
  const one = rule.quality === 1;
  const l1 = buildLadder(phase, targetKm, rule);
  let q1: Dose | null = null;
  if (!skipQ1 && l1) {
    // Pouka 14: MP slot uz drugi član plafona (trajanje ≤ najduži dozvoljeni dugi nedelje).
    const fits =
      l1 === 'MP' && mpLong
        ? (s: Structure) => mpFitsLong(s, mpLong.long10, p, mpLong.wc)
        : undefined;
    q1 = pickSlot(state.q1, l1, targetKm, p, allowDrop, one, rule.beginner, fits);
    if (!q1) return null;
  }
  if (one) return { q1, q2: null };
  const q2 = pickSlot(state.q2, ladderFor(phase, 'q2', rule.quality), targetKm, p, allowDrop);
  return q2 ? { q1, q2 } : null;
}

/** Stanje posle nedelje izgradnje: slot bez izbora zadržava stanje pre nedelje (M16: progresija se posle
    testa nastavlja od stanja pre testa); `t` = poslednja doza u zoni T (M5). */
export function advance(picks: Picks, prev: QualityState): QualityState {
  const slot = (d: Dose | null, before: SlotState | null): SlotState | null =>
    d ? { ladder: d.ladder as LadderId, doseM: d.doseM, structure: d.structure } : before;
  const t = [picks.q1, picks.q2].filter((d) => d?.zone === 'T').pop();
  return { q1: slot(picks.q1, prev.q1), q2: slot(picks.q2, prev.q2), t: t ? t.doseM : prev.t };
}

/** Struktura doze `minM` u lestvici: nivo sa tom dozom, inače prva struktura iste doze (M10). */
export function floorOf(ladder: LadderId, minM: number, beginner = false): Structure {
  return (
    ladderLevels(ladder, beginner).find((s) => doseOf(s) === minM) ??
    structuresForDose(ladder, minM)[0]!
  );
}

/** ≈ share × poslednja doza, najviši nivo lestvice naniže (`beginner`: lestvica početnika, M17); ispod
    najnižeg → `floor` (min). */
export function reduced(
  ladder: LadderId,
  lastM: number,
  share: number,
  floor: Structure,
  beginner = false
): Structure {
  const limit = share * lastM + 1e-6;
  const lv = ladderLevels(ladder, beginner).filter(
    (s) => doseOf(s) <= limit && doseOf(s) >= doseOf(floor)
  );
  return lv[lv.length - 1] ?? floor;
}

/** M5: najmanja T doza rasterećenja [m] — 2,0 km; početnik 1,5 km (M17). */
export const deloadMinM = (beginner: boolean): number =>
  Math.round((beginner ? P.beginner.tFirstKm : P.deload.tMinKm) * 1000);

/** M5: jedini kvalitet rasterećenja — T ≈ 60 % poslednje T doze (4–6 dana: slot Q2; 3 dana i početnik:
    poslednje T iz izgradnje), lestvica faze, min 2,0 km (početnik 1,5 km, M17; u razvoju/specifičnoj 1,5 km
    kontinuirano — T cruise nema taj nivo). null = ne staje u plafon M11. */
export function pickDeload(
  state: QualityState,
  phase: Phase,
  targetKm: number,
  beginner = false
): Dose | null {
  const ladder = deloadLadder(phase);
  const floor = floorOf(ladder, deloadMinM(beginner), beginner);
  const s = reduced(ladder, state.t, P.deload.tShare, floor, beginner);
  return doseOf(s) <= capM('T', targetKm) ? pick(ladder, s, 'deload') : null;
}

export interface TaperPicks {
  /** null = početnik u N−1 (M17: bez MP). */
  mp: Dose | null;
  t: Dose | null;
}

/** M7: doza nedelje tapera `step` po pravilu — MP ≈ share × poslednja MP doza (naniže, min 2 × 3000 m);
    N−2 i T ≈ 60 % poslednje T doze (min 2,0 km); 3 dana (`quality` 1) samo MP. M17 (odluka organizatora,
    MAR-03 S3): početnik u N−1 bez MP — jedan kvalitet T kontinuirano ≈ 60 % poslednje T doze (min 1,5 km;
    M7a ne važi). JEDINA funkcija doze tapera — čitaju je konstruktor (pickTaper) i validator (pouka 24).
    Plafon M11 se ovde ne proverava. */
export function taperDoses(
  state: QualityState,
  step: number,
  quality: 1 | 2,
  beginner = false
): { mp: Structure | null; t: Structure | null; tLadder: LadderId } {
  const w = P.taper.weeks[step]!;
  if (beginner && w.tShare === null) {
    const floor = floorOf('T_continuous', deloadMinM(true), true);
    return {
      mp: null,
      t: reduced('T_continuous', state.t, P.deload.tShare, floor, true),
      tLadder: 'T_continuous'
    };
  }
  // Poslednja MP doza izgradnje (slot Q1; početnik čija specifična faza nije imala MP: 0 → minimum).
  const lastMp = state.q1?.ladder === 'MP' ? state.q1.doseM : 0;
  const mp = reduced('MP', lastMp, w.mpShare, P.taper.mpMin);
  const t =
    w.tShare === null || quality === 1
      ? null
      : reduced(
          'T_cruise',
          state.q2?.doseM ?? 0,
          w.tShare,
          floorOf('T_cruise', Math.round(P.taper.tMinKm * 1000))
        );
  return { mp, t, tLadder: 'T_cruise' };
}

/** M7: izbor tapera. MP je uvek doza iz M7 — plafon M11 se na MP u taperu ne primenjuje (M7a, odluka
    organizatora posle STANI: minimum 2 × 3000 m ispred plafona 20 %). T po pravilu (`relax` false) mora stati
    u plafon M11, inače null; `relax` (druga pretraga, samo kad nijedan cilj nije izvodljiv po pravilu): T koji
    ne staje u plafon otpada (M11 ispred M7). Početnik N−1 (M17): T mora stati u plafon (jedini kvalitet). */
export function pickTaper(
  state: QualityState,
  step: number,
  targetKm: number,
  quality: 1 | 2,
  relax = false,
  beginner = false
): TaperPicks | null {
  const d = taperDoses(state, step, quality, beginner);
  const t = d.t && doseOf(d.t) <= capM('T', targetKm) ? pick(d.tLadder, d.t, 'taper') : null;
  if (!d.mp) return t ? { mp: null, t } : null;
  if (!relax && d.t !== null && !t) return null;
  return { mp: pick('MP', d.mp, 'taper'), t };
}
