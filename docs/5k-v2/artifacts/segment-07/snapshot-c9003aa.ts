/* Kolona „c9003aa" u examples.md: iste činjenice (inputs.json) na polaznom commitu.
   Pokretanje: git worktree add --detach /tmp/c9003aa c9003aa (sa web/node_modules), pa iz korena repoa:
     node docs/5k-v2/artifacts/segment-07/snapshot-c9003aa.ts /tmp/c9003aa/web/src/domain/generators/fiveK/v2
   Upisuje c9003aa.json pored skripte; zatim ponovo run.ts. */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

interface Week {
  index: number;
  phase: string;
  deload: boolean;
  test: boolean;
  targetKm: number;
  plannedKm: number;
  stridesOnly: boolean;
  days: { workout: { kind: string; qualityType: string | null } }[];
}
const OUT = dirname(fileURLToPath(import.meta.url));
const dir = process.argv[2]!;
const { generateFiveKV2 } = (await import(pathToFileURL(`${dir}/generate.ts`).href)) as {
  generateFiveKV2: (x: unknown) => { ok: boolean; plan: { weeks: Week[] } };
};
const { adaptFiveKV2 } = (await import(pathToFileURL(`${dir}/adapt.ts`).href)) as {
  adaptFiveKV2: (p: unknown, f: unknown, a: unknown) => { ok: boolean; plan: { weeks: Week[] }; reasons: unknown };
};
const inputs = JSON.parse(readFileSync(join(OUT, "inputs.json"), "utf8")) as Record<
  string,
  { input: unknown; asOf: string | null; facts: unknown }
>;
const q = (w: Week): string =>
  w.days
    .filter((d) => d.workout.kind === "quality")
    .map((d) => d.workout.qualityType)
    .join(" + ") || (w.stridesOnly ? "ubrzanja" : "—");
const out: Record<string, { weeks: string[] }> = {};
for (const id of ["dev-04-pauza-20", "d5-30km-pauza-35", "dev-04-nepotpun-unos"]) {
  const ex = inputs[id]!;
  const g = generateFiveKV2(ex.input);
  const r = adaptFiveKV2(g.plan, ex.facts, ex.asOf);
  if (!r.ok) throw new Error(JSON.stringify(r));
  out[id] = {
    weeks: r.plan.weeks.map(
      (w) => `${w.phase}${w.deload ? " (r)" : ""}${w.test ? " T" : ""} ${w.targetKm} / ${w.plannedKm}, ${q(w)}`,
    ),
  };
}
writeFileSync(join(OUT, "c9003aa.json"), JSON.stringify(out, null, 2) + "\n");
console.log("ok");
