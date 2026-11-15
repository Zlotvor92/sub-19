/* KRUG 13 (M18/M17): jedan model forme — isti rezultat kao unet u profilu i kao trčanje od juče daje istu formu. */
import { describe, expect, it } from 'vitest';
import { estimateForm } from './estimate';
import type { FitnessFacts } from './types';

const base: FitnessFacts = {
  today: '2026-11-01',
  availability: { runDays: [1, 3, 5, 6], longDay: 6 },
  profile: {
    weeklyKm: 40,
    recentResult: { distanceM: 10000, timeSec: 2760, date: '2026-10-19' }
  },
  runs: [],
  pauses: [],
  pain: []
};

describe('krug 13 — jedan model forme', () => {
  it.each([5000, 10000, 21097.5, 42195])(
    'cilj %d m: trka od juče istim vremenom ne menja formu (bilo 21:49 → 22:01 kod 5 km)',
    (distanceM) => {
      const goal = { distanceM, raceDate: '2027-02-07' };
      const a = estimateForm(base, goal, null);
      const b = estimateForm(
        {
          ...base,
          runs: [
            {
              id: 'trka',
              date: '2026-10-31',
              distanceM: 10000,
              durationSec: 2760,
              effort: 'race'
            }
          ]
        },
        goal,
        null
      );
      expect(Math.abs(b.current.raceTimeSec - a.current.raceTimeSec)).toBeLessThanOrEqual(2);
    }
  );
});
