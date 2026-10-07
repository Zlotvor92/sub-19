import { describe, it, expect } from 'vitest';
import { defaultRaceContext, racePayload } from './analysis';

describe('analiza trke', () => {
  it('HM GPS distanca je predlog, a zvanično vreme ostaje nepoznato', () => {
    const context = defaultRaceContext(
      { km: 21.8, sec: 6300, stravaName: 'Niški polumaraton' },
      '2026-10-04'
    );
    expect(context.distanceM).toBe(21097.5);
    expect(context.officialSec).toBeNull();
    expect(racePayload({ km: 21.8, sec: 6300 }, context)).toMatchObject({
      analysisType: 'race',
      session: { tag: 'trka' },
      race: { officialSec: null }
    });
  });
  it('čuva nameru i stvarnu distancu trke uz obogaćene prolaze', () => {
    const context = {
      ...defaultRaceContext({ km: 21.5 }, '2026-10-04'),
      intent: 'first_distance' as const,
      officialSec: 6400
    };
    const entered = { perKm: [{ km: 1, paceSec: 300 }], hr: 160 };
    expect(racePayload({}, context, entered).entered).toMatchObject(entered);
    expect(racePayload({}, context, entered).race.intent).toBe('first_distance');
  });
});

it('race activity details override merged daily totals and preserve partial-km clocks', () => {
  const context = defaultRaceContext({ km: 21.5 }, '2026-10-04');
  const payload = racePayload(
    {
      km: 24,
      sec: 7500,
      raceDetails: {
        version: 1,
        date: context.date,
        source: 'strava',
        km: 21.5,
        movingSec: 6252,
        elapsedSec: 6272,
        perKm: [{ km: 22, distanceM: 500, paceSec: 280, partial: true }]
      }
    },
    context,
    { km: 24, time: '2:05:00' }
  );
  expect(payload.entered).toMatchObject({
    km: 21.5,
    movingSec: 6252,
    elapsedSec: 6272,
    perKmSource: 'strava',
    perKm: [{ distanceM: 500, partial: true }],
    oporavakTiming: 'morning_of_race'
  });
  expect(payload.entered.time).toBeUndefined();
});
