/* P7a — ulazi 12 profila × 4 distance (isti ulaz za obe verzije generatora).
   Pokretanje: node make-inputs.ts <izlazni.json> */
import { writeFileSync } from "node:fs";
import { raceTimeForVdot, vdotFromResult } from "../../../../web/src/domain/generators/tenK/v2/paces.ts";

type WD = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type DistName = "5K" | "10K" | "HM" | "MAR";
const START = "2026-11-02"; // ponedeljak
const DAY = 86_400_000;
const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10);
const DAYS: Record<3 | 4 | 5 | 6, WD[]> = {
  3: ["tue", "thu", "sun"],
  4: ["tue", "thu", "sat", "sun"],
  5: ["mon", "tue", "thu", "sat", "sun"],
  6: ["mon", "tue", "wed", "thu", "sat", "sun"],
};
const RACE_M: Record<DistName, number> = { "5K": 5000, "10K": 10000, HM: 21097.5, MAR: 42195 };
/* Rezultat za VDOT profile: na distanci plana (maraton: polumaraton). */
const RES_M: Record<DistName, number> = { "5K": 5000, "10K": 10000, HM: 21097.5, MAR: 21097.5 };
/* Tabela obima po broju dana (dno, vrh) i tabela početnika. */
const KM: Record<DistName, Partial<Record<3 | 4 | 5 | 6, [number, number]>>> = {
  "5K": { 3: [12, 35], 4: [15, 45], 5: [25, 65] },
  "10K": { 3: [20, 40], 4: [25, 55], 5: [30, 65], 6: [35, 80] },
  HM: { 3: [25, 45], 4: [30, 60], 5: [35, 75], 6: [40, 90] },
  MAR: { 3: [30, 50], 4: [35, 65], 5: [40, 85], 6: [50, 110] },
};
const BEG: Record<DistName, Partial<Record<3 | 4 | 5, [number, number]>>> = {
  "5K": { 3: [12, 35], 4: [15, 45] },
  "10K": { 3: [15, 30], 4: [18, 35] },
  HM: { 4: [20, 40], 5: [25, 45] },
  MAR: { 4: [25, 45], 5: [30, 50] },
};
/* Nedelje: najkraća / srednja / najduža priprema. */
const WEEKS: Record<DistName, [number, number, number]> = { "5K": [6, 10, 16], "10K": [8, 12, 18], HM: [10, 16, 20], MAR: [12, 18, 24] };
const r5 = (x: number) => Math.round(x / 5) * 5;

