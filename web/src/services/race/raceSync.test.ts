import { it, expect, vi } from 'vitest';
import { createRaceSync } from './raceSync';
import type { LogEntry } from '../../domain/state';
import type { IcuApi } from '../api/icuApi';
import type { StravaApi } from '../strava/stravaApi';
const success = <T>(data: T) => ({ ok: true as const, data, status: 200 });
const failure = {
  ok: false as const,
  error: '403 bez dozvole',
  kind: 'http' as const,
  status: 403
};
const streams = {
  distance: { data: [0, 1000, 2000, 2500] },
  time: { data: [0, 300, 610, 750] },
  heartrate: { data: [null, 150, 160, 165] }
};
function setup() {
  let account = 'u1:1';
  let entry: LogEntry = {
    km: 2.5,
    sec: 750,
    hr: 158,
    runDate: '2026-10-04',
    src: 'icu',
    icuId: 'i1',
    stravaId: 42,
    note: 'ručno',
    lock: true,
    raceAi: { context: { name: 'trka' }, aiCount: 2, aiText: 'samo prosek' },
    aiText: 'trening'
  };
  const icu = {
    activities: vi.fn(() =>
      Promise.resolve(
        success({
          activities: [
            { id: 'i1', datum: '2026-10-04', km: 2.5, sec: 750, hr: 158, zonePuls: [100, 500, 150] }
          ]
        })
      )
    ),
    streams: vi.fn(() => Promise.resolve(success({ streams: { i1: streams } }))),
    details: vi.fn(() =>
      Promise.resolve(
        success({
          details: { i1: { rounds: [{ distM: 2500, sec: 750, paceSec: 300 }], groups: [] } }
        })
      )
    )
  };
  const strava = {
    get: vi.fn((path: string) =>
      Promise.resolve(
        success(
          path.includes('/streams')
            ? streams
            : {
                id: 42,
                distance: 2500,
                moving_time: 750,
                elapsed_time: 760,
                start_date_local: '2026-10-04T09:00:00Z'
              }
        )
      )
    )
  };
  let connected = true;
  const sync = createRaceSync({
    accountKey: () => account,
    icu: icu as unknown as IcuApi,
    strava: strava as unknown as StravaApi,
    stravaConnected: () => connected,
    icuLink: () => (connected ? { athleteId: 'i123', apiKey: 'fixture' } : null),
    get: () => entry,
    set: (_id, x) => {
      entry = x;
    }
  });
  return {
    sync,
    icu,
    strava,
    get: () => entry,
    switchAccount: () => {
      account = 'u2:2';
      entry = { km: 5, sec: 1500, note: 'novi nalog' };
    },
    disconnect: () => {
      connected = false;
    }
  };
}
it('backfills an existing locked race from both providers, preserves manual/admin-independent data and resets only race count', async () => {
  const s = setup();
  expect(await s.sync.refresh('day', '2026-10-04')).toMatchObject({ ok: true, splits: 3 });
  expect(s.icu.streams).toHaveBeenCalledWith(expect.anything(), ['i1']);
  expect(s.strava.get).toHaveBeenCalledWith('/activities/42');
  expect(s.get()).toMatchObject({
    lock: true,
    note: 'ručno',
    aiText: 'trening',
    raceDetails: {
      source: 'icu',
      perKm: [{ km: 1 }, { km: 2 }, { km: 3, partial: true }],
      providers: { strava: { elapsedSec: 760 } }
    },
    raceAi: { aiText: 'samo prosek', dataUpdated: true, context: { name: 'trka' } }
  });
  expect((s.get()['raceAi'] as Record<string, unknown>)['aiCount']).toBeUndefined();
  await s.sync.refresh('day', '2026-10-04');
  expect(s.icu.streams).toHaveBeenCalledTimes(1);
});
it('falls back to Strava metric splits if ICU and Strava streams are denied', async () => {
  const s = setup();
  s.icu.streams.mockImplementation(() => Promise.resolve(failure) as never);
  s.strava.get.mockImplementation(
    (path) =>
      Promise.resolve(
        path.includes('/streams')
          ? failure
          : success({
              distance: 2500,
              moving_time: 750,
              splits_metric: [
                { distance: 1000, elapsed_time: 300, moving_time: 300 },
                { distance: 1000, elapsed_time: 300, moving_time: 300 },
                { distance: 500, elapsed_time: 150, moving_time: 150 }
              ]
            })
      ) as never
  );
  expect(await s.sync.refresh('day', '2026-10-04')).toMatchObject({ ok: true, splits: 3 });
  expect(s.get()['raceDetails']).toMatchObject({
    source: 'strava',
    perKm: [{ km: 1 }, { km: 2 }, { km: 3, distanceM: 500 }]
  });
});
it('failure never erases valid cached splits or the old analysis', async () => {
  const s = setup();
  await s.sync.refresh('day', '2026-10-04');
  const before = s.get();
  s.icu.streams.mockImplementation(() => Promise.resolve(failure) as never);
  s.strava.get.mockImplementation(() => Promise.resolve(failure) as never);
  expect(await s.sync.refresh('day', '2026-10-04', true)).toMatchObject({ ok: true, splits: 3 });
  expect(s.get()).toEqual(before);
});
it('returns an actionable error rather than opening an average-only AI job for an imported race', async () => {
  const s = setup();
  s.icu.streams.mockImplementation(() => Promise.resolve(failure) as never);
  s.strava.get.mockImplementation(() => Promise.resolve(failure) as never);
  const result = await s.sync.refresh('day', '2026-10-04');
  expect(result.ok).toBe(false);
  expect(result.error).toContain('403');
  expect(s.get()['raceAi']).toMatchObject({ aiCount: 2, aiText: 'samo prosek' });
});
it('never writes fetched private activity data into another account', async () => {
  const s = setup();
  let release!: (value: ReturnType<typeof success<{ streams: typeof streams }>>) => void;
  s.icu.streams.mockImplementation(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }) as never
  );
  const job = s.sync.refresh('day', '2026-10-04');
  await vi.waitFor(() => expect(release).toBeDefined());
  s.switchAccount();
  release(success({ streams }));
  expect(await job).toMatchObject({ ok: false, error: 'Nalog je promenjen.' });
  expect(s.get()).toEqual({ km: 5, sec: 1500, note: 'novi nalog' });
  expect(s.strava.get).not.toHaveBeenCalled();
});
it('manual races without integrations can still be analyzed honestly as averages', async () => {
  const s = setup();
  s.disconnect();
  expect(await s.sync.refresh('manual', '2026-10-04')).toMatchObject({ ok: true, splits: 0 });
});

