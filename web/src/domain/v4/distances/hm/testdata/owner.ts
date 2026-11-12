/* Dva plana vlasnika (brief F3):
   v1 — polumaraton, forma 1:41:00, 30 km nedeljno, 4 dana (uto, čet, sub, ned), 10 nedelja (SPEC § 12a).
   v2 — 18 nedelja od 14. 12. 2026. (dan posle polumaratona 13. 12.) do polumaratona 17. 4. 2027.
        Pretpostavke (nema podatka): vreme 13. 12. = 1:40:20 (očekivano po F4), obim 30 km, isti dani. */
import type { Goal, RunnerFacts } from '../../../engine/types';

export interface OwnerPlan {
  id: string;
  title: string;
  facts: RunnerFacts;
  goal: Goal;
}

const DAYS = { runDays: [1, 3, 5, 6], longDay: 6 } as RunnerFacts['availability'];

export const OWNER_PLANS: OwnerPlan[] = [
  {
    id: 'vlasnik-v1',
    title: 'vlasnik v1: polumaraton 1:41:00, 30 km/ned, 4 dana, 10 nedelja',
    facts: {
      today: '2026-11-15',
      availability: DAYS,
      profile: {
        weeklyKm: 30,
        recentResult: { distanceM: 21097.5, timeSec: 6060, date: '2026-10-03' }
      },
      runs: [],
      pauses: [],
      pain: []
    },
    goal: { distanceId: 'hm', raceDate: '2027-01-24' }
  },
  {
    id: 'vlasnik-v2',
    title: 'vlasnik v2: 18 nedelja posle polumaratona 13. 12. 2026, trka 17. 4. 2027',
    facts: {
      today: '2026-12-13',
      availability: DAYS,
      profile: {
        weeklyKm: 30,
        recentResult: { distanceM: 21097.5, timeSec: 6020, date: '2026-12-13' }
      },
      runs: [
        {
          id: '2026-12-13-hm',
          date: '2026-12-13',
          distanceM: 21097.5,
          durationSec: 6020,
          effort: 'race'
        }
      ],
      pauses: [],
      pain: []
    },
    goal: { distanceId: 'hm', raceDate: '2027-04-17', raceName: 'Beogradski polumaraton' }
  }
];
