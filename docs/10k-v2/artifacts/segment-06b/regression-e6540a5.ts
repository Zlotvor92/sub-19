/* Heševi izlaza adaptacije e6540a5 (10k-v2.4.0) za regresiju segmenta 06b (10k-v2.4.1: menjaju se SAMO
   tokovi sa primenjenim PAIN). Pokretanje iz korena repoa:
     git worktree add --detach /tmp/wt-e65 e6540a5
     ln -s "$PWD/web/node_modules" /tmp/wt-e65/web/node_modules
     node docs/10k-v2/artifacts/segment-06b/regression-e6540a5.ts /tmp/wt-e65
   Generiše bazne planove i adaptira ih KODOM IZ e6540a5 (generateTenKV2, adaptTenKV2):
   - mreža 04: 30 planova × 4 asOf × 17 scenarija = 2040 (adaptBases, asOfOf, factsOf, runsIn iz e6540a5;
     lanac = drugi korak, isto kao adapt.node.test.ts chainFacts);
   - mreža bola P: 336 tokova (PAIN_GRID, painGridBases, painCases, painFacts iz OVOG stabla — mreža P na
     e6540a5 ne postoji; definicija je samo ulaz, kod koji se meri je iz e6540a5).
   Heš = planHash81 (ceo rezultat adaptacije — plan, changes, reasons — bez oznake verzije). Upisuje
   web/src/domain/generators/tenK/v2/segment06b.adapt-hashes-e6540a5.json (posle toga prettier --write). */

import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const old = resolve(process.argv[2] ?? "");
const v2 = join(old, "web/src/domain/generators/tenK/v2");
type Result = { ok: boolean; plan?: unknown };
const { generateTenKV2 } = (await import(join(v2, "generate.ts"))) as {
  generateTenKV2: (input: unknown) => Result & { plan: Plan };
};
const { adaptTenKV2 } = (await import(join(v2, "adapt.ts"))) as {
  adaptTenKV2: (
    plan: unknown,
    facts: unknown,
    asOf: string,
  ) => Result & { plan: Plan };
};
const { addDays } = (await import(join(v2, "dates.ts"))) as {
  addDays: (d: string, n: number) => string;
};
interface Plan {
  weeks: { startDate: string }[];
}
const t = (await import(join(v2, "testInputs.ts"))) as {
  adaptBases: () => { id: string; input: unknown }[];
  AS_OF_KINDS: readonly string[];
  SCENARIOS: readonly string[];
  asOfOf: (p: Plan, k: string) => string;
  factsOf: (p: Plan, s: string, asOf: string) => unknown;
  runsIn: (p: Plan, from: string, to: string, share?: number) => unknown[];
  planHash81: (r: unknown) => number;
};
const cur = (await import(
  new URL(
    "../../../../web/src/domain/generators/tenK/v2/testInputs.ts",
    import.meta.url,
  ).href
)) as {
  painGridBases: () => { id: string; input: unknown }[];
  painCases: (
    id: string,
    p: Plan,
  ) => { key: string; asOf: string; level: number }[];
  painFacts: (asOf: string, level: number) => unknown;
};

const gen = (input: unknown): Plan => {
  const r = generateTenKV2(input);
  if (!r.ok) throw new Error(JSON.stringify(r).slice(0, 500));
  return r.plan;
};
const chainFacts = (p: Plan, a2: string): unknown => ({
  workouts: [
    ...t.runsIn(p, addDays(a2, -13), addDays(a2, -7)),
    ...t.runsIn(p, addDays(a2, -6), a2, 0.5),
  ],
  coverage: { from: addDays(a2, -13), to: a2, complete: true },
});

const grid04: Record<string, number> = {};
for (const b of t.adaptBases()) {
  const p0 = gen(b.input);
  for (const k of t.AS_OF_KINDS)
    for (const s of t.SCENARIOS) {
      const asOf = t.asOfOf(p0, k);
      let r = adaptTenKV2(p0, t.factsOf(p0, s, asOf), asOf);
      if (r.ok && s === "chain") {
        const a2 = addDays(asOf, 7);
        r = adaptTenKV2(r.plan, chainFacts(r.plan, a2), a2);
      }
      grid04[`${b.id}/${k}/${s}`] = t.planHash81(r);
    }
}
const gridP: Record<string, number> = {};
for (const b of cur.painGridBases()) {
  const p0 = gen(b.input);
  for (const c of cur.painCases(b.id, p0))
    gridP[c.key] = t.planHash81(
      adaptTenKV2(p0, cur.painFacts(c.asOf, c.level), c.asOf),
    );
}
const out = new URL(
  "../../../../web/src/domain/generators/tenK/v2/segment06b.adapt-hashes-e6540a5.json",
  import.meta.url,
);
writeFileSync(
  out,
  JSON.stringify({
    against: "e6540a5",
    count: {
      grid04: Object.keys(grid04).length,
      gridP: Object.keys(gridP).length,
    },
    grid04,
    gridP,
  }) + "\n",
);
console.log(
  Object.keys(grid04).length + Object.keys(gridP).length,
  "heševa →",
  out.pathname,
);
