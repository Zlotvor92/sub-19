/* HM v2 Segment 04 — mreža 04 (MASTER § 3): 33 bazna plana × asOf (§ 3) × 17 scenarija (+ drugi korak lanca)
   + bol 5 i 8 na svaki dan nedelje 2 i nedelje sredine plana. Broji odbijanja po klasi, greške validatora,
   prekršaje adaptInvariants. Pokretanje iz korena repoa:
     node docs/hm-v2/artifacts/segment-04/grid04.ts [izlaz.json] */

import { writeFileSync } from "node:fs";
import { adaptHmV2 } from "../../../../web/src/domain/generators/halfMarathon/v2/adapt.ts";
import { adaptInvariants } from "../../../../web/src/domain/generators/halfMarathon/v2/adaptInvariants.ts";
import {
  adaptBases,
  asOfs04,
  chainSecond,
  factsOf,
  painFacts,
  SCENARIOS,
} from "../../../../web/src/domain/generators/halfMarathon/v2/adaptInputs.ts";
import { addDays } from "../../../../web/src/domain/generators/halfMarathon/v2/dates.ts";
import { generateHmV2 } from "../../../../web/src/domain/generators/halfMarathon/v2/generate.ts";
import type { HmV2Plan } from "../../../../web/src/domain/generators/halfMarathon/v2/types.ts";

const t0 = Date.now();
const out = {
  flows: 0,
  rejected: {} as Record<string, number>,
  examples: {} as Record<string, string>,
  invariants: {} as Record<string, number>,
  invExamples: {} as Record<string, string>,
  applied: {} as Record<string, Record<string, number>>,
  mixed: 0,
};
const add = (o: Record<string, number>, k: string) => (o[k] = (o[k] ?? 0) + 1);

/** Jedan tok adaptacije: odbijanje po klasi ili prekršaji invarijanti; vraća adaptiran plan. */
function flow(
  pl: HmV2Plan,
  f: Record<string, unknown>,
  at: string,
  key: string,
  scen: string,
): HmV2Plan | null {
  out.flows++;
  const r = adaptHmV2(pl, f, at);
  if (!r.ok) {
    for (const x of r.reasons) {
      const k =
        x.code === "PLAN_VIOLATES_POLICY"
          ? [
              ...new Set(
                r.violations
                  .filter((v) => v.severity === "error")
                  .map((v) => v.rule),
              ),
            ].join("+")
          : x.code;
      add(out.rejected, k);
      out.examples[k] ??= `${key}: ${x.message} ${r.violations
        .filter((v) => v.severity === "error")
        .slice(0, 3)
        .map((v) => `${v.rule} ned ${v.week}: ${v.message}`)
        .join(" | ")}`;
    }
    return null;
  }
  for (const x of r.reasons)
    if (x.applied)
      (out.applied[scen] ??= {})[x.condition] =
        (out.applied[scen][x.condition] ?? 0) + 1;
  if (r.plan.adaptation!.mixedWeeks.length > 0) out.mixed++;
  for (const v of adaptInvariants(pl, r.plan, at, f as never)) {
    const k = v.replace(/[0-9-]+/g, "#");
    add(out.invariants, k);
    out.invExamples[k] ??= `${key}: ${v}`;
  }
  return r.plan;
}

for (const b of adaptBases()) {
  const g = generateHmV2(b.input);
  if (!g.ok) throw new Error(`${b.id}: ${JSON.stringify(g.reasons)}`);
  const plan = g.plan as HmV2Plan;
  for (const a of asOfs04(plan))
    for (const s of SCENARIOS) {
      const key = `${b.id}/${a.tag}/${s}`;
      const p1 = flow(plan, factsOf(plan, s, a.asOf), a.asOf, key, s);
      if (s === "chain" && p1) {
        const at2 = addDays(a.asOf, 7);
        if (at2 < plan.input.raceDate)
          flow(p1, chainSecond(plan, at2), at2, `${key}/2`, "chain2");
      }
    }
  // Bol 5 i 8 na svaki dan u nedelji (MASTER § 3): svaki dan nedelje 2 i nedelje sredine plana.
  const mid = Math.ceil(plan.weeks.length / 2);
  for (const wi of [...new Set([2, mid])])
    for (let k = 0; k < 7; k++) {
      const at = addDays(plan.weeks[wi - 1]!.startDate, k);
      for (const level of [5, 8])
        flow(
          plan,
          painFacts(at, level),
          at,
          `${b.id}/w${wi}d${k}/pain${level}`,
          `painDay${level}`,
        );
    }
}
const res = { ...out, seconds: (Date.now() - t0) / 1000 };
if (process.argv[2])
  writeFileSync(process.argv[2], JSON.stringify(res, null, 1));
console.log(
  JSON.stringify(
    {
      flows: res.flows,
      rejected: res.rejected,
      examples: res.examples,
      invariants: res.invariants,
      invExamples: res.invExamples,
      mixed: res.mixed,
      seconds: res.seconds,
    },
    null,
    1,
  ),
);
