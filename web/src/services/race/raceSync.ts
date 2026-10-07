import { raceSplits, stravaRaceSplits, type RaceSplit } from '../../domain/race/splits';
import { icuCanReadActivities, icuConnected, type IcuLink } from '../../domain/icu';
import type { LogEntry } from '../../domain/state';
import type { IcuApi } from '../api/icuApi';
import type { StravaApi } from '../strava/stravaApi';
import { parseActivities, STREAM_KEYS_EASY } from '../strava/stravaSync';
import { parseStreams } from '../streams';

export interface RaceActivityDetails {
  source: 'icu' | 'strava';
  activityId: string;
  km: number;
  movingSec: number | null;
  elapsedSec: number | null;
  hr: number | null;
  maxHr: number | null;
  cadence: number | null;
  elevGain: number | null;
  perKm: RaceSplit[];
  laps: unknown[];
  icu?: Record<string, unknown>;
}
export interface RaceDetails extends RaceActivityDetails {
  version: 1;
  date: string;
  providers: Partial<Record<'icu' | 'strava', RaceActivityDetails>>;
}
export type RaceRefreshResult = { ok: boolean; error: string | null; splits: number };
interface Deps {
  accountKey?: () => string;
  strava: StravaApi;
  icu: IcuApi;
  stravaConnected(): boolean;
  icuLink(): IcuLink | null;
  get(id: string): LogEntry | undefined;
  set(id: string, entry: LogEntry): void;
}
const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const activityKey = (v: unknown): string | null =>
  typeof v === 'string' && /^[a-zA-Z0-9_-]+$/.test(v)
    ? v
    : typeof v === 'number' && Number.isFinite(v)
      ? String(v)
      : null;
const obj = (x: unknown): Record<string, unknown> =>
  x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : {};

/** Match a missing cross-provider ID only when date, distance and time agree,
 * and there is exactly one candidate. Never join a warm-up or another run. */
function match<T>(
  list: T[],
  log: LogEntry,
  km: (a: T) => number | null,
  sec: (a: T) => number | null
): T | undefined {
  const found = list.filter((a) => {
    const d = km(a),
      t = sec(a);
    return (
      d != null &&
      (log.km ?? 0) > 0 &&
      Math.abs(d - log.km!) <= Math.max(0.2, log.km! * 0.03) &&
      t != null &&
      (log.sec ?? 0) > 0 &&
      Math.abs(t - log.sec!) <= Math.max(30, log.sec! * 0.03)
    );
  });
  return found.length === 1 ? found[0] : undefined;
}
const complete = (x: RaceActivityDetails): boolean =>
  x.perKm.length > 0 &&
  x.perKm.every((k) => k.paceSec != null && k.paceSec >= 30 && k.paceSec <= 7200) &&
  Math.abs(x.perKm.reduce((s, k) => s + k.distanceM, 0) - x.km * 1000) <= 100;

