/* Heševi planova 49ad476 (10k-v2.2.0) za regresioni test segmenta 02b. Pokretanje iz korena repoa:
     git worktree add --detach /tmp/wt49 49ad476
     node docs/10k-v2/artifacts/segment-02b/regression-49ad476.ts /tmp/wt49
   Generiše mrežu 02 (3/4/5/6 dana, 15 840 planova) KODOM IZ 49ad476 i upisuje `planHashes49` iz
   trenutnog testInputs.ts (heš celog plana bez oznake verzije, teksta CAPACITY_LIMITED i upozorenja D25;
   heš nedelja bez trkačke; RP deonica < 1000 m) u
   web/src/domain/generators/tenK/v2/segment02b.plan-hashes-49ad476.json, i sažetke primera iz
   inputs.json (summary.ts) u compare-49ad476.json za tabelu poređenja u plans.md. */

import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { planHashes49 } from "../../../../web/src/domain/generators/tenK/v2/testInputs.ts";
import { type ExampleSummary, summarize } from "./summary.ts";

const old = resolve(process.argv[2] ?? "");
const v2 = join(old, "web/src/domain/generators/tenK/v2");
const { generateTenKV2 } = (await import(join(v2, "generate.ts"))) as {
  generateTenKV2: (input: unknown) => unknown;
};
const { grid02Inputs } = (await import(join(v2, "testInputs.ts"))) as {
  grid02Inputs: (
    days: 3 | 4 | 5 | 6,
  ) => { id: string; input: Record<string, unknown> }[];
};
const plans: Record<string, [number, number, number]> = {};
for (const n of [3, 4, 5, 6] as const)
  for (const { id, input } of grid02Inputs(n))
    plans[id] = planHashes49(generateTenKV2(input));
const out = new URL(
  "../../../../web/src/domain/generators/tenK/v2/segment02b.plan-hashes-49ad476.json",
  import.meta.url,
);
writeFileSync(
  out,
  JSON.stringify({
    against: "49ad476",
    count: Object.keys(plans).length,
    plans,
  }) + "\n",
);
console.log(Object.keys(plans).length, "heševa →", out.pathname);

const cases: Record<string, ExampleSummary> = {};
const inputs = JSON.parse(
  readFileSync(new URL("./inputs.json", import.meta.url), "utf8"),
) as { id: string; input: unknown }[];
for (const c of inputs) cases[c.id] = summarize(generateTenKV2(c.input));
const cmp = new URL("./compare-49ad476.json", import.meta.url);
writeFileSync(
  cmp,
  JSON.stringify({ against: "49ad476", cases }, null, 2) + "\n",
);
console.log(Object.keys(cases).length, "primera →", cmp.pathname);
