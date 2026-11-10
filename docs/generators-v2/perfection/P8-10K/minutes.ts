/* P8-10K (dopuna G4/G5) — najveći rad jednog treninga po zoni [min] i oštrenje trkačke nedelje [min], mreža P0 + 12
   profila P7; broj treninga iznad plafona G4 (T 30 / 40 od 80 km, I 20 VDOT < 40 / 24, RP 30) i oštrenja > 12 min.
   Iz web/: node ../docs/generators-v2/perfection/P8-10K/minutes.ts */
import { readFileSync } from "node:fs";
import { generateTenKV2 } from "../../../../web/src/domain/generators/tenK/v2/generate.ts";
import { grid } from "../P0/common.ts";
const dir = new URL(".", import.meta.url).pathname;
const p7 = (JSON.parse(readFileSync(`${dir}p7-inputs-10K.json`, "utf8")) as Record<string, { input: unknown }[]>)["10K"]!.map((x) => x.input);
const ins = [...p7, ...grid("10K").map((c) => c.input)];
const max: Record<string, number> = {}; const over: Record<string, number> = { T: 0, I: 0, RP: 0, sharp: 0 }; let sharpMax = 0, plans = 0;
for (const inp of ins) {
  const r: any = generateTenKV2(inp); if (!r.ok) continue; plans++;
  for (const w of r.plan.weeks) for (const d of w.days) {
    const sec: Record<string, number> = {};
    for (const s of d.workout.segments) if ((s.kind === "rep" || s.kind === "continuous") && ["T", "I", "RP", "R"].includes(s.zone)) sec[s.zone] = (sec[s.zone] ?? 0) + s.sec;
    if (d.role === "sharpener") { const m = (sec.RP ?? 0) / 60; sharpMax = Math.max(sharpMax, m); if (m > 12 + 1e-9) over.sharp!++; continue; }
    if (d.role === "race" || d.role === "test") continue;
    for (const [z, v] of Object.entries(sec)) { const m = v / 60; max[z] = Math.max(max[z] ?? 0, m);
      const cap = z === "T" ? (w.targetKm >= 80 ? 40 : 30) : z === "I" ? (r.plan.paces.vdot < 40 ? 20 : 24) : z === "RP" ? 30 : Infinity;
      if (m > cap + 0.05) over[z]!++; }
  }
}
console.log(JSON.stringify({ plans, maxMin: Object.fromEntries(Object.entries(max).map(([k, v]) => [k, Math.round(v * 10) / 10])), sharpMax: Math.round(sharpMax * 10) / 10, overCap: over }));
