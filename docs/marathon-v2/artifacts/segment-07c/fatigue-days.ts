// MAR-07c (pouka 23, 36): plan po osećaju (feelInputs) i početnik × umor (factsOf 'fatigue'), asOf SVAKI dan nedelja
// 1 … N − 3 → broj odbijanja (cilj 0). Iz web/: node ../docs/marathon-v2/artifacts/segment-07c/fatigue-days.ts <deo> <delova> [korak]
import { adaptMarathonV2 } from "../../../../web/src/domain/generators/marathon/v2/adapt.ts";
import { addDays } from "../../../../web/src/domain/generators/marathon/v2/dates.ts";
import { generateMarathonV2 } from "../../../../web/src/domain/generators/marathon/v2/generate.ts";
import {
  beginnerInputs,
  factsOf,
  feelInputs,
} from "../../../../web/src/domain/generators/marathon/v2/testInputs.ts";

const part = Number(process.argv[2] ?? 0);
const parts = Number(process.argv[3] ?? 1);
const stride = Number(process.argv[4] ?? 1);
const all = [...feelInputs(), ...beginnerInputs()].filter(
  (_, i) => i % stride === 0,
);
let flows = 0;
let monday = 0;
const rej: Record<string, number> = {};
const ex: string[] = [];
for (const [i, c] of all.entries()) {
  if (i % parts !== part) continue;
  const g = generateMarathonV2(c.input);
  if (!g.ok) continue;
  const p = g.plan;
  const N = p.weeks.length;
  for (let k = 0; k < N - 3; k++)
    for (let d = 0; d < 7; d++) {
      const at = addDays(p.weeks[k]!.startDate, d);
      const r = adaptMarathonV2(p, factsOf(p, "fatigue", at) as never, at);
      flows++;
      if (d === 0) monday++;
      if (!r.ok) {
        const m = (r.reasons[0]?.message ?? "").slice(0, 90);
        rej[m] = (rej[m] ?? 0) + 1;
        if (ex.length < 5) ex.push(`${c.id} ${at}`);
      }
    }
}
console.log(
  JSON.stringify({
    part,
    parts,
    stride,
    plans: all.length,
    flows,
    monday,
    rejected: rej,
    examples: ex,
  }),
);
