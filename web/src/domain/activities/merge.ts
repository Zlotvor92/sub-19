/* DVA TRČANJA ISTOG DANA SU DVA TRČANJA — oba se broje.

   Stari kod je uzimao samo ono bliže planiranoj kilometraži, a drugo je nestajalo bez traga. Dve štete, obe
   merene: (1) OBIM — dan sa dva trčanja brojao se kao jedno, što truje akutni/hronični obim i svaki predlog
   povratka; (2) IZBOR — na kvalitetnom danu je „bliže planu" sistematski birao pogrešno, jer plan uključuje
   zagrevanje i hlađenje koje ljudi trče kraće (plan 9,4 km; jutro 7,71 km sa strukturom, veče 9,40 lagano →
   uzimalo se veče; intervali su se gubili zajedno sa krugovima i VDOT-om).

   Sada je kilometraža ZBIR, vreme ZBIR, puls prosek ponderisan trajanjem.

   DUPLIKATI SE NE SABIRAJU: isti trening ume da stigne dvaput (ponovljen upload, sat i telefon). Aktivnost
   koja se od već uzete razlikuje manje od 1 % i po distanci i po vremenu preskače se.

   Radi nad OBA oblika: Strava (`distance` m, `moving_time`, `average_heartrate`…) i intervals.icu (`km`,
   `sec`, `hr`…). */

export interface RawActivity {
  distance?: number | null;
  km?: number | null;
  moving_time?: number | null;
  sec?: number | null;
  average_heartrate?: number | null;
  hr?: number | null;
  max_heartrate?: number | null;
  maxHr?: number | null;
  total_elevation_gain?: number | null;
  uspon?: number | null;
}

const distM = (a: RawActivity | null | undefined): number =>
  a && a.distance != null ? a.distance : a && a.km != null ? a.km * 1000 : 0;
/** `null` znači NEPOZNATO, ne nula: puls je ponderisan trajanjem, pa bi ponder 0 poznat puls pretvorio u `null`. */
const secOf = (a: RawActivity | null | undefined): number | null =>
  a && a.moving_time != null ? a.moving_time : a && a.sec != null ? a.sec : null;
const hrOf = (a: RawActivity): number | null =>
  a.average_heartrate != null ? a.average_heartrate : a.hr != null ? a.hr : null;
const maxHrOf = (a: RawActivity): number | null =>
  a.max_heartrate != null ? a.max_heartrate : a.maxHr != null ? a.maxHr : null;
const elevOf = (a: RawActivity): number | null =>
  a.total_elevation_gain != null ? a.total_elevation_gain : a.uspon != null ? a.uspon : null;

export interface MergedDay<A extends RawActivity> {
  taken: A[];
  n: number;
  km: number;
  /** `null` kad nijedna uzeta aktivnost nema poznato trajanje — pozivaoci ne upisuju ništa umesto nule. */
  sec: number | null;
  hr: number | null;
  maxHr: number | null;
  elev: number | null;
}

export function mergeDay<A extends RawActivity>(
  list: readonly (A | null | undefined)[] | null | undefined
): MergedDay<A> {
  const taken: A[] = [];
  for (const a of list ?? []) {
    if (!a) continue;
    const dup = taken.some((b) => {
      const dd = Math.abs(distM(a) - distM(b)) / Math.max(distM(b), 1);
      const dt =
        Math.abs((secOf(a) as number) - (secOf(b) as number)) / Math.max(secOf(b) as number, 1);
      return dd < 0.01 && dt < 0.01;
    });
    if (!dup) taken.push(a);
  }
  /* Puls: ponderisan trajanjem KAD JE TRAJANJE POZNATO, a kad nije — prost prosek poznatih pulseva. */
  const withHr = taken.filter((a) => hrOf(a) != null);
  const hrWeight = withHr.reduce((s, a) => s + (secOf(a) || 0), 0);
  const hrSum = withHr.reduce((s, a) => s + (hrOf(a) as number) * (secOf(a) || 0), 0);
  const maxHr = taken.reduce(
    (m, a) => (maxHrOf(a) != null ? Math.max(m, maxHrOf(a) as number) : m),
    0
  );
  return {
    taken,
    n: taken.length,
    km: Math.round(taken.reduce((s, a) => s + distM(a), 0) / 10) / 100,
    sec: taken.some((a) => secOf(a) != null)
      ? taken.reduce((s, a) => s + (secOf(a) || 0), 0)
      : null,
    hr: withHr.length
      ? hrWeight > 0
        ? Math.round(hrSum / hrWeight)
        : Math.round(withHr.reduce((s, a) => s + (hrOf(a) as number), 0) / withHr.length)
      : null,
    maxHr: maxHr > 0 ? Math.round(maxHr) : null,
    elev: taken.some((a) => elevOf(a) != null)
      ? Math.round(taken.reduce((s, a) => s + (elevOf(a) || 0), 0))
      : null
  };
}

/**
 * Cilj tempa iz teksta opisa: „@ 4:10/km", „~4:25/km" ili opseg „3:52–3:54/km" (sredina). Best-effort — za
 * sesije sa VIŠE tempova u tekstu hvata PRVI pomen.
 */
export function extractPaceFromDesc(desc: string | null | undefined): number | null {
  if (!desc) return null;
  const m = /(\d{1,2}):(\d{2})(?:\s*[–-]\s*(\d{1,2}):(\d{2}))?\s*\/\s*km/.exec(String(desc));
  if (!m) return null;
  const s1 = +(m[1] as string) * 60 + +(m[2] as string);
  if (m[3] != null) {
    const s2 = +m[3] * 60 + +(m[4] as string);
    return Math.round((s1 + s2) / 2);
  }
  return s1;
}
