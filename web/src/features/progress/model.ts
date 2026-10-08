/* MODELI ZA NAPREDAK: poslednje nedelje, spisak aktivnosti, rekordi. Čisto čitanje onoga što aplikacija već ima (plan, dnevnik, ciklus) — nijedna nova veličina
   se ne računa i ništa se ne upisuje. */

import type { ResolvedPlan } from '../../domain/plan';
import { dayLabel } from '../../domain/plan';
import type { AltRecord, LogEntry } from '../../domain/state';
import type { CycleModel, CycleState } from '../cycle/cycle';

type Log = Readonly<Record<string, LogEntry>>;

export interface RecentWeek {
  w: number;
  realKm: number;
  planKm: number;
  state: CycleState;
}

/**
 * Poslednje četiri nedelje plana do tekuće (uključujući nju). Pre početka plana nema nijedne; posle kraja su to poslednje četiri nedelje plana. Nedelje
 * su nedelje PLANA (N1…), zato što se kilometri računaju po danima plana (`weekRealKm`).
 */
export function recentWeeks(cycle: CycleModel | null, count = 4): RecentWeek[] {
  if (!cycle || !cycle.weeks.length) return [];
  const started = cycle.weeks.filter((x) => x.state !== 'future');
  return started.slice(-count).map((x) => ({
    w: x.w,
    realKm: x.realKm,
    planKm: x.planKm,
    state: x.state
  }));
}

export type ActivitySource = 'strava' | 'icu' | 'manual';

export interface ActivityRow {
  /** Ključ u dnevniku (ID dana u planu, ili ID ručno unete trke). */
  id: string;
  /** Dan u planu kome pripada; `null` za unos van plana (ručno uneta trka). */
  dayId: string | null;
  date: string;
  title: string;
  km: number | null;
  sec: number | null;
  /** s/km; `null` bez kilometara ili vremena. */
  paceSec: number | null;
  hr: number | null;
  source: ActivitySource;
}

const num = (x: unknown): number | null =>
  typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : null;
const str = (x: unknown): string => (typeof x === 'string' ? x.trim() : '');

const sourceOf = (l: LogEntry): ActivitySource => {
  const s = str(l.src);
  return s === 'strava' ? 'strava' : s.startsWith('icu') ? 'icu' : 'manual';
};

/**
 * ISTORIJA AKTIVNOSTI iz dnevnika: svaki unos koji je odrađen ili ima kilometre i vreme, najnoviji prvi. Datum je pravi datum trčanja (`runDate`), pa
 * `ts` (datum koji je čovek upisao), pa datum dana u planu. Naslov je vrsta treninga iz plana; unos van plana nosi naziv sa servisa ili „Trčanje“.
 */
export function activityRows(
  plan: ResolvedPlan,
  log: Log,
  alts: Readonly<Record<string, AltRecord | undefined>>
): ActivityRow[] {
  const rows: ActivityRow[] = [];
  for (const [id, l] of Object.entries(log)) {
    if (!l || typeof l !== 'object') continue;
    const km = num(l.km);
    const sec = num(l.sec);
    const day = plan.byId.get(id);
    if (l.status !== 'done' && !(km && sec)) continue;
    const date = str(l.runDate) || str(l.ts) || day?.date || '';
    rows.push({
      id,
      dayId: day ? id : null,
      date,
      title: day ? dayLabel(day, !!alts[id]) : str(l['stravaName']) || 'Trčanje',
      km,
      sec,
      paceSec: km && sec ? sec / km : null,
      hr: num(l.hr),
      source: sourceOf(l)
    });
  }
  return rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id < b.id ? 1 : -1));
}

export const SOURCE_TEXT: Readonly<Record<ActivitySource, string>> = {
  strava: 'Strava · sinhronizovano',
  icu: 'intervals.icu · sinhronizovano',
  manual: 'uneto ručno'
};
