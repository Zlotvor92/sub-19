import type { ActivityStreams, PerKmRow } from '../activities';

export interface RaceSplit extends PerKmRow {
  distanceM: number;
  elapsedSec: number;
  movingSec: number | null;
  timeBasis: 'moving' | 'elapsed';
  partial: boolean;
  gapSec?: number;
}
const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** Distance boundaries are interpolated; sensors are weighted by elapsed time.
 * Keep the final partial km and both clocks. Missing moving flags mean elapsed pace,
 * never an invented moving time. Original streams and coordinates are not persisted. */
export function raceSplits(streams: ActivityStreams | null): RaceSplit[] {
  const d = streams?.distance?.data;
  const t = streams?.time?.data;
  if (!d || !t || d.length !== t.length || d.length < 2) return [];
  if (!num(d[0]) || d[0] < 0 || d[0] > 1 || !num(t[0]) || t[0] < 0) return [];
  for (let i = 1; i < d.length; i++)
    if (!num(d[i]) || !num(t[i]) || d[i]! < d[i - 1]! || t[i]! <= t[i - 1]!) return [];
  const end = d[d.length - 1]!;
  if (end < 1 || end > 100000 || t[t.length - 1]! - t[0] > 172800) return [];
  const flags = streams?.moving?.data;
  const movingKnown =
    flags?.length === t.length &&
    flags.every((x) => x === true || x === false || x === 0 || x === 1);
  const sensors = ['heartrate', 'cadence', 'watts', 'temp'] as const;
  const out: RaceSplit[] = [];
  let start = 0;
  let boundary = Math.min(1000, end);
  let elapsed = 0;
  let moving = 0;
  let sums: Record<string, number> = {};
  let weights: Record<string, number> = {};
  const altitude = streams?.altitude?.data;
  let startAlt = altitude?.[0];
  for (let i = 1; i < d.length; i++) {
    let fraction = 0;
    const delta = d[i]! - d[i - 1]!;
    while (fraction < 1) {
      const f = delta > 0 ? Math.min(1, (boundary - d[i - 1]!) / delta) : 1;
      const dt = (t[i]! - t[i - 1]!) * (f - fraction);
      elapsed += dt;
      if (movingKnown && flags?.[i]) moving += dt;
      for (const key of sensors) {
        const x = streams?.[key]?.data[i];
        if (num(x) && (key === 'temp' || x > 0)) {
          sums[key] = (sums[key] ?? 0) + x * dt;
          weights[key] = (weights[key] ?? 0) + dt;
        }
      }
      fraction = f;
      if (delta > 0 && boundary <= d[i]!) {
        const distanceM = boundary - start;
        const row: RaceSplit = {
          km: out.length + 1,
          v: 2,
          distanceM,
          elapsedSec: Math.round(elapsed * 10) / 10,
          movingSec: movingKnown ? Math.round(moving * 10) / 10 : null,
          timeBasis: movingKnown ? 'moving' : 'elapsed',
          paceSec: Math.round(((movingKnown ? moving : elapsed) * 1000) / distanceM),
          partial: distanceM < 999,
          hr: weights.heartrate ? Math.round(sums.heartrate! / weights.heartrate) : null,
          cadence: weights.cadence ? Math.round(sums.cadence! / weights.cadence) : null
        };
        if (movingKnown) row.stopSec = Math.round((elapsed - moving) * 10) / 10;
        if (weights.watts) row.watts = Math.round(sums.watts! / weights.watts);
        if (weights.temp) row.temp = Math.round(sums.temp! / weights.temp);
        const a = altitude?.[i - 1],
          b = altitude?.[i];
        const endAlt = num(a) && num(b) ? a + (b - a) * f : null;
        if (num(startAlt) && num(endAlt)) row.elevM = Math.round(endAlt - startAlt);
        out.push(row);
        startAlt = endAlt;
        start = boundary;
        boundary = Math.min(boundary + 1000, end);
        elapsed = 0;
        moving = 0;
        sums = {};
        weights = {};
        if (start === end) return out;
      }
    }
  }
  return out;
}

/** Strava's own metric splits are the fallback when streams are inaccessible. */
export function stravaRaceSplits(raw: unknown): RaceSplit[] {
  if (!Array.isArray(raw) || !raw.length || raw.length > 110) return [];
  const out: RaceSplit[] = [];
  for (const item of raw as unknown[]) {
    if (!item || typeof item !== 'object') return [];
    const x = item as Record<string, unknown>;
    const distanceM = x['distance'],
      elapsed = x['elapsed_time'],
      moving = x['moving_time'];
    if (!num(distanceM) || distanceM <= 0 || distanceM > 1500 || !num(elapsed) || elapsed <= 0)
      return [];
    const known = num(moving) && moving > 0 && moving <= elapsed;
    const row: RaceSplit = {
      km: out.length + 1,
      v: 2,
      distanceM,
      elapsedSec: elapsed,
      movingSec: known ? moving : null,
      timeBasis: known ? 'moving' : 'elapsed',
      paceSec: Math.round(((known ? moving : elapsed) * 1000) / distanceM),
      partial: distanceM < 950,
      hr: num(x['average_heartrate']) ? x['average_heartrate'] : null,
      cadence: null
    };
    if (known) row.stopSec = elapsed - moving;
    if (num(x['elevation_difference'])) row.elevM = x['elevation_difference'];
    const gap = x['average_grade_adjusted_speed'];
    if (num(gap) && gap > 0) row.gapSec = Math.round(1000 / gap);
    out.push(row);
  }
  return out;
}
