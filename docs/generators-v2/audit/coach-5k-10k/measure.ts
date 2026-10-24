/* Ugao 1a — kvantifikacija trenerskih nalaza (SAMO ČITANJE, kod 670700e). Deterministički: uzorak = svaki k-ti ulaz
   mreže (lib.DISTS[..].all()) od pomaka 0; adaptacije nad lib.facts (scenariji pain5/pain8/painPause/pause20/under50,
   asOf = sreda i kraj svake nedelje 2…N−2 uzorka baza). Iz web/:
   node ../docs/generators-v2/audit/coach-5k-10k/measure.ts <5K|10K> <k generator> <k adaptacija> */
import { distOf, wedOf, type Plan, type Week } from "../../final-check/lib.ts";

const [name, kG, kA] = [process.argv[2]!, Number(process.argv[3] ?? 1), Number(process.argv[4] ?? 50)];
const d = distOf(name);
const all = d.all();
const build = (w: Week) => !w.deload && !["taper", "race"].includes(w.phase);
const longOf = (w: Week) => w.days.find((x) => x.role === "long");
const out: Record<string, unknown> = { dist: name, kG, kA };

// M1: lagan ≥ 0,95 × dugi u nedelji izgradnje (generator)
const m1 = { plans: 0, ok: 0, withEq: 0, withNear: 0, byDays: {} as Record<string, [number, number]>, ex: [] as string[] };
// M4 (10K): oštrenje u trkačkoj nedelji — km dana oštrenja / najduži lagan trkačke nedelje
const m4 = { n: 0, ratioGe15: 0, maxRatio: 0, ex: "" };
// M5: lagan ≥ 0,95 × dugi DAN PRE ili POSLE dugog (izgradnja); M6: lagan < 20 min u izgradnji
const m5 = { plans: 0, weeks: 0, ex: [] as string[] };
const m6 = { plans: 0, minSec: Infinity, ex: [] as string[] };
for (let i = 0; i < all.length; i += kG) {
  const b = all[i]!;
  m1.plans++;
  const g = d.generate(b.input);
  if (!g.ok) continue;
  m1.ok++;
  const days = String((b.input["runDays"] as unknown[]).length) + b.family;
  const bd = (m1.byDays[days] ??= [0, 0]);
  bd[0]++;
  let eq = false, near = false;
  for (const w of g.plan.weeks.filter(build)) {
    const L = longOf(w);
    if (!L) continue;
    for (const x of w.days.filter((y) => y.role === "easy")) {
      if (x.workout.km >= L.workout.km - 0.05) eq = true;
      if (x.workout.km >= 0.95 * L.workout.km) near = true;
    }
  }
  let adj = false, short = false;
  for (const w of g.plan.weeks.filter(build)) {
    const L = longOf(w);
    if (!L) continue;
    const t = Date.parse(L.date);
    const near = w.days.filter((y) => y.role === "easy" && Math.abs(Date.parse(y.date) - t) === 86_400_000 && y.workout.km >= 0.95 * L.workout.km);
    if (near.length) { adj = true; m5.weeks++; }
    for (const y of w.days.filter((z) => z.role === "easy")) if (y.workout.sec < 1200) { short = true; if (y.workout.sec < m6.minSec) m6.minSec = y.workout.sec; }
  }
  if (adj) { m5.plans++; if (m5.ex.length < 6) m5.ex.push(b.id); }
  if (short) { m6.plans++; if (m6.ex.length < 6) m6.ex.push(b.id); }
  if (eq) { m1.withEq++; bd[1]++; if (m1.ex.length < 6) m1.ex.push(b.id); }
  if (near) m1.withNear++;
  const rw = g.plan.weeks[g.plan.weeks.length - 1]!;
  const sh = rw.days.find((x) => x.role === "sharpener");
  const ez = Math.max(0, ...rw.days.filter((x) => x.role === "easy").map((x) => x.workout.km));
  if (sh && ez > 0) {
    m4.n++;
    const r = sh.workout.km / ez;
    if (r >= 1.5) m4.ratioGe15++;
    if (r > m4.maxRatio) { m4.maxRatio = r; m4.ex = `${b.id}: oštrenje ${sh.workout.km} km / lagan ${ez} km`; }
  }
}
out["M1_laganJednakDugi"] = m1;
out["M5_laganUzDugiSusedniDan"] = m5;
out["M6_laganKraciOd20min"] = m6;
if (name === "10K") out["M4_ostrenjePremaLaganom"] = m4;

// M2/M3: adaptacija — napomena „planirano X km" ≠ planirano nedelje (5K), „Rasterećenje:" u nedelji koja nije rasterećenje
const m2 = { flows: 0, ok: 0, notePlannedMismatch: 0, notePlannedMismatchOver015: 0, flowsWithMismatch: 0, deloadNoteOnNonDeload: 0, flowsWithDeloadNote: 0, ex2: [] as string[], ex3: [] as string[] };
const scen = ["pain5", "pain8", "painPause", "pause20", "under50"] as const;
for (let i = 0; i < all.length; i += kA) {
  const b = all[i]!;
  const g = d.generate(b.input);
  if (!g.ok) continue;
  const p = g.plan;
  const N = p.weeks.length;
  for (let wi = 2; wi <= N - 2; wi++)
    for (const at of [wedOf(p.weeks[wi - 1]!.startDate), p.weeks[wi - 1]!.endDate])
      for (const s of scen) {
        m2.flows++;
        let r;
        try { r = d.adapt(p, d.facts(p as Plan, s, at), at); } catch { continue; }
        if (!r.ok) continue;
        m2.ok++;
        let f2 = false, f3 = false;
        for (const w of r.plan.weeks) {
          if (w.endDate <= at) continue;
          for (const n of w.notes) {
            const m = /planirano ([0-9]+(?:\.[0-9]+)?) km < cilj/.exec(n);
            if (m && Math.abs(Number(m[1]) - w.plannedKm) > 0.05) {
              m2.notePlannedMismatch++;
              if (Math.abs(Number(m[1]) - w.plannedKm) > 0.15) { m2.notePlannedMismatchOver015++; f2 = true; }
              if (Math.abs(Number(m[1]) - w.plannedKm) > 0.15 && m2.ex2.length < 5) m2.ex2.push(`${b.id}/${s}@${at} ned ${w.index}: napomena ${m[1]} ≠ planirano ${w.plannedKm}`);
            }
            if (/^Rasterećenje:/.test(n) && !w.deload) {
              m2.deloadNoteOnNonDeload++;
              f3 = true;
              if (m2.ex3.length < 5) m2.ex3.push(`${b.id}/${s}@${at} ned ${w.index} (${w.phase}): ${n.slice(0, 80)}`);
            }
          }
        }
        if (f2) m2.flowsWithMismatch++;
        if (f3) m2.flowsWithDeloadNote++;
      }
}
out["M2_M3_napomene"] = m2;
console.log(JSON.stringify(out, null, 1));
