import { expect, it } from 'vitest';
import { importedDay, selectRaceActivity } from './raceDay';
const runs = [
  {
    id: 1,
    distance: 400,
    moving_time: 180,
    average_heartrate: 120,
    max_heartrate: 140,
    total_elevation_gain: 2
  },
  {
    id: 2,
    distance: 21500,
    moving_time: 6252,
    average_heartrate: 166,
    max_heartrate: 186,
    total_elevation_gain: 31
  }
];
it('race day excludes a separate 400m warm-up from distance, duration, HR and elevation', () => {
  const result = importedDay(runs, 'trka', {}, 21.0975, 'strava');
  expect(result.activity?.id).toBe(2);
  expect(result.merged).toMatchObject({ n: 1, km: 21.5, sec: 6252, hr: 166, maxHr: 186, elev: 31 });
});
it('a saved race context overrides an ordinary 5km plan and an old warm-up ID', () => {
  const result = importedDay(
    runs,
    'lako',
    { stravaId: 1, raceAi: { context: { distanceM: 21097.5 } } },
    5,
    'strava'
  );
  expect(result.activity?.id).toBe(2);
  expect(result.merged.n).toBe(1);
});
it('ordinary training still sums multiple runs and weights the pulse', () => {
  expect(importedDay(runs, 'lr', {}, 21, 'strava').merged).toMatchObject({
    n: 2,
    km: 21.9,
    sec: 6432,
    hr: 165,
    elev: 33
  });
});
it('the same single-race rule applies to Intervals.icu data', () => {
  const result = importedDay(
    [
      { id: 'warm', km: 0.4, sec: 180, hr: 120 },
      { id: 'race', km: 21.5, sec: 6252, hr: 166 }
    ],
    'trka',
    { icuId: 'warm' },
    21.0975,
    'icu'
  );
  expect(result.activity?.id).toBe('race');
  expect(result.merged).toMatchObject({ km: 21.5, sec: 6252, hr: 166, n: 1 });
});
it('does not import a warm-up as the race when the race file is missing', () => {
  expect(importedDay(runs.slice(0, 1), 'trka', {}, 21.0975, 'strava').merged.n).toBe(0);
});
it('unknown race distance uses the longest individual activity', () => {
  expect(importedDay(runs, 'trka', {}, null, 'strava').activity?.id).toBe(2);
});
it('ambiguous races need a known matching ID; distance cannot be inferred from a sum', () => {
  expect(selectRaceActivity([...runs, { ...runs[1]!, id: 3 }], 21.0975)).toBeUndefined();
  expect(selectRaceActivity([...runs, { ...runs[1]!, id: 3 }], 21.0975, 3)?.id).toBe(3);
});

it('changing a race carrier clears warm-up details but preserves notes and manual locks', () => {
  const log = {
    stravaId: 1,
    perKm: [{ km: 1 }],
    laps: [{}],
    decoupling: {},
    raceDetails: {},
    note: 'keep'
  };
  const result = importedDay(runs, 'trka', log, 21.0975, 'strava');
  expect(result.current).toEqual({ stravaId: 1, note: 'keep' });
  expect(log.perKm).toHaveLength(1);
  const locked = { ...log, lock: true };
  expect(importedDay(runs, 'trka', locked, 21.0975, 'strava').current).toBe(locked);
  expect(importedDay(runs, 'lr', log, 21.0975, 'strava').current).toBe(log);
});
