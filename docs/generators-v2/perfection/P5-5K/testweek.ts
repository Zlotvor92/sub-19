/* P5 (5K) — nedelja testa u planu sa rezultatom (gusta mreža 3–5 d × svaki ceo km × 10–16 ned × VDOT 35/45/55/65):
   planirano − cilj [km], udeo km bržih od E (test 3 km se broji kao brz), trajanje dana testa prema danu I nedelje pre.
   Iz web/: node ../docs/generators-v2/perfection/P5-5K/testweek.ts */
import { distOf } from "../../final-check/lib.ts";
import { SCHED, START } from "../P0/common.ts";
import { FIVE_K_V2_POLICY as P } from "../../../../web/src/domain/generators/fiveK/v2/policy.ts";
import { timeForVdot } from "../../../../web/src/domain/generators/tenK/v2/testInputs.ts";
const add = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const FAST = (s: any) => s.kind !== "recovery" && s.kind !== "warmup" && s.kind !== "cooldown" && !["E", "jog", "walk"].includes(s.zone);
const def: number[] = [], fast: number[] = [], over: string[] = [], durRatio: number[] = [];
let n = 0;
for (const v of [35, 45, 55, 65]) for (const days of [3, 4, 5]) {
  const r0 = P.days[days as 3 | 4 | 5].weeklyKm;
  for (let km = r0.min; km <= r0.max; km++) for (let weeks = 10; weeks <= 16; weeks++) {
    const r: any = distOf("5K").generate({ startDate: START, raceDate: add(START, weeks * 7 - 1), runDays: SCHED[days], currentWeeklyKm: km, goalTimeSec: null, recentResult: { distanceM: 10000, timeSec: timeForVdot(v, 10000), date: add(START, -14) } });
    if (!r.ok) continue;
    const w = r.plan.weeks.find((x: any) => x.test); if (!w) continue; n++;
    def.push(Math.round((w.plannedKm - w.targetKm) * 100) / 100);
    let f = 0, t = 0; for (const d of w.days) for (const s of d.workout.segments) { t += s.km; if (FAST(s)) f += s.km; }
    const pct = Math.round(1000 * f / t) / 10; fast.push(pct); if (pct > 25) over.push(`d${days}-${km}km-${weeks}w-v${v} ${pct}%`);
    const td = w.days.find((d: any) => d.workout.qualityType === "TEST_3K");
    const prevI = [...r.plan.weeks].reverse().find((x: any) => x.index < w.index && x.phase === "peak" && !x.deload)?.days.find((d: any) => d.workout.qualityType === "I");
    if (prevI) durRatio.push(Math.round(100 * td.workout.sec / prevI.workout.sec) / 100);
  }
}
const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(p * (s.length - 1))]; };
console.log(`planova sa testom ${n}; planirano − cilj [km]: medijana ${q(def, 0.5)}, min ${Math.min(...def)}, < 0: ${def.filter((x) => x < -1e-9).length}, < −1 km: ${def.filter((x) => x < -1).length}`);
console.log(`% km bržih od E u nedelji testa: medijana ${q(fast, 0.5)}, max ${Math.max(...fast)}, > 25 %: ${over.length} (${over.slice(0, 20).join("; ")})`);
console.log(`trajanje dana testa / dan I prethodne nedelje vrhunca: medijana ${q(durRatio, 0.5)} [${Math.min(...durRatio)}–${Math.max(...durRatio)}], n ${durRatio.length}`);