export function createRaceSync(deps: Deps) {
  const pending = new Map<string, Promise<RaceRefreshResult>>();
  async function refresh(id: string, date: string, force = false): Promise<RaceRefreshResult> {
    const owner = deps.accountKey?.();
    const key = `${owner}:${id}:${date}`;
    const running = pending.get(key);
    if (running) return running;
    const task = perform(id, date, force, owner).finally(() => pending.delete(key));
    pending.set(key, task);
    return task;
  }
  async function perform(
    id: string,
    date: string,
    force: boolean,
    owner: string | undefined
  ): Promise<RaceRefreshResult> {
    const log = deps.get(id);
    if (!log) return { ok: false, error: 'Trčanje nije sačuvano.', splits: 0 };
    const cached = obj(log['raceDetails']);
    const cacheMatches =
      cached['version'] === 1 &&
      cached['date'] === date &&
      (!activityKey(log[cached['source'] === 'icu' ? 'icuId' : 'stravaId']) ||
        activityKey(log[cached['source'] === 'icu' ? 'icuId' : 'stravaId']) ===
          cached['activityId']);
    if (!force && cacheMatches && Array.isArray(cached['perKm']) && cached['perKm'].length)
      return { ok: true, error: null, splits: cached['perKm'].length };
    const changed = () => deps.accountKey?.() !== owner;
    const errors: string[] = [];
    const providers: Partial<Record<'icu' | 'strava', RaceActivityDetails>> = {};
    const link = deps.icuLink();
    const hasIcu = icuCanReadActivities(link) && !!link;
    const hasStrava = deps.stravaConnected();
    if (icuConnected(link) && !hasIcu)
      errors.push(
        'intervals.icu nema dozvolu za aktivnosti. Otkači pa ponovo poveži servis u podešavanjima.'
      );
    if (hasIcu && link) {
      const list = await deps.icu.activities(link, date, date);
      if (changed()) return { ok: false, error: 'Nalog je promenjen.', splits: 0 };
      const runs = list.ok
        ? list.data.activities.filter((a) => a.datum === date && /run/i.test(a.tip || 'Run'))
        : [];
      const a =
        activityKey(log['icuId']) != null
          ? runs.find((a) => a.id === activityKey(log['icuId']))
          : match(
              runs,
              log,
              (a) => a.km ?? null,
              (a) => a.sec ?? null
            );
      const activityId =
        a?.id ??
        (!list.ok && log.runDate === date && log.src === 'icu' ? activityKey(log['icuId']) : null);
      if (activityId) {
        const [stream, detail] = await Promise.all([
          deps.icu.streams(link, [activityId]),
          deps.icu.details(link, [activityId])
        ]);
        if (changed()) return { ok: false, error: 'Nalog je promenjen.', splits: 0 };
        const perKm = stream.ok ? raceSplits(parseStreams(stream.data.streams[activityId])) : [];
        const icu: Record<string, unknown> = a
          ? Object.fromEntries(
              [
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
              ]
                .map((k): [string, unknown] => [k, obj(a)[k]])
                .filter(([, v]) => v != null)
            )
          : obj(log['icu']);
        providers.icu = {
          source: 'icu',
          activityId,
          km: a?.km ?? log.km ?? 0,
          movingSec: a?.sec ?? log.sec ?? null,
          elapsedSec: a?.elapsedSec ?? null,
          hr: a?.hr ?? log.hr ?? null,
          maxHr: a?.maxHr ?? num(log['maxHr']),
          cadence: a?.kadenca ?? num(log['cadence']),
          elevGain: a?.uspon ?? num(log['elevGain']),
          perKm,
          laps: detail.ok ? (detail.data.details[activityId]?.rounds ?? []) : [],
          icu
        };
        if (!perKm.length)
          errors.push(
            `intervals.icu: ${stream.ok ? 'Nema dostupnih tokova distance i vremena.' : stream.error}`
          );
      } else
        errors.push(
          `intervals.icu: ${list.ok ? 'Nije pronađeno jednoznačno odgovarajuće trčanje.' : list.error}`
        );
    }
    if (hasStrava) {
      let activityId = activityKey(log['stravaId']);
      if (!activityId && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        // Broad UTC window; filter by the athlete's local calendar date.
        const epoch = Date.parse(`${date}T00:00:00Z`) / 1000;
        const list = await deps.strava.get(
          `/athlete/activities?after=${epoch - 86400}&before=${epoch + 172800}&per_page=100&page=1`
        );
        if (changed()) return { ok: false, error: 'Nalog je promenjen.', splits: 0 };
        const runs = list.ok
          ? (parseActivities(list.data) ?? []).filter(
              (a) =>
                (a.type === 'Run' || a.sport_type === 'Run') &&
                a.start_date_local?.slice(0, 10) === date
            )
          : [];
        activityId =
          match(
            runs,
            providers.icu
              ? { km: providers.icu.km, sec: providers.icu.movingSec ?? undefined }
              : log,
            (a) => (a.distance ?? 0) / 1000,
            (a) => a.moving_time ?? null
          )?.id?.toString() ?? null;
        if (!list.ok) errors.push(`Strava: ${list.error}`);
      }
      if (activityId) {
        const [detail, stream] = await Promise.all([
          deps.strava.get(`/activities/${encodeURIComponent(activityId)}`),
          deps.strava.get(
            `/activities/${encodeURIComponent(activityId)}/streams?keys=${STREAM_KEYS_EASY}&key_by_type=true`
          )
        ]);
        if (changed()) return { ok: false, error: 'Nalog je promenjen.', splits: 0 };
        const a = detail.ok ? obj(detail.data) : {};
        const wrongDate =
          typeof a['start_date_local'] === 'string' && a['start_date_local'].slice(0, 10) !== date;
        const derived = stream.ok && !wrongDate ? raceSplits(parseStreams(stream.data)) : [];
        const perKm = wrongDate
          ? []
          : derived.length
            ? derived
            : stravaRaceSplits(a['splits_metric']);
        providers.strava = {
          source: 'strava',
          activityId,
          km: num(a['distance']) != null ? num(a['distance'])! / 1000 : (log.km ?? 0),
          movingSec: num(a['moving_time']) ?? log.sec ?? null,
          elapsedSec: num(a['elapsed_time']),
          hr: num(a['average_heartrate']) ?? log.hr ?? null,
          maxHr: num(a['max_heartrate']) ?? num(log['maxHr']),
          cadence: num(a['average_cadence']),
          elevGain: num(a['total_elevation_gain']),
          perKm,
          laps: Array.isArray(a['laps'])
            ? (a['laps'] as unknown[]).slice(0, 150).map((raw) => {
                const lap = obj(raw);
                return Object.fromEntries(
                  [
                    'distance',
                    'moving_time',
                    'elapsed_time',
                    'average_speed',
                    'average_heartrate',
                    'average_cadence',
                    'average_watts',
                    'max_heartrate',
                    'total_elevation_gain'
                  ]
                    .filter((k) => num(lap[k]) != null)
                    .map((k) => [k, num(lap[k])])
                );
              })
            : []
        };
        if (!perKm.length)
          errors.push(
            `Strava: ${stream.ok ? 'Nema dostupnih kilometarskih prolaza.' : stream.error}`
          );
      } else errors.push('Strava: Nije pronađeno jednoznačno odgovarajuće trčanje.');
    }
    if (changed()) return { ok: false, error: 'Nalog je promenjen.', splits: 0 };
    // A complete alternative beats a truncated primary file; never concatenate the two series.
    const available = [providers.icu, providers.strava].filter(
      (x): x is RaceActivityDetails => !!x && complete(x)
    );
    for (const p of [providers.icu, providers.strava]) {
      if (p?.perKm.length && !complete(p))
        errors.push(`${p.source}: Tokovi ne pokrivaju celu distancu aktivnosti.`);
    }
    const chosen = available[0];
    if (chosen) {
      const current = deps.get(id);
      if (!current) return { ok: false, error: 'Trčanje više nije dostupno.', splits: 0 };
      const raceDetails: RaceDetails = { ...chosen, version: 1, date, providers };
      const raceAi = { ...obj(current['raceAi']) };
      if (JSON.stringify(cached['perKm']) !== JSON.stringify(chosen.perKm) && !raceAi['aiPosao']) {
        delete raceAi['aiCount'];
        raceAi['dataUpdated'] = !!raceAi['aiText'];
      }
      deps.set(id, { ...current, raceDetails, raceAi });
      return {
        ok: true,
        error: errors.length ? errors.join(' ') : null,
        splits: chosen.perKm.length
      };
    }
    // Failed refresh retains a previously valid series and existing analysis.
    const old = cacheMatches && Array.isArray(cached['perKm']) ? cached['perKm'].length : 0;
    if (old) return { ok: true, error: errors.join(' '), splits: old };
    return {
      ok: !icuConnected(link) && !hasStrava,
      error:
        errors.join(' ') ||
        'Nema povezane Strave ili intervals.icu; dostupni su samo ručno uneti podaci.',
      splits: 0
    };
  }
  return { refresh };
}
