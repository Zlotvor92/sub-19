/* P4 — pun ispis plana po nedelji (P0/common.ts weekly). Iz web/:
   node ../docs/generators-v2/perfection/P4/profile.ts <dani> <km> <nedelja> <vdot> [cilj s]   ili   ... b  (profil (b))
   Ulaz kao mreža P4 (rezultat 10 km pre 14 dana, start 2. 11. 2026). */
import { distOf, type Plan } from "../../final-check/lib.ts";
import { profileB, SCHED, START, weekly } from "../P0/common.ts";
import { timeForVdot } from "../../../../web/src/domain/generators/tenK/v2/testInputs.ts";
const addDays = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const a = process.argv.slice(2);
const input = a[0] === "b" ? profileB("5K") : {
  startDate: START, raceDate: addDays(START, +a[2]! * 7 - 1), runDays: SCHED[+a[0]!], currentWeeklyKm: +a[1]!, goalTimeSec: a[4] ? +a[4] : null,
  recentResult: { distanceM: 10000, timeSec: timeForVdot(+a[3]!, 10000), date: addDays(START, -14) } };
const r = distOf("5K").generate(input);
if (!r.ok) { console.log("ODBIJENO", JSON.stringify(r.reasons)); process.exit(0); }
const p = r.plan as Plan;
const pc = p["paces"] as Record<string, unknown>;
console.log(`ulaz ${JSON.stringify(input)}\ntempo ${JSON.stringify(pc)}`);
console.log(weekly(p));
