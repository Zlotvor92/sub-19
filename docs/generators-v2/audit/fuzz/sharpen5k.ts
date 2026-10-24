/* 5K: koje kombinacije (dani trčanja × dan trke) generator odbija sa WEEK_INFEASIBLE „nema zahtevnog dana šablona ≥ 3 dana
   pre trke za oštrenje". Iscrpno: svi skupovi 3/4/5 dana × 7 dana trke; ulaz inače srednji (VDOT 45, 10 nedelja, km sredina).
   Iz web/: node ../docs/generators-v2/audit/fuzz/sharpen5k.ts */
import { generateFiveKV2 } from "../../../../web/src/domain/generators/fiveK/v2/generate.ts";
import { raceTimeForVdot } from "../../../../web/src/domain/generators/fiveK/v2/paces.ts";
import { addDays } from "../../final-check/lib.ts";
const WD = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const KM: Record<number, number> = { 3: 20, 4: 28, 5: 40 };
const subsets = (k: number, from = 0): string[][] =>
  k === 0 ? [[]] : WD.slice(from).flatMap((d, j) => subsets(k - 1, from + j + 1).map((s) => [d, ...s]));
const out: Record<string, { all: number; rej: Record<string, number>; ex: string[] }> = {};
const RACE0 = "2027-03-01"; // ponedeljak
for (const n of [3, 4, 5])
  for (const days of subsets(n))
    for (let rw = 0; rw < 7; rw++) {
      const race = addDays(RACE0, rw);
      const start = addDays(race, -69);
      const input = { startDate: start, raceDate: race, runDays: days, currentWeeklyKm: KM[n], recentResult: { distanceM: 5000, timeSec: Math.round(raceTimeForVdot(45, 5000)), date: addDays(start, -10) }, goalTimeSec: null };
      const r = generateFiveKV2(input) as { ok: boolean; reasons?: { code: string; message: string }[] };
      const k = `${n}d`;
      const o = (out[k] ??= { all: 0, rej: {}, ex: [] });
      o.all++;
      if (!r.ok)
        for (const x of r.reasons!) {
          const c = x.message.includes("oštrenje") ? "WEEK_INFEASIBLE:oštrenje" : `${x.code}:${x.message.slice(0, 60)}`;
          o.rej[c] = (o.rej[c] ?? 0) + 1;
          if (o.ex.length < 40 && c.endsWith("oštrenje")) o.ex.push(`${days.join(",")} trka ${WD[rw]}`);
        }
    }
console.log(JSON.stringify(out, null, 1));
