/* MAR-09: kopija docs/generators-v2/audit/owner/mar-timecap-example.ts sa potpisom posle ispravke t. 4 (tempo nedelje kao funkcija). */
/* Ugao 4, maraton v2 — jedan ulaz koji reprodukuje razilaženje „plafon trajanja iz tempa nedelje" (konstruktor,
   generate.ctxAt/pacesAt) vs „iz tempa plana" (lengths.longShortOf sa plan.paces; generate.ts:410, validate.ts:688,
   shorter.ts:29). Ispisuje dugi svake nedelje, plafon 150 min tempa nedelje i tempa plana, i šta plan kaže.
   Iz web/: node ../docs/generators-v2/audit/owner/mar-timecap-example.ts */

import { adaptMarathonV2 } from "../../../../web/src/domain/generators/marathon/v2/adapt.ts";
import { generateMarathonV2 } from "../../../../web/src/domain/generators/marathon/v2/generate.ts";
import { checkInput } from "../../../../web/src/domain/generators/marathon/v2/input.ts";
import { longShortOf, longTimeCap10, longShareCap10 } from "../../../../web/src/domain/generators/marathon/v2/lengths.ts";
import { pacesAt } from "../../../../web/src/domain/generators/marathon/v2/steps.ts";
import * as TM from "../../../../web/src/domain/generators/marathon/v2/testInputs.ts";
import type { MarathonV2Plan } from "../../../../web/src/domain/generators/marathon/v2/types.ts";

const input = JSON.parse(process.argv[2] ?? JSON.stringify({
  startDate: "2026-11-07", raceDate: "2027-02-12", runDays: ["thu", "wed", "tue", "sun", "sat"], longRunDay: "sun",
  currentWeeklyKm: 44, recentResult: null, goalTimeSec: 12147, recentLongRunKm: 16.9, easyPaceSecPerKm: 464,
}));
const asOf = process.argv[3] ?? "2026-12-25";
const scen = (process.argv[4] ?? "faster") as (typeof TM.SCENARIOS)[number];
const g = generateMarathonV2(input);
if (!g.ok) throw new Error(JSON.stringify(g.reasons));
const plan = g.plan as MarathonV2Plan;
const r = adaptMarathonV2(plan, TM.factsOf(plan, scen, asOf), asOf);
if (!r.ok) throw new Error(JSON.stringify(r.reasons));
const a = r.plan;
const chk = checkInput(a.input);
if (!chk.ok) throw new Error("input");
const steps = a.adaptation!.steps;
const rows = a.weeks.map((w) => {
  const l = w.days.find((d) => d.role === "long");
  const pw = pacesAt(chk.pace, steps, w.index, chk.input.currentWeeklyKm);
  return {
    w: w.index, phase: w.phase, deload: w.deload, targetKm: w.targetKm,
    longKm: l?.workout.km ?? null,
    capWeek150: longTimeCap10(pw) / 10, capPlan150: longTimeCap10(a.paces) / 10,
    capShare: longShareCap10(Math.round(w.targetKm * 10), chk.rule) / 10,
    Eslow: pw.E.slow,
  };
});
const ls = longShortOf(a.weeks, chk.rule.longShortKm, (w: number) => pacesAt(chk.pace, steps, w, chk.input.currentWeeklyKm));
console.log(JSON.stringify({
  input, asOf, scenario: scen,
  planPacesEslow: a.paces.E.slow,
  longShortOf: ls,
  warning: a.warnings.find((x) => x.rule === "MARATHON_LONG_SHORT")?.message ?? null,
  note150: a.notes.find((n) => n.startsWith("Najduži dugi trk je")) ?? null,
  weeks: rows,
}, null, 1));
