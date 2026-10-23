/* Heševi planova b13ca17 (10k-v2.3.1) za regresioni test segmenta 04 (generate = construct(input, [])
   bajt-isto). Pokretanje iz korena repoa:
     git worktree add --detach /tmp/wt-b13 b13ca17
     ln -s "$PWD/web/node_modules" /tmp/wt-b13/web/node_modules
     node docs/10k-v2/artifacts/segment-04/regression-b13ca17.ts /tmp/wt-b13
   Generiše mrežu sa rezultatom (15 840), po osećaju (11 880) i početnika (3402) KODOM IZ b13ca17 i
   upisuje heš celog rezultata bez oznake verzije (`planHash81`, isti kod u testInputs.ts) u
   web/src/domain/generators/tenK/v2/segment04.plan-hashes-b13ca17.json (posle toga prettier --write). */

import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const old = resolve(process.argv[2] ?? "");
const v2 = join(old, "web/src/domain/generators/tenK/v2");
const { generateTenKV2 } = (await import(join(v2, "generate.ts"))) as {
  generateTenKV2: (input: unknown) => unknown;
};
type Grid = (days: 3 | 4 | 5 | 6) => { id: string; input: unknown }[];
const { grid02Inputs, feelGridInputs, beginnerGridInputs, planHash81 } =
  (await import(join(v2, "testInputs.ts"))) as {
    grid02Inputs: Grid;
    feelGridInputs: Grid;
    beginnerGridInputs: Grid;
    planHash81: (r: unknown) => number;
  };
const hashes = (
  grid: Grid,
  days: readonly (3 | 4 | 5 | 6)[],
): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const n of days)
    for (const { id, input } of grid(n))
      out[id] = planHash81(generateTenKV2(input));
  return out;
};
const result = hashes(grid02Inputs, [3, 4, 5, 6]);
const feel = hashes(feelGridInputs, [3, 4, 5, 6]);
const beginner = hashes(beginnerGridInputs, [3, 4]);
const out = new URL(
  "../../../../web/src/domain/generators/tenK/v2/segment04.plan-hashes-b13ca17.json",
  import.meta.url,
);
writeFileSync(
  out,
  JSON.stringify({
    against: "b13ca17",
    count: {
      result: Object.keys(result).length,
      feel: Object.keys(feel).length,
      beginner: Object.keys(beginner).length,
    },
    result,
    feel,
    beginner,
  }) + "\n",
);
console.log(
  Object.keys(result).length +
    Object.keys(feel).length +
    Object.keys(beginner).length,
  "heševa →",
  out.pathname,
);
