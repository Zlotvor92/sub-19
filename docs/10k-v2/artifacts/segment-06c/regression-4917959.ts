/* Heševi izlaza adaptacije 4917959 (10k-v2.4.1) za regresiju segmenta 06c (A17). Pokretanje iz korena repoa:
     git worktree add --detach <wt> 4917959
     ln -s "$PWD/web/node_modules" <wt>/web/node_modules
     node docs/10k-v2/artifacts/segment-06c/regression-4917959.ts <wt>
   Generiše bazne planove i adaptira ih KODOM IZ 4917959 (generateTenKV2, adaptTenKV2):
   - mreža 04: 30 planova × 4 asOf × 17 scenarija = 2040 (adaptBases, asOfOf, factsOf, runsIn iz 4917959;
     lanac = drugi korak, isto kao adapt.node.test.ts chainFacts);
   - mreža bola P (06b): 336 tokova (PAIN_GRID, painGridBases, painCases, painFacts iz 4917959);
   - mreža R (06c): reliefGridBases × reliefAsOfs × RELIEF_SCENARIOS iz OVOG stabla — mreža R na 4917959 ne
     postoji; definicija je samo ulaz, kod koji se meri je iz 4917959.
   Heš = planHash81 (ceo rezultat adaptacije — plan, changes, reasons — bez oznake verzije). Upisuje
   web/src/domain/generators/tenK/v2/segment06c.adapt-hashes-4917959.json (posle toga prettier --write). */

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
  painGridBases: () => { id: string; input: unknown }[];
  painCases: (
    id: string,
    p: Plan,
  ) => { key: string; asOf: string; level: number }[];
  painFacts: (asOf: string, level: number) => unknown;
};
const cur = (await import(
  new URL(
    "../../../../web/src/domain/generators/tenK/v2/testInputs.ts",
    import.meta.url,
  ).href
)) as {
  reliefGridBases: () => { id: string; input: unknown }[];
  RELIEF_SCENARIOS: readonly string[];
  reliefAsOfs: (p: Plan) => { week: number; asOf: string }[];
  reliefFacts: (p: Plan, s: string, asOf: string) => unknown;
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
for (const b of t.painGridBases()) {
  const p0 = gen(b.input);
  for (const c of t.painCases(b.id, p0))
    gridP[c.key] = t.planHash81(
      adaptTenKV2(p0, t.painFacts(c.asOf, c.level), c.asOf),
    );
}
const gridR: Record<string, number> = {};
for (const b of cur.reliefGridBases()) {
  const p0 = gen(b.input);
  for (const a of cur.reliefAsOfs(p0))
    for (const s of cur.RELIEF_SCENARIOS)
      gridR[`${b.id}/w${a.week}/${s}`] = t.planHash81(
        adaptTenKV2(p0, cur.reliefFacts(p0, s, a.asOf), a.asOf),
      );
}
const out = new URL(
  "../../../../web/src/domain/generators/tenK/v2/segment06c.adapt-hashes-4917959.json",
  import.meta.url,
);
writeFileSync(
  out,
  JSON.stringify({
    against: "4917959",
    count: {
      grid04: Object.keys(grid04).length,
      gridP: Object.keys(gridP).length,
      gridR: Object.keys(gridR).length,
    },
    grid04,
    gridP,
    gridR,
  }) + "\n",
);
console.log(
  Object.keys(grid04).length +
    Object.keys(gridP).length +
    Object.keys(gridR).length,
  "heševa →",
  out.pathname,
);
