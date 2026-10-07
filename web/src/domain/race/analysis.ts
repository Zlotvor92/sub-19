import type { LogEntry } from '../state';
export interface RaceContext {
  name: string;
  date: string;
  distanceM: number;
  officialSec: number | null;
  targetSec: number | null;
  intent: 'race' | 'controlled' | 'first_distance';
  nutrition: string;
  conditions: string;
}
/** Race distance is explicit; GPS distance and moving time are never official results. */
export function racePayload(
  log: LogEntry,
  context: RaceContext,
  entered?: Record<string, unknown>
) {
  const details = log['raceDetails'];
  const d =
    details && typeof details === 'object' && !Array.isArray(details)
      ? (details as Record<string, unknown>)
      : {};
  const data = {
    km: log.km,
    time: log.sec,
    hr: log.hr,
    rpe: log['rpe'],
    note: log['note'],
    maxHr: log['maxHr'],
    elevGain: log['elevGain'],
    perKm: log['perKm'],
    laps: log['laps'],
    lapsIzvor: log['lapsIzvor'],
    icu: log['icu'],
    ...entered
  };
  const selected = (d['version'] === 1 || d['version'] === 2) && d['date'] === context.date;
  return {
    analysisType: 'race',
    race: context,
    session: {
      tag: 'trka',
      kind: 'trka',
      desc: context.name,
      stravaName: log['stravaName'] ?? null
    },
    entered: {
      ...data,
      movingSec: log.sec,
      ...(selected
        ? {
            km: d['km'],
            movingSec: d['movingSec'],
            elapsedSec: d['elapsedSec'],
            hr: d['hr'],
            maxHr: d['maxHr'],
            cadence: d['cadence'],
            elevGain: d['elevGain'],
            perKm: d['perKm'],
            perKmSource: d['source'],
            laps: d['laps'],
            lapsIzvor: d['source'],
            icu: d['source'] === 'icu' ? d['icu'] : undefined,
            zoneUdeo: undefined,
            decoupling: undefined,
            time: undefined,
            providerDetails: d['providers']
          }
        : {}),
      dataSource: selected ? d['source'] : (log.src ?? 'manual'),
      // Daily wellness is a morning record, not a measurement taken after the finish.
      oporavakTiming: 'morning_of_race',
      oporavakDate: context.date
    }
  };
}
export function defaultRaceContext(log: LogEntry, date: string): RaceContext {
  const km = log.km ?? 0;
  const distanceM = km > 20 && km < 22 ? 21097.5 : km > 41 && km < 44 ? 42195 : km * 1000;
  return {
    name: typeof log['stravaName'] === 'string' ? log['stravaName'] : 'Trka',
    date: date.slice(0, 10),
    distanceM,
    officialSec: null,
    targetSec: null,
    intent: 'race',
    nutrition: '',
    conditions: ''
  };
}

/** Imported backups may contain arbitrary extension fields; normalize just this namespace. */
export function normalizeRaceContext(value: unknown, fallback: RaceContext): RaceContext {
  const v = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const str = (key: string, limit: number, def: string) =>
    typeof v[key] === 'string' ? v[key].slice(0, limit) : def;
  const time = (key: string, def: number | null) =>
    v[key] === null
      ? null
      : typeof v[key] === 'number' && Number.isFinite(v[key]) && v[key] > 0 && v[key] <= 172800
        ? v[key]
        : def;
  return {
    name: str('name', 120, fallback.name),
    date: str('date', 10, fallback.date),
    distanceM:
      typeof v['distanceM'] === 'number' &&
      Number.isFinite(v['distanceM']) &&
      v['distanceM'] >= 1000 &&
      v['distanceM'] <= 100000
        ? v['distanceM']
        : fallback.distanceM,
    officialSec: time('officialSec', fallback.officialSec),
    targetSec: time('targetSec', fallback.targetSec),
    intent:
      v['intent'] === 'race' || v['intent'] === 'controlled' || v['intent'] === 'first_distance'
        ? v['intent']
        : fallback.intent,
    nutrition: str('nutrition', 600, fallback.nutrition),
    conditions: str('conditions', 600, fallback.conditions)
  };
}
