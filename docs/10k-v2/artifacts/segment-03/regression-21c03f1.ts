/* Heševi planova 21c03f1 (10k-v2.2.1) za regresioni test segmenta 03. Pokretanje iz korena repoa:
     git worktree add --detach /tmp/wt21 21c03f1
     ln -s "$PWD/web/node_modules" /tmp/wt21/web/node_modules
     node docs/10k-v2/artifacts/segment-03/regression-21c03f1.ts /tmp/wt21
   Generiše mrežu 02 (3/4/5/6 dana, 15 840 planova sa rezultatom) KODOM IZ 21c03f1 i upisuje
   `planHashes21` iz trenutnog testInputs.ts (heš celog plana bez oznake verzije i bez novih polja
   10k-v2.3.0 sa podrazumevanom vrednošću; isti heš bez upozorenja RACE_WEEK_SHORT) i oznaku da je stari
   plan imao RACE_WEEK_SHORT u web/src/domain/generators/tenK/v2/segment03.plan-hashes-21c03f1.json. */

import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { planHashes21 } from "../../../../web/src/domain/generators/tenK/v2/testInputs.ts";

const old = resolve(process.argv[2] ?? "");
const v2 = join(old, "web/src/domain/generators/tenK/v2");
const { generateTenKV2 } = (await import(join(v2, "generate.ts"))) as {
  generateTenKV2: (input: unknown) => {
    ok: boolean;
    plan?: { warnings: { rule: string }[] };
  };
};
const { grid02Inputs } = (await import(join(v2, "testInputs.ts"))) as {
  grid02Inputs: (
    days: 3 | 4 | 5 | 6,
  ) => { id: string; input: Record<string, unknown> }[];
};
const plans: Record<string, [number, number, number]> = {};
for (const n of [3, 4, 5, 6] as const)
  for (const { id, input } of grid02Inputs(n)) {
    const r = generateTenKV2(input);
    const rws = r.plan?.warnings.some((w) => w.rule === "RACE_WEEK_SHORT");
    plans[id] = [...planHashes21(r), rws ? 1 : 0];
  }
const out = new URL(
  "../../../../web/src/domain/generators/tenK/v2/segment03.plan-hashes-21c03f1.json",
  import.meta.url,
);
writeFileSync(
  out,
  JSON.stringify({
    against: "21c03f1",
    count: Object.keys(plans).length,
    plans,
  }) + "\n",
);
console.log(Object.keys(plans).length, "heševa →", out.pathname);
