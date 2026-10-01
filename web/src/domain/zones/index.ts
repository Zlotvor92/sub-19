/* ZONE PULSA — jedan izvor, i zna se KOJI.

   Granice zona su ranije dolazile isključivo sa Strave, a vreme po zonama (`l.icu.zonePuls`) sa
   intervals.icu — dva sistema: Strava ima pet zona iz maksimalnog pulsa, icu sedam iz praga, i granice se ne
   poklapaju. AI je raspodelu sa icu-a čitao kroz Stravine nazive („ceo trening u zoni 1" za trčanje koje je po
   njegovim zonama bilo Z2).

   PRAVILO: ko daje RASPODELU, daje i GRANICE. Granice iz same aktivnosti imaju prednost (stižu uz
   `zonePuls`, pa se broj zona po definiciji poklapa); sportska podešavanja su rezerva i pokazuju stanje
   DANAS, zato se broj zona proverava. Pola tačnih zona je gore od nijedne, jer izgleda ispravno. */

/** Zona kakva stiže sa servera ili iz backupa — sve je nepouzdano dok se ne proveri. */
export type RawZone = { min?: unknown; max?: unknown; ime?: unknown } | null | undefined;

export interface ZoneBoundary {
  min: number;
  /** `null` = poslednja zona, otvorena naviše. */
  max: number | null;
  ime: null;
}

export interface ZoneSource {
  zones: readonly RawZone[] | null;
  source: 'icu' | 'strava' | null;
}

const isNonEmptyArray = (x: unknown): x is readonly RawZone[] => Array.isArray(x) && x.length > 0;

/** Zone iz intervals.icu podešavanja, pa sa Strave; `null` kad nijednih nema. */
export function zoneSource(
  icu: { hrZones?: unknown } | null | undefined,
  strava: { hrZones?: unknown } | null | undefined
): ZoneSource {
  const zi = icu?.hrZones;
  if (isNonEmptyArray(zi)) return { zones: zi, source: 'icu' };
  const zs = strava?.hrZones;
  if (isNonEmptyArray(zs)) return { zones: zs, source: 'strava' };
  return { zones: null, source: null };
}

/**
 * Gornje granice iz icu-a (`[122,141,153,…]`) u `{min,max}` oblik. Poslednja zona je otvorena: icu je drži na
 * maksimalnom pulsu, pa bi otkucaj iznad nje ostao van svake zone. `null` na sve što nije rastući niz
 * uverljivih pulseva (50–250, 2–8 zona).
 */
export function zonesFromUpperBounds(upper: unknown): ZoneBoundary[] | null {
  if (!Array.isArray(upper) || upper.length < 2 || upper.length > 8) return null;
  const g: Array<number | null> = (upper as unknown[]).map((x) =>
    x == null || !Number.isFinite(+(x as number)) ? null : Math.round(+(x as number))
  );
  for (let i = 0; i < g.length; i++) {
    const v = g[i];
    if (v == null || v < 50 || v > 250) return null;
    const prev = g[i - 1];
    if (i > 0 && prev != null && v <= prev) return null;
  }
  return g.map((x, i) => ({
    min: i === 0 ? 1 : (g[i - 1] as number) + 1,
    max: i === g.length - 1 ? null : x,
    ime: null
  }));
}

export interface ZoneRow {
  n: number;
  sec: number;
  pct: number;
  ime: string | null;
}

export interface ZoneDistribution {
  total: number;
  rows: ZoneRow[];
  source: 'icu';
  zones: readonly RawZone[];
}

interface RunZones {
  icu?: { zonePuls?: unknown; zoneGranice?: unknown } | null;
}

/**
 * RASPODELA VREMENA PO ZONAMA — jedan račun za ekran i za model. `l.icu.zonePuls` su SEKUNDE po zoni.
 * Procenti se računaju OVDE, ne u modelu: da model sam deli sekunde, dobio bi priliku da pogreši u računu koji
 * aplikacija ume tačno. `null` kad raspodela ne sme da se imenuje: granice moraju biti iz icu-a i broj zona se
 * mora poklapati (trkač koji je promenio broj zona ima starije treninge sa starim brojem — indeksi bi bili
 * pomereni i svaka oznaka „Z2" pogrešna).
 *
 * PROCENTI MORAJU DATI 100: obično zaokruživanje na sedam zona ume da da 99 ili 101, a to na ekranu izgleda kao
 * greška u računu. Metod najvećeg ostatka.
 */
export function zoneDistribution(
  log: RunZones | null | undefined,
  current: ZoneSource
): ZoneDistribution | null {
  if (!log || typeof log !== 'object') return null;
  const arr = log.icu && Array.isArray(log.icu.zonePuls) ? (log.icu.zonePuls as unknown[]) : null;
  if (!arr || !arr.length) return null;
  const own =
    log.icu && Array.isArray(log.icu.zoneGranice)
      ? zonesFromUpperBounds(log.icu.zoneGranice)
      : null;
  let zones: readonly RawZone[] | null = null;
  if (own && own.length === arr.length) zones = own;
  else if (current.source === 'icu' && current.zones && current.zones.length === arr.length)
    zones = current.zones;
  if (!zones) return null;
  const sec = arr.map((x) =>
    x == null || !Number.isFinite(+(x as number)) || +(x as number) < 0
      ? 0
      : Math.round(+(x as number))
  );
  const total = sec.reduce((a, b) => a + b, 0);
  if (total < 60) return null; // ispod minuta nema šta da se deli na zone
  const exact = sec.map((s) => (s / total) * 100);
  const floor = exact.map((x) => Math.floor(x));
  let left = 100 - floor.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => ({ i, rem: x - Math.floor(x) })).sort((a, b) => b.rem - a.rem);
  for (let k = 0; k < order.length && left > 0; k++, left--) {
    const idx = (order[k] as { i: number }).i;
    floor[idx] = (floor[idx] as number) + 1;
  }
  const rows = sec.map((s, i) => {
    const name = zones[i]?.ime;
    return {
      n: i + 1,
      sec: s,
      pct: floor[i] as number,
      ime: typeof name === 'string' && name.trim() ? name.trim() : null
    };
  });
  return { total, rows, source: 'icu', zones };
}

