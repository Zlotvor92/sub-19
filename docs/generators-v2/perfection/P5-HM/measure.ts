/* P5-HM — mreža P0 (192 ulaza) + metrike P5: test (broj, nedelja, ned. do trke), T/I radni minuti prvog pojavljivanja
   i udeo rada prvog kvalitetnog dana (M1/M2 iz P0/common.ts), dani sa ubrzanjima, % km bržih od E po fazi (sa i bez
   ubrzanja), nedelje > 25 % brzih km, vrh/kapacitet, WEEK_FITTED, nedelja 1 < trenutni obim. Samo čitanje.
   Iz web/: node ../docs/generators-v2/perfection/P5-HM/measure.ts <oznaka>  → P5-HM/raw-<oznaka>.json */
import { writeFileSync } from "node:fs";
import { distOf, type Plan } from "../../final-check/lib.ts";
import { grid, metrics } from "../P0/common.ts";

const tag = process.argv[2] ?? "posle";
const dist = distOf("HM");
const dir = new URL(".", import.meta.url).pathname;
type Seg = { kind: string; zone?: string; km: number; sec: number };
type Day = { role: string; date: string; workout: { kind: string; km: number; sec: number; segments: Seg[] } };
type Wk = { index: number; phase: string; deload: boolean; test?: boolean; targetKm: number; plannedKm: number; days: Day[]; notes: string[] };
const fastOf = (s: Seg, strides: boolean) => !!s.zone && !["E", "jog", "walk"].includes(s.zone) && (strides || s.kind !== "stride");
const rows: Record<string, unknown>[] = [];
for (const c of grid("HM")) {
  const r = dist.generate(c.input);
  if (!r.ok) { rows.push({ id: c.id, family: c.family, days: c.days, weeks: c.weeks, rejected: r.reasons.map((x) => `${x.code}: ${x.message}`.slice(0, 160)) }); continue; }
  const plan = r.plan as Plan;
  const W = plan.weeks as unknown as Wk[];
  const N = W.length;
  const testW = W.filter((w) => w.days.some((d) => d.role === "test")).map((w) => w.index);
  const testPhase = testW.map((i) => W[i - 1]!.phase + (W[i - 1]!.deload ? "*" : ""));
  let strideDays = 0; const strideReps: number[] = []; const strideWeeks: number[] = [];
  const over25: { w: number; pct: number; noStr: number; phase: string }[] = [];
  const phaseAcc: Record<string, [number, number, number]> = {};
  for (const w of W) {
    let f = 0, f0 = 0, t = 0, sw = 0;
    for (const d of w.days) {
      const st = d.workout.segments.filter((s) => s.kind === "stride").length;
      if (st > 0 && d.role === "easy") { strideDays++; strideReps.push(st); sw++; }
      if (d.role === "race") continue;
      for (const s of d.workout.segments) { t += s.km; if (fastOf(s, true)) f += s.km; if (fastOf(s, false)) f0 += s.km; }
    }
    if (sw > 0) strideWeeks.push(w.index);
    const a = (phaseAcc[w.phase] ??= [0, 0, 0]); a[0] += f; a[1] += f0; a[2] += t;
    const pct = t > 0 ? Math.round((1000 * f) / t) / 10 : 0;
    if (["base", "development", "specific"].includes(w.phase) && !w.deload && pct > 25) over25.push({ w: w.index, pct, noStr: Math.round((1000 * f0) / t) / 10, phase: w.phase });
  }
  const m7 = Object.fromEntries(Object.entries(phaseAcc).map(([k, [f, f0, t]]) => [k, { with: Math.round((1000 * f) / t) / 10, without: Math.round((1000 * f0) / t) / 10 }]));
  const warn = (plan as unknown as { warnings: { rule: string; week?: number }[] }).warnings;
  rows.push({ id: c.id, family: c.family, days: c.days, weeks: c.weeks, policyVersion: plan["policyVersion"], m: metrics("HM", plan),
    p5: { tests: testW.length, testWeek: testW[0] ?? null, testPhase, weeksTestToRace: testW.length ? N - testW[0]! : null,
      strideDays, strideReps, strideWeeksN: strideWeeks.length, over25, m7,
      peakKm: plan["peakKm"], peakCapKm: plan["peakCapKm"], week1Km: W[0]!.plannedKm, startKm: plan["startKm"],
      fitted: warn.filter((x) => x.rule === "WEEK_FITTED").length, capLimited: warn.some((x) => x.rule === "CAPACITY_LIMITED"),
      warnRules: [...new Set(warn.map((x) => x.rule))].sort() },
    weeksJson: W.map((w) => JSON.stringify(w)) });
}
writeFileSync(`${dir}raw-${tag}.json`, JSON.stringify(rows));
console.log(`HM ${tag}: ulaza ${rows.length}, ok ${rows.filter((r) => r["m"]).length}, odbijeno ${rows.filter((r) => r["rejected"]).length}`);
