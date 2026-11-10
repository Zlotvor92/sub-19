import { distOf } from "../../final-check/lib.ts";
import { timeForVdot } from "../../../../web/src/domain/generators/tenK/v2/testInputs.ts";
const [days, km, weeks, v] = process.argv.slice(2).map(Number);
const SCHED: any = { 3: ["tue", "thu", "sun"], 4: ["tue", "thu", "sat", "sun"], 5: ["mon", "tue", "thu", "sat", "sun"] };
const add = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const r: any = distOf("5K").generate({ startDate: "2026-11-02", raceDate: add("2026-11-02", weeks * 7 - 1), runDays: SCHED[days], currentWeeklyKm: km, goalTimeSec: null, recentResult: { distanceM: 10000, timeSec: timeForVdot(v, 10000), date: add("2026-11-02", -14) } });
if (!r.ok) { console.log(r.reasons, r.violations?.filter((x: any) => x.severity === "error")); process.exit(); }
for (const w of r.plan.weeks) {
  console.log(`${w.index} ${w.phase}${w.deload ? "*" : ""}${w.test ? " TEST" : ""}${w.hold ? " HOLD" : ""} cilj ${w.targetKm} plan ${w.plannedKm}: ` + w.days.map((d: any) => `${d.role}:${d.workout.title} [${d.workout.km} km ${Math.round(d.workout.sec / 60)}m]`).join(" | "));
  for (const n of w.notes) console.log("    · " + n);
}
console.log(r.plan.warnings.map((x: any) => `${x.rule}@${x.week}`).join(", "));
