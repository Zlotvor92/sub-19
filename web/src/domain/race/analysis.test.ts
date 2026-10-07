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
    expect(racePayload({}, context, entered).entered).toEqual(entered);
    expect(racePayload({}, context, entered).race.intent).toBe('first_distance');
  });
});