it('does not use another date or a truncated file when complete streams are needed', async () => {
  const s = setup();
  s.icu.streams.mockImplementation(
    () =>
      Promise.resolve(
        success({ streams: { i1: { distance: { data: [0, 1000] }, time: { data: [0, 300] } } } })
      ) as never
  );
  s.strava.get.mockImplementation(() => Promise.resolve(failure) as never);
  const result = await s.sync.refresh('day', '2026-10-04');
  expect(result.ok).toBe(false);
  expect(result.error).toContain('celu distancu');
  expect(s.get()['raceDetails']).toBeUndefined();
  s.icu.streams.mockImplementation(() => Promise.resolve(success({ streams: { i1: streams } })));
  await s.sync.refresh('day', '2026-10-04');
  s.icu.streams.mockImplementation(() => Promise.resolve(failure) as never);
  expect(await s.sync.refresh('day', '2026-10-05')).toMatchObject({ ok: false, splits: 0 });
});
it('does not merge ambiguous cross-provider matches', async () => {
  const s = setup();
  delete s.get()['icuId'];
  delete s.get()['stravaId'];
  const duplicate = {
    id: 'i2',
    datum: '2026-10-04',
    km: 2.5,
    sec: 750,
    hr: 158,
    zonePuls: [100, 500, 150]
  };
  s.icu.activities.mockImplementation(() =>
    Promise.resolve(success({ activities: [duplicate, { ...duplicate, id: 'i3' }] }))
  );
  s.strava.get.mockImplementation(
    () =>
      Promise.resolve(
        success([
          {
            id: 42,
            type: 'Run',
            start_date_local: '2026-10-04T09:00:00',
            distance: 2500,
            moving_time: 750
          },
          {
            id: 43,
            type: 'Run',
            start_date_local: '2026-10-04T18:00:00',
            distance: 2500,
            moving_time: 750
          }
        ])
      ) as never
  );
  expect(await s.sync.refresh('day', '2026-10-04')).toMatchObject({ ok: false, splits: 0 });
  expect(s.icu.streams).not.toHaveBeenCalled();
});

it('repairs a previously summed race and replaces a warm-up ID without modifying notes or official context', async () => {
  const s = setup();
  Object.assign(s.get(), {
    lock: false,
    km: 2.9,
    sec: 930,
    hr: 150,
    spojeno: 2,
    icuId: 'warm',
    stravaId: 41,
    raceAi: { context: { distanceM: 2500, officialSec: 770 }, aiText: 'pogrešan prosek' }
  });
  s.icu.activities.mockImplementation(() =>
    Promise.resolve(
      success({
        activities: [
          { id: 'warm', datum: '2026-10-04', km: 0.4, sec: 180, hr: 120, zonePuls: [] },
          { id: 'i1', datum: '2026-10-04', km: 2.5, sec: 750, hr: 158, zonePuls: [] }
        ]
      })
    )
  );
  s.strava.get.mockImplementation(
    (path) =>
      Promise.resolve(
        success(
          path.includes('/athlete/activities')
            ? [
                {
                  id: 41,
                  type: 'Run',
                  start_date_local: '2026-10-04T09:00:00',
                  distance: 400,
                  moving_time: 180
                },
                {
                  id: 42,
                  type: 'Run',
                  start_date_local: '2026-10-04T09:10:00',
                  distance: 2500,
                  moving_time: 750
                }
              ]
            : path.includes('/streams')
              ? streams
              : {
                  distance: 2500,
                  moving_time: 750,
                  elapsed_time: 760,
                  start_date_local: '2026-10-04T09:10:00'
                }
        )
      ) as never
  );
  expect(await s.sync.refresh('day', '2026-10-04')).toMatchObject({ ok: true, splits: 3 });
  expect(s.icu.streams).toHaveBeenCalledWith(expect.anything(), ['i1']);
  expect(s.strava.get).toHaveBeenCalledWith('/activities/42');
  expect(s.strava.get).not.toHaveBeenCalledWith('/activities/41');
  expect(s.get()).toMatchObject({
    km: 2.5,
    sec: 750,
    hr: 158,
    icuId: 'i1',
    note: 'ručno',
    raceDetails: { version: 2 },
    raceAi: { context: { distanceM: 2500, officialSec: 770 }, dataUpdated: true }
  });
  expect(s.get()['spojeno']).toBeUndefined();
});
