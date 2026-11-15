/* P5-10K — mreže generatorskih testova 10K v2 (01: 3024, 02: 15 840, po osećaju, početnik): odbijanja, nedelje
   WEEK_FITTED, planovi sa testom, nedelja testa spuštena (fitted), ned 1 ispod obima. Samo čitanje.
   Iz web/: node ../docs/generators-v2/perfection/P5-10K/bigGrid.ts <oznaka> → P5-10K/big-<oznaka>.json */
import { writeFileSync } from "node:fs";
import { generateTenKV2 } from "../../../../web/src/domain/generators/tenK/v2/generate.ts";
import { beginnerGridInputs, feelGridInputs, grid02Inputs, gridInputs } from "../../../../web/src/domain/generators/tenK/v2/testInputs.ts";
const tag = process.argv[2] ?? "posle";
const dir = new URL(".", import.meta.url).pathname;
const sets: [string, { id: string; input: Record<string, unknown> }[]][] = [
  ["01", gridInputs()],
  ["02", ([3, 4, 5, 6] as const).flatMap((d) => grid02Inputs(d))],
  ["F", ([3, 4, 5, 6] as const).flatMap((d) => feelGridInputs(d))],
  ["B", ([3, 4] as const).flatMap((d) => beginnerGridInputs(d))],
];
const out: Record<string, unknown> = {};
const t0 = Date.now();
for (const [name, list] of sets) {
  const rej: Record<string, string> = {}; let ok = 0, fittedPlans = 0, fittedWeeks = 0, withTest = 0, testFitted = 0, w1Low = 0, strides = 0, p35 = 0, p35keep = 0, p35Plans = 0;
  const hash: Record<string, number> = {};
  for (const c of list) {
    const r = generateTenKV2(c.input);
    if (!r.ok) { rej[c.id] = r.reasons.map((x) => `${x.code}: ${x.message}`).join(" | ").slice(0, 200); continue; }
    ok++;
    const W = r.plan.weeks;
    const f = W.filter((w) => w.fitted !== null).length; fittedWeeks += f; if (f) fittedPlans++;
    const t = W.find((w) => w.days.some((d) => d.role === "test")); if (t) { withTest++; if (t.fitted) testFitted++; }
    if (W[0]!.plannedKm + 0.1 < (c.input["currentWeeklyKm"] as number)) w1Low++;
    const pw = W.filter((w) => w.notes.some((n) => n.startsWith("Drugi dan kvaliteta"))).length;
    p35 += pw; if (pw) p35Plans++;
    p35keep += W.filter((w) => w.notes.some((n) => n.startsWith("Dva dana kvaliteta ostaju"))).length;
    strides += W.reduce((a, w) => a + w.days.filter((d) => d.role === "easy" && d.workout.segments.some((s) => s.kind === "stride")).length, 0);
  }
  out[name] = { n: list.length, ok, rejected: Object.keys(rej).length, fittedPlans, fittedWeeks, withTest, testFitted, w1Low, strides, p35, p35Plans, p35keep, rej };
  console.log(name, JSON.stringify({ n: list.length, ok, rejected: Object.keys(rej).length, fittedPlans, fittedWeeks, withTest, testFitted, w1Low, strides, p35, p35Plans, p35keep }));
}
writeFileSync(`${dir}big-${tag}.json`, JSON.stringify(out));
console.log(`${Date.now() - t0} ms`);
