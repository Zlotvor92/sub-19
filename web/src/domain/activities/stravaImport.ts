/* UVOZ TRČANJA SA STRAVE: odluke, bez ikakvog ulaza/izlaza. Servis (`services/strava`) povlači podatke i ovde pita „šta s njima".

   Pravila koja su učena na greškama:
   - RUČNA KOREKCIJA IMA TRAJNU PREDNOST: zapis sa `lock` se ne prepisuje (samo mu se osvežava pravi datum trčanja);
   - SVA TRČANJA ISTOG DANA ULAZE U OBIM (v. `mergeDay`); „glavno" trčanje je samo nosilac imena, opisa i ID-ja;
   - sat trčanja se čita iz STRINGA (Strava šalje lokalno vreme trkača i uz završno „Z"), nikad preko `Date` — pomerilo bi ga za
     zonu pregledača. */

import type { LogEntry } from '../state/types';
import type { MergedDay } from './merge';

export interface StravaActivity {
  id: number | string;
  name?: string | null;
  description?: string | null;
  type?: string | null;
  sport_type?: string | null;
  start_date_local?: string | null;
  distance?: number | null;
  moving_time?: number | null;
  average_heartrate?: number | null;
  max_heartrate?: number | null;
  total_elevation_gain?: number | null;
  suffer_score?: number | null;
  average_cadence?: number | null;
  average_temp?: number | null;
}

export const isRun = (a: StravaActivity): boolean => a.type === 'Run' || a.sport_type === 'Run';

/** Trčanja po lokalnom datumu početka (`YYYY-MM-DD`). Redosled ključeva je redosled prvog pojavljivanja. */
export function runsByDate(acts: readonly StravaActivity[]): Record<string, StravaActivity[]> {
  const by: Record<string, StravaActivity[]> = {};
  for (const a of acts) {
    if (!isRun(a)) continue;
    const dt = String(a.start_date_local ?? '').slice(0, 10);
    if (dt) (by[dt] ??= []).push(a);
  }
  return by;
}

/** Ukupno km po danu (za trčanja pre plana). */
export function kmByDate(
  by: Readonly<Record<string, readonly StravaActivity[]>>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const dt of Object.keys(by))
    out[dt] = (by[dt] ?? []).reduce((s, a) => s + (+(a.distance ?? 0) || 0) / 1000, 0);
  return out;
}

/** Trčanje najbliže planiranoj kilometraži (nosilac imena/ID-ja). Dan bez km (snaga) poredi sa 0, kao stari kod. */
export function pickClosest<T extends { distance?: number | null }>(
  list: readonly T[],
  planKm: number | null
): T {
  const km = planKm ?? 0;
  return list.reduce<T>(
    (b, x) =>
      Math.abs((x.distance ?? 0) / 1000 - km) < Math.abs((b.distance ?? 0) / 1000 - km) ? x : b,
    list[0] as T
  );
}

/** Sat početka iz lokalnog vremena u stringu (`2026-01-14T07:32:00Z` → 7); `null` kad ga nema. */
export function localStartHour(a: Pick<StravaActivity, 'start_date_local'>): number | null {
  const m = /^\d{4}-\d\d-\d\dT(\d\d)/.exec(String(a.start_date_local ?? ''));
  return m ? +(m[1] as string) : null;
}

export interface ImportedRun {
  entry: LogEntry;
  /** Zapis je prepisan podacima sa Strave (`false` kad je zaključan ručnom korekcijom). */
  imported: boolean;
}

/**
 * Zapis dana posle uvoza. `a` je glavno trčanje (nosilac), `merged` zbir svih trčanja tog dana.
 * Zaključan zapis (`lock`) dobija SAMO `runDate`.
 */
export function importedEntry(
  current: LogEntry | undefined,
  date: string,
  merged: MergedDay<StravaActivity>,
  a: StravaActivity
): ImportedRun {
  const l: LogEntry = { ...(current ?? {}) };
  l.runDate = date; // pravi datum trčanja iz Strave — NE dira se ručnim izmenama, koristi ga trend
  if (l.lock) return { entry: l, imported: false };
  l.status = 'done';
  l.km = merged.km;
  if (merged.sec) l.sec = merged.sec; // trajanje samo ako je poznato (isto pravilo kao putanja intervals.icu)
  if (merged.n > 1) l['spojeno'] = merged.n;
  else delete l['spojeno'];
  if (merged.hr) l.hr = merged.hr;
  l.ts = date;
  l.src = 'strava';
  l['stravaId'] = a.id;
  /* Ime i opis sa Strave: tu trkač sam kaže ŠTA je hteo tog dana („4km @5:25 / 4km @5:00 …"). Bez toga AI sudi progresivno
     trčanje po pravilima za lagano, jer u planu dana piše samo „LR". */
  const name = (a.name ?? '').trim();
  const desc = (a.description ?? '').trim();
  if (name) l['stravaName'] = name.slice(0, 120);
  if (desc) l['stravaDesc'] = desc.slice(0, 400);
  if (merged.maxHr) l['maxHr'] = merged.maxHr;
  if (merged.elev != null) l['elevGain'] = merged.elev;
  if (a.suffer_score != null) l['relEffort'] = Math.round(a.suffer_score);
  if (a.average_cadence != null) l['cadence'] = Math.round(a.average_cadence * 2) / 2;
  if (a.average_temp != null) l['temp'] = Math.round(a.average_temp);
  const hour = localStartHour(a);
  if (hour != null) l['satTrk'] = hour;
  return { entry: l, imported: true };
}

/** Dan već ima detalje (krugove ili presek po km): povlačenje streamova se ne ponavlja (štednja kvote). */
export function hasDetails(e: LogEntry | undefined): boolean {
  if (!e) return false;
  const laps = e['laps'];
  const perKm = e['perKm'];
  return (Array.isArray(laps) && laps.length > 0) || (Array.isArray(perKm) && perKm.length > 0);
}

/** Presek po km računat starijom verzijom (ili ga nema): lagano/dugo trčanje se osvežava, osim zaključanog. */
export function perKmStale(e: LogEntry | undefined, currentVersion: number): boolean {
  if (!e || e.lock) return false;
  const p = e['perKm'];
  if (!Array.isArray(p) || !p.length) return true;
  const first = p[0] as { v?: number } | undefined;
  return first?.v !== currentVersion;
}
