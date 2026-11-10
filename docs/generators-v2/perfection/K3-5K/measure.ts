/* K3-5K — merenje pravila K3-A … K3-F na mreži 5K (final-check lib.all() + P0 mreža).
   Iz web/: node ../docs/generators-v2/perfection/K3-5K/measure.ts <oznaka>  → K3-5K/r-<oznaka>.json (red po planu)
            node ../docs/generators-v2/perfection/K3-5K/measure.ts cmp <A> <B>  → poređenje (promenjeni, odbijanja, vrh obima, metrike) */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { distOf } from "../../final-check/lib.ts";
import { grid } from "../P0/common.ts";

const dir = new URL(".", import.meta.url).pathname;
type Seg = { kind: string; zone: string; km: number; sec: number };
type Day = { role: string; date: string; countsToWeek: boolean; workout: { kind: string; km: number; sec: number; qualityType: string | null; segments: Seg[] } };
type Week = { index: number; phase: string; deload: boolean; test: boolean; targetKm: number; plannedKm: number; days: Day[]; notes: string[] };
type Plan = { experience: string; paceMode: string; vdot: number | null; paces: { vdotOrEstimate?: number }; startKm: number; input: { runDays: string[]; currentWeeklyKm: number }; weeks: Week[]; warnings: { rule: string }[]; notes: string[] };
export type Row = {
  fam: string; days: number; exp: string; mode: string; vdot: number; fp: string;
  peakT: number; peakP: number; startKm: number; wk1P: number;
  iMax: number; iWeeks: number; iWeeksNonDeload: number; nWeeks: number;
  easyLongMax: number; // najveći odnos lagan/dugi u nedeljama izgradnje (ne-rasteretne)
  hardestFromEnd: number; preTaperShare: number; // K3-D
  testWork: number; testPriorMax: number; // K3-E [s]
  shortEasyWeeks: number; // K3-F: nedelje izgradnje sa laganim < 30 min
  sameDoseRun: number; // K3-C: najduži niz iste doze iste zone (ne-rasteretne)
  longStrides: number; // K3-C: dugi u oštrenju sa ubrzanjima
  belowTarget: number;
};
const WORKK = new Set(["rep", "continuous", "progression"]);
const workSec = (d: Day, z?: string) => d.workout.segments.filter((s) => (WORKK.has(s.kind) && !["E", "jog"].includes(s.zone) && (!z || s.zone === z)) || (!z && s.kind === "test")).reduce((a, s) => a + s.sec, 0);
const BUILD = (w: Week) => ["base", "peak", "sharpen"].includes(w.phase);

function vdotOf(p: Plan): number { return p.vdot ?? (p.paces as { vdot?: number; vdotOrEstimate?: number }).vdotOrEstimate ?? 0; }

