/* HM v2 Segment 02 — fixture regresije 4 dana: normalizovani heš (testInputs.planHashNorm) svakog plana mreže 01
   generisanog kodom hm-v2.0.0 (3979237). Pokrenuto JEDNOM nad kodom 3979237 (pre izmena segmenta 02):
     node docs/hm-v2/artifacts/segment-02/norm-hashes-3979237.ts
   Upisuje web/src/domain/generators/halfMarathon/v2/segment01.norm-hashes-3979237.json (id mreže 01 → heš). */

import { writeFileSync } from "node:fs";
import { generateHmV2 } from "../../../../web/src/domain/generators/halfMarathon/v2/generate.ts";
import {
  gridInputs,
  planHashNorm,
} from "../../../../web/src/domain/generators/halfMarathon/v2/testInputs.ts";

const out: Record<string, string> = {};
for (const g of gridInputs()) {
  const r = generateHmV2(g.input);
  if (!r.ok) throw new Error(`${g.id} odbijen`);
  out[g.id] = planHashNorm(r.plan);
}
writeFileSync(
  new URL(
    "../../../../web/src/domain/generators/halfMarathon/v2/segment01.norm-hashes-3979237.json",
    import.meta.url,
  ),
  `${JSON.stringify(out, null, 2)}\n`,
);
console.log(Object.keys(out).length);
