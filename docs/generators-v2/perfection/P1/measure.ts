/* P1 — mreža P0 za HM (isti ulazi, iste metrike M1–M8 kao P0/common.ts) + metrike P1 (blok RP u dugom, RP trening,
   tip A/B, % km bržih od E po nedelji specifične faze, uzrok vrha RP). Samo čitanje.
   Iz web/: node ../docs/generators-v2/perfection/P1/measure.ts <oznaka>   → P1/raw-HM-<oznaka>.json */
import { writeFileSync } from "node:fs";
import { distOf, type Plan } from "../../final-check/lib.ts";
import { grid, metrics } from "../P0/common.ts";

const tag = process.argv[2] ?? "posle";
const dist = distOf("HM");
const dir = new URL(".", import.meta.url).pathname;
type Seg = { kind: string; zone?: string; km: number; sec: number };
type Day = { role: string; date: string; workout: { kind: string; km: number; sec: number; segments: Seg[]; dose?: { zone: string; doseM: number } | null } };
type Wk = { index: number; phase: string; deload: boolean; targetKm: number; plannedKm: number; days: Day[] };
const rows: Record<string, unknown>[] = [];
for (const c of grid("HM")) {
  const r = dist.generate(c.input);
  if (!r.ok) { rows.push({ id: c.id, family: c.family, days: c.days, weeks: c.weeks, rejected: r.reasons.map((x) => `${x.code}: ${x.message}`.slice(0, 160)) }); continue; }
  const plan = r.plan as Plan;
  const W = plan.weeks as unknown as Wk[];
  const blocks: number[] = []; let rpTrainMax = 0; let longestDay = 0;
  const fastPct: number[] = []; const types: string[] = [];
  for (const w of W) {
    const long = w.days.find((d) => d.role === "long");
    const b = long ? long.workout.segments.filter((s) => s.zone === "RP").reduce((a, s) => a + s.km, 0) : 0;
    if (b > 0) blocks.push(Math.round(b * 10) / 10);
    for (const d of w.days) if (d.workout.kind === "quality" && d.role !== "sharpener") {
      const rp = d.workout.segments.filter((s) => s.zone === "RP" && (s.kind === "rep" || s.kind === "continuous")).reduce((a, s) => a + s.km, 0);
      rpTrainMax = Math.max(rpTrainMax, rp);
    }
    for (const d of w.days) if (d.role !== "race") longestDay = Math.max(longestDay, d.workout.km);
    if (w.phase === "specific") {
      let f = 0, t = 0;
      for (const d of w.days) for (const s of d.workout.segments) { t += s.km; if (s.zone && !["E", "jog", "walk"].includes(s.zone)) f += s.km; }
      fastPct.push(t > 0 ? Math.round((1000 * f) / t) / 10 : 0);
      if (!w.deload) types.push(b > 0 ? "B" : "A");
    }
  }
  rows.push({ id: c.id, family: c.family, days: c.days, weeks: c.weeks, policyVersion: plan["policyVersion"], m: metrics("HM", plan),
    p1: { blocks, rpTrainMax: Math.round(rpTrainMax * 10) / 10, longestDay: Math.round(longestDay * 10) / 10, fastPct, types: types.join("") },
    hash: JSON.stringify(plan.weeks).length, weeksJson: JSON.stringify(plan.weeks.map((w) => w.days)) });
}
writeFileSync(`${dir}raw-HM-${tag}.json`, JSON.stringify(rows));
console.log(`HM ${tag}: ulaza ${rows.length}, ok ${rows.filter((r) => r["m"]).length}, odbijeno ${rows.filter((r) => r["rejected"]).length}`);