function row(fam: string, p: Plan, est: (p: Plan) => number): Row {
  const W = p.weeks;
  const B = W.filter(BUILD);
  const I = W.map((w) => Math.max(0, ...w.days.filter((d) => d.role !== "race").map((d) => (d.workout.qualityType === "FARTLEK" ? workSec(d) : workSec(d, "I")))));
  const wkWork = W.map((w) => w.days.filter((d) => d.role !== "race").reduce((a, d) => a + workSec(d), 0));
  let hardest = 0; W.forEach((w, i) => { if (w.phase !== "race" && w.phase !== "taper" && wkWork[i]! > wkWork[hardest]!) hardest = i; });
  const taper0 = W.findIndex((w) => w.phase === "taper" || w.phase === "race");
  const pre = [...W.slice(0, taper0 < 0 ? W.length : taper0)].reverse().find((w) => !w.deload);
  const preShare = pre && wkWork[hardest]! > 0 ? wkWork[pre.index - 1]! / wkWork[hardest]! : 0;
  let testWork = 0, testPrior = 0;
  W.forEach((w, i) => { const t = w.days.find((d) => d.workout.qualityType === "TEST_3K" || d.workout.segments.some((s) => s.kind === "test"));
    if (t && !testWork) { testWork = t.workout.segments.filter((s) => s.kind === "test").reduce((a, s) => a + s.sec, 0);
      for (let j = 0; j < i; j++) for (const d of W[j]!.days) if (d.workout.kind === "quality") testPrior = Math.max(testPrior, workSec(d)); } });
  let shortEasy = 0, easyLong = 0;
  for (const w of B) { if (w.deload) continue;
    const L = w.days.find((d) => d.role === "long")?.workout.km ?? 0;
    const E = w.days.filter((d) => d.role === "easy");
    if (E.some((d) => d.workout.sec < 1800 - 1e-9)) shortEasy++;
    for (const d of E) if (L > 0) easyLong = Math.max(easyLong, d.workout.km / L); }
  // ista doza iste zone, uzastopne ne-rasteretne nedelje izgradnje
  let sameRun = 0; const prevDose: Record<string, [string, number]> = {};
  for (const w of B) { if (w.deload) continue;
    // pojavljivanja zone (i kad se zone smenjuju, 3 dana R/T), ključ = blokovi treninga sa tom zonom
    for (const z of ["T", "I", "R", "RP"]) { const ds = w.days.filter((d) => d.role !== "race" && workSec(d, z) > 0); if (!ds.length) continue;
      const v = JSON.stringify(ds.map((d) => (d.workout as unknown as { blocks: unknown }).blocks));
      const pr = prevDose[z]; const n = pr && pr[0] === v ? pr[1] + 1 : 1; prevDose[z] = [v, n]; sameRun = Math.max(sameRun, n); } }
  const longStrides = W.filter((w) => w.phase === "sharpen" && w.days.some((d) => d.role === "long" && d.workout.segments.some((s) => s.kind === "stride"))).length;
  return {
    fam, days: p.input.runDays.length, exp: p.experience, mode: p.paceMode, vdot: Math.round(est(p) * 10) / 10,
    fp: createHash("sha1").update(JSON.stringify({ ...p, policyVersion: "" })).digest("hex").slice(0, 12),
    peakT: Math.max(0, ...B.map((w) => w.targetKm)), peakP: Math.max(0, ...B.map((w) => w.plannedKm)), startKm: p.input.currentWeeklyKm, wk1P: W[0]?.plannedKm ?? 0,
    iMax: Math.max(0, ...I) / 60, iWeeks: I.filter((x) => x > 0).length, iWeeksNonDeload: W.filter((w, i) => I[i]! > 0 && !w.deload && BUILD(w)).length, nWeeks: W.length,
    easyLongMax: Math.round(easyLong * 1000) / 1000, hardestFromEnd: W.length - 1 - hardest, preTaperShare: Math.round(preShare * 1000) / 1000,
    testWork, testPriorMax: testPrior, shortEasyWeeks: shortEasy, sameDoseRun: sameRun, longStrides,
    belowTarget: B.filter((w) => w.plannedKm < w.targetKm - 0.05).length,
  };
}

