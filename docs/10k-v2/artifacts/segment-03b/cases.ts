/* Primeri segmenta 03b (10k-v2.3.1): četiri plana početnika. Dele ih run.ts (trenutni kod) i
   regression-81bd351.ts (kod 81bd351, tabela poređenja 03 → 03b). */

import { timeForVdot } from "../../../../web/src/domain/generators/tenK/v2/testInputs.ts";

export const START = "2026-11-02"; // ponedeljak; trka nedelja = START + 7N − 1

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export interface Case {
  id: string;
  note: string;
  input: Record<string, unknown>;
}

const D3 = ["tue", "thu", "sun"];
const D4 = ["tue", "thu", "sat", "sun"];

const beginner = (o: {
  weeks: number;
  km: number;
  days: string[];
  easy?: number;
  vdot?: number;
}): Record<string, unknown> => ({
  startDate: START,
  raceDate: addDays(START, o.weeks * 7 - 1),
  runDays: o.days,
  currentWeeklyKm: o.km,
  recentResult:
    o.vdot === undefined
      ? null
      : {
          distanceM: 10000,
          timeSec: timeForVdot(o.vdot),
          date: addDays(START, -14),
        },
  goalTimeSec: null,
  ...(o.easy !== undefined ? { easyPaceSecPerKm: o.easy } : {}),
  experience: "beginner",
});

export const CASES: Case[] = [
  {
    id: "beg-d3-15km-e7:30-12w",
    note: "početnik, 3 dana uto/čet/ned, 15 km, lagan 7:30/km, bez rezultata, 12 ned",
    input: beginner({ weeks: 12, km: 15, days: D3, easy: 450 }),
  },
  {
    id: "beg-d4-18km-e8:00-10w",
    note: "početnik, 4 dana uto/čet/sub/ned, 18 km, lagan 8:00/km, bez rezultata, 10 ned",
    input: beginner({ weeks: 10, km: 18, days: D4, easy: 480 }),
  },
  {
    id: "beg-d3-20km-e6:30-14w",
    note: "početnik, 3 dana uto/čet/ned, 20 km, lagan 6:30/km, bez rezultata, 14 ned",
    input: beginner({ weeks: 14, km: 20, days: D3, easy: 390 }),
  },
  {
    id: "beg-d4-25km-result-v35-14w",
    note: "početnik, 4 dana uto/čet/sub/ned, 25 km, rezultat 10 km VDOT 35, 14 ned",
    input: beginner({ weeks: 14, km: 25, days: D4, vdot: 35 }),
  },
];
