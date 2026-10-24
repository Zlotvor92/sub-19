/* Ugao 4, maraton v2 — CAPACITY_LIMITED (volume.capacityWeeks/capacityLimits, generate.ts:405-408, validate.ts:1309-1320)
   računa plafon dugog (150 min i M13 longCap10) iz tempa PLANA (plan.paces), a konstruktor je nedelju gradio sa tempom
   NEDELJE (pacesAt). Poredi ishod (skup nedelja kapaciteta i 'time'/'share' u poruci) sa istom računicom po tempu
   nedelje. Isti tokovi kao mar-adapt-search (seed, asOf, scenariji), samo uspešne adaptacije.
   Iz web/: node ../docs/generators-v2/audit/owner/mar-capacity-pace.ts <broj planova> [seed] */

import { adaptMarathonV2 } from "../../../../web/src/domain/generators/marathon/v2/adapt.ts";
import { generateMarathonV2 } from "../../../../web/src/domain/generators/marathon/v2/generate.ts";
import { checkInput } from "../../../../web/src/domain/generators/marathon/v2/input.ts";
import { longCap10, longJumpCap10, longShareCap10, longTimeCap10 } from "../../../../web/src/domain/generators/marathon/v2/lengths.ts";
import { isBuildPhase } from "../../../../web/src/domain/generators/marathon/v2/periodize.ts";
import { jumpRecentKm, pacesAt } from "../../../../web/src/domain/generators/marathon/v2/steps.ts";
import { capacityLimits, capacityWeeks } from "../../../../web/src/domain/generators/marathon/v2/volume.ts";
import * as TM from "../../../../web/src/domain/generators/marathon/v2/testInputs.ts";
import type { MarathonV2Plan, Paces, PlanWeek } from "../../../../web/src/domain/generators/marathon/v2/types.ts";
import { randomInput } from "./mar-gen-search.ts";

const NB = Number(process.argv[2] ?? 60);
const SEED = Number(process.argv[3] ?? 4004);
const to10 = (x: number) => Math.round(x * 10);
const res10 = (asOf: string, vdot: number) => ({
  results: [{ distM: 10000, sec: TM.timeForVdot(Math.max(30, Math.min(80, vdot)), 10000), date: asOf, kind: "race" }],
});
/** Kopija volume.ts:79-115 sa tempom nedelje `pw(i)` umesto jednog `p`. */
function perWeek(weeks: readonly PlanWeek[], rule: Parameters<typeof longCap10>[1], pw: (i: number) => Paces, recent: number | null) {
  const longs10 = weeks.map((w) => { const l = w.days.find((d) => d.role === "long"); return l ? to10(l.workout.km) : null; });
  const cw = weeks.filter((w, i) => {
    if (!isBuildPhase(w.phase) || w.deload || w.fitted !== "down") return false;
    const jump = longJumpCap10(longs10.slice(0, i), w.index, recent);
    const l = longs10[i];
    return !(jump !== null && l === jump && jump < longCap10(to10(w.targetKm), rule, pw(w.index)));
  });
  let time = false, share = false;
  for (const w of cw) {
    const l = w.days.find((d) => d.role === "long"); if (!l) continue;
    if (to10(l.workout.km) === longTimeCap10(pw(w.index))) time = true;
    if (to10(l.workout.km) === longShareCap10(to10(w.targetKm), rule)) share = true;
  }
  return { weeks: cw.map((w) => w.index), limits: [...(time ? ["time"] : []), ...(share ? ["share"] : [])] };
}

let bases = 0, flows = 0, ok = 0, limited = 0;
const diff: Record<string, { n: number; ex: string }> = {};
for (let i = 0; bases < NB && i < NB * 20; i++) {
  const inp = randomInput();
  const g = generateMarathonV2(inp);
  if (!g.ok) continue;
  bases++;
  const plan = g.plan as MarathonV2Plan;
  const scen: [string, (a: string) => Record<string, unknown>][] = [
    ...TM.SCENARIOS.map((s) => [s, (a: string) => TM.factsOf(plan, s, a)] as [string, (a: string) => Record<string, unknown>]),
    ["slower4", (a) => res10(a, Math.round((plan.vdot! - 4) * 10) / 10)],
    ["faster4", (a) => res10(a, Math.round((plan.vdot! + 4) * 10) / 10)],
  ];
  for (const { tag, asOf } of TM.adaptAsOfs(plan))
    for (const [s, f] of scen) {
      if (plan.vdot === null && /faster|slower/.test(s)) continue;
      flows++;
      const r = adaptMarathonV2(plan, f(asOf), asOf);
      if (!r.ok) continue;
      ok++;
      const a = r.plan;
      const chk = checkInput(a.input);
      if (!chk.ok) continue;
      const steps = a.adaptation!.steps;
      const recentJ = jumpRecentKm(a.input.recentLongRunKm, steps);
      const planW = capacityWeeks(a.weeks, chk.rule, a.paces, recentJ).map((w) => w.index);
      const planL = capacityLimits(a.weeks, chk.rule, a.paces, recentJ);
      const pw = (w: number) => pacesAt(chk.pace, steps, w, chk.input.currentWeeklyKm);
      const own = perWeek(a.weeks, chk.rule, pw, recentJ);
      if (planW.length > 0 || own.weeks.length > 0) limited++;
      const k =
        JSON.stringify(planW) !== JSON.stringify(own.weeks) ? (planW.length > 0) !== (own.weeks.length > 0) ? "poruka postoji/ne postoji drukčije" : "isti ishod poruke, drugi skup nedelja"
        : JSON.stringify(planL) !== JSON.stringify(own.limits) ? `ograničenje u poruci: plan ${planL.join("+") || "—"} vs nedelja ${own.limits.join("+") || "—"}`
        : null;
      if (k) {
        diff[k] ??= { n: 0, ex: `base#${bases - 1} ${tag} ${s} asOf=${asOf} input=${JSON.stringify(inp)}` };
        diff[k].n++;
      }
    }
}
console.log(JSON.stringify({ seed: SEED, bases, flows, ok, capacityLimitedPlans: limited, diff }, null, 1));
