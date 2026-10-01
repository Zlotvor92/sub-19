/* PO-KILOMETARSKI PRESEK za kontinuirana trčanja (lako/dugo): puls, kadenca i tempo svakog kilometra. */

import type { ActivityStreams, PerKmRow, StreamSeries } from './types';

/**
 * Verzija po-km podataka. Podiže se kad se promeni NAČIN računanja, da se već sinhronizovani treninzi jednom
 * osveže — inače popravka nikad ne stigne do trčanja koja su već u bazi (prijava korisnika: ista pogrešna
 * analiza i posle ispravke, jer je `perKm` bio keširan iz starog sync-a).
 */
export const PERKM_VERSION = 2;

/**
 * Verzija krugova sa intervals.icu — isti obrazac i razlog. v2: zagrevanje i hlađenje nisu radni krugovi;
 * v3: radni krugovi se biraju po PLANIRANOJ dužini repa kad je plan zna.
 */
export const LAPS_VERSION = 3;

const mean = (
  arr: ReadonlyArray<number | null> | undefined,
  a: number,
  b: number
): number | null => {
  if (!arr) return null;
  let s = 0;
  let n = 0;
  for (let k = a; k <= b && k < arr.length; k++) {
    const x = arr[k];
    if (x != null) {
      s += x;
      n++;
    }
  }
  return n ? s / n : null;
};
const roundOrNull = (x: number | null): number | null => (x != null ? Math.round(x) : null);

/**
 * TEMPO PO KILOMETRU iz VREMENA U POKRETU, ne iz proteklog. Proteklo vreme uvlači svako zaustavljanje
 * (semafor, česma): izmereno na progresivnom dugom trčanju sa stajanjima od 121, 54, 42 i 37 s, pa je
 * analiza dobila 6:53 umesto 4:52 i zaključila „ogroman drift" — analiza pogrešna u samoj osnovi. `stopSec`
 * se vraća da se zna DA je bilo stajanja i da se ne tumači kao usporavanje.
 */
export function perKmDetail(streams: ActivityStreams | null | undefined): PerKmRow[] {
  if (!streams) return [];
  const dist = streams.distance?.data;
  const time = streams.time?.data;
  const mov = streams.moving?.data;
  if (!Array.isArray(dist) || !dist.length) return [];
  const d = dist as readonly number[];
  const t = time;
  const hasMoving = Array.isArray(mov) && Array.isArray(t) && mov.length === t.length;
  const series = (s: StreamSeries | undefined) => s?.data;
  const out: PerKmRow[] = [];
  let km = 1;
  let startI = 0;
  for (let i = 0; i < d.length; i++) {
    if ((d[i] as number) < km * 1000) continue;
    const elapsed =
      t && t[i] != null && t[startI] != null ? (t[i] as number) - (t[startI] as number) : null;
    let dt = elapsed;
    let stop = 0;
    if (hasMoving && elapsed != null && t && mov) {
      let s = 0;
      for (let k = startI; k < i; k++) if (mov[k + 1]) s += (t[k + 1] as number) - (t[k] as number);
      dt = s;
      stop = Math.max(0, elapsed - s);
    }
    const row: PerKmRow = {
      km,
      v: PERKM_VERSION,
      paceSec: dt != null ? Math.round(dt) : null,
      hr: roundOrNull(mean(series(streams.heartrate), startI, i)),
      cadence: roundOrNull(mean(series(streams.cadence), startI, i))
    };
    if (stop >= 5) row.stopSec = Math.round(stop);
    const alt = streams.altitude?.data;
    const alt0 = alt && alt[startI] != null ? alt[startI] : null;
    const alt1 = alt && alt[i] != null ? alt[i] : null;
    if (alt0 != null && alt1 != null) {
      const dEl = Math.round(alt1 - alt0);
      if (Math.abs(dEl) >= 4) row.elevM = dEl;
    }
    const w = mean(series(streams.watts), startI, i);
    if (w != null) row.watts = Math.round(w);
    const tmp = mean(series(streams.temp), startI, i);
    if (tmp != null) row.temp = Math.round(tmp);
    out.push(row);
    startI = i;
    km++;
  }
  return out;
}

export type Decoupling = { n: number } | { n: null; reason: string } | null;

/**
 * DEKUPLOVANJE (Pa:HR) — koliko se odnos tempa i pulsa pokvario u drugoj polovini trčanja; standardna
 * mera AEROBNE IZDRŽLJIVOSTI (ispod 5 % dobro, preko 8 % znači da tempo u drugoj polovini košta znatno više
 * otkucaja). Merodavno SAMO ako je tempo bio približno ravnomeran (±3 % između polovina): na progresivnom
 * trčanju je razlika po definiciji ogromna i ništa ne govori o izdržljivosti, pa se vraća razlog umesto
 * broja koji bi pogrešno protumačili. Pragovi su konvencija iz treninga, ne zakon.
 */
export function decouplingPerKm(
  perKm: ReadonlyArray<Pick<PerKmRow, 'paceSec' | 'hr'>> | null | undefined
): Decoupling {
  if (!Array.isArray(perKm)) return null;
  const list: ReadonlyArray<Pick<PerKmRow, 'paceSec' | 'hr'>> = perKm;
  const v = list.filter((k) => k && (k.paceSec ?? 0) > 0 && (k.hr ?? 0) > 0);
  if (v.length < 6) return null;
  const half = Math.floor(v.length / 2);
  const A = v.slice(0, half);
  const B = v.slice(v.length - half);
  const avg = (arr: typeof v, f: (x: (typeof v)[number]) => number): number =>
    arr.reduce((s, x) => s + f(x), 0) / arr.length;
  const pA = avg(A, (x) => x.paceSec as number);
  const pB = avg(B, (x) => x.paceSec as number);
  if (!(pA > 0) || Math.abs(pB - pA) / pA > 0.03)
    return { n: null, reason: 'tempo nije bio ravnomeran' };
  const rA = 1000 / pA / avg(A, (x) => x.hr as number);
  const rB = 1000 / pB / avg(B, (x) => x.hr as number);
  if (!(rA > 0)) return null;
  return { n: Math.round(((rA - rB) / rA) * 1000) / 10 };
}
