/* Heševi planova 53da370 (10k-v2.1.0) za regresioni test segmenta 02. Pokretanje iz korena repoa:
     git worktree add --detach /tmp/wt53 53da370
     node docs/10k-v2/artifacts/segment-02/regression-53da370.ts /tmp/wt53
   Generiše mrežu 01 (4 dana, 10–18 ned, 3024 plana) KODOM IZ 53da370 i upisuje normalizovan heš
   (`planHash` iz trenutnog testInputs.ts: bez oznake verzije i teksta CAPACITY_LIMITED) u
   web/src/domain/generators/tenK/v2/segment02.plan-hashes-53da370.json. */

import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { planHash } from "../../../../web/src/domain/generators/tenK/v2/testInputs.ts";

const old = resolve(process.argv[2] ?? "");
const v2 = join(old, "web/src/domain/generators/tenK/v2");
const { generateTenKV2 } = (await import(join(v2, "generate.ts"))) as {
  generateTenKV2: (input: unknown) => unknown;
};
const { gridInputs } = (await import(join(v2, "testInputs.ts"))) as {
  gridInputs: () => { id: string; input: Record<string, unknown> }[];
};
const hashes: Record<string, number> = {};
for (const { id, input } of gridInputs())
  hashes[`d4-${id}`] = planHash(generateTenKV2(input));
const out = new URL(
  "../../../../web/src/domain/generators/tenK/v2/segment02.plan-hashes-53da370.json",
  import.meta.url,
);
writeFileSync(
  out,
  JSON.stringify({
    against: "53da370",
    count: Object.keys(hashes).length,
    hashes,
  }) + "\n",
);
console.log(Object.keys(hashes).length, "heševa →", out.pathname);