function build(D: DistName, n: number): { title: string; input: Record<string, unknown> } {
  const [wShort, wMid, wLong] = WEEKS[D];
  const km = (days: 3 | 4 | 5 | 6, where: "lo" | "mid" | "hi") => {
    const [lo, hi] = KM[D][days]!;
    return where === "lo" ? lo : where === "hi" ? hi : r5((lo + hi) / 2);
  };
  const resultAt = (vdot: number) => ({ distanceM: RES_M[D], timeSec: Math.round(raceTimeForVdot(vdot, RES_M[D])), date: addDays(START, -14) });
  const mk = (o: {
    weeks: number; days: 3 | 4 | 5 | 6; km: number; vdot?: number; result?: { distanceM: number; timeSec: number };
    easy?: number; beginner?: boolean; goal?: number; recentLong?: number;
  }) => {
    const input: Record<string, unknown> = {
      startDate: START,
      raceDate: addDays(START, o.weeks * 7 - 1),
      runDays: DAYS[o.days],
      currentWeeklyKm: o.km,
      goalTimeSec: o.goal ?? null,
    };
    if (D !== "5K") input["longRunDay"] = "sun";
    if (o.easy !== undefined) {
      input["recentResult"] = null;
      input[D === "5K" ? "typicalEasyPaceSecPerKm" : "easyPaceSecPerKm"] = o.easy;
    } else {
      const res = o.result ?? resultAt(o.vdot!);
      input["recentResult"] = { ...res, date: addDays(START, -14) };
    }
    if (o.beginner) {
      input["experience"] = "beginner";
      if (D === "5K") input["canRun30Min"] = true;
    }
    if (o.recentLong !== undefined && (D === "HM" || D === "MAR")) input["recentLongRunKm"] = o.recentLong;
    return input;
  };
  const six: 5 | 6 = D === "5K" ? 5 : 6;
  const begLo = Number(Object.keys(BEG[D])[0]) as 3 | 4 | 5;
  const begHi = Number(Object.keys(BEG[D]).slice(-1)[0]) as 3 | 4 | 5;
  const forecast = (m: number) => Math.round(raceTimeForVdot(vdotFromResult(10000, 2760), m) * 0.98);
  switch (n) {
    case 1:
      return { title: "10 km 46:00, 40 km/ned, 4 dana, cilj = prognoza −2 %", input: mk({ weeks: D === "5K" ? 12 : 16, days: 4, km: 40, result: { distanceM: 10000, timeSec: 2760 }, goal: forecast(RACE_M[D]), recentLong: 14 }) };
    case 2:
      return { title: "5 km 20:25, 4 dana", input: mk({ weeks: D === "5K" ? 8 : D === "10K" ? 8 : D === "HM" ? 14 : 18, days: 4, km: D === "5K" || D === "10K" ? 30 : 40, result: { distanceM: 5000, timeSec: 1225 }, recentLong: 14 }) };
    case 3: return { title: "spor, VDOT 33, dno obima, 3 dana, srednja priprema", input: mk({ weeks: wMid, days: 3, km: km(3, "lo"), vdot: 33 }) };
    case 4: return { title: "spor, VDOT 35, 5 dana, sredina obima, najduža priprema", input: mk({ weeks: wLong, days: 5, km: km(5, "mid"), vdot: 35 }) };
    case 5: return { title: `brz, VDOT 60, vrh obima, ${six} dana, srednja priprema`, input: mk({ weeks: wMid, days: six, km: km(six, "hi"), vdot: 60 }) };
    case 6: return { title: "brz, mali obim, VDOT 58, dno obima za 5 dana, najkraća priprema", input: mk({ weeks: wShort, days: 5, km: km(5, "lo"), vdot: 58 }) };
    case 7: return { title: "srednji, VDOT 45, 5 dana, sredina obima, najkraća priprema", input: mk({ weeks: wShort, days: 5, km: km(5, "mid"), vdot: 45 }) };
    case 8: return { title: "srednji, VDOT 45, 3 dana, vrh obima za 3 dana, najduža priprema", input: mk({ weeks: wLong, days: 3, km: km(3, "hi"), vdot: 45 }) };
    case 9: return { title: "po osećaju, lagan tempo 6:00/km, 4 dana, sredina obima, srednja priprema", input: mk({ weeks: wMid, days: 4, km: km(4, "mid"), easy: 360 }) };
    case 10: return { title: "po osećaju, spor, lagan tempo 7:30/km, 3 dana, dno obima, najduža priprema", input: mk({ weeks: wLong, days: 3, km: km(3, "lo"), easy: 450 }) };
    case 11: return { title: `početnik sa rezultatom (VDOT 35), ${begLo} dana, dno tabele početnika, najduža priprema`, input: mk({ weeks: wLong, days: begLo, km: BEG[D][begLo]![0], vdot: 35, beginner: true }) };
    default: return { title: `početnik po osećaju (lagan 7:00/km), ${begHi} dana, vrh tabele početnika, srednja priprema`, input: mk({ weeks: wMid, days: begHi, km: BEG[D][begHi]![1], easy: 420, beginner: true }) };
  }
}
const out: Record<string, { title: string; input: Record<string, unknown> }[]> = {};
for (const D of ["5K", "10K", "HM", "MAR"] as DistName[]) out[D] = Array.from({ length: 12 }, (_, i) => build(D, i + 1));
writeFileSync(process.argv[2]!, JSON.stringify(out, null, 1));
