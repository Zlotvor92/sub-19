/* K4-10K — merenje K4-B (kopija K4-10K/measure.ts + opt) na mreži 10K (final-check lib.all() + P0 mreža).
   Iz web/: node ../docs/generators-v2/perfection/K4-10K/measure.ts <oznaka>      → K4-10K/r-<oznaka>.json (red po planu)
            node ../docs/generators-v2/perfection/K4-10K/measure.ts cmp <A> <B>  → poređenje (promenjeni, odbijanja, vrh obima)
            node ../docs/generators-v2/perfection/K4-10K/measure.ts prof <oznaka> → 12 profila P9 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { distOf } from "../../final-check/lib.ts";
import { grid } from "../P0/common.ts";
import { P35_DROP } from "../../../../web/src/domain/generators/tenK/v2/week.ts";

const dir = new URL(".", import.meta.url).pathname;
type Seg = { kind: string; zone: string; km: number; sec: number };
type Day = { role: string; date: string; countsToWeek: boolean; workout: { kind: string; km: number; sec: number; qualityType: string | null; blocks: unknown; segments: Seg[]; dose: { zone: string; doseM: number } | null } };
type Week = { index: number; phase: string; deload: boolean; targetKm: number; plannedKm: number; days: Day[]; notes: string[] };
type Plan = { vdot: number | null; paces: { vdot: number }; paceBasis: string; startKm: number; input: { runDays: string[]; currentWeeklyKm: number; experience?: string }; weeks: Week[]; warnings: { rule: string }[]; notes: string[] };
export type Row = {
  fam: string; days: number; exp: string; mode: string; vdot: number; fp: string;
  peakT: number; peakP: number; startKm: number; wk1P: number; nWeeks: number;
  iMax: number; iWeeksNonDeload: number; // K3-A I (min rada jednog treninga)
  rpMax: number; rpPeakT: number; // K3-A RP (min), cilj nedelje vrha RP
  easyLongMax: number; // najveći odnos lagan/dugi (ne-rasteretne nedelje izgradnje)
  hardestFromEnd: number; preTaperShare: number; // K3-D (0 = trkačka nedelja)
  testWork: number; testPriorMax: number; // K3-E [s]
  shortEasyWeeks: number; // K3-F: ne-rasteretne nedelje izgradnje sa laganim < 30 min
  sameDoseRun: number; // K3-C: najduži niz iste doze iste zone (ne-rasteretne)
  longT: number; // K3-C: dugi sa T u specifičnoj fazi (nedelja)
  belowTarget: number;
  dropped: number; // upozorenje DOSE_DROPPED
  taperNoQ: number; // taper bez kvaliteta
  p35: number; // nedelje pouke 35 (drugi dan kvaliteta lagan)
  optW: number; // K4-B: nedelje sa danom „po želji"
  shortKm: number; // K4-B: zbir (cilj − planirano) u izgradnji
  easySum: number; // zbir laganih km u izgradnji
};
const workSec = (d: Day, z?: string) => d.workout.segments.filter((s) => (["rep", "continuous"].includes(s.kind) && !["E", "jog"].includes(s.zone) && (!z || s.zone === z)) || (!z && s.kind === "test")).reduce((a, s) => a + s.sec, 0);
const BUILD = (w: Week) => ["base", "development", "specific"].includes(w.phase);

function row(fam: string, p: Plan): Row {
  const W = p.weeks;
  const B = W.filter(BUILD);
  const zmax = (z: string) => W.map((w) => Math.max(0, ...w.days.filter((d) => d.role !== "race" && d.role !== "long").map((d) => workSec(d, z))));
  const I = zmax("I"); const RP = zmax("RP");
  let rpI = 0; RP.forEach((x, i) => { if (x > RP[rpI]!) rpI = i; });
  const wkWork = W.map((w) => w.days.filter((d) => d.role !== "race").reduce((a, d) => a + workSec(d), 0));
  let hardest = 0; W.forEach((w, i) => { if (w.phase !== "race" && w.phase !== "taper" && wkWork[i]! > wkWork[hardest]!) hardest = i; });
  const taper0 = W.findIndex((w) => w.phase === "taper" || w.phase === "race");
  const pre = [...W.slice(0, taper0 < 0 ? W.length : taper0)].reverse().find((w) => !w.deload);
  const preShare = pre && wkWork[hardest]! > 0 ? wkWork[pre.index - 1]! / wkWork[hardest]! : 0;
  let testWork = 0, testPrior = 0;
  W.forEach((w, i) => { const t = w.days.find((d) => d.workout.kind === "test");
    if (t && !testWork) { testWork = t.workout.segments.filter((s) => s.kind === "test").reduce((a, s) => a + s.sec, 0);
      for (let j = 0; j < i; j++) for (const d of W[j]!.days) if (d.workout.kind === "quality") testPrior = Math.max(testPrior, workSec(d)); } });
  let shortEasy = 0, easyLong = 0;
  for (const w of B) { if (w.deload) continue;
    const L = w.days.find((d) => d.role === "long")?.workout.km ?? 0;
    const E = w.days.filter((d) => d.role === "easy");
    if (E.some((d) => d.workout.sec < 1800 - 1e-9)) shortEasy++;
    for (const d of E) if (L > 0) easyLong = Math.max(easyLong, d.workout.km / L); }
  let sameRun = 0; const prevDose: Record<string, [string, number]> = {};
  for (const w of B) { if (w.deload) continue;
    for (const z of ["T", "I", "R", "RP"]) { const ds = w.days.filter((d) => d.role !== "race" && d.role !== "long" && workSec(d, z) > 0); if (!ds.length) continue;
      const v = JSON.stringify(ds.map((d) => d.workout.blocks));
      const pr = prevDose[z]; const n = pr && pr[0] === v ? pr[1] + 1 : 1; prevDose[z] = [v, n]; sameRun = Math.max(sameRun, n); } }
  const longT = W.filter((w) => w.phase === "specific" && w.days.some((d) => d.role === "long" && workSec(d, "T") > 0)).length;
  return {
    fam, days: p.input.runDays.length, exp: p.input.experience ?? "", mode: p.paceBasis, vdot: Math.round((p.vdot ?? p.paces.vdot) * 10) / 10,
    fp: createHash("sha1").update(JSON.stringify({ ...p, policyVersion: "" })).digest("hex").slice(0, 12),
    peakT: Math.max(0, ...B.map((w) => w.targetKm)), peakP: Math.max(0, ...B.map((w) => w.plannedKm)), startKm: p.input.currentWeeklyKm, wk1P: W[0]?.plannedKm ?? 0, nWeeks: W.length,
    iMax: Math.max(0, ...I) / 60, iWeeksNonDeload: W.filter((w, i) => I[i]! > 0 && !w.deload && BUILD(w)).length,
    rpMax: Math.max(0, ...RP.filter((_, i) => W[i]!.phase !== "taper" && W[i]!.phase !== "race")) / 60, rpPeakT: W[rpI]?.targetKm ?? 0,
    easyLongMax: Math.round(easyLong * 1000) / 1000, hardestFromEnd: W.length - 1 - hardest, preTaperShare: Math.round(preShare * 1000) / 1000,
    testWork, testPriorMax: testPrior, shortEasyWeeks: shortEasy, sameDoseRun: sameRun, longT,
    belowTarget: B.filter((w) => w.plannedKm < w.targetKm - 0.05).length,
    dropped: p.warnings.some((x) => x.rule === "DOSE_DROPPED") ? 1 : 0,
    p35: W.filter((w) => w.notes.some((n) => n.startsWith(P35_DROP))).length,
    optW: W.filter((w) => w.notes.some((n) => n.startsWith("Kratak lagan dan"))).length,
    shortKm: Math.round(B.filter((w) => !w.deload).reduce((a, w) => a + Math.max(0, w.targetKm - w.plannedKm), 0) * 10) / 10,
    easySum: Math.round(B.filter((w) => !w.deload).reduce((a, w) => a + w.days.filter((d) => d.role === "easy").reduce((x, d) => x + d.workout.km, 0), 0) * 10) / 10,
    taperNoQ: W.some((w) => w.phase === "taper" && !w.days.some((d) => d.workout.kind === "quality")) ? 1 : 0,
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
  const { generateTenKV2 } = (await import("../../../../web/src/domain/generators/tenK/v2/generate.ts")) as { generateTenKV2: (i: unknown) => { ok: boolean; plan?: Plan } };
  const inputs = JSON.parse(readFileSync(`${dir}../P9/inputs.json`, "utf8"))["10K"] as { input: unknown }[];
  const rows: Record<string, Row> = {};
  inputs.forEach((x, i) => { const r = generateTenKV2(x.input); if (r.ok) rows[`p${String(i + 1).padStart(2, "0")}`] = row("P9", r.plan!); });
  writeFileSync(`${dir}r-prof-${a}.json`, JSON.stringify(rows));
  console.log("profil | vrh I min | vrh RP min | I ned | lagan/dugi | ned1/start | najteža od kraja | pre tapera | test/doza | lagan<30 ned | ista doza | dugi+T");
  for (const [k, r] of Object.entries(rows)) console.log(`${k} | ${r.iMax.toFixed(1)} | ${r.rpMax.toFixed(1)} | ${r.iWeeksNonDeload} | ${r.easyLongMax} | ${(r.wk1P / r.startKm).toFixed(2)} | ${r.hardestFromEnd} | ${r.preTaperShare} | ${r.testWork ? (r.testWork / Math.max(1, r.testPriorMax)).toFixed(2) : "-"} | ${r.shortEasyWeeks} | ${r.sameDoseRun} | ${r.longT}`);
} else {
  const dist = distOf("10K");
  const cases: { id: string; fam: string; input: unknown }[] = []; const seen = new Set<string>();
  for (const c of grid("10K")) { const k = JSON.stringify(c.input); if (!seen.has(k)) { seen.add(k); cases.push({ id: "P0:" + c.id, fam: c.family, input: c.input }); } }
  for (const c of dist.all()) { const k = JSON.stringify(c.input); if (!seen.has(k)) { seen.add(k); cases.push({ id: c.id, fam: c.family, input: c.input }); } }
  const rows: Record<string, Row> = {}; const rej: string[] = [];
  for (const c of cases) { const r = dist.generate(c.input) as { ok: boolean; plan?: Plan; reasons?: { code: string }[] };
    if (!r.ok) { rej.push(`${c.id}: ${(r.reasons ?? []).map((x) => x.code).join(",")}`); continue; }
    if (!r.plan!.weeks.length) continue; rows[c.id] = row(c.fam, r.plan!); }
  writeFileSync(`${dir}r-${tag}.json`, JSON.stringify({ rej, rows }));
  console.log(tag, Object.keys(rows).length, "planova, odbijanja", rej.length);
}
