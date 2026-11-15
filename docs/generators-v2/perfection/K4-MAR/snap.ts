/* K4-MAR — snimak mreža maratona (testInputs: gridInputs R, feelInputs F, beginnerInputs B; 31 920 ulaza): po planu
   odbijanje, heš plana (bez policyVersion) i mere pravila K3. Poređenje dva snimka: diff.ts.
   Iz korena repoa: node --max-old-space-size=6144 docs/generators-v2/perfection/K4-MAR/snap.ts <koren koda> <oznaka>
   (<koren koda> = koren repoa ili worktree starijeg SHA) → K4-MAR/snap-<oznaka>.json (nije u gitu). */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
const dir = new URL(".", import.meta.url).pathname;
type Seg = { kind: string; km: number; sec: number; zone?: string };
const WORK = (s: Seg) => s.zone !== undefined && !["E", "jog", "walk"].includes(s.zone) && !["recovery", "warmup", "cooldown", "stride"].includes(s.kind);
const workSec = (d: any, z?: string) => (d.workout.segments ?? []).filter((s: Seg) => WORK(s) && (!z || s.zone === z)).reduce((a: number, s: Seg) => a + s.sec, 0);
const workKm = (d: any, z?: string) => (d.workout.segments ?? []).filter((s: Seg) => WORK(s) && (!z || s.zone === z)).reduce((a: number, s: Seg) => a + s.km, 0);
const r2 = (x: number) => Math.round(x * 100) / 100;
export function metrics(p: any, input: any) {
  const W = p.weeks as any[];
  const build = W.filter((w) => !w.deload && w.phase !== "taper" && w.phase !== "race");
  const longOf = (w: any) => w.days.find((d: any) => d.role === "long") ?? null;
  const longs = W.map((w) => longOf(w)?.workout.km ?? 0);
  const longest = Math.max(...longs);
  const nonRace = W.filter((w) => w.phase !== "race");
  const wk = (w: any) => w.days.filter((d: any) => d.countsToWeek).reduce((a: number, d: any) => a + workSec(d), 0) / 60;
  const mins = nonRace.map(wk);
  const hardIdx = nonRace[mins.indexOf(Math.max(...mins))]?.index ?? 0;
  const raceIdx = W[W.length - 1].index;
  const firstTaper = W.find((w) => w.phase === "taper")?.index ?? raceIdx;
  const lastPre = [...W].reverse().find((w) => w.index < firstTaper && !w.deload);
  const hardMin = Math.max(...mins);
  let easyLong = 0, longShare45 = 0, eve = 0, blockMpKm = 0, blocks3 = 0;
  for (const w of W) {
    if (w.phase === "race") continue;
    const L = longOf(w);
    if (!L) continue;
    const easy = w.days.filter((d: any) => d.role === "easy").map((d: any) => d.workout.km);
    if (!w.deload && w.phase !== "taper" && easy.length) easyLong = Math.max(easyLong, Math.max(...easy) / L.workout.km);
    if (L.workout.km > 0.45 * w.plannedKm + 1e-9) longShare45++;
    const i = w.days.indexOf(L);
    const prev = i > 0 ? w.days[i - 1] : null;
    if (prev && prev.date === new Date(Date.parse(L.date) - 86400000).toISOString().slice(0, 10) && prev.workout.km > 0) eve = Math.max(eve, prev.workout.km / L.workout.km);
    blockMpKm = Math.max(blockMpKm, workKm(L, "MP"));
    if (workKm(L) > 0 && w.phase === "specific") blocks3++;
  }
  const atTop = longs.filter((x) => x >= longest - 0.05).length;
  // K4: nedelje sa blokom MP u dugom, km MP u dugom ukupno, najduži niz ne-rasteretnih nedelja izgradnje na najdužem dugom.
  let blocks = 0, mpLongKm = 0, run = 0, topRun = 0, easyMin = Infinity, shortEasyWeeks = 0;
  for (const w of W) {
    const L = longOf(w); const bk = L ? workKm(L, "MP") : 0;
    if (bk > 0) { blocks++; mpLongKm += bk; }
    if (w.deload || w.phase === "taper" || w.phase === "race") { if (w.phase === "taper" || w.phase === "race") run = 0; continue; }
    run = L && L.workout.km >= longest - 0.05 ? run + 1 : 0; topRun = Math.max(topRun, run);
    const es = w.days.filter((d: any) => d.role === "easy" && d.workout.km > 0).map((d: any) => d.workout.sec / 60);
    if (es.length) { const m = Math.min(...es); easyMin = Math.min(easyMin, m); if (m < 30 - 1e-9) shortEasyWeeks++; }
  }
  const peak = Math.max(...build.map((w) => w.targetKm));
  return {
    blocks, mpLongKm: r2(mpLongKm), topRun, easyMin: Math.round(easyMin === Infinity ? 0 : easyMin), shortEasyWeeks,
    peak, start: input.currentWeeklyKm, longest, atTop, longShare45,
    hoursPeak: Math.max(...nonRace.map((w) => w.days.filter((d: any) => d.countsToWeek).reduce((a: number, d: any) => a + d.workout.sec, 0) / 3600)),
    hardFromRace: raceIdx - hardIdx, lastPreShare: lastPre ? wk(lastPre) / hardMin : 0,
    easyLong: r2(easyLong), eve: r2(eve), blockMpKm: r2(blockMpKm), blocksSpec: blocks3,
    longMin: Math.max(0, ...W.map((w) => (longOf(w)?.workout.sec ?? 0) / 60)),
    mpMidMax: Math.max(0, ...W.filter((w) => w.phase !== "taper" && w.phase !== "race").flatMap((w) => w.days.filter((d: any) => d.role === "q1" || d.role === "q2").map((d: any) => workSec(d, "MP") / 60))),
    testMin: Math.max(0, ...W.flatMap((w) => w.days.filter((d: any) => d.role === "test").map((d: any) => workSec(d) / 60))),
    warn: p.warnings.map((x: any) => x.rule),
  };
}
const main = process.argv[1]?.endsWith("snap.ts");
const [root, tag] = [process.argv[2]!, process.argv[3]!];
const V2 = `${root}/web/src/domain/generators/marathon/v2`;
const T = main ? await import(`${V2}/testInputs.ts`) : null;
const gen = main ? (await import(`${V2}/generate.ts`)).generateMarathonV2 : null;
const out: Record<string, any> = {};
const t0 = Date.now();
if (main) {
for (const [fam, list] of [["R", T.gridInputs()], ["F", T.feelInputs()], ["B", T.beginnerInputs()]] as const) {
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
