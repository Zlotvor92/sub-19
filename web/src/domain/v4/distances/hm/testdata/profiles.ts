/* 12 profila polumaratona (P9 `inputs.json`, HM) u obliku V4: činjenice trkača + cilj. Plan počinje 2. 11. 2026. */
import type { Goal, RunnerFacts, RunnerProfile, Weekday } from '../../../engine/types';

export interface HmProfile {
  id: string;
  title: string;
  today: string;
  runDays: Weekday[];
  longDay: Weekday;
  profile: RunnerProfile;
  goal: Goal;
}

export const PROFILES: HmProfile[] = [
  {
    id: 'p01',
    title: '10 km 46:00, 40 km/ned, 4 dana, cilj = prognoza −2 %',
    today: '2026-11-01',
    runDays: [1, 3, 5, 6],
    longDay: 6,
    profile: {
      weeklyKm: 40,
      recentResult: {
        distanceM: 10000,
        timeSec: 2760,
        date: '2026-10-19'
      },
      longestRecentKm: 14
    },
    goal: {
      distanceId: 'hm',
      raceDate: '2027-02-21',
      targetTimeSec: 5996
    }
  },
  {
    id: 'p02',
    title: '5 km 20:25, 4 dana',
    today: '2026-11-01',
    runDays: [1, 3, 5, 6],
    longDay: 6,
    profile: {
      weeklyKm: 40,
      recentResult: {
        distanceM: 5000,
        timeSec: 1225,
        date: '2026-10-19'
      },
      longestRecentKm: 14
    },
    goal: {
      distanceId: 'hm',
      raceDate: '2027-02-07'
    }
  },
  {
    id: 'p03',
    title: 'spor, VDOT 33, dno obima, 3 dana, srednja priprema',
    today: '2026-11-01',
    runDays: [1, 3, 6],
    longDay: 6,
    profile: {
      weeklyKm: 25,
      recentResult: {
        distanceM: 21097.5,
        timeSec: 7831,
        date: '2026-10-19'
      }
    },
    goal: {
      distanceId: 'hm',
      raceDate: '2027-02-21'
    }
  },
  {
    id: 'p04',
    title: 'spor, VDOT 35, 5 dana, sredina obima, najduža priprema',
    today: '2026-11-01',
    runDays: [0, 1, 3, 5, 6],
    longDay: 6,
    profile: {
      weeklyKm: 55,
      recentResult: {
        distanceM: 21097.5,
        timeSec: 7453,
        date: '2026-10-19'
      }
    },
    goal: {
      distanceId: 'hm',
      raceDate: '2027-03-21'
    }
  },
  {
    id: 'p05',
    title: 'brz, VDOT 60, vrh obima, 6 dana, srednja priprema',
    today: '2026-11-01',
    runDays: [0, 1, 2, 3, 5, 6],
    longDay: 6,
    profile: {
      weeklyKm: 90,
      recentResult: {
        distanceM: 21097.5,
        timeSec: 4689,
        date: '2026-10-19'
      }
    },
    goal: {
      distanceId: 'hm',
      raceDate: '2027-02-21'
    }
  },
  {
    id: 'p06',
    title: 'brz, mali obim, VDOT 58, dno obima za 5 dana, najkraća priprema',
    today: '2026-11-01',
    runDays: [0, 1, 3, 5, 6],
    longDay: 6,
    profile: {
      weeklyKm: 35,
      recentResult: {
        distanceM: 21097.5,
        timeSec: 4828,
        date: '2026-10-19'
      }
    },
    goal: {
      distanceId: 'hm',
      raceDate: '2027-01-10'
    }
  },
  {
    id: 'p07',
    title: 'srednji, VDOT 45, 5 dana, sredina obima, najkraća priprema',
    today: '2026-11-01',
    runDays: [0, 1, 3, 5, 6],
    longDay: 6,
    profile: {
      weeklyKm: 55,
      recentResult: {
        distanceM: 21097.5,
        timeSec: 6014,
        date: '2026-10-19'
      }
    },
    goal: {
      distanceId: 'hm',
      raceDate: '2027-01-10'
    }
  },
  {
    id: 'p08',
    title: 'srednji, VDOT 45, 3 dana, vrh obima za 3 dana, najduža priprema',
    today: '2026-11-01',
    runDays: [1, 3, 6],
    longDay: 6,
    profile: {
      weeklyKm: 45,
      recentResult: {
        distanceM: 21097.5,
        timeSec: 6014,
        date: '2026-10-19'
      }
    },
    goal: {
      distanceId: 'hm',
      raceDate: '2027-03-21'
    }
  },
  {
    id: 'p09',
    title: 'po osećaju, lagan tempo 6:00/km, 4 dana, sredina obima, srednja priprema',
    today: '2026-11-01',
    runDays: [1, 3, 5, 6],
    longDay: 6,
    profile: {
      weeklyKm: 45,
      easyPaceSecPerKm: 360
    },
    goal: {
      distanceId: 'hm',
      raceDate: '2027-02-21'
    }
  },
  {
    id: 'p10',
    title: 'po osećaju, spor, lagan tempo 7:30/km, 3 dana, dno obima, najduža priprema',
    today: '2026-11-01',
    runDays: [1, 3, 6],
    longDay: 6,
    profile: {
      weeklyKm: 25,
      easyPaceSecPerKm: 450
    },
    goal: {
      distanceId: 'hm',
      raceDate: '2027-03-21'
    }
  },
  {
    id: 'p11',
    title: 'početnik sa rezultatom (VDOT 35), 4 dana, dno tabele početnika, najduža priprema',
    today: '2026-11-01',
    runDays: [1, 3, 5, 6],
    longDay: 6,
    profile: {
      weeklyKm: 20,
      recentResult: {
        distanceM: 21097.5,
        timeSec: 7453,
        date: '2026-10-19'
      },
      beginner: true
    },
    goal: {
      distanceId: 'hm',
      raceDate: '2027-03-21'
    }
  },
  {
    id: 'p12',
    title: 'početnik po osećaju (lagan 7:00/km), 5 dana, vrh tabele početnika, srednja priprema',
    today: '2026-11-01',
    runDays: [0, 1, 3, 5, 6],
    longDay: 6,
    profile: {
      weeklyKm: 45,
      easyPaceSecPerKm: 420,
      beginner: true
    },
    goal: {
      distanceId: 'hm',
      raceDate: '2027-02-21'
    }
  }
];

export function factsOf(p: HmProfile): RunnerFacts {
  return {
    today: p.today,
    availability: { runDays: p.runDays, longDay: p.longDay },
    profile: p.profile,
    runs: [],
    pauses: [],
    pain: []
  };
}
