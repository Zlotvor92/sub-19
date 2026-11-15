/* P5-10K — mreža P0 za 10K (isti ulazi i metrike M1–M8 kao P0/common.ts) + metrike P5: test u planu (nedelja, faza,
   nedelja do trke), T/I radni minuti nedelje 1, udeo rada prvog kvalitetnog dana, laganih dana sa ubrzanjima, % km
   bržih od E po fazi, nedelje > 25 % brzih km, vrh cilja, nedelje WEEK_FITTED, upozorenja. Samo čitanje.
   Iz web/: node ../docs/generators-v2/perfection/P5-10K/measure.ts <oznaka> → P5-10K/raw-<oznaka>.json */
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { distOf, type Plan } from "../../final-check/lib.ts";
import { grid, metrics } from "../P0/common.ts";

const tag = process.argv[2] ?? "posle";
const dist = distOf("10K");
const dir = new URL(".", import.meta.url).pathname;
type Seg = { kind: string; zone?: string; km: number; sec: number };
type Day = { role: string; date: string; workout: { kind: string; km: number; sec: number; title?: string; segments: Seg[] } };
type Wk = { index: number; phase: string; deload: boolean; test?: boolean; targetKm: number; plannedKm: number; fitted: string | null; days: Day[]; notes: string[] };
const WORK = (s: Seg) => (s.kind === "rep" || s.kind === "continuous") && s.zone !== undefined && !["E", "jog", "walk", "test"].includes(s.zone);
const rows: Record<string, unknown>[] = [];
const t0 = Date.now();
for (const c of grid("10K")) {
  const r = dist.generate(c.input);
  if (!r.ok) { rows.push({ id: c.id, family: c.family, days: c.days, weeks: c.weeks, rejected: r.reasons.map((x) => `${x.code}: ${x.message}`.slice(0, 160)) }); continue; }
  const plan = r.plan as Plan;
  const W = plan.weeks as unknown as Wk[];
  const N = W.length;
  const w1 = W[0]!;
  const zMin = (w: Wk, z: string) => Math.round(w.days.filter((d) => d.workout.kind === "quality").flatMap((d) => d.workout.segments).filter((s) => WORK(s) && s.zone === z).reduce((a, s) => a + s.sec, 0) / 6) / 10;
  const tw = W.find((w) => w.days.some((d) => d.role === "test"));
  const fast: { w: number; ph: string; pct: number }[] = [];
  for (const w of W) if (w.phase !== "race") {
    let f = 0, t = 0;
    for (const d of w.days) for (const s of d.workout.segments) { t += s.km; if (s.zone && !["E", "jog", "walk"].includes(s.zone)) f += s.km; }
    fast.push({ w: w.index, ph: w.deload ? `${w.phase}-r` : w.phase, pct: t > 0 ? Math.round((1000 * f) / t) / 10 : 0 });
  }
  const strideWeeks = W.filter((w) => w.days.some((d) => d.role === "easy" && d.workout.segments.some((s) => s.kind === "stride"))).map((w) => w.index);
  const strideEligible = W.filter((w) => w.phase !== "race").map((w) => w.index);
  rows.push({ id: c.id, family: c.family, days: c.days, band: c.band, weeks: c.weeks, km: c.input["currentWeeklyKm"], policyVersion: plan["policyVersion"], m: metrics("10K", plan),
    p5: {
      test: tw ? { week: tw.index, phase: tw.phase, deload: tw.deload, toRace: N - tw.index } : null,
      w1T: zMin(w1, "T"), w1I: zMin(w1, "I"), w1R: zMin(w1, "R"), w1Planned: w1.plannedKm, w1Target: w1.targetKm, current: c.input["currentWeeklyKm"],
      strideWeeks: strideWeeks.length, strideEligible: strideEligible.length,
      strideDays: W.reduce((a, w) => a + w.days.filter((d) => d.role === "easy" && d.workout.segments.some((s) => s.kind === "stride")).length, 0),
      fast, over25: fast.filter((x) => x.pct > 25).length,
      peakTarget: Math.max(...W.map((w) => w.targetKm)), fitted: W.filter((w) => w.fitted !== null).length,
      warnings: [...new Set(((plan as unknown as { warnings: { rule: string }[] }).warnings).map((x) => x.rule))],
    },
    weekHash: W.map((w) => createHash("sha1").update(JSON.stringify({ ...w, notes: undefined })).digest("hex").slice(0, 10)) });
}
writeFileSync(`${dir}raw-${tag}.json`, JSON.stringify(rows));
console.log(`10K ${tag}: ulaza ${rows.length}, ok ${rows.filter((r) => r["m"]).length}, odbijeno ${rows.filter((r) => r["rejected"]).length}, ${Date.now() - t0} ms`);
