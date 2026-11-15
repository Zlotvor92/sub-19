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

/* Raspodela (odluka posle STOP 2): medijana i max po tipu A/B i danima; nedelje > 30 % posebno. */
const rows: { id: string; w: number; pct: number; days: number; type: string; t: number }[] = [];
for (const c of grid("HM")) { const r = generateHmV2(c.input); if (!r.ok) continue;
  for (const w of r.plan.weeks) { if (w.phase !== "specific") continue;
    let f = 0, t = 0; for (const d of w.days) for (const s of d.workout.segments) { t += s.km; if (!["E", "jog", "walk"].includes(s.zone)) f += s.km; }
    const pct = Math.round((1000 * f) / t) / 10; if (pct <= 25) continue;
    rows.push({ id: c.id, w: w.index, pct, days: c.days, type: w.deload ? "R" : w.days.some((d) => d.role === "long" && d.workout.workKm.RP > 0) ? "B" : "A", t: w.targetKm }); } }
const md = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : NaN; };
for (const k of ["A", "B"]) for (const d of [4, 5, 6]) { const xs = rows.filter((r) => r.type === k && r.days === d).map((r) => r.pct); if (xs.length) console.log(`${k} ${d} d: n ${xs.length}, medijana ${md(xs)} %, max ${Math.max(...xs)} %`); }
console.log(`sve: n ${rows.length}, medijana ${md(rows.map((r) => r.pct))} %, max ${Math.max(...rows.map((r) => r.pct))} %`);
const o30 = rows.filter((r) => r.pct > 30);
console.log(`> 30 %: ${o30.length} nedelja, ${new Set(o30.map((r) => r.id)).size} planova — ${o30.map((r) => `${r.id} ned ${r.w} (${r.type}, cilj ${r.t} km) ${r.pct} %`).join("; ")}`);
