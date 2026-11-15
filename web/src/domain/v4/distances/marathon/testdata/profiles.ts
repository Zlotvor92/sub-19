/* 12 + 7 profila maratona u obliku V4: činjenice trkača + cilj. Plan počinje 2. 11. 2026.
   p01–p12: P9 `inputs.json` (MAR); p07, p08, p11 i p12 su profili ciljnih planova trenera (`coach/target/MAR/`).
   p13–p19 (brief F7-MAR): prvi maraton za 10 nedelja sa 28 km i 3 dana, iskusan sa 85 km, povratnik, stariji trkač,
   cilj ispod 3 h, cilj „samo da završim", maraton za 8 nedelja. */
import type {
  Goal,
  PainFlag,
  Pause,
  RunnerFacts,
  RunnerProfile,
  Weekday
} from '../../../engine/types';

export interface MarathonProfile {
  id: string;
  title: string;
  today: string;
  runDays: Weekday[];
  longDay: Weekday;
  profile: RunnerProfile;
  goal: Goal;
  pauses?: Pause[];
  painHistory?: PainFlag[];
}

export const PROFILES: MarathonProfile[] = [
  {
    today: '2026-11-01',
    id: 'p01',
    title: '10 km 46:00, 40 km/ned, 4 dana, cilj = prognoza −2 %',
    runDays: [1, 3, 5, 6],
    longDay: 6,
    profile: {
      weeklyKm: 40,
      longestRecentKm: 14,
      recentResult: { distanceM: 10000, timeSec: 2760, date: '2026-10-19' }
    },
    goal: { distanceId: 'marathon', raceDate: '2027-02-21', targetTimeSec: 12450 }
  },
  {
    today: '2026-11-01',
    id: 'p02',
    title: '5 km 20:25, 4 dana',
    runDays: [1, 3, 5, 6],
    longDay: 6,
    profile: {
      weeklyKm: 40,
      longestRecentKm: 14,
      recentResult: { distanceM: 5000, timeSec: 1225, date: '2026-10-19' }
    },
    goal: { distanceId: 'marathon', raceDate: '2027-03-07' }
  },
  {
    today: '2026-11-01',
    id: 'p03',
    title: 'spor, VDOT 33, dno obima, 3 dana, srednja priprema',
    runDays: [1, 3, 6],
    longDay: 6,
    profile: {
      weeklyKm: 30,
      recentResult: { distanceM: 21097.5, timeSec: 7831, date: '2026-10-19' }
    },
    goal: { distanceId: 'marathon', raceDate: '2027-03-07' }
  },
  {
    today: '2026-11-01',
    id: 'p04',
    title: 'spor, VDOT 35, 5 dana, sredina obima, najduža priprema',
    runDays: [0, 1, 3, 5, 6],
    longDay: 6,
    profile: {
      weeklyKm: 65,
      recentResult: { distanceM: 21097.5, timeSec: 7453, date: '2026-10-19' }
    },
    goal: { distanceId: 'marathon', raceDate: '2027-04-18' }
  },
  {
    today: '2026-11-01',
    id: 'p05',
    title: 'brz, VDOT 60, vrh obima, 6 dana, srednja priprema',
    runDays: [0, 1, 2, 3, 5, 6],
    longDay: 6,
    profile: {
      weeklyKm: 110,
      recentResult: { distanceM: 21097.5, timeSec: 4689, date: '2026-10-19' }
    },
    goal: { distanceId: 'marathon', raceDate: '2027-03-07' }
  },
  {
    today: '2026-11-01',
    id: 'p06',
    title: 'brz, mali obim, VDOT 58, dno obima za 5 dana, najkraća priprema',
    runDays: [0, 1, 3, 5, 6],
    longDay: 6,
    profile: {
      weeklyKm: 40,
      recentResult: { distanceM: 21097.5, timeSec: 4828, date: '2026-10-19' }
    },
    goal: { distanceId: 'marathon', raceDate: '2027-01-24' }
  },
  {
    today: '2026-11-01',
    id: 'p07',
    title: 'srednji, VDOT 45, 5 dana, sredina obima, najkraća priprema',
    runDays: [0, 1, 3, 5, 6],
    longDay: 6,
    profile: {
      weeklyKm: 65,
      recentResult: { distanceM: 21097.5, timeSec: 6014, date: '2026-10-19' }
    },
    goal: { distanceId: 'marathon', raceDate: '2027-01-24' }
  },
  {
    today: '2026-11-01',
    id: 'p08',
    title: 'srednji, VDOT 45, 3 dana, vrh obima za 3 dana, najduža priprema',
    runDays: [1, 3, 6],
    longDay: 6,
    profile: {
      weeklyKm: 50,
      recentResult: { distanceM: 21097.5, timeSec: 6014, date: '2026-10-19' }
    },
    goal: { distanceId: 'marathon', raceDate: '2027-04-18' }
  },
  {
    today: '2026-11-01',
    id: 'p09',
    title: 'po osećaju, lagan tempo 6:00/km, 4 dana, sredina obima, srednja priprema',
    runDays: [1, 3, 5, 6],
    longDay: 6,
    profile: { weeklyKm: 50, easyPaceSecPerKm: 360 },
    goal: { distanceId: 'marathon', raceDate: '2027-03-07' }
  },
  {
    today: '2026-11-01',
    id: 'p10',
    title: 'po osećaju, spor, lagan tempo 7:30/km, 3 dana, dno obima, najduža priprema',
    runDays: [1, 3, 6],
    longDay: 6,
    profile: { weeklyKm: 30, easyPaceSecPerKm: 450 },
    goal: { distanceId: 'marathon', raceDate: '2027-04-18' }
  },
  {
    today: '2026-11-01',
    id: 'p11',
    title: 'početnik sa rezultatom (VDOT 35), 4 dana, dno tabele početnika, najduža priprema',
    runDays: [1, 3, 5, 6],
    longDay: 6,
    profile: {
      weeklyKm: 25,
      recentResult: { distanceM: 21097.5, timeSec: 7453, date: '2026-10-19' },
      beginner: true
    },
    goal: { distanceId: 'marathon', raceDate: '2027-04-18' }
  },
  {
    today: '2026-11-01',
    id: 'p12',
    title: 'početnik po osećaju (lagan 7:00/km), 5 dana, vrh tabele početnika, srednja priprema',
    runDays: [0, 1, 3, 5, 6],
    longDay: 6,
    profile: { weeklyKm: 50, easyPaceSecPerKm: 420, beginner: true },
    goal: { distanceId: 'marathon', raceDate: '2027-03-07' }
  },
  {
    today: '2026-11-01',
    id: 'p13',
    title: 'prvi maraton: 28 km/ned, 3 dana, 10 nedelja do trke, polumaraton 2:15',
    runDays: [1, 3, 6],
    longDay: 6,
    profile: {
      weeklyKm: 28,
      longestRecentKm: 16,
      recentResult: { distanceM: 21097.5, timeSec: 8100, date: '2026-10-11' },
      beginner: true
    },
    goal: { distanceId: 'marathon', raceDate: '2027-01-10' }
  },
  {
    today: '2026-11-01',
    id: 'p14',
    title: 'iskusan: 85 km/ned, 6 dana, 16 nedelja, polumaraton 1:30',
    runDays: [0, 1, 2, 3, 5, 6],
    longDay: 6,
    profile: {
      weeklyKm: 85,
      longestRecentKm: 26,
      recentResult: { distanceM: 21097.5, timeSec: 5400, date: '2026-10-18' },
      yearsRunning: 8
    },
    goal: { distanceId: 'marathon', raceDate: '2027-02-21' }
  },
  {
    today: '2026-11-01',
    id: 'p15',
    title:
      'povratnik: 4 nedelje pauze (povreda) do 4. 10., 40 km/ned, 5 dana, 20 nedelja, polumaraton 1:50',
    runDays: [0, 1, 3, 5, 6],
    longDay: 6,
    profile: {
      weeklyKm: 40,
      longestRecentKm: 15,
      recentResult: { distanceM: 21097.5, timeSec: 6600, date: '2026-05-10' },
      yearsRunning: 6
    },
    goal: { distanceId: 'marathon', raceDate: '2027-03-21' },
    pauses: [{ from: '2026-09-07', to: '2026-10-04', reason: 'povreda' }]
  },
  {
    today: '2026-11-01',
    id: 'p16',
    title:
      'stariji trkač (rođen 1961), tegoba u kolenu u junu, 45 km/ned, 4 dana, 18 nedelja, polumaraton 1:58',
    runDays: [1, 3, 5, 6],
    longDay: 6,
    profile: {
      weeklyKm: 45,
      longestRecentKm: 18,
      recentResult: { distanceM: 21097.5, timeSec: 7080, date: '2026-10-04' },
      yearsRunning: 20,
      birthYear: 1961
    },
    goal: { distanceId: 'marathon', raceDate: '2027-03-07' },
    painHistory: [{ date: '2026-06-14', level: 4, part: 'koleno' }]
  },
  {
    today: '2026-11-01',
    id: 'p17',
    title: 'cilj ispod 3 h: 90 km/ned, 6 dana, 18 nedelja, polumaraton 1:24:00',
    runDays: [0, 1, 2, 3, 5, 6],
    longDay: 6,
    profile: {
      weeklyKm: 90,
      longestRecentKm: 28,
      recentResult: { distanceM: 21097.5, timeSec: 5040, date: '2026-10-18' },
      yearsRunning: 10
    },
    goal: { distanceId: 'marathon', raceDate: '2027-03-07', targetTimeSec: 10740 }
  },
  {
    today: '2026-11-01',
    id: 'p18',
    title:
      'cilj „samo da završim": početnik po osećaju (lagan 7:30/km), 30 km/ned, 4 dana, 20 nedelja',
    runDays: [1, 3, 5, 6],
    longDay: 6,
    profile: { weeklyKm: 30, easyPaceSecPerKm: 450, beginner: true, longestRecentKm: 14 },
    goal: { distanceId: 'marathon', raceDate: '2027-03-21' }
  },
  {
    today: '2026-11-01',
    id: 'p19',
    title: 'maraton za 8 nedelja: 40 km/ned, 4 dana, polumaraton 1:55',
    runDays: [1, 3, 5, 6],
    longDay: 6,
    profile: {
      weeklyKm: 40,
      longestRecentKm: 18,
      recentResult: { distanceM: 21097.5, timeSec: 6900, date: '2026-10-18' }
    },
    goal: { distanceId: 'marathon', raceDate: '2026-12-27' }
  }
];

export function factsOf(p: MarathonProfile): RunnerFacts {
  return {
    today: p.today,
    availability: { runDays: p.runDays, longDay: p.longDay },
    profile: p.profile,
    runs: [],
    pauses: p.pauses ?? [],
    pain: [],
    ...(p.painHistory === undefined ? {} : { painHistory: p.painHistory })
  };
}
