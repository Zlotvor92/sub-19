/* Segment 06e: heševi tokova mreže E sa asOf pre starta (testInputs.earlyFlows, redni broj ≥ EARLY_06D) na zadatom
   checkoutu (pre izmene: git worktree bd07eec, `ln -s "$PWD/node_modules" <wt>/web/node_modules`). Tokovi i
   činjenice iz OVOG repozitorijuma (testInputs), adaptacija iz checkouta. Pokretanje iz web/:
     node ../docs/10k-v2/artifacts/segment-06e/prestart-hashes-06e.ts <koren checkouta> <sha>
   → src/domain/generators/tenK/v2/segment06e.prestart-hashes-<sha>.json ({against, flows, rejected, hashes}; 0 = odbijen). */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [root, sha] = process.argv.slice(2);
const HERE = new URL(
  "../../../../web/src/domain/generators/tenK/v2/",
  import.meta.url,
).href;
const O = `${resolve(root!)}/web/src/domain/generators/tenK/v2/`;
const T = await import(HERE + "testInputs.ts");
const { generateTenKV2 } = await import(O + "generate.ts");
const { adaptTenKV2 } = await import(O + "adapt.ts");
const plans = new Map<string, any>();
const planOf = (b: any) => {
  if (!plans.has(b.id)) plans.set(b.id, generateTenKV2(b.input).plan);
  return plans.get(b.id);
};
const flows = T.earlyFlows(planOf).filter((f: any) => f.n >= T.EARLY_06D);
const hashes = flows.map((f: any) => {
  const p0 = planOf(f.base);
  const r = adaptTenKV2(p0, T.earlyFacts(p0, f.s, f.asOf), f.asOf);
  return r.ok ? T.planHash06c(r) : 0;
});
const rejected: Record<string, number> = {};
flows.forEach((f: any, i: number) => {
  if (hashes[i] === 0) rejected[f.s] = (rejected[f.s] ?? 0) + 1;
});
writeFileSync(
  new URL(`segment06e.prestart-hashes-${sha}.json`, HERE),
  JSON.stringify({ against: sha, flows: flows.length, rejected, hashes }) +
    "\n",
);
console.log(flows.length, "tokova; odbijeno na", sha, rejected);
