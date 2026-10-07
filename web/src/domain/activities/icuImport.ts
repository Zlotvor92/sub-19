/* UVOZ TRENINGA SA intervals.icu: odluke bez ulaza/izlaza. Isti oblik pravila kao `stravaImport` (jedno pravilo, dva izvora): spajanje
   trčanja istog dana, ručna korekcija ima prednost, pomeranje plana. Ono što icu daje a Strava nema (GAP, razdvajanje, zone, opterećenje)
   ide u `entry.icu`.

   Server (`api/icu.js → sazetak`) već svodi aktivnost na malo polja srpskih imena; to je spoljni ugovor i ostaje. */

import type { LogEntry } from '../state/types';
import { LAPS_VERSION, PERKM_VERSION } from './perkm';
import type { MergedDay } from './merge';

export interface IcuActivity {
  id: string;
  /** `YYYY-MM-DD`. */
  datum: string;
  sat?: number | null;
  tip?: string | null;
  naziv?: string | null;
  opis?: string | null;
  km?: number | null;
  sec?: number | null;
  elapsedSec?: number | null;
  hr?: number | null;
  maxHr?: number | null;
  kadenca?: number | null;
  uspon?: number | null;
  temp?: number | null;
  osecaSe?: number | null;
  gapSec?: number | null;
  razdvajanje?: number | null;
  efikasnost?: number | null;
  opterecenje?: number | null;
  intenzitet?: number | null;
  trimp?: number | null;
  korak?: number | null;
  zonePuls?: number[] | null;
  zoneTempo?: number[] | null;
  zoneGranice?: number[] | null;
}

/** Aktivnost u obliku koji `mergeDay`/`pickClosest`/`realignPlan` već znaju (Stravin `distance` u metrima). */
export type IcuRun = IcuActivity & { distance: number };

/** Trčanja po datumu, sa `distance` u metrima. Aktivnost bez kilometara se preskače. */
export function icuRunsByDate(list: readonly IcuActivity[]): Record<string, IcuRun[]> {
  const by: Record<string, IcuRun[]> = {};
  for (const a of list) {
    if (a && a.datum && (a.km ?? 0) > 0)
      (by[a.datum] ??= []).push({ ...a, distance: (a.km as number) * 1000 });
  }
  return by;
}

/** Ukupno km po danu (za trčanja pre plana); računa se samo ono što je trčanje (tip prazan = trčanje). */
export function icuKmByDate(
  by: Readonly<Record<string, readonly IcuRun[]>>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const dt of Object.keys(by))
    out[dt] = (by[dt] ?? [])
      .filter((x) => /run/i.test(String(x.tip || 'Run')))
      .reduce((s, x) => s + (x.km ?? 0), 0);
  return out;
}

const ICU_FIELDS = [
  'gapSec',
  'razdvajanje',
  'efikasnost',
  'opterecenje',
  'intenzitet',
  'trimp',
  'korak',
  'osecaSe',
  'zonePuls',
  'zoneTempo',
  'zoneGranice'
] as const;

export interface ImportedIcuRun {
  entry: LogEntry;
  imported: boolean;
}

export function icuImportedEntry(
  current: LogEntry | undefined,
  date: string,
  merged: MergedDay<IcuRun>,
  a: IcuRun
): ImportedIcuRun {
  const l: LogEntry = { ...(current ?? {}) };
  l.runDate = date;
  if (l.lock) return { entry: l, imported: false }; // ručna korekcija ima trajnu prednost
  l.status = 'done';
  l.km = merged.km;
  if (merged.sec) l.sec = merged.sec;
  if (merged.n > 1) l['spojeno'] = merged.n;
  else delete l['spojeno'];
  if (merged.hr != null) l.hr = merged.hr;
  l.ts = date;
  l.src = 'icu';
  l['icuId'] = a.id;
  if (a.naziv) l['stravaName'] = String(a.naziv).slice(0, 120);
  if (a.opis) l['stravaDesc'] = String(a.opis).slice(0, 400);
  if (merged.maxHr != null) l['maxHr'] = merged.maxHr;
  if (merged.elev != null) l['elevGain'] = merged.elev;
  if (a.kadenca != null) l['cadence'] = a.kadenca;
  if (a.temp != null) l['temp'] = a.temp;
  /* Sat trčanja za `tempTrcanja` — stiže već izdvojen iz `start_date_local`. */
  if (a.sat != null && Number.isFinite(a.sat) && a.sat >= 0 && a.sat <= 23) l['satTrk'] = +a.sat;
  /* Ono što Strava putanja uopšte nema, a icu izračuna sam. */
  const ic: Record<string, unknown> = {};
  for (const k of ICU_FIELDS) if (a[k] != null) ic[k] = a[k];
  if (Object.keys(ic).length) l['icu'] = ic;
  else delete l['icu'];
  /* icu-ovo razdvajanje je merenje nad celim fajlom — bolje od procene po kilometru. Isti oblik koji čita „Sa sata": {n} je procenat pada
     efikasnosti (pozitivno = puls je odleteo pri istom tempu). */
  if (a.razdvajanje != null) l['decoupling'] = { n: a.razdvajanje, izvor: 'icu' };
  return { entry: l, imported: true };
}

/**
 * Da li za dan treba tražiti krugove (kvalitetan dan). Ne ponavlja se kad je icu već rekao da strukture NEMA (`icu-bez-strukture`),
 * ali se ponavlja kad su krugovi iz STARIJE verzije — bez provere verzije bi treninzi uvezeni pre ispravke zauvek nosili zagrevanje
 * i hlađenje među repovima.
 */
export function needsIcuDetails(
  tag: string | undefined,
  a: { id?: string },
  e: LogEntry | undefined
): boolean {
  if (tag !== 'int' && tag !== 'tempo') return false;
  if (!a.id) return false;
  const raw = e?.['lapsIzvor'];
  const src = typeof raw === 'string' ? raw : '';
  return !(src.startsWith('icu') && e?.['lapsVer'] === LAPS_VERSION);
}

/** Da li za dan treba tražiti sirove tokove (lagano/dugo trčanje: icu tu nema strukturu, pa nema ni preseka po km). */
export function needsIcuStreams(
  tag: string | undefined,
  a: { id?: string },
  e: LogEntry | undefined
): boolean {
  if (tag !== 'lako' && tag !== 'lr') return false;
  if (!a.id || e?.lock) return false;
  const p = e?.['perKm'];
  const fresh =
    Array.isArray(p) && p.length > 0 && (p[0] as { v?: number } | undefined)?.v === PERKM_VERSION;
  return !fresh;
}
