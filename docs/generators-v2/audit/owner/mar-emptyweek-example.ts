/* Ugao 4, maraton v2 — jedini neuspeh adaptacije u mar-adapt-search (150 planova, seed 4004): EMPTY_WEEK iz construct.
   Iz web/: node ../docs/generators-v2/audit/owner/mar-emptyweek-example.ts */
import { adaptMarathonV2 } from "../../../../web/src/domain/generators/marathon/v2/adapt.ts";
import { generateMarathonV2 } from "../../../../web/src/domain/generators/marathon/v2/generate.ts";
import * as TM from "../../../../web/src/domain/generators/marathon/v2/testInputs.ts";
import type { MarathonV2Plan } from "../../../../web/src/domain/generators/marathon/v2/types.ts";
const input = { startDate: "2026-11-05", raceDate: "2027-03-10", runDays: ["thu", "fri", "sat"], longRunDay: "sat", currentWeeklyKm: 33, recentResult: null, goalTimeSec: 10071, easyPaceSecPerKm: 375 };
const asOf = "2027-02-24";
const g = generateMarathonV2(input);
if (!g.ok) throw new Error("gen");
const p = g.plan as MarathonV2Plan;
const f = TM.factsOf(p, "pain8", asOf);
const r = adaptMarathonV2(p, f, asOf);
console.log(JSON.stringify({ N: p.weeks.length, weeks: p.weeks.slice(-3).map((w) => ({ i: w.index, phase: w.phase, start: w.startDate, end: w.endDate, days: w.days.map((d) => `${d.role}@${d.date}`) })), facts: f, result: r.ok ? "ok" : r.reasons }, null, 1));
