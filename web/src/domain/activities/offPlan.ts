/* TRČANJA VAN PLANA (08c, samo za aktivan plan 5K v2): odluke bez ulaza/izlaza. Servis uvoza (`services/strava`,
   `services/icu`) posle uparivanja sa danima plana pita „šta je ostalo".

   - Uvoz kači trčanje na dan plana samo kad je dan trkački (ne odmor, ima km ili je dan snage) i, na dan trke, samo
     glavnu aktivnost. Sve ostalo — trčanje na dan odmora, van datuma plana, zagrevanje uz trku — za v2 postaje ZAPIS VAN
     PLANA sa datumom, km, trajanjem i ID-jem izvora (ključ `izvor:ID`: ponovljena sinhronizacija ne pravi duplikat).
   - Duplikati (ponovljen upload) se ne broje: isto pravilo kao `mergeDay`.
   - Pre prvog dana plana važi stari mehanizam `vanPlana` (datum → km); ovde se ne beleži, da se ne broji dvaput.
   - Spisak koji je ceo za svoj period je istina za taj period: zapisi u periodu (oba izvora) se zamenjuju onim što je
     sada van plana (obrisana aktivnost, kasnije uparena, ista trčanja iz drugog izvora). Spisak koji nije ceo samo
     dopunjuje; uparena trčanja se uvek uklanjaju.
   - Aktivnost bez ičega za brojanje (ni km ni trajanje), bez datuma ili bez tipa NIJE obrađena: to je `SyncIssue`, a
     dan ostaje nepoznat (pokrivenost, `fiveK/v2/app/facts.ts`). */

import type { OffPlanRun, SyncIssue } from '../state/types';
import { mergeDay, type RawActivity } from './merge';
import { isRun, type StravaActivity } from './stravaImport';
import type { IcuActivity } from './icuImport';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const distM = (a: RawActivity): number =>
  a.distance != null ? a.distance : a.km != null ? a.km * 1000 : 0;
const secOf = (a: RawActivity): number | null =>
  a.moving_time != null ? a.moving_time : a.sec != null ? a.sec : null;

export const offPlanKey = (src: OffPlanRun['src'], id: string | number): string =>
  `${src}:${String(id)}`;

/** Zašto Stravina aktivnost nije obrađena; `null` = obrađena (trčanje sa km ili trajanjem, ili poznat tip koji nije trčanje). */
export function stravaActivityIssue(a: StravaActivity): string | null {
  if (!a.type && !a.sport_type) return 'nepoznat tip aktivnosti';
  if (!isRun(a)) return null;
  if (!DAY.test(String(a.start_date_local ?? '').slice(0, 10))) return 'trčanje nema datum početka';
  if (!positive(a.distance) && !positive(a.moving_time)) return 'trčanje bez km i trajanja';
  return null;
}

/** Zašto trening sa intervals.icu nije obrađen (server šalje samo trčanja); `null` = obrađen. */
export function icuActivityIssue(a: IcuActivity): string | null {
  if (!positive(a.km) && !positive(a.sec)) return 'trčanje bez km i trajanja';
  return null;
}

/** Problem sa danom i ID-jem aktivnosti. */
export function activityIssue(
  date: string | null,
  id: string | number | null,
  reason: string
): SyncIssue {
  return {
    date: date !== null && DAY.test(date) ? date : null,
    id: id === null ? null : String(id),
    reason
  };
}

/** Najviše problema koji se pamte (prvo oni bez dana, pa najnoviji): dovoljno za pokrivenost i napomene. */
export const SYNC_ISSUES_MAX = 50;

/**
 * Polja veze izvora posle sinhronizacije plana 5K v2: `fullSync` (ms) i `fullSyncFrom` (prvi dan perioda) pomeraju se
 * SAMO kad nijedna aktivnost nije ostala neobrađena; inače ostaju kakvi su bili. `syncIssues` = problemi ove sinhronizacije.
 */
export function syncStatus(
  prev: Readonly<Record<string, unknown>>,
  issues: readonly SyncIssue[],
  from: string,
  now: number
): { fullSync: unknown; fullSyncFrom: unknown; syncIssues: SyncIssue[] } {
  if (issues.length === 0) return { fullSync: now, fullSyncFrom: from, syncIssues: [] };
  const rank = (x: SyncIssue): string => (x.date === null ? '9999-99-99' : x.date);
  return {
    fullSync: prev['fullSync'] ?? null,
    fullSyncFrom: prev['fullSyncFrom'] ?? null,
    syncIssues: [...issues].sort((a, b) => rank(b).localeCompare(rank(a))).slice(0, SYNC_ISSUES_MAX)
  };
}

export interface OffPlanInput {
  current: Readonly<Record<string, OffPlanRun>>;
  src: OffPlanRun['src'];
  /** Trčanja po datumu — za dan plana isti spisak koji je video uvoz (`importedDay`), plus trčanja koja uvoz ne vidi
   *  (npr. icu bez km, sa trajanjem). */
  byDate: Readonly<Record<string, ReadonlyArray<RawActivity & { id: string | number }>>>;
  /** ID-jevi aktivnosti uparenih sa danom plana. */
  paired: ReadonlySet<string>;
  /** Prvi dan plana. */
  planStart: string;
  today: string;
  /** Period koji je spisak izvora CEO pokrio; `null` = spisak nije ceo (samo dopuna). */
  window: { from: string; to: string } | null;
}

/** Novi zapisi van plana; `null` kad nema promene. */
export function recordOffPlanRuns(i: OffPlanInput): Record<string, OffPlanRun> | null {
  const fresh: Record<string, OffPlanRun> = {};
  for (const date of Object.keys(i.byDate)) {
    if (!DAY.test(date) || date < i.planStart || date > i.today) continue;
    for (const a of mergeDay(i.byDate[date] ?? []).taken) {
      const id = String(a.id);
      if (i.paired.has(id)) continue;
      const km = Math.round(Math.max(0, distM(a)) / 10) / 100;
      const raw = secOf(a);
      const sec = positive(raw) ? Math.round(raw) : null;
      if (km <= 0 && sec === null) continue; // ništa za brojanje — `SyncIssue` (v. `*ActivityIssue`)
      fresh[offPlanKey(i.src, id)] = { date, km, sec, src: i.src, id };
    }
  }
  const next: Record<string, OffPlanRun> = {};
  for (const [k, r] of Object.entries(i.current)) {
    if (r.date < i.planStart) continue; // drugi plan ili pre plana (`vanPlana`)
    if (r.src === i.src && i.paired.has(r.id)) continue;
    if (i.window && r.date >= i.window.from && r.date <= i.window.to) continue;
    next[k] = r;
  }
  Object.assign(next, fresh);
  const same =
    Object.keys(next).length === Object.keys(i.current).length &&
    Object.entries(next).every(
      ([k, r]) => JSON.stringify(r) === JSON.stringify(i.current[k] ?? null)
    );
  return same ? null : next;
}
