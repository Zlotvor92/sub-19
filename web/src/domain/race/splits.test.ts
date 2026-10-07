import { describe, it, expect } from 'vitest';
import { raceSplits, stravaRaceSplits } from './splits';

describe('race splits', () => {
  it('interpolates sparse kilometer boundaries and preserves the final 500m', () => {
    const rows = raceSplits({
      distance: { data: [0, 1500, 2500] },
      time: { data: [0, 450, 750] },
      heartrate: { data: [null, 150, 170] }
    });
    expect(rows.map((x) => x.distanceM)).toEqual([1000, 1000, 500]);
    expect(rows.map((x) => x.elapsedSec)).toEqual([300, 300, 150]);
    expect(rows.map((x) => x.paceSec)).toEqual([300, 300, 300]);
    expect(rows[1]?.hr).toBe(160);
    expect(rows[2]).toMatchObject({ partial: true, timeBasis: 'elapsed', movingSec: null });
  });
  it('separates pauses from moving pace, including interpolation', () => {
    const rows = raceSplits({
      distance: { data: [0, 500, 500, 1000, 1500] },
      time: { data: [0, 150, 210, 360, 510] },
      moving: { data: [true, true, false, true, true] }
    });
    expect(rows[0]).toMatchObject({ elapsedSec: 360, movingSec: 300, paceSec: 300, stopSec: 60 });
    expect(rows[1]).toMatchObject({
      distanceM: 500,
      elapsedSec: 150,
      movingSec: 150,
      partial: true
    });
  });
  it('does not invent moving time when any flag is missing', () => {
    const rows = raceSplits({
      distance: { data: [0, 1000] },
      time: { data: [0, 300] },
      moving: { data: [null, true] }
    });
    expect(rows[0]?.timeBasis).toBe('elapsed');
    expect(rows[0]?.stopSec).toBeUndefined();
  });
  it('rejects corrupted, missing and nonmonotonic streams', () => {
    expect(raceSplits({ distance: { data: [0, 1000] } })).toEqual([]);
    expect(
      raceSplits({ distance: { data: [0, 1000, 900] }, time: { data: [0, 300, 320] } })
    ).toEqual([]);
    expect(raceSplits({ distance: { data: [0, 1000] }, time: { data: [0, NaN] } })).toEqual([]);
  });
  it('uses Strava metric splits when streams are unavailable, including partial km', () => {
    expect(
      stravaRaceSplits([
        { distance: 1001, elapsed_time: 310, moving_time: 300, average_heartrate: 165 },
        { distance: 300, elapsed_time: 90, moving_time: 90 }
      ])
    ).toMatchObject([
      { km: 1, distanceM: 1001, paceSec: 300, stopSec: 10, hr: 165 },
      { km: 2, distanceM: 300, paceSec: 300, partial: true }
    ]);
    expect(stravaRaceSplits([{ distance: null, elapsed_time: 300 }])).toEqual([]);
  });
});