const [tag, a, b] = process.argv.slice(2);
if (tag === "cmp") {
  const A = JSON.parse(readFileSync(`${dir}r-${a}.json`, "utf8")) as { rej: string[]; rows: Record<string, Row> };
  const Bx = JSON.parse(readFileSync(`${dir}r-${b}.json`, "utf8")) as { rej: string[]; rows: Record<string, Row> };
  const newRej = Bx.rej.filter((x) => !A.rej.includes(x));
  let changed = 0; const g: Record<string, { n: number; ch: number; drop10: number; pdrop10: number }> = {};
  for (const [id, r] of Object.entries(A.rows)) { const s = Bx.rows[id]; if (!s) continue;
    const k = `${r.fam} ${r.days} d`; const x = (g[k] ??= { n: 0, ch: 0, drop10: 0, pdrop10: 0 }); x.n++;
    if (s.peakP < 0.9 * r.peakP - 1e-9) x.pdrop10++;
    if (s.fp !== r.fp) { changed++; x.ch++; } if (s.peakT < 0.9 * r.peakT - 1e-9) x.drop10++; }
  console.log(`odbijanja ${A.rej.length} → ${Bx.rej.length}, novih ${newRej.length}${newRej.length ? ": " + newRej.slice(0, 5).join(" | ") : ""}; promenjenih planova ${changed} / ${Object.keys(A.rows).length}`);
  console.log("grupa | planova | promenjeno | vrh cilja pao > 10 % | planirani vrh pao > 10 %");
  for (const k of Object.keys(g).sort()) console.log(`${k} | ${g[k]!.n} | ${g[k]!.ch} | ${g[k]!.drop10} | ${g[k]!.pdrop10}`);
} else if (tag === "prof") {
  // 12 profila P9 (P9/inputs.json): red po profilu → r-prof-<oznaka>.json i tabela
  const { generateFiveKV2 } = (await import("../../../../web/src/domain/generators/fiveK/v2/generate.ts")) as { generateFiveKV2: (i: unknown) => { ok: boolean; plan?: Plan } };
  const { vdotOrEstimate } = (await import("../../../../web/src/domain/generators/fiveK/v2/paces.ts")) as { vdotOrEstimate: (p: unknown) => number };
  const inputs = JSON.parse(readFileSync(`${dir}../P9/inputs.json`, "utf8"))["5K"] as { input: unknown }[];
  const rows: Record<string, Row> = {};
  inputs.forEach((x, i) => { const r = generateFiveKV2(x.input); if (r.ok) rows[`p${String(i + 1).padStart(2, "0")}`] = row("P9", r.plan!, (p) => p.vdot ?? vdotOrEstimate(p.paces)); });
  writeFileSync(`${dir}r-prof-${a}.json`, JSON.stringify(rows));
  console.log("profil | vrh I min | I ned | lagan/dugi | ned1/start | najteža od kraja | pre tapera | test/doza | lagan<30 ned");
  for (const [k, r] of Object.entries(rows)) console.log(`${k} | ${r.iMax.toFixed(1)} | ${r.iWeeksNonDeload} | ${r.easyLongMax} | ${(r.wk1P / r.startKm).toFixed(2)} | ${r.hardestFromEnd} | ${r.preTaperShare} | ${r.testWork ? (r.testWork / Math.max(1, r.testPriorMax)).toFixed(2) : "-"} | ${r.shortEasyWeeks}`);
} else {
  const dist = distOf("5K");
  const { vdotOrEstimate } = (await import("../../../../web/src/domain/generators/fiveK/v2/paces.ts")) as { vdotOrEstimate: (p: unknown) => number };
  const est = (p: Plan) => p.vdot ?? vdotOrEstimate(p.paces);
  const cases: { id: string; fam: string; input: unknown }[] = []; const seen = new Set<string>();
  for (const c of grid("5K")) { const k = JSON.stringify(c.input); if (!seen.has(k)) { seen.add(k); cases.push({ id: "P0:" + c.id, fam: c.family, input: c.input }); } }
  for (const c of dist.all()) { const k = JSON.stringify(c.input); if (!seen.has(k)) { seen.add(k); cases.push({ id: c.id, fam: c.family, input: c.input }); } }
  const rows: Record<string, Row> = {}; const rej: string[] = [];
  for (const c of cases) { const r = dist.generate(c.input) as { ok: boolean; plan?: Plan; reasons?: { code: string }[] };
    if (!r.ok) { rej.push(`${c.id}: ${r.reasons!.map((x) => x.code).join(",")}`); continue; }
    if (!r.plan!.weeks.length) continue; rows[c.id] = row(c.fam, r.plan!, est); }
  writeFileSync(`${dir}r-${tag}.json`, JSON.stringify({ rej, rows }));
  console.log(tag, Object.keys(rows).length, "planova, odbijanja", rej.length);
}
