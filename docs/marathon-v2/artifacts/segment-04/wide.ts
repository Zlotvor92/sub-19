/* Široka pretraga rane i srednje adaptacije (pouka 23, MAR-04): svaki n-ti plan svih mreža (02, 03 po osećaju, 03
   početnik, M13a, gusta ned 1) × asOf sreda i kraj svake nedelje 1 … N − 2 × scenariji mreže E (pauza 10/20,
   bol 5/8, pauza 10 + bol 5, manjak, umor). Po toku: odbijanje (K1) i adaptInvariants.
   Iz korena: node --experimental-strip-types docs/marathon-v2/artifacts/segment-04/wide.ts <n> <k>/<m>
   (deo k od m planova; izlaz JSON na stdout). */

import {
  adaptMarathonV2,
  generateMarathonV2,
} from "../../../../web/src/domain/generators/marathon/v2/index.ts";
import type { MarathonV2Facts } from "../../../../web/src/domain/generators/marathon/v2/index.ts";
import { adaptInvariants } from "../../../../web/src/domain/generators/marathon/v2/adaptInvariants.ts";
import {
  addDays,
  weekdayOf,
} from "../../../../web/src/domain/generators/marathon/v2/dates.ts";
import {
  beginnerInputs,
  denseInputs,
  EARLY_SCENARIOS,
  earlyFacts,
  feelInputs,
  gridInputs,
  recentInputs,
} from "../../../../web/src/domain/generators/marathon/v2/testInputs.ts";

const n = Number(process.argv[2] ?? "50");
const [k, m] = (process.argv[3] ?? "1/1").split("/").map(Number) as [
  number,
  number,
];
const every = <X>(xs: readonly X[], s: number): X[] =>
  xs.filter((_, i) => i % s === 0);
const all = [
  ...every(gridInputs(), n),
  ...every(feelInputs(), n),
  ...every(beginnerInputs(), n),
  ...every(recentInputs(), n),
  ...every(denseInputs(), n * 10),
];
const bases = all.filter((_, i) => i % m === k - 1);
const t0 = Date.now();
let plans = 0;
let flows = 0;
let skipped = 0;
const rejected: string[] = [];
const bad: string[] = [];
const byClass: Record<string, number> = {};
const badClass: Record<string, number> = {};
for (const b of bases) {
  const g = generateMarathonV2(b.input);
  if (!g.ok) {
    skipped++;
    continue;
  }
  plans++;
  const p = g.plan;
  const N = p.weeks.length;
  for (let i = 1; i <= N - 2; i++) {
    const w = p.weeks[i - 1]!;
    let wed = w.startDate;
    while (weekdayOf(wed) !== "wed") wed = addDays(wed, 1);
    for (const asOf of [wed, w.endDate])
      for (const s of EARLY_SCENARIOS) {
        flows++;
        const facts = earlyFacts(p, s, asOf);
        const r = adaptMarathonV2(p, facts, asOf);
        if (!r.ok) {
          const cls = r.reasons
            .map((x) => x.message.split(":")[0]!.replace(/\d+/g, "#"))
            .join(",");
          byClass[cls] = (byClass[cls] ?? 0) + 1;
          if (rejected.length < 50)
            rejected.push(
              `${b.id}/${asOf}/${s}: ${r.reasons
                .map((x) => x.message)
                .join(" | ")
                .slice(0, 300)}`,
            );
          continue;
        }
        const inv = adaptInvariants(p, r.plan, asOf, facts as MarathonV2Facts);
        if (inv.length) {
          for (const x of inv) {
            const c = x.replace(/[\d-]+/g, "#");
            badClass[c] = (badClass[c] ?? 0) + 1;
          }
          if (bad.length < 50)
            bad.push(`${b.id}/${asOf}/${s}: ${inv.join("; ")}`);
        }
      }
  }
}
console.log(
  JSON.stringify(
    {
      n,
      part: `${k}/${m}`,
      plans,
      skipped,
      flows,
      rejected: Object.values(byClass).reduce((a, x) => a + x, 0),
      byClass,
      badClass,
      sec: (Date.now() - t0) / 1000,
      rejectedEx: rejected,
      badEx: bad,
    },
    null,
    1,
  ),
);
