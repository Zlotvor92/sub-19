/* P5-10K — nedelje pouke 35 (drugi dan kvaliteta lagan, „dan kvaliteta ≤ dugi") na mreži 02: po broju dana, fazi, km,
   VDOT. Iz web/ (ili web/ starog stabla): node ../docs/generators-v2/perfection/P5-10K/p35split.ts */
import { generateTenKV2 } from "../../../../web/src/domain/generators/tenK/v2/generate.ts";
import { grid02Inputs } from "../../../../web/src/domain/generators/tenK/v2/testInputs.ts";
const by: Record<string, number> = {};
const inc = (k: string) => { by[k] = (by[k] ?? 0) + 1; };
for (const d of [3, 4, 5, 6] as const) for (const c of grid02Inputs(d)) {
  const r = generateTenKV2(c.input); if (!r.ok) continue;
  for (const w of r.plan.weeks) if (w.notes.some((n) => n.startsWith("Drugi dan kvaliteta"))) {
    inc(`dana ${d}`); inc(`faza ${w.deload ? "rast." : w.phase}`); inc(`km ${c.km}`); inc(`vdot ${(c.input["recentResult"] as { timeSec: number }) ? c.id.split("-")[3] : "?"}`);
    inc(`ned ${w.index <= 2 ? w.index : "3+"}`);
  }
}
console.log(JSON.stringify(by));
