/* 5K QUALITY_INFEASIBLE: najmanji VDOT koji generator odbija, po (dani, km). Mreža: 3 d (tue,thu,sun / mon,wed,sat /
   mon,thu,sat), km 12–20, nedelje 6–16, VDOT 30–60 (korak 1), rezultat 5 km star 10 dana. Iz web/:
   node ../docs/generators-v2/audit/fuzz/qinf5k.ts */
import { generateFiveKV2 } from "../../../../web/src/domain/generators/fiveK/v2/generate.ts";
import { raceTimeForVdot } from "../../../../web/src/domain/generators/fiveK/v2/paces.ts";
import { addDays } from "../../final-check/lib.ts";
const out: Record<string, { n: number; rej: number; minVdot: number | null }> = {};
for (const days of [["tue", "thu", "sun"], ["mon", "wed", "sat"], ["mon", "thu", "sat"]])
  for (let km = 12; km <= 20; km++)
    for (let w = 6; w <= 16; w++)
      for (let v = 30; v <= 60; v++) {
        const race = "2027-03-07";
        const start = addDays(race, -7 * w + 1);
        const r = generateFiveKV2({ startDate: start, raceDate: race, runDays: days, currentWeeklyKm: km, recentResult: { distanceM: 5000, timeSec: Math.round(raceTimeForVdot(v, 5000)), date: addDays(start, -10) }, goalTimeSec: null }) as { ok: boolean; reasons?: { code: string }[] };
        const o = (out[`km${km}`] ??= { n: 0, rej: 0, minVdot: null });
        o.n++;
        if (!r.ok && r.reasons!.some((x) => x.code === "QUALITY_INFEASIBLE")) {
          o.rej++;
          if (o.minVdot === null || v < o.minVdot) o.minVdot = v;
        }
      }
console.log(JSON.stringify(out));
