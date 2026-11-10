/* P8-5K G6 — vrh obima po planu (mreža final-check 5K all()). Iz web/: node ../docs/generators-v2/perfection/P8-5K/g6.ts <oznaka>
   → P8-5K/g6-<oznaka>.json { id: [grupa, najveći cilj izgradnje, najveći planirani obim izgradnje, nedelja „planirano < cilj"] }.
   Poređenje dve oznake: node ../docs/generators-v2/perfection/P8-5K/g6.ts cmp <A> <B>. */
import { readFileSync, writeFileSync } from "node:fs";
import { distOf } from "../../final-check/lib.ts";
const dir = new URL(".", import.meta.url).pathname;
const tag = process.argv[2] ?? "x";
type Row = [string, number, number, number];
if (tag === "cmp") {
  const A = JSON.parse(readFileSync(`${dir}g6-${process.argv[3]}.json`, "utf8")) as Record<string, Row>;
  const B = JSON.parse(readFileSync(`${dir}g6-${process.argv[4]}.json`, "utf8")) as Record<string, Row>;
  const g: Record<string, { n: number; over10: number; max: number; drops: number[]; belowA: number; belowB: number; plA: number; plB: number }> = {};
  for (const [id, a] of Object.entries(A)) {
    const b = B[id]; if (!b) continue;
    const x = (g[a[0]] ??= { n: 0, over10: 0, max: 0, drops: [], belowA: 0, belowB: 0, plA: 0, plB: 0 });
    const drop = 1 - b[1] / a[1];
    x.n++; x.drops.push(drop); if (drop > 0.1 + 1e-9) x.over10++; x.max = Math.max(x.max, drop);
    if (a[3] > 0) x.belowA++; if (b[3] > 0) x.belowB++;
    if (a[2] < 0.9 * a[1] - 1e-9) x.plA++; if (b[2] < 0.9 * a[1] - 1e-9) x.plB++;
  }
  console.log("grupa | planova | vrh cilja B < 0,9 × A | najveći pad % | prosečan pad % | planova sa padom | plan. vrh < 0,9 × cilj A (A / B) | planova sa „planirano < cilj\" (A / B)");
  for (const k of Object.keys(g).sort()) { const x = g[k];
    console.log(`${k} | ${x.n} | ${x.over10} (${(100 * x.over10 / x.n).toFixed(1)} %) | ${(100 * x.max).toFixed(1)} | ${(100 * x.drops.reduce((s, d) => s + d, 0) / x.n).toFixed(2)} | ${x.drops.filter((d) => d > 1e-9).length} | ${x.plA} / ${x.plB} | ${x.belowA} / ${x.belowB}`); }
} else {
  const out: Record<string, Row> = {}; let rej = 0;
  for (const c of distOf("5K").all()) {
    const r = distOf("5K").generate(c.input) as { ok: boolean; plan?: { experience: string; input: { runDays: string[]; mode?: string }; weeks: { phase: string; targetKm: number; plannedKm: number }[] } };
    if (!r.ok) { rej++; continue; }
    const p = r.plan!; if (!p.weeks.length) continue;
    const W = p.weeks.filter((w) => ["base", "peak", "sharpen"].includes(w.phase)); if (!W.length) continue;
    out[c.id] = [`${c.family} ${p.input.runDays.length} d`, Math.max(...W.map((w) => w.targetKm)), Math.max(...W.map((w) => w.plannedKm)), W.filter((w) => w.plannedKm < w.targetKm - 0.05).length];
  }
  writeFileSync(`${dir}g6-${tag}.json`, JSON.stringify(out));
  console.log(tag, Object.keys(out).length, "planova, odbijanja", rej);
}
