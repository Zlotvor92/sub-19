/* 12 profila 10 km (P9 `inputs.json`, 10K) u obliku V4: činjenice trkača + cilj. Plan počinje 2. 11. 2026.
   p01, p03, p06 i p11 su profili ciljnih planova trenera (`coach/target/10K/`). */
import type { Goal, RunnerFacts, RunnerProfile, Weekday } from '../../../engine/types';

export interface TenkProfile {
  id: string;
  title: string;
  today: string;
  runDays: Weekday[];
  longDay: Weekday;
  profile: RunnerProfile;
  goal: Goal;
}

export const PROFILES: TenkProfile[] = [
  {
    id: 'p01',
    title: '10 km 46:00, 40 km/ned, 4 dana, cilj = prognoza −2 %',
    today: '2026-11-01',
    runDays: [1, 3, 5, 6],
    longDay: 6,
    profile: {
      weeklyKm: 40,
      recentResult: { distanceM: 10000, timeSec: 2760, date: '2026-10-19' }
    },
    goal: { distanceId: 'tenk', raceDate: '2027-02-21', targetTimeSec: 2705 }
  },
  {
    id: 'p02',
    title: '5 km 20:25, 4 dana',
    today: '2026-11-01',
    runDays: [1, 3, 5, 6],
    longDay: 6,
    profile: { weeklyKm: 30, recentResult: { distanceM: 5000, timeSec: 1225, date: '2026-10-19' } },
    goal: { distanceId: 'tenk', raceDate: '2026-12-27' }
  },
  {
    id: 'p03',
    title: 'spor, VDOT 33, dno obima, 3 dana, srednja priprema',
    today: '2026-11-01',
    runDays: [1, 3, 6],
    longDay: 6,
    profile: {
      weeklyKm: 20,
      recentResult: { distanceM: 10000, timeSec: 3534, date: '2026-10-19' }
    },
    goal: { distanceId: 'tenk', raceDate: '2027-01-24' }
  },
  {
    id: 'p04',
    title: 'spor, VDOT 35, 5 dana, sredina obima, najduža priprema',
    today: '2026-11-01',
    runDays: [0, 1, 3, 5, 6],
    longDay: 6,
    profile: {
      weeklyKm: 50,
      recentResult: { distanceM: 10000, timeSec: 3362, date: '2026-10-19' }
    },
    goal: { distanceId: 'tenk', raceDate: '2027-03-07' }
  },
  {
    id: 'p05',
    title: 'brz, VDOT 60, vrh obima, 6 dana, srednja priprema',
    today: '2026-11-01',
    runDays: [0, 1, 2, 3, 5, 6],
    longDay: 6,
    profile: {
      weeklyKm: 80,
      recentResult: { distanceM: 10000, timeSec: 2122, date: '2026-10-19' }
    },
    goal: { distanceId: 'tenk', raceDate: '2027-01-24' }
  },
  {
    id: 'p06',
    title: 'brz, mali obim, VDOT 58, dno obima za 5 dana, najkraća priprema',
    today: '2026-11-01',
    runDays: [0, 1, 3, 5, 6],
    longDay: 6,
    profile: {
      weeklyKm: 30,
      recentResult: { distanceM: 10000, timeSec: 2184, date: '2026-10-19' }
    },
    goal: { distanceId: 'tenk', raceDate: '2026-12-27' }
  },
  {
    id: 'p07',
    title: 'srednji, VDOT 45, 5 dana, sredina obima, najkraća priprema',
    today: '2026-11-01',
    runDays: [0, 1, 3, 5, 6],
    longDay: 6,
    profile: {
      weeklyKm: 50,
      recentResult: { distanceM: 10000, timeSec: 2713, date: '2026-10-19' }
    },
    goal: { distanceId: 'tenk', raceDate: '2026-12-27' }
  },
  {
    id: 'p08',
    title: 'srednji, VDOT 45, 3 dana, vrh obima za 3 dana, najduža priprema',
    today: '2026-11-01',
    runDays: [1, 3, 6],
    longDay: 6,
    profile: {
      weeklyKm: 40,
      recentResult: { distanceM: 10000, timeSec: 2713, date: '2026-10-19' }
    },
    goal: { distanceId: 'tenk', raceDate: '2027-03-07' }
  },
  {
    id: 'p09',
    title: 'po osećaju, lagan tempo 6:00/km, 4 dana, sredina obima, srednja priprema',
    today: '2026-11-01',
    runDays: [1, 3, 5, 6],
    longDay: 6,
    profile: { weeklyKm: 40, easyPaceSecPerKm: 360 },
    goal: { distanceId: 'tenk', raceDate: '2027-01-24' }
  },
  {
    id: 'p10',
    title: 'po osećaju, spor, lagan tempo 7:30/km, 3 dana, dno obima, najduža priprema',
    today: '2026-11-01',
    runDays: [1, 3, 6],
    longDay: 6,
    profile: { weeklyKm: 20, easyPaceSecPerKm: 450 },
    goal: { distanceId: 'tenk', raceDate: '2027-03-07' }
  },
  {
    id: 'p11',
    title: 'početnik sa rezultatom (VDOT 35), 3 dana, dno tabele početnika, najduža priprema',
    today: '2026-11-01',
    runDays: [1, 3, 6],
    longDay: 6,
    profile: {
      weeklyKm: 15,
      recentResult: { distanceM: 10000, timeSec: 3362, date: '2026-10-19' },
      beginner: true
    },
    goal: { distanceId: 'tenk', raceDate: '2027-03-07' }
  },
  {
    id: 'p12',
    title: 'početnik po osećaju (lagan 7:00/km), 4 dana, vrh tabele početnika, srednja priprema',
    today: '2026-11-01',
    runDays: [1, 3, 5, 6],
    longDay: 6,
    profile: { weeklyKm: 35, easyPaceSecPerKm: 420, beginner: true },
    goal: { distanceId: 'tenk', raceDate: '2027-01-24' }
  }
];

export function factsOf(p: TenkProfile): RunnerFacts {
  return {
    today: p.today,
    availability: { runDays: p.runDays, longDay: p.longDay },
    profile: p.profile,
    runs: [],
    pauses: [],
    pain: []
  };
}
