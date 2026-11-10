/* P8-5K — merenje na mreži P0 + punoj mreži 5K (final-check lib.all()) i 12 profila P7.
   Iz web/: node ../docs/generators-v2/perfection/P8-5K/measure.ts <oznaka>   (npr. pre, posle)
   Izlaz: P8-5K/m-<oznaka>.json (agregati) i P8-5K/fp-<oznaka>.json (otisak po planu, za „promenjeni planovi po klasi"). */
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { distOf } from "../../final-check/lib.ts";
import { grid } from "../P0/common.ts";

const tag = process.argv[2] ?? "x";
const dir = new URL(".", import.meta.url).pathname;
const dist = distOf("5K");
type Seg = { kind: string; zone?: string; km: number; sec: number };
type Day = { role: string; date: string; countsToWeek: boolean; workout: { kind: string; km: number; sec: number; qualityType?: string | null; segments: Seg[]; blocks?: { kind: string; km?: number }[] } };
type Week = { index: number; phase: string; deload: boolean; test?: boolean; targetKm: number; plannedKm: number; days: Day[]; notes: string[] };
const WORK = (s: Seg) => !["recovery", "warmup", "cooldown", "stride"].includes(s.kind) && s.zone !== undefined && !["E", "jog", "walk"].includes(s.zone);
const zoneWork = (d: Day, z: string, unit: "km" | "sec") => d.workout.segments.filter((s) => WORK(s) && s.zone === z).reduce((a, s) => a + s[unit], 0);
const BUILD = (w: Week) => ["base", "peak", "sharpen"].includes(w.phase);

const cases: { id: string; fam: string; input: unknown }[] = [];
const seen = new Set<string>();
for (const c of grid("5K")) { const k = JSON.stringify(c.input); if (!seen.has(k)) { seen.add(k); cases.push({ id: "P0:" + c.id, fam: c.family, input: c.input }); } }
for (const c of dist.all()) { const k = JSON.stringify(c.input); if (!seen.has(k)) { seen.add(k); cases.push({ id: c.id, fam: c.family, input: c.input }); } }