/**
 * Zone merodavne za JEDAN KONKRETAN TRENING. `zoneSource` odgovara na „koje su tvoje zone DANAS"; za pojedinačan
 * trening to nije isto pitanje — raspodela se računa po granicama koje su stigle UZ TU AKTIVNOST. Bez ovoga je
 * model dobijao „Z1–Z5, iz: Strava" a ispod procente izračunate po sedam icu zona („Z4 7 %" po icu granicama je
 * prag, a model ga je čitao kao Stravin VO2max).
 */
export function zonesForRun(log: RunZones | null | undefined, current: ZoneSource): ZoneSource {
  const r = zoneDistribution(log, current);
  if (r && r.zones.length) return { zones: r.zones, source: r.source };
  return current;
}

/**
 * U kojoj je zoni dati puls. Poslednja zona nema gornju granicu (Strava je šalje kao −1 → null). Konačna
 * granica se proverava sa `Number.isFinite`, NE sa `>= 0`: u JS-u je `null >= 0` tačno, pa bi zapis bez
 * granice iz pokvarenog backupa prošao kao zona koja počinje od nule.
 */
export function zoneForHr(
  hr: number | null | undefined,
  zones: readonly RawZone[] | null | undefined
): { n: number; from: number; to: number | null } | null {
  if (!Array.isArray(zones) || !zones.length || !((hr ?? 0) > 0)) return null;
  const list: readonly RawZone[] = zones;
  const value = hr as number;
  for (let i = 0; i < list.length; i++) {
    const lo = list[i]?.min;
    const hi = list[i]?.max;
    if (typeof lo !== 'number' || !Number.isFinite(lo) || lo < 0) continue;
    const bounded = typeof hi === 'number' && Number.isFinite(hi) && hi > 0;
    if (value >= lo && (!bounded || value <= hi))
      return { n: i + 1, from: lo, to: bounded ? hi : null };
  }
  return null;
}

export interface MissingZonesContext {
  icuConnected: boolean;
  current: ZoneSource;
  /** Poslednja greška povlačenja zona (`S.icu.zoneGreska`). */
  zoneError?: string | null;
}

/**
 * ZAŠTO RASPODELE NEMA — izgovoreno, ne prećutano. `zoneDistribution` vraća `null` iz četiri razloga, a
 * kartica koja tada nestane izgleda isto u sva četiri. Objašnjava se SAMO kad ima šta da se objasni (ko nema
 * povezan icu nema odakle da dobije raspodelu); `''` = ćutati. Redosled provera prati `zoneDistribution`.
 */
export function missingZonesReason(
  log: (RunZones & { lock?: unknown }) | null | undefined,
  ctx: MissingZonesContext
): string {
  if (!log || typeof log !== 'object') return '';
  if (!ctx.icuConnected) return '';
  const arr = log.icu && Array.isArray(log.icu.zonePuls) ? (log.icu.zonePuls as unknown[]) : null;
  if (!arr || !arr.length) {
    if (log.lock)
      return 'Ovo trčanje je ručno korigovano, pa se podaci sa intervals.icu za njega više ne prepisuju (tako ispravka ostaje trajna). Zato za njega nema vremena po zonama.';
    if (typeof ctx.zoneError === 'string' && ctx.zoneError) return ctx.zoneError;
    return 'Za ovo trčanje intervals.icu još nije dao vreme po zonama. Podešavanja → intervals.icu → „Povuci sve" — treninzi se tada uvoze ponovo, sa zonama. Ako i posle toga nema, tog podatka nema ni na njihovoj strani.';
  }
  const own =
    log.icu && Array.isArray(log.icu.zoneGranice)
      ? zonesFromUpperBounds(log.icu.zoneGranice)
      : null;
  if (own && own.length === arr.length) return '';
  const g = ctx.current;
  if (g.source === 'icu' && g.zones && g.zones.length === arr.length) return '';
  if (g.source === 'icu' && g.zones && g.zones.length)
    return `Raspodela za ovo trčanje je računata po ${arr.length} zona, a tvoje zone sada imaju ${g.zones.length}. Oznake bi bile pomerene za jedno mesto, pa se ne prikazuju — „Povuci sve" uvozi trening ponovo, sa granicama iz same aktivnosti, i to rešava.`;
  return 'Ovo trčanje je uvezeno pre nego što je aplikacija počela da preuzima i granice zona. Podešavanja → intervals.icu → „Povuci sve" i raspodela će se pojaviti — nije potrebna nikakva nova dozvola.';
}

/** Pragovi skale drifta (%): ispod prvog zdrava aerobna baza, do drugog granično, preko drugog tempo košta znatno više otkucaja. Isti brojevi stoje u uputstvu. */
export const DRIFT_GOOD_BELOW = 5;
export const DRIFT_WARN_BELOW = 8;

/** Skala boje drifta: < 5 % zdrava aerobna baza, 5–8 % granično, > 8 % tempo košta znatno više otkucaja. */
export function driftLevel(n: number): 'good' | 'warn' | 'bad' {
  return n < DRIFT_GOOD_BELOW ? 'good' : n < DRIFT_WARN_BELOW ? 'warn' : 'bad';
}
