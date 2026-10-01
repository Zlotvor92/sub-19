/* KRUGOVI (lapovi): koji su RADNI i koliki je tempo radnog dela.

   JEDNO PRAVILO, DVA IZVORA (Strava i intervals.icu): sidro je najbrži krug, zadržavaju se krugovi unutar
   25 % od njega. Zagrevanje, hlađenje i hod su iste distance ali dramatično sporiji, pa ispadaju sami. */

import type { Lap } from './types';

/** Radni krug je najviše ovoliko sporiji od najbržeg (heuristika). */
export const WORK_LAP_PACE_RATIO = 1.25;
/**
 * Koliko sporiji od najbržeg radnog mora biti krug da bi bio SIGURNO kaskanje, ma gde u nizu stajao. Šire
 * od `WORK_LAP_PACE_RATIO` namerno: mora da propusti sporiji rep u lestvici (1600 m @4:00 uz 400 m @3:00 =
 * 1,33), a da uhvati dvominutni hod (odnos preko 2,3). Postoji jer intervals.icu ne označava uvek kaskanja
 * kao RECOVERY: kad ih ne označi, stoje u SREDINI niza, gde pravilo po položaju ne dopire (izmereno 4:22–4:26
 * umesto 3:52).
 */
export const JOG_LAP_PACE_RATIO = 1.5;
/** Tolerancija dužine kruga naspram planirane dužine repa. */
export const LAP_DISTANCE_TOLERANCE = 0.15;

/** Zadržava stavke čiji je tempo u opsegu od najbrže. Neupotrebljiv tempo (≤0, NaN) ispada. */
export function keepWorkItems<T>(
  items: readonly T[] | null | undefined,
  paceOf: (x: T) => number
): T[] {
  if (!items || !items.length) return [];
  const t = items.map(paceOf).filter((x) => x > 0 && Number.isFinite(x));
  if (!t.length) return [];
  const fastest = Math.min(...t);
  return items.filter((x) => {
    const p = paceOf(x);
    return p > 0 && Number.isFinite(p) && p <= fastest * WORK_LAP_PACE_RATIO;
  });
}

const lapTime = (L: Lap): number => L.moving_time || L.elapsed_time || 0;

/** Radni krugovi: oni čija je dužina blizu planirane dužine repa, pa samo najbrži među njima. */
export function selectWorkLaps(
  laps: readonly Lap[] | null | undefined,
  specs: readonly number[]
): Lap[] {
  if (!laps || !laps.length) return [];
  const paceOf = (L: Lap): number => lapTime(L) / (L.distance / 1000);
  const candidates = laps.filter(
    (L) =>
      L.distance > 0 &&
      lapTime(L) > 0 &&
      specs.some((m) => Math.abs(L.distance - m) / m <= LAP_DISTANCE_TOLERANCE)
  );
  if (!candidates.length) return [];
  return keepWorkItems(candidates, paceOf);
}

/** Tempo radnog dela (s/km) iz krugova; `null` kad nema upotrebljivih. */
export function workLapsPace(
  laps: readonly Lap[] | null | undefined,
  specs: readonly number[]
): number | null {
  const work = selectWorkLaps(laps, specs);
  if (!work.length) return null;
  const dist = work.reduce((s, L) => s + L.distance, 0);
  const t = work.reduce((s, L) => s + lapTime(L), 0);
  if (!dist || !t) return null;
  return Math.round(t / (dist / 1000));
}

/** Tempo svih krugova u opsegu `[prvi radni, poslednji radni]` UKLJUČUJUĆI oporavke između (donja granica). */
export function blockPace(
  laps: readonly Lap[] | null | undefined,
  specs: readonly number[],
  tol = 0.12
): number | null {
  if (!laps) return null;
  const idx = laps
    .map((L, i) => ({ i, hit: specs.some((m) => Math.abs(L.distance - m) / m <= tol) }))
    .filter((x) => x.hit)
    .map((x) => x.i);
  if (!idx.length) return null;
  const block = laps.slice(idx[0], (idx[idx.length - 1] as number) + 1);
  const dist = block.reduce((s, L) => s + L.distance, 0);
  const t = block.reduce((s, L) => s + lapTime(L), 0);
  if (!dist || !t) return null;
  return Math.round(t / (dist / 1000));
}

/** Tempo samo krugova koji pogađaju dužinu repa (gornja granica opsega; bez oporavaka). */
export function allWorkLapsPace(
  laps: readonly Lap[] | null | undefined,
  specs: readonly number[],
  tol = 0.12
): number | null {
  if (!laps) return null;
  const work = laps.filter((L) => specs.some((m) => Math.abs(L.distance - m) / m <= tol));
  if (!work.length) return null;
  const dist = work.reduce((s, L) => s + L.distance, 0);
  const t = work.reduce((s, L) => s + lapTime(L), 0);
  if (!dist || !t) return null;
  return Math.round(t / (dist / 1000));
}

/** Riegel (v2 oblik): tempo kvalitetnog dela → vreme na 5 km. */
export const riegelTo5kFromPace = (paceSec: number, qKm: number): number =>
  paceSec * qKm * Math.pow(5 / qKm, 1.06);

export interface PredictRange {
  hi: number;
  lo: number;
  hiPace: number;
  loPace: number;
}

/**
 * Opseg predikcije 5K za intervalne sesije sa krugovima: gornja granica iz samih radnih krugova, donja iz
 * celog bloka sa oporavcima (WU/CD ostaju isključeni). `null` → pozivalac koristi jedan-broj tok.
 */
export function predictRange(
  laps: readonly Lap[] | null | undefined,
  specs: readonly number[],
  qKm: number
): PredictRange | null {
  if (!laps || !laps.length) return null;
  const hiPace = allWorkLapsPace(laps, specs);
  const loPace = blockPace(laps, specs);
  if (hiPace == null || loPace == null) return null;
  return {
    hi: Math.round(riegelTo5kFromPace(hiPace, qKm)),
    lo: Math.round(riegelTo5kFromPace(loPace, qKm)),
    hiPace,
    loPace
  };
}
