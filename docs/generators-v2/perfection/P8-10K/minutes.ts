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
const g5 = { taperOver: 0, taperWeeks: 0, deloadOver: 0, deloadWeeks: 0, deloadNoQ: 0 };
const workSec = (d: any, z: string) => d.workout.segments.filter((s: any) => (s.kind === "rep" || s.kind === "continuous") && s.zone === z).reduce((a: number, s: any) => a + s.sec, 0);
for (const inp of ins) {
  const r: any = generateTenKV2(inp); if (!r.ok) continue; plans++;
  // G5: taper ≤ 60 % najvećeg rada zone u izgradnji; rasterećenje ≤ 60 % poslednje ne-rasteretne doze zone [s].
  const maxB: Record<string, number> = {}; let last: Record<string, number> = {};
  for (const w of r.plan.weeks) {
    const q = w.days.filter((d: any) => d.workout.kind === "quality");
    if (["base", "development", "specific"].includes(w.phase) && !w.deload) {
      const cur: Record<string, number> = {};
      for (const d of q) for (const z of ["T", "I", "RP", "R"]) { const v = workSec(d, z); if (v) { maxB[z] = Math.max(maxB[z] ?? 0, v); cur[z] = Math.max(cur[z] ?? 0, v); } }
      if (Object.keys(cur).length) last = { ...last, ...cur };
    }
    if (w.phase === "taper") { g5.taperWeeks++; if (q.some((d: any) => ["T", "I", "RP"].some((z) => workSec(d, z) > 0.6 * (maxB[z] ?? 0) + 1))) g5.taperOver++; }
    if (w.deload) { g5.deloadWeeks++; if (!q.length) g5.deloadNoQ++; else if (q.some((d: any) => ["T", "I", "RP"].some((z) => workSec(d, z) > 0.6 * (last[z] ?? 0) + 1))) g5.deloadOver++; }
  }
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
console.log(JSON.stringify({ g5 }));
console.log(JSON.stringify({ plans, maxMin: Object.fromEntries(Object.entries(max).map(([k, v]) => [k, Math.round(v * 10) / 10])), sharpMax: Math.round(sharpMax * 10) / 10, overCap: over }));
