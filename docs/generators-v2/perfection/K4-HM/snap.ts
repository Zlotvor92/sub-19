/* K4-HM — snimak mreža polumaratona (testInputs: grid02Inputs R, feelInputs F, beginnerInputs B): po planu
   odbijanje, heš plana (bez policyVersion) i mere pravila K3 (A–G). Poređenje dva snimka: diff.ts.
   Iz korena repoa: node --max-old-space-size=6144 docs/generators-v2/perfection/K4-HM/snap.ts <koren koda> <oznaka>
   (<koren koda> = koren repoa ili worktree starijeg SHA) → K4-HM/snap-<oznaka>.json (nije u gitu). */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
const dir = new URL(".", import.meta.url).pathname;
type Seg = { kind: string; km: number; sec: number; zone?: string };
const WORK = (s: Seg) => ["T", "I", "R", "RP"].includes(s.zone ?? "") && ["rep", "continuous"].includes(s.kind);
const workSec = (d: any, z?: string) => (d.workout.segments ?? []).filter((s: Seg) => WORK(s) && (!z || s.zone === z)).reduce((a: number, s: Seg) => a + s.sec, 0);
const workKm = (d: any, z?: string) => (d.workout.segments ?? []).filter((s: Seg) => WORK(s) && (!z || s.zone === z)).reduce((a: number, s: Seg) => a + s.km, 0);
const r2 = (x: number) => Math.round(x * 100) / 100;
const doseKey = (d: any) => (d.workout.dose ? `${d.workout.dose.zone}:${d.workout.dose.doseM}` : null);
export function metrics(p: any, input: any) {
  const W = p.weeks as any[];
  const build = W.filter((w) => !w.deload && w.phase !== "taper" && w.phase !== "race");
  const longOf = (w: any) => w.days.find((d: any) => d.role === "long") ?? null;
  const longKm = (w: any) => longOf(w)?.workout.km ?? 0;
  const longs = W.map(longKm);
  const longest = Math.max(...longs);
  const nonRace = W.filter((w) => w.phase !== "race");
  const wk = (w: any) => w.days.filter((d: any) => d.countsToWeek).reduce((a: number, d: any) => a + workSec(d), 0) / 60;
  const mins = nonRace.map(wk);
  const hardMin = Math.max(...mins);
  const hardIdx = nonRace[mins.indexOf(hardMin)]?.index ?? 0;
  const raceIdx = W[W.length - 1].index;
  const firstTaper = W.find((w) => w.phase === "taper")?.index ?? raceIdx;
  const pre = W.filter((w) => w.index < firstTaper && !w.deload && w.phase !== "taper");
  const lastPre = pre[pre.length - 1];
  // K3-A: najduži dugi u poslednje 3 ne-rasteretne nedelje pred taper; pad u specifičnoj ispod najdužeg iz razvoja
  const last3 = pre.slice(-3);
  const longestInLast3 = last3.some((w) => longKm(w) >= longest - 0.05);
  const devMax = Math.max(0, ...W.filter((w) => w.phase !== "specific" && w.phase !== "taper" && w.phase !== "race" && !w.deload).map(longKm));
  const specLongs = W.filter((w) => w.phase === "specific" && !w.deload).map(longKm);
  const specDrop = specLongs.length ? r2(devMax - Math.min(...specLongs)) : 0;
  const share45 = W.filter((w) => w.phase !== "race" && longKm(w) > 0.45 * w.plannedKm + 1e-9).length;
  // K3-B: taper RP rad / poslednja RP doza pred taper (minuti)
  const rpMin = (w: any) => Math.max(0, ...w.days.filter((d: any) => d.role === "q1" || d.role === "q2").map((d: any) => workSec(d, "RP") / 60));
  const lastRp = [...pre].reverse().map(rpMin).find((x) => x > 0) ?? 0;
  const taperRp = Math.max(0, ...W.filter((w) => w.phase === "taper").map(rpMin));
  // K3-C: lagan/dugi u izgradnji; najduži niz iste doze iste zone kroz ne-rasteretne nedelje
  let easyLong = 0;
  for (const w of build) {
    const L = longKm(w);
    const easy = w.days.filter((d: any) => d.role === "easy").map((d: any) => d.workout.km);
    if (L > 0 && easy.length) easyLong = Math.max(easyLong, Math.max(...easy) / L);
  }
  let sameRun = 0;
  const runs: Record<string, number> = {};
  for (const w of build) {
    const keys = new Set(w.days.map(doseKey).filter(Boolean) as string[]);
    for (const k of Object.keys(runs)) if (!keys.has(k)) delete runs[k];
    for (const k of keys) { runs[k] = (runs[k] ?? 0) + 1; sameRun = Math.max(sameRun, runs[k]); }
  }
  // K3-E: RP blok u dugom
  const blockKm = Math.max(0, ...W.map((w) => (longOf(w) ? workKm(longOf(w), "RP") : 0)));
  const blocks = W.filter((w) => longOf(w) && workKm(longOf(w), "RP") > 0).map((w) => r2(workKm(longOf(w), "RP")));
  // K3-F: dugi na plafonu (najdužem) — broj i najduži niz ne-rasteretnih nedelja
  const nd = W.filter((w) => !w.deload && w.phase !== "race" && w.phase !== "taper");
  let topRun = 0, cur = 0;
  for (const w of nd) { if (longKm(w) >= longest - 0.05) { cur++; topRun = Math.max(topRun, cur); } else cur = 0; }
  const atTop = longs.filter((x) => x >= longest - 0.05).length;
  // K3-G: lagan < 30 min u nedeljama izgradnje; test / najveća ranija doza (min)
  const shortEasy = build.filter((w) => w.days.some((d: any) => d.role === "easy" && d.workout.sec < 1800)).length;
  let maxDose = 0, testRatio = 0;
  for (const w of W) {
    for (const d of w.days) {
      if (d.role === "test") { const t = d.workout.segments.filter((x: Seg) => x.kind === "test").reduce((a: number, x: Seg) => a + x.sec, 0) / 60; if (maxDose > 0) testRatio = Math.max(testRatio, t / maxDose); }
      else if (d.role === "q1" || d.role === "q2") maxDose = Math.max(maxDose, workSec(d) / 60);
    }
  }
  const peak = Math.max(...build.map((w) => w.targetKm));
  return {
    peak, start: input.currentWeeklyKm, longest, longestInLast3: longestInLast3 ? 1 : 0, specDrop, share45,
    lastRp: r2(lastRp), taperRp: r2(taperRp), taperShare: lastRp ? r2(taperRp / lastRp) : 0,
    easyLong: r2(easyLong), sameRun, blockKm: r2(blockKm), blocks: blocks.join("/"),
    atTop, topRun, hardFromRace: raceIdx - hardIdx, lastPreShare: lastPre && hardMin ? r2(wk(lastPre) / hardMin) : 0,
    shortEasy, testRatio: r2(testRatio), testMaxDose: r2(maxDose),
    spec3: input.runDays.length === 3 ? W.filter((w) => w.phase === "specific" && !w.deload).map((w) => `${r2(longKm(w))}:${r2(rpMin(w))}`).join(",") : "", vdot: p.paces?.vdot ?? null,
    // K4-A: dugi po nedeljama (3 dana), broj nedelja sa blokom, km RP u dugom ukupno; K4-B: najkraći lagan (s) u izgradnji
    longs3: input.runDays.length === 3 ? W.filter((w) => w.phase !== "race").map((w) => r2(longKm(w))).join("/") : "",
    nBlock: blocks.length, blockSum: r2(blocks.reduce((a, x) => a + x, 0)),
    minEasy: Math.min(99999, ...build.flatMap((w) => w.days.filter((d: any) => d.role === "easy" && d.workout.km > 0).map((d: any) => d.workout.sec))),
    optWeeks: W.filter((w: any) => w.notes.some((n: string) => n.startsWith("Kratak lagan dan"))).length,
    optKm: r2(W.reduce((a: number, w: any) => a + (w.notes.some((n: string) => n.startsWith("Kratak lagan dan")) ? w.targetKm - w.plannedKm : 0), 0)),
    easySum: r2(build.reduce((a: number, w: any) => a + w.days.filter((d: any) => d.role === "easy").reduce((b: number, d: any) => b + d.workout.km, 0), 0)),
    planned: r2(build.reduce((a: number, w: any) => a + w.plannedKm, 0)), target: r2(build.reduce((a: number, w: any) => a + w.targetKm, 0)),
    warn: p.warnings.map((x: any) => x.rule ?? x.code),
  };
}
const main = process.argv[1]?.endsWith("snap.ts");
const [root, tag] = [process.argv[2]!, process.argv[3]!];
const V2 = `${root}/web/src/domain/generators/halfMarathon/v2`;
const T = main ? await import(`${V2}/testInputs.ts`) : null;
const gen = main ? (await import(`${V2}/generate.ts`)).generateHmV2 : null;
const out: Record<string, any> = {};
const t0 = Date.now();
if (main) {
  for (const [fam, list] of [["R", T.grid02Inputs()], ["F", T.feelInputs()], ["B", T.beginnerInputs()]] as const) {
    for (const c of list) {
      const r = gen(c.input);
      if (!r.ok) { out[c.id] = { fam, days: c.days, ok: false, reasons: r.reasons.map((x: any) => `${x.code} ${(x.message ?? "").slice(0, 120)}`) }; continue; }
      const h = createHash("sha1").update(JSON.stringify({ ...r.plan, policyVersion: null })).digest("hex").slice(0, 12);
      out[c.id] = { fam, days: c.days, ok: true, h, m: metrics(r.plan, c.input) };
    }
    console.log(fam, list.length, Math.round((Date.now() - t0) / 1000) + " s");
  }
  writeFileSync(`${dir}snap-${tag}.json`, JSON.stringify(out));
}
