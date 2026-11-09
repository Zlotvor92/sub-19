/* P2 — mreža P0 za maraton (isti ulazi i metrike M1–M8 kao P0/common.ts) + metrike P2 (blok MP u dugom, MP trening,
   tip A/B, % km bržih od E po nedelji A/B, najduži dan [km, min], MARATHON_LONG_SHORT). Samo čitanje.
   Iz web/: node ../docs/generators-v2/perfection/P2/measure.ts <oznaka>   → P2/raw-MAR-<oznaka>.json */
import { writeFileSync } from "node:fs";
import { distOf, type Plan } from "../../final-check/lib.ts";
import { grid, metrics } from "../P0/common.ts";

const tag = process.argv[2] ?? "posle";
const dist = distOf("MAR");
const dir = new URL(".", import.meta.url).pathname;
type Seg = { kind: string; zone?: string; km: number; sec: number };
type Day = { role: string; date: string; workout: { kind: string; km: number; sec: number; segments: Seg[]; dose?: { zone: string; doseM: number } | null } };
type Wk = { index: number; phase: string; deload: boolean; targetKm: number; plannedKm: number; days: Day[] };
const FAST = (s: Seg) => !!s.zone && !["E", "jog", "walk"].includes(s.zone);
const r1 = (x: number) => Math.round(x * 10) / 10;
const rows: Record<string, unknown>[] = [];
const t0 = Date.now();
for (const c of grid("MAR")) {
  const r = dist.generate(c.input);
  if (!r.ok) { rows.push({ id: c.id, family: c.family, days: c.days, weeks: c.weeks, rejected: r.reasons.map((x) => `${x.code}: ${x.message}`.slice(0, 200)) }); continue; }
  const plan = r.plan as Plan;
  const W = plan.weeks as unknown as Wk[];
  const blocks: number[] = []; let mpTrainMax = 0; let longestDay = 0; let longestDayMin = 0;
  const fastA: number[] = []; const fastB: number[] = []; const fastAll: number[] = []; const types: string[] = [];
  let longMax = 0, longMaxMin = 0;
  for (const w of W) {
    const long = w.days.find((d) => d.role === "long");
    const b = long ? long.workout.segments.filter((s) => s.zone === "MP").reduce((a, s) => a + s.km, 0) : 0;
    if (b > 0) blocks.push(r1(b));
    if (long && long.workout.km > longMax) { longMax = long.workout.km; longMaxMin = Math.round(long.workout.sec / 60); }
    for (const d of w.days) if (d.workout.kind === "quality" && d.role !== "sharpener") {
      const mp = d.workout.segments.filter((s) => s.zone === "MP" && (s.kind === "rep" || s.kind === "continuous")).reduce((a, s) => a + s.km, 0);
      mpTrainMax = Math.max(mpTrainMax, mp);
    }
    for (const d of w.days) if (d.role !== "race") { longestDay = Math.max(longestDay, d.workout.km); longestDayMin = Math.max(longestDayMin, Math.round(d.workout.sec / 60)); }
    let f = 0, t = 0;
    for (const d of w.days) if (d.role !== "race") for (const s of d.workout.segments) { t += s.km; if (FAST(s)) f += s.km; }
    const pct = t > 0 ? Math.round((1000 * f) / t) / 10 : 0;
    if (w.phase !== "race") fastAll.push(pct);
    if (w.phase === "specific" && !w.deload) { types.push(b > 0 ? "B" : "A"); (b > 0 ? fastB : fastA).push(pct); }
  }
  const warns = (plan.warnings as { code: string }[]).map((x) => x.code);
  rows.push({ id: c.id, family: c.family, days: c.days, weeks: c.weeks, km: c.input["currentWeeklyKm"], policyVersion: plan["policyVersion"], m: metrics("MAR", plan),
    p2: { blocks, mpTrainMax: r1(mpTrainMax), longestDay: r1(longestDay), longestDayMin, fastA, fastB, fastAll, types: types.join(""), longMax: r1(longMax), longMaxMin,
      longShort: warns.includes("MARATHON_LONG_SHORT"), longShortNote: (plan.notes as string[]).some((n) => n.startsWith("Najduže dugo trčanje je")), peakKm: Math.max(...W.map((w) => w.plannedKm)) },
    weeksJson: JSON.stringify(plan.weeks.map((w) => w.days)) });
}
writeFileSync(`${dir}raw-MAR-${tag}.json`, JSON.stringify(rows));
console.log(`MAR ${tag}: ulaza ${rows.length}, ok ${rows.filter((r) => r["m"]).length}, odbijeno ${rows.filter((r) => r["rejected"]).length}, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
