/* Regresija 4 dana prema MAR-01 (e86d2c3): heš normalizovanog plana (testInputs.normalizedHash) iz koda MAR-01
   za svaki ulaz mreže 01 + spiskovi planova koje u marathon-v2.1.0 menja piramida M10a i plafon skoka dugog M13a. Pokretanje iz korena repoa:
     git worktree add /tmp/mar01 e86d2c3
     node --experimental-strip-types docs/marathon-v2/artifacts/segment-02/regression-01.ts /tmp/mar01
   → web/src/domain/generators/marathon/v2/segment02.regression-01.json (pa `npx prettier --write`). */

import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { generateMarathonV2 } from "../../../../web/src/domain/generators/marathon/v2/generate.ts";
import {
  gridInputs,
  hasPyramid,
  normalizedHash,
} from "../../../../web/src/domain/generators/marathon/v2/testInputs.ts";
import type { MarathonV2Plan } from "../../../../web/src/domain/generators/marathon/v2/types.ts";

const oldRoot = resolve(process.argv[2] ?? "");
const V2 = "web/src/domain/generators/marathon/v2";
const oldGen = (await import(join(oldRoot, V2, "generate.ts"))) as {
  generateMarathonV2: (raw: unknown) => { ok: boolean; plan?: MarathonV2Plan };
};

const hashes: Record<string, string> = {};
const pyramid: string[] = [];
const jump: string[] = [];
for (const g of gridInputs(4)) {
  const id = g.id.replace(/^d4-/, "");
  const o = oldGen.generateMarathonV2(g.input);
  if (!o.ok || !o.plan) throw new Error(`MAR-01 odbija ${id}`);
  hashes[id] = normalizedHash(o.plan);
  const n = generateMarathonV2(g.input);
  if (!n.ok) throw new Error(`marathon-v2.1.0 odbija ${id}`);
  if (hasPyramid(n.plan)) pyramid.push(id);
  else if (
    n.plan.weeks.some((w) => w.notes.some((x) => x.includes("plafon skoka")))
  )
    jump.push(id);
}
const out = join(V2, "segment02.regression-01.json");
writeFileSync(
  out,
  `${JSON.stringify({ base: "e86d2c3", hashes, pyramid, jump }, null, 0)}\n`,
);
console.log(
  `${out}: ${Object.keys(hashes).length} heševa, piramida ${pyramid.length}, skok ${jump.length}`,
);
