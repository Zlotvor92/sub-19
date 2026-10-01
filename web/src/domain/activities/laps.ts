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

/* ---------- krugovi sa intervals.icu ---------- */

/** Krug sa intervals.icu u njegovom (srpskom) obliku — spoljni ugovor `api/icu.js`. */
export interface IcuRound {
  tip?: string | null;
  sec?: number | null;
  paceSec?: number | null;
  distM?: number | null;
  hr?: number | null;
  kadenca?: number | null;
  watts?: number | null;
  gapSec?: number | null;
  maxHr?: number | null;
  minHr?: number | null;
  razdvajanje?: number | string | null;
  oznaka?: string | null;
}

/** Radni krug u obliku koji aplikacija čuva (`l.laps`). */
export interface WorkLap {
  distM: number;
  paceSec: number;
  avgHr: number | null;
  cadence: number | null;
  watts: number | null;
  gapSec?: number;
  maxHr?: number;
  minHr?: number;
  razdvajanje?: number | string;
  oznaka?: string;
  restSec?: number;
  restPaceSec?: number;
}

type PacedLap = { distM?: number | null; paceSec?: number | null };

/**
 * SKIDA SAMO KRAJEVE, I SAMO KAD SU JASNO SPORIJI. Primena Stravinog pravila („sidro je najbrži, zadrži
 * unutar 25 %") na CEO niz pokvarila bi lestvicu 1600 m @4:00 + 400 m @3:00: oba su radni repovi, razlika je
 * 33 %, pa bi duži ispao i tempo bio 3:00 umesto 3:48 (greška koja izgleda kao napredak). Zagrevanje i
 * hlađenje razlikuje POLOŽAJ — prvi su i poslednji — pa se gledaju samo prva i poslednja deonica naspram
 * najbrže iz JEZGRA. Rep u sredini, ma koliko sporiji, ostaje rep. Ispod tri deonice se ne dira ništa.
 *
 * Dužina repa iz PLANA je najpouzdaniji ključ kad postoji (isti prag 15 % kao Stravina putanja); ako nijedna
 * deonica ne odgovara planu (čovek je trčao drugačiju strukturu), pravilo se NE primenjuje.
 * Očigledno kaskanje (> `JOG_LAP_PACE_RATIO` od najbrže) ispada ma gde stajalo — jedini sloj koji doseže u
 * sredinu niza, namerno grub.
 */
export function selectIcuWorkLaps<T extends PacedLap>(
  items: readonly (T | null | undefined)[] | null | undefined,
  specs?: readonly number[] | null
): T[] {
  if (!Array.isArray(items)) return [];
  const list: readonly (T | null | undefined)[] = items;
  let ok = list.filter(
    (x): x is T => !!x && (x.distM ?? 0) > 0 && (x.paceSec ?? 0) > 0 && Number.isFinite(x.paceSec)
  );
  const planned: readonly number[] | null | undefined = specs;
  if (planned && planned.length) {
    const byPlan = ok.filter((x) =>
      planned.some((m) => m > 0 && Math.abs((x.distM as number) - m) / m <= LAP_DISTANCE_TOLERANCE)
    );
    if (byPlan.length) ok = byPlan;
  }
  if (ok.length > 1) {
    const fastestAll = Math.min(...ok.map((x) => x.paceSec as number));
    const coarse = ok.filter((x) => (x.paceSec as number) <= fastestAll * JOG_LAP_PACE_RATIO);
    if (coarse.length) ok = coarse;
  }
  if (ok.length < 3) return ok;
  const core = ok.slice(1, -1).map((x) => x.paceSec as number);
  const limit = Math.min(...core) * WORK_LAP_PACE_RATIO;
  const from = (ok[0] as T).paceSec! > limit ? 1 : 0;
  const to = (ok[ok.length - 1] as T).paceSec! > limit ? ok.length - 1 : ok.length;
  return ok.slice(from, to);
}

/**
 * Krugovi sa icu-a u `l.laps` oblik: dodaje GAP, maks/min puls, razdvajanje po repu i trajanje oporavka KOJI
 * SLEDI. Oporavci se ne vode kao krugovi (inače bi „6×800" ispalo 11 krugova), nego se lepe na rep ispred
 * sebe. Zagrevanje i hlađenje NISU radni krugovi (v. `selectIcuWorkLaps`): sesija 1,5 km WU + 6×1000 m @3:55 +
 * 2,5 km CD davala je 4:40/km umesto 3:52, što je `recordVdot` s pravom odbijao, a korisnik je morao da kuca
 * tempo ručno posle svakih intervala.
 */
export function icuRoundsToLaps(
  rounds: readonly (IcuRound | null | undefined)[] | null | undefined,
  specs?: readonly number[] | null
): WorkLap[] {
  if (!Array.isArray(rounds)) return [];
  const list: readonly (IcuRound | null | undefined)[] = rounds;
  const out: WorkLap[] = [];
  for (const k of list) {
    if (!k) continue;
    if (k.tip === 'oporavak') {
      const last = out[out.length - 1];
      if (last && (k.sec ?? 0) > 0) {
        last.restSec = k.sec as number;
        if (k.paceSec) last.restPaceSec = k.paceSec;
      }
      continue;
    }
    if (!((k.distM ?? 0) > 0) || !((k.paceSec ?? 0) > 0)) continue;
    const o: WorkLap = {
      distM: k.distM as number,
      paceSec: k.paceSec as number,
      avgHr: k.hr ?? null,
      cadence: k.kadenca ?? null,
      watts: k.watts ?? null
    };
    if (k.gapSec != null) o.gapSec = k.gapSec;
    if (k.maxHr != null) o.maxHr = k.maxHr;
    if (k.minHr != null) o.minHr = k.minHr;
    if (k.razdvajanje != null) o.razdvajanje = k.razdvajanje;
    if (k.oznaka) o.oznaka = String(k.oznaka).slice(0, 40);
    out.push(o);
  }
  return selectIcuWorkLaps(out, specs);
}

/**
 * Prosečan tempo RADNOG dela iz krugova — ukupno vreme / ukupna distanca, ne prosek proseka. Poziva se i nad
 * već upisanim `l.laps` (kartica „Ostvaren tempo", trend): treninzi uvezeni PRE ispravke imaju zagrevanje i
 * hlađenje unutra, a filtriranje pri uvozu ih ne dotiče. Nad već očišćenim nizom je bez dejstva.
 */
export function icuWorkPace(
  laps: readonly (PacedLap | null | undefined)[] | null | undefined,
  specs?: readonly number[] | null
): number | null {
  if (!Array.isArray(laps) || !laps.length) return null;
  const list: readonly (PacedLap | null | undefined)[] = laps;
  const work = selectIcuWorkLaps(list, specs);
  if (!work.length) return null;
  const d = work.reduce((s, x) => s + (x.distM || 0), 0);
  const t = work.reduce((s, x) => s + ((x.paceSec as number) * (x.distM || 0)) / 1000, 0);
  return d > 0 && t > 0 ? Math.round(t / (d / 1000)) : null;
}
