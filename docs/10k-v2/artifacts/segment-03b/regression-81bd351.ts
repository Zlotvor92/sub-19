/* Heševi planova 81bd351 (10k-v2.3.0) za regresioni test segmenta 03b. Pokretanje iz korena repoa:
     git worktree add --detach /tmp/wt81 81bd351
     ln -s "$PWD/web/node_modules" /tmp/wt81/web/node_modules
     node docs/10k-v2/artifacts/segment-03b/regression-81bd351.ts /tmp/wt81
   Generiše mrežu sa rezultatom (15 840) i mrežu po osećaju (11 880) KODOM IZ 81bd351 i upisuje
   `planHash81` iz trenutnog testInputs.ts (heš celog rezultata bez oznake verzije) u
   web/src/domain/generators/tenK/v2/segment03b.plan-hashes-81bd351.json, i sažetke primera (cases.ts,
   summary.ts) u compare-81bd351.json za tabelu poređenja 03 → 03b u plans.md. */

import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { planHash81 } from "../../../../web/src/domain/generators/tenK/v2/testInputs.ts";
import { CASES } from "./cases.ts";
import { summarize } from "./summary.ts";

const old = resolve(process.argv[2] ?? "");
const v2 = join(old, "web/src/domain/generators/tenK/v2");
const { generateTenKV2 } = (await import(join(v2, "generate.ts"))) as {
  generateTenKV2: (input: unknown) => unknown;
};
type Grid = (days: 3 | 4 | 5 | 6) => { id: string; input: unknown }[];
const { grid02Inputs, feelGridInputs } = (await import(
  join(v2, "testInputs.ts")
)) as { grid02Inputs: Grid; feelGridInputs: Grid };
const hashes = (grid: Grid): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const n of [3, 4, 5, 6] as const)
    for (const { id, input } of grid(n))
      out[id] = planHash81(generateTenKV2(input));
  return out;
};
const result = hashes(grid02Inputs);
const feel = hashes(feelGridInputs);
const out = new URL(
  "../../../../web/src/domain/generators/tenK/v2/segment03b.plan-hashes-81bd351.json",
  import.meta.url,
);
writeFileSync(
  out,
  JSON.stringify({
    against: "81bd351",
    count: {
      result: Object.keys(result).length,
      feel: Object.keys(feel).length,
    },
    result,
    feel,
  }) + "\n",
);
console.log(
  Object.keys(result).length + Object.keys(feel).length,
  "heševa →",
  out.pathname,
);

const cases = Object.fromEntries(
  CASES.map((c) => [c.id, summarize(generateTenKV2(c.input))]),
);
const cmp = new URL("./compare-81bd351.json", import.meta.url);
writeFileSync(
  cmp,
  JSON.stringify({ against: "81bd351", cases }, null, 2) + "\n",
);
console.log(Object.keys(cases).length, "primera →", cmp.pathname);
