/* P1 — nedelje specifične faze sa > 25 % km bržih od E (zaokruženo na 0,1 %, kao compare.ts): broj po danima, pojasu cilja i tipu. Iz web/: node ../docs/generators-v2/perfection/P1/over25.ts */
import { grid } from "../P0/common.ts";
import { generateHmV2 } from "../../../../web/src/domain/generators/halfMarathon/v2/generate.ts";
const agg: Record<string, number> = {}; const tg: number[] = []; let n = 0;
for (const c of grid("HM")) { const r = generateHmV2(c.input); if (!r.ok) continue;
  for (const w of r.plan.weeks) { if (w.phase !== "specific") continue;
    let f = 0, t = 0; for (const d of w.days) for (const s of d.workout.segments) { t += s.km; if (!["E", "jog", "walk"].includes(s.zone)) f += s.km; }
    if (Math.round((1000 * f) / t) / 10 <= 25) continue; n++; tg.push(w.targetKm);
    const B = w.days.some((d) => d.role === "long" && d.workout.workKm.RP > 0);
    const k = `${c.days} d, cilj ${w.targetKm >= 40 ? "≥ 40" : "< 40"} km, ${w.deload ? "rasterećenje" : B ? "B" : "A"}`; agg[k] = (agg[k] ?? 0) + 1; } }
const s = tg.sort((a, b) => a - b); console.log(n, agg, `cilj ${s[0]}–${s[s.length - 1]} km`);
