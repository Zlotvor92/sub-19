import type { LogEntry } from '../state';
import { mergeDay, type RawActivity } from './merge';
import { pickClosest } from './stravaImport';
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const positive = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
const id = (v: unknown): string | null =>
  typeof v === 'string' || typeof v === 'number' ? String(v) : null;
export function raceDistanceKm(log: LogEntry | undefined): number | null {
  const context = obj(obj(log?.['raceAi'])['context']);
  const m = positive(context['distanceM']);
  return m ? m / 1000 : null;
}
export function isRaceDay(tag: string | undefined, log: LogEntry | undefined): boolean {
  return tag === 'trka' || raceDistanceKm(log) != null;
}
/** One activity only. An old ID pointing to a 400m warm-up cannot override the
 * known race distance. Without a target use the longest run, never the sum. */
export function selectRaceActivity<A extends RawActivity & { id: string | number }>(
  list: readonly A[],
  targetKm: number | null,
  knownId?: unknown
): A | undefined {
  const km = (a: A): number => (a.distance != null ? a.distance : (a.km ?? 0) * 1000) / 1000;
  const candidates = list.filter(
    (a) => km(a) > 0 && (!targetKm || Math.abs(km(a) - targetKm) <= Math.max(0.25, targetKm * 0.15))
  );
  if (!candidates.length) return undefined;
  const score = (a: A) => (targetKm ? Math.abs(km(a) - targetKm) : -km(a));
  const best = Math.min(...candidates.map(score));
  const closest = candidates.filter((a) => Math.abs(score(a) - best) < 0.001);
  return (
    closest.find((a) => id(a.id) === id(knownId)) ?? (closest.length === 1 ? closest[0] : undefined)
  );
}
export function importedDay<A extends RawActivity & { id: string | number }>(
  list: readonly A[],
  tag: string | undefined,
  log: LogEntry | undefined,
  planKm: number | null,
  source: 'icu' | 'strava'
) {
  const all = mergeDay(list);
  const race = isRaceDay(tag, log);
  const activity = race
    ? selectRaceActivity(
        all.taken,
        raceDistanceKm(log) ?? planKm,
        log?.[source === 'icu' ? 'icuId' : 'stravaId']
      )
    : all.taken.length
      ? pickClosest(all.taken, planKm)
      : undefined;
  let current = log;
  const oldId = id(log?.[source === 'icu' ? 'icuId' : 'stravaId']);
  if (race && activity && log && !log.lock && oldId != null && oldId !== id(activity.id)) {
    current = { ...log };
    // Derived details belong to the old activity, possibly the warm-up.
    for (const key of ['perKm', 'laps', 'lapsIzvor', 'lapsVer', 'decoupling', 'raceDetails'])
      delete current[key];
  }
  return { activity, merged: race ? mergeDay(activity ? [activity] : []) : all, race, current };
}
