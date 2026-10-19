/* MAR-07 N10.4 (pouka 33): da li u planovima generatora postoji rasterećenje koje nije izvodljivo zbog MINIMUMA LAGANOG
   (lagani < 5 km uz dugi 0,8 × poslednji — slučaj pouke 33) VAN nedelje testa (M16), početnika (M17) i adaptacije
   (A9). Za svako rasterećenje spušteno ispod cilja po pravilu (`fitted`) računa se, na cilju po pravilu, ostatak za
   lagane posle dugog po pravilu (lengths.deloadLengths bez skraćenja): < 5 km po danu = pouka 33; > dugi = drugi uzrok
   (pouka 2: lagan bi bio duži od dugog). Iz korena repoa: node docs/marathon-v2/artifacts/segment-07/deload-feasible.ts */

import { generateMarathonV2 } from "../../../../web/src/domain/generators/marathon/v2/generate.ts";
import { deloadLengths } from "../../../../web/src/domain/generators/marathon/v2/lengths.ts";
import { planRule } from "../../../../web/src/domain/generators/marathon/v2/policy.ts";
import * as T from "../../../../web/src/domain/generators/marathon/v2/testInputs.ts";

const fams: Record<string, () => { id: string; input: Record<string, unknown> }[]> = {
  grid: () => T.gridInputs(),
  feel: () => T.feelInputs(),
  recent: () => T.recentInputs(),
  dense: () => T.denseInputs(),
};
const out: Record<string, unknown> = {};
for (const [fam, all] of Object.entries(fams)) {
  let plans = 0, deloads = 0, fitted = 0, shortened = 0, easyMin = 0, easyOverLong = 0, other = 0, shortenFeasible = 0;
  const ex: string[] = [];
  for (const c of all()) {
    const r = generateMarathonV2(c.input);
    if (!r.ok) continue;
    plans++;
    const p = r.plan;
    const rule = planRule(p.input.runDays.length, p.input.experience ?? "regular")!;
    let lastLong10: number | null = null;
    for (const w of p.weeks) {
      const long = w.days.find((d) => d.role === "long");
      if (w.deload && !w.test) {
        deloads++;
        if (w.notes.some((n) => n.includes("skraćen sa 0,8 ×"))) shortened++;
        if (w.fitted !== null && lastLong10 !== null) {
          fitted++;
          const nom10 = Math.round(w.nominalKm * 10);
          const q100 = w.days.filter((d) => d.workout.kind === "quality").reduce((a, d) => a + Math.round(d.workout.km * 100), 0);
          const nEasy = w.days.filter((d) => d.role === "easy").length;
          const rule10 = Math.min(Math.floor(0.8 * lastLong10 + 1e-9), Math.floor(rule.longMaxShare * nom10 + 1e-9));
          const per100 = (nom10 * 10 - q100 - rule10 * 10) / nEasy;
          if (per100 < 500) easyMin++;
          else if (per100 > rule10 * 10) easyOverLong++;
          else other++;
          if (deloadLengths(nom10, q100, nEasy, lastLong10, rule, p.paces, null, true)) shortenFeasible++;
          if (per100 < 500 && ex.length < 3) ex.push(`${c.id} ned ${w.index}`);
        }
      }
      if (["base", "development", "specific"].includes(w.phase) && !w.deload && long) lastLong10 = Math.round(long.workout.km * 10);
    }
  }
  out[fam] = { plans, deloadsNoTest: deloads, fitted, shortened, fittedEasyBelowMin: easyMin, fittedEasyOverLong: easyOverLong, fittedOther: other, shortenWouldFitAtRule: shortenFeasible, ex };
}
console.log(JSON.stringify(out, null, 1));
