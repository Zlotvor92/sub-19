/* Ugao 4 — ponovljiv primer N1 (5K): bol pa višak. Iz web/: node ../docs/generators-v2/audit/owner/fiveK-n1-repro.ts */
import { DISTS, type Plan as LPlan } from "../../final-check/lib.ts";
import { adaptFiveKV2 } from "../../../../web/src/domain/generators/fiveK/v2/adapt.ts";
import type { FiveKV2Plan } from "../../../../web/src/domain/generators/fiveK/v2/types.ts";
const d5 = DISTS.find((d) => d.name === "5K")!;
const b = d5.all().find((x) => x.id === "r-d3-6w-20km-v45-1")!;
const p = d5.generate(b.input).plan as unknown as FiveKV2Plan;
const r1 = adaptFiveKV2(p, d5.facts(p as unknown as LPlan, "pain5", "2026-11-15"), "2026-11-15");
if (!r1.ok) throw new Error("korak 1 odbijen");
const p1 = r1.plan as FiveKV2Plan;
const r2 = adaptFiveKV2(p1, d5.facts(p1 as unknown as LPlan, "over120", "2026-11-22"), "2026-11-22");
if (!r2.ok) throw new Error("korak 2 odbijen");
const show = (q: FiveKV2Plan) => q.weeks.map((w) => `${w.index}:${w.phase}${w.deload ? "D" : ""}:${w.targetKm}`).join(" ");
console.log("izvorni ", show(p)); console.log("posle bol", show(p1)); console.log("posle višak", show(r2.plan as FiveKV2Plan));
console.log("koraci", JSON.stringify((r2.plan as FiveKV2Plan).adaptation?.steps));
for (const x of r2.reasons) console.log("razlog", x.condition, x.applied, x.message);
