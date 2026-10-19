/* Mreža 04 (MASTER § 3, M18): 30 baznih planova × asOf (ned 1 sreda i kraj, kraj ned 2, sredina, pre testa /
   rasterećenja / N−2 / N−1, sreda N−2) × 17 scenarija, bol 5 i 8 u svakom danu nedelje asOf-a. Po toku: odbijanje
   (K1), adaptInvariants. Pokretanje iz korena: node --experimental-strip-types docs/marathon-v2/artifacts/segment-04/grid04.ts [k/m]
   (deo k od m baznih planova; bez argumenta svi). Izlaz: JSON na stdout. */

import {
  adaptMarathonV2,
  generateMarathonV2,
} from "../../../../web/src/domain/generators/marathon/v2/index.ts";
import type {
  MarathonV2Facts,
  MarathonV2Plan,
} from "../../../../web/src/domain/generators/marathon/v2/index.ts";
import { adaptInvariants } from "../../../../web/src/domain/generators/marathon/v2/adaptInvariants.ts";
import { addDays } from "../../../../web/src/domain/generators/marathon/v2/dates.ts";
import {
  adaptBases,
  adaptCases,
  chainFacts,
  factsOf,
} from "../../../../web/src/domain/generators/marathon/v2/testInputs.ts";

const [k, m] = (process.argv[2] ?? "1/1").split("/").map(Number) as [
  number,
  number,
];
const bases = adaptBases().filter((_, i) => i % m === k - 1);
const t0 = Date.now();
let flows = 0;
const rejected: string[] = [];
const bad: string[] = [];
const byRule: Record<string, number> = {};
for (const b of bases) {
  const g = generateMarathonV2(b.input);
  if (!g.ok) throw new Error(b.id);
  const p0 = g.plan;
  for (const c of adaptCases(b.id, p0)) {
    flows++;
    const f = factsOf(p0, c.s, c.asOf);
    let r = adaptMarathonV2(p0, f, c.asOf);
    let before: MarathonV2Plan = p0;
    let at = c.asOf;
    let ff = f;
    if (r.ok && c.s === "chain") {
      before = r.plan;
      at = addDays(c.asOf, 7);
      ff = chainFacts(r.plan, at);
      r = adaptMarathonV2(r.plan, ff, at);
    }
    if (!r.ok) {
      const rules = [
        ...new Set(
          r.violations.filter((v) => v.severity === "error").map((v) => v.rule),
        ),
      ];
      for (const x of rules.length ? rules : r.reasons.map((x) => x.code))
        byRule[x] = (byRule[x] ?? 0) + 1;
      rejected.push(
        `${c.key}@${c.asOf}: ${r.reasons.map((x) => x.code).join(",")} ${rules.join(",")} ${JSON.stringify(r.violations.filter((v) => v.severity === "error").slice(0, 2))} ${r.reasons[0]?.message.slice(0, 200)}`,
      );
      continue;
    }
    const inv = adaptInvariants(before, r.plan, at, ff as MarathonV2Facts);
    if (inv.length) bad.push(`${c.key}@${c.asOf}: ${inv.join("; ")}`);
  }
}
console.log(
  JSON.stringify(
    {
      flows,
      rejected: rejected.length,
      bad: bad.length,
      byRule,
      sec: (Date.now() - t0) / 1000,
      rejectedEx: rejected.slice(0, 40),
      badEx: bad.slice(0, 40),
    },
    null,
    1,
  ),
);
