/* 12 + 4 profila 5 km. p01–p12 su P9 `inputs.json` (5K) u obliku V4: činjenice trkača + cilj; plan počinje 2. 11. 2026.
   p01, p04, p08 i p11 su profili ciljnih planova trenera (`coach/target/5K/`). Dodatni (brief F7-5K): p13 početnik
   koji tek prelazi sa hod-trka, p14 priprema od 4 nedelje, p15 povratnik posle pauze, p16 stariji trkač (motor u prvoj
   verziji ne čita godinu rođenja — profil pokazuje šta plan danas daje). */
import type { Goal, Pause, RunnerFacts, RunnerProfile, Weekday } from '../../../engine/types';

export interface FivekProfile {
  id: string;
  title: string;
  today: string;
  runDays: Weekday[];
  longDay: Weekday;
  profile: RunnerProfile;
  goal: Goal;
  pauses?: Pause[];
}

export const PROFILES: FivekProfile[] = [
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
    goal: { distanceId: 'fivek', raceDate: '2027-01-24', targetTimeSec: 1304 }
  },
  {
    id: 'p02',
    title: '5 km 20:25, 4 dana',
    today: '2026-11-01',
    runDays: [1, 3, 5, 6],
    longDay: 6,
    profile: { weeklyKm: 30, recentResult: { distanceM: 5000, timeSec: 1225, date: '2026-10-19' } },
    goal: { distanceId: 'fivek', raceDate: '2026-12-27' }
  },
  {
    id: 'p03',
    title: 'spor, VDOT 33, dno obima, 3 dana, srednja priprema',
    today: '2026-11-01',
    runDays: [1, 3, 6],
    longDay: 6,
    profile: { weeklyKm: 12, recentResult: { distanceM: 5000, timeSec: 1700, date: '2026-10-19' } },
    goal: { distanceId: 'fivek', raceDate: '2027-01-10' }
  },
  {
    id: 'p04',
    title: 'spor, VDOT 35, 5 dana, sredina obima, najduža priprema',
    today: '2026-11-01',
    runDays: [0, 1, 3, 5, 6],
    longDay: 6,
    profile: { weeklyKm: 45, recentResult: { distanceM: 5000, timeSec: 1619, date: '2026-10-19' } },
    goal: { distanceId: 'fivek', raceDate: '2027-02-21' }
  },
  {
    id: 'p05',
    title: 'brz, VDOT 60, vrh obima, 5 dana, srednja priprema',
    today: '2026-11-01',
    runDays: [0, 1, 3, 5, 6],
    longDay: 6,
    profile: { weeklyKm: 65, recentResult: { distanceM: 5000, timeSec: 1023, date: '2026-10-19' } },
    goal: { distanceId: 'fivek', raceDate: '2027-01-10' }
  },
  {
    id: 'p06',
    title: 'brz, mali obim, VDOT 58, dno obima za 5 dana, najkraća priprema',
    today: '2026-11-01',
    runDays: [0, 1, 3, 5, 6],
    longDay: 6,
    profile: { weeklyKm: 25, recentResult: { distanceM: 5000, timeSec: 1053, date: '2026-10-19' } },
    goal: { distanceId: 'fivek', raceDate: '2026-12-13' }
  },
  {
    id: 'p07',
    title: 'srednji, VDOT 45, 5 dana, sredina obima, najkraća priprema',
    today: '2026-11-01',
    runDays: [0, 1, 3, 5, 6],
    longDay: 6,
    profile: { weeklyKm: 45, recentResult: { distanceM: 5000, timeSec: 1309, date: '2026-10-19' } },
    goal: { distanceId: 'fivek', raceDate: '2026-12-13' }
  },
  {
    id: 'p08',
    title: 'srednji, VDOT 45, 3 dana, vrh obima za 3 dana, najduža priprema',
    today: '2026-11-01',
    runDays: [1, 3, 6],
    longDay: 6,
    profile: { weeklyKm: 35, recentResult: { distanceM: 5000, timeSec: 1309, date: '2026-10-19' } },
    goal: { distanceId: 'fivek', raceDate: '2027-02-21' }
  },
  {
    id: 'p09',
    title: 'po osećaju, lagan tempo 6:00/km, 4 dana, sredina obima, srednja priprema',
    today: '2026-11-01',
    runDays: [1, 3, 5, 6],
    longDay: 6,
    profile: { weeklyKm: 30, easyPaceSecPerKm: 360 },
    goal: { distanceId: 'fivek', raceDate: '2027-01-10' }
  },
  {
    id: 'p10',
    title: 'po osećaju, spor, lagan tempo 7:30/km, 3 dana, dno obima, najduža priprema',
    today: '2026-11-01',
    runDays: [1, 3, 6],
    longDay: 6,
    profile: { weeklyKm: 12, easyPaceSecPerKm: 450 },
    goal: { distanceId: 'fivek', raceDate: '2027-02-21' }
  },
  {
    id: 'p11',
    title: 'početnik sa rezultatom (VDOT 35), 3 dana, dno tabele početnika, najduža priprema',
    today: '2026-11-01',
    runDays: [1, 3, 6],
    longDay: 6,
    profile: {
      weeklyKm: 12,
      recentResult: { distanceM: 5000, timeSec: 1619, date: '2026-10-19' },
      beginner: true
    },
    goal: { distanceId: 'fivek', raceDate: '2027-02-21' }
  },
  {
    id: 'p12',
    title: 'početnik po osećaju (lagan 7:00/km), 4 dana, vrh tabele početnika, srednja priprema',
    today: '2026-11-01',
    runDays: [1, 3, 5, 6],
    longDay: 6,
    profile: { weeklyKm: 45, easyPaceSecPerKm: 420, beginner: true },
    goal: { distanceId: 'fivek', raceDate: '2027-01-10' }
  },
  {
    id: 'p13',
    title:
      'početnik koji tek prelazi sa hod-trka (staž 6 nedelja), 10 km/ned, 3 dana, kratka priprema',
    today: '2026-11-01',
    runDays: [1, 3, 6],
    longDay: 6,
    profile: { weeklyKm: 10, easyPaceSecPerKm: 480, beginner: true, yearsRunning: 0.12 },
    goal: { distanceId: 'fivek', raceDate: '2027-01-10' }
  },
  {
    id: 'p14',
    title: 'srednji, VDOT 45, 4 dana, 35 km, najkraća priprema (4 nedelje)',
    today: '2026-11-01',
    runDays: [1, 3, 5, 6],
    longDay: 6,
    profile: { weeklyKm: 35, recentResult: { distanceM: 5000, timeSec: 1309, date: '2026-10-19' } },
    goal: { distanceId: 'fivek', raceDate: '2026-11-29' }
  },
  {
    id: 'p15',
    title: 'povratnik posle 5 nedelja pauze (povreda), 5 km 23:30 pre pauze, 20 km/ned, 4 dana',
    today: '2026-11-01',
    runDays: [1, 3, 5, 6],
    longDay: 6,
    profile: { weeklyKm: 20, recentResult: { distanceM: 5000, timeSec: 1410, date: '2026-08-23' } },
    goal: { distanceId: 'fivek', raceDate: '2027-02-07' },
    pauses: [{ from: '2026-09-07', to: '2026-10-11', reason: 'povreda' }]
  },
  {
    id: 'p16',
    title: 'stariji trkač (rođen 1960), 5 km 27:40, 25 km/ned, 4 dana, srednja priprema',
    today: '2026-11-01',
    runDays: [1, 3, 5, 6],
    longDay: 6,
    profile: {
      weeklyKm: 25,
      recentResult: { distanceM: 5000, timeSec: 1660, date: '2026-10-19' },
      yearsRunning: 10,
      birthYear: 1960
    },
    goal: { distanceId: 'fivek', raceDate: '2027-01-24' }
  }
];

export function factsOf(p: FivekProfile): RunnerFacts {
  return {
    today: p.today,
    availability: { runDays: p.runDays, longDay: p.longDay },
    profile: p.profile,
    runs: [],
    pauses: p.pauses ?? [],
    pain: []
  };
}
