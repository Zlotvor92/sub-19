/* P3 — mreža P0 za 10K (isti ulazi i metrike M1–M8 kao P0/common.ts) + metrike P3: najveći RP trening, ukupno RP,
   I minuti u specifičnoj fazi, % km bržih od E po nedelji specifične faze, tip nedelje A/B, nedelja B koja ne staje,
   uzrok vrha RP. Samo čitanje. Iz web/: node ../docs/generators-v2/perfection/P3/measure.ts <oznaka> → P3/raw-10K-<oznaka>.json */
import { writeFileSync } from "node:fs";
import { distOf, type Plan } from "../../final-check/lib.ts";
import { grid, metrics } from "../P0/common.ts";

const tag = process.argv[2] ?? "posle";
const dist = distOf("10K");
const dir = new URL(".", import.meta.url).pathname;
type Seg = { kind: string; zone?: string; km: number; sec: number };
type Day = { role: string; date: string; workout: { kind: string; km: number; sec: number; title?: string; segments: Seg[]; dose?: { zone: string; doseM: number; ladder: string } | null } };
type Wk = { index: number; phase: string; deload: boolean; targetKm: number; plannedKm: number; days: Day[]; notes: string[] };
const rows: Record<string, unknown>[] = [];
const t0 = Date.now();
for (const c of grid("10K")) {
  const r = dist.generate(c.input);
  if (!r.ok) { rows.push({ id: c.id, family: c.family, days: c.days, weeks: c.weeks, rejected: r.reasons.map((x) => `${x.code}: ${x.message}`.slice(0, 160)) }); continue; }
  const plan = r.plan as Plan;
  const W = plan.weeks as unknown as Wk[];
  let rpTrainMax = 0, iSpecMin = 0;
  const fastPct: { w: number; ph: string; pct: number }[] = []; const types: string[] = []; let bNotFit = 0;
  for (const w of W) {
    for (const d of w.days) if (d.workout.kind === "quality" && d.role !== "sharpener") {
      const rp = d.workout.segments.filter((s) => s.zone === "RP" && (s.kind === "rep" || s.kind === "continuous")).reduce((a, s) => a + s.km, 0);
      rpTrainMax = Math.max(rpTrainMax, rp);
      if (w.phase === "specific") iSpecMin += d.workout.segments.filter((s) => s.zone === "I" && (s.kind === "rep" || s.kind === "continuous")).reduce((a, s) => a + s.sec, 0) / 60;
    }
    if (w.phase !== "race") {
      let f = 0, t = 0;
      for (const d of w.days) for (const s of d.workout.segments) { t += s.km; if (s.zone && !["E", "jog", "walk"].includes(s.zone)) f += s.km; }
      fastPct.push({ w: w.index, ph: w.deload ? `${w.phase}-r` : w.phase, pct: t > 0 ? Math.round((1000 * f) / t) / 10 : 0 });
    }
    if (w.phase === "specific" && !w.deload) {
      const q2 = w.days.find((d) => d.role === "q2");
      types.push(q2?.workout.dose?.zone === "I" ? "B" : q2 ? "A" : "a");
      if (w.notes.some((n) => n.startsWith("Nedelja B"))) bNotFit++;
    }
  }
  rows.push({ id: c.id, family: c.family, days: c.days, band: c.band, weeks: c.weeks, km: c.input["currentWeeklyKm"], policyVersion: plan["policyVersion"], m: metrics("10K", plan),
    p3: { rpTrainMax: Math.round(rpTrainMax * 10) / 10, iSpecMin: Math.round(iSpecMin * 10) / 10, fastPct, types: types.join(""), bNotFit,
      peakTarget: Math.max(...W.map((w) => w.targetKm)), p35: W.filter((w) => w.notes.some((n) => n.startsWith("Drugi dan kvaliteta"))).length,
      p35keep: W.filter((w) => w.notes.some((n) => n.startsWith("Dva dana kvaliteta ostaju"))).length,
      warnings: [...new Set(((plan as unknown as { warnings: { rule: string }[] }).warnings).map((x) => x.rule))] },
    weeksJson: JSON.stringify(plan.weeks.map((w) => w.days)) });
}
writeFileSync(`${dir}raw-10K-${tag}.json`, JSON.stringify(rows));
console.log(`10K ${tag}: ulaza ${rows.length}, ok ${rows.filter((r) => r["m"]).length}, odbijeno ${rows.filter((r) => r["rejected"]).length}, ${Date.now() - t0} ms`);