const agg: Record<string, number> = {};
const inc = (k: string, n = 1) => (agg[k] = (agg[k] ?? 0) + n);
const fp: Record<string, string> = {};
const rej: string[] = [];
const ex: Record<string, string[]> = {};
const note = (k: string, id: string) => { inc(k); const a = (ex[k] ??= []); if (a.length < 6) a.push(id); };
let plateauLongSum = 0, plateauVolSum = 0, n = 0;
for (const c of cases) {
  const r = dist.generate(c.input) as { ok: boolean; plan?: { weeks: Week[]; warnings: { rule: string; message: string }[]; notes: string[]; experience: string; input: { runDays: string[] } }; reasons?: { code: string }[] };
  if (!r.ok) { rej.push(`${c.id}: ${r.reasons!.map((x) => x.code).join(",")}`); fp[c.id] = "REJ"; continue; }
  const p = r.plan!;
  fp[c.id] = createHash("sha1").update(JSON.stringify(p)).digest("hex").slice(0, 12);
  n++; inc(`fam_${c.fam}`);
  const W = p.weeks;
  // plato dugog i obima (uzastopne ne-rasteretne nedelje izgradnje, isti dugi / isti cilj)
  let run = 0, prev = -1, best = 0, runV = 0, prevV = -1, bestV = 0;
  for (const w of W) { if (!BUILD(w) || w.deload) continue;
    const L = w.days.find((d) => d.role === "long")?.workout.km ?? 0;
    run = prev >= 0 && Math.abs(L - prev) <= 0.1 + 1e-9 ? run + 1 : 1; prev = L; best = Math.max(best, run);
    runV = prevV >= 0 && Math.abs(w.targetKm - prevV) <= 0.1 + 1e-9 ? runV + 1 : 1; prevV = w.targetKm; bestV = Math.max(bestV, runV); }
  plateauLongSum += best; plateauVolSum += bestV;
  if (best >= 6) note("plato_dugog_>=6", c.id);
  if (bestV >= 6) note("plato_obima_>=6", c.id);
  // vrh obima: nedelja dostizanja
  const peakT = Math.max(...W.filter(BUILD).map((w) => w.targetKm));
  const firstPeak = W.find((w) => BUILD(w) && w.targetKm >= peakT - 1e-9)!.index;
  const lastDev = Math.max(...W.filter((w) => (w.phase === "base" || w.phase === "peak")).map((w) => w.index));
  inc("vrh_dostignut_ned_sum", firstPeak); inc("kraj_razvoja_ned_sum", lastDev);
  // % brzih km
  for (const w of W) { if (w.phase === "race") continue;
    const fast = w.days.filter((d) => d.countsToWeek).reduce((a, d) => a + d.workout.segments.filter(WORK).reduce((b, s) => b + s.km, 0), 0);
    if (w.plannedKm > 0 && fast / w.plannedKm > 0.25 + 1e-9) note("nedelje_>25%", `${c.id}#${w.index}`);
    if (w.plannedKm > 0 && fast / w.plannedKm > 0.30 + 1e-9) note("nedelje_>30%", `${c.id}#${w.index}`);
  }
  // doze po zoni: poslednja ne-rasteretna doza izgradnje
  const last: Record<string, number> = {};
  const unit = (d: Day): "km" | "sec" => (d.workout.segments.some((s) => WORK(s) && s.km > 0 && d.workout.qualityType && /FARTLEK|HILLS|TEMPO_FEEL|FEEL/.test(String(d.workout.qualityType))) ? "sec" : "sec");
  let firstI: number | null = null; let lastR: number | null = null;
  for (const w of W) {
    const qd = w.days.filter((d) => d.workout.kind === "quality" && d.role !== "race" && d.role !== "test");
    const dose: Record<string, number> = {};
    for (const d of qd) for (const z of ["T", "I", "R", "RP"]) { const v = zoneWork(d, z, unit(d)); if (v > 0) dose[z] = (dose[z] ?? 0) + v; }
    if (BUILD(w) && !w.deload) {
      if (dose["I"] && firstI === null && w.phase === "peak") { firstI = dose["I"]; if (lastR !== null) { inc("prvi_I_posle_R_n"); inc("prvi_I_posle_R_sec_sum", dose["I"]); inc("poslednji_R_sec_sum", lastR); } }
      if (dose["R"] && w.phase === "base") lastR = dose["R"];
    }
    if (w.deload) for (const [z, v] of Object.entries(dose)) { if (last[z] && v > 0.6 * last[z] + 1) note(`rasterecenje_${z}>60%`, `${c.id}#${w.index}`); if (last[z] && v >= last[z] - 1) note(`rasterecenje_${z}>=pune`, `${c.id}#${w.index}`); }
    if (w.phase === "taper") for (const [z, v] of Object.entries(dose)) { if (last[z] && v > 0.7 * last[z] + 1) note(`taper_${z}>70%`, `${c.id}#${w.index}`); }
    if (w.phase === "taper" && !dose["RP"]) note("taper_bez_RP", `${c.id}#${w.index}`);
    if (w.phase === "sharpen" && !w.deload && !dose["RP"]) note("ostrenje_faza_bez_RP", `${c.id}#${w.index}`);
    if (w.phase === "race" && !w.days.some((d) => d.role !== "race" && d.workout.kind === "quality")) note("trkacka_bez_ostrenja", c.id);
    if (BUILD(w) && !w.deload) for (const [z, v] of Object.entries(dose)) last[z] = v;
    // dugi rasterećenja
    if (w.deload) { const L = w.days.find((d) => d.role === "long")?.workout.km ?? 0; const pw = [...W].slice(0, w.index - 1).reverse().find((x) => !x.deload && BUILD(x)); const PL = pw?.days.find((d) => d.role === "long")?.workout.km ?? 0; if (PL && L > 0.8 * PL + 0.15) note("dugi_rasterecenja_>0.8", `${c.id}#${w.index}`); }
    // dan kvaliteta duži od dugog
    const L = w.days.find((d) => d.role === "long")?.workout.km ?? 0;
    if (L && qd.some((d) => d.workout.km > L + 1e-9)) note("kvalitet_duzi_od_dugog", `${c.id}#${w.index}`);
  }
  // trkački dan
  const race = W[W.length - 1]!.days.find((d) => d.role === "race")!;
  inc(`trka_${race.workout.km.toFixed(1)}km`);
  const maxOther = Math.max(...W.flatMap((w) => w.days.filter((d) => d !== race).map((d) => d.workout.km)));
  if (race.workout.km >= maxOther - 1e-9) note("trka_najduzi_dan", c.id);
  // početnik
  if (p.experience === "beginner") inc("pocetnik");
  // tekst
  const txt = [...p.notes, ...W.flatMap((w) => w.notes), ...p.warnings.map((x) => x.message)].join("\n");
  for (const bad of ["nije izvodljiv", "odstupanje", "cilj po pravilu", "ispred", "pouka", "Odluka"]) if (txt.includes(bad)) note(`tekst_${bad}`, c.id);
  const wr = new Map<string, number>(); for (const x of p.warnings) wr.set(x.rule, (wr.get(x.rule) ?? 0) + 1);
  for (const [k, v] of wr) if (v > 1) note(`upozorenje_ponovljeno_${k}`, c.id);
}
const out = { tag, inputs: cases.length, ok: n, rejected: rej.length, rejectedList: rej.slice(0, 50), plateauLongAvg: +(plateauLongSum / n).toFixed(2), plateauVolAvg: +(plateauVolSum / n).toFixed(2), counts: Object.fromEntries(Object.entries(agg).sort()), examples: ex };
writeFileSync(`${dir}m-${tag}.json`, JSON.stringify(out, null, 1));
writeFileSync(`${dir}fp-${tag}.json`, JSON.stringify(fp));
console.log(JSON.stringify({ ...out, examples: undefined, rejectedList: undefined }, null, 0));
