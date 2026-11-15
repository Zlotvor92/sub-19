/* P8-MAR — mreže 02, 03 po osećaju i 03 početnika (testInputs: gridInputs, feelInputs, beginnerInputs; 31 920 ulaza):
   stari kod (worktree polaznog SHA, argument 1) prema tekućem. Odbijanja staro/novo, planovi bajt-isti (bez
   policyVersion) → stabilni, i zbirne mere pre/posle po porodici.
   Iz korena repoa: node --max-old-space-size=6144 docs/generators-v2/perfection/P8-MAR/classify.ts <worktree> <sha>
   → web/src/domain/generators/marathon/v2/segmentP8.stable-<sha>.json, docs/generators-v2/perfection/P8-MAR/classify-<sha>.json */
import { writeFileSync } from "node:fs";
const [wt, sha] = [process.argv[2]!, process.argv[3]!];
const NEW = new URL("../../../../web/src/domain/generators/marathon/v2", import.meta.url).pathname;
const OLD = `${wt}/web/src/domain/generators/marathon/v2`;
const T = await import(`${NEW}/testInputs.ts`);
const genN = (await import(`${NEW}/generate.ts`)).generateMarathonV2;
const genO = (await import(`${OLD}/generate.ts`)).generateMarathonV2;
const strip = (p: any) => JSON.stringify({ ...p, policyVersion: null });
const stable: string[] = [];
const out: Record<string, any> = {};
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : 0; };
const work = (d: any, z: string) => d.workout.segments.filter((s: any) => s.zone === z && !["recovery", "warmup", "cooldown", "stride"].includes(s.kind)).reduce((a: number, s: any) => a + s.sec, 0) / 60;
function m(p: any) {
  const W = p.weeks, build = W.filter((w: any) => !w.deload && w.phase !== "taper" && w.phase !== "race");
  const q = (w: any) => w.days.filter((d: any) => d.role === "q1" || d.role === "q2");
  const taper = W.filter((w: any) => w.phase === "taper"), race = W.find((w: any) => w.phase === "race");
  const longs = W.map((w: any) => w.days.find((d: any) => d.role === "long")?.workout.km ?? 0);
  let over25 = 0;
  for (const w of W) { if (w.phase === "race") continue; const segs = w.days.filter((d: any) => d.countsToWeek).flatMap((d: any) => d.workout.segments);
    const fast = segs.filter((s: any) => s.zone && !["E", "jog", "walk"].includes(s.zone) && !["recovery", "warmup", "cooldown", "stride"].includes(s.kind)).reduce((a: number, s: any) => a + s.km, 0);
    const all = segs.reduce((a: number, s: any) => a + s.km, 0); if (all > 0 && fast / all > 0.25) over25++; }
  return {
    peak: Math.max(...build.map((w: any) => w.targetKm)),
    hours: Math.max(...W.filter((w: any) => w.phase !== "race").map((w: any) => w.days.filter((d: any) => d.countsToWeek).reduce((a: number, d: any) => a + d.workout.sec, 0) / 3600)),
    long: Math.max(...longs),
    mpMid: Math.max(0, ...W.filter((w: any) => w.phase !== "taper").flatMap((w: any) => q(w).map((d: any) => work(d, "MP")))),
    t: Math.max(0, ...W.flatMap((w: any) => q(w).map((d: any) => work(d, "T")))),
    i: Math.max(0, ...W.flatMap((w: any) => q(w).map((d: any) => work(d, "I")))),
    mpTotalKm: W.filter((w: any) => w.phase !== "race").flatMap((w: any) => w.days).reduce((a: number, d: any) => a + (d.workout.workKm?.MP ?? 0), 0),
    taper1: taper[1] ? Math.max(0, ...q(taper[1]).map((d: any) => work(d, "MP"))) : 0,
    sharp: race ? Math.max(0, ...race.days.filter((d: any) => d.role === "sharpener").map((d: any) => work(d, "MP"))) : 0,
    over25, test: W.some((w: any) => w.days.some((d: any) => d.role === "test")) ? 1 : 0,
    dropped: p.warnings.filter((v: any) => v.rule === "DOSE_DROPPED").length,
    capLimited: p.warnings.some((v: any) => v.rule === "CAPACITY_LIMITED") || p.notes.some((n: string) => n.includes("ne nose ovaj obim")) ? 1 : 0,
    warnings: p.warnings.length,
  };
}
const t0 = Date.now();
for (const [fam, list] of [["R", T.gridInputs()], ["F", T.feelInputs()], ["B", T.beginnerInputs()]] as const) {
  const A: any[] = [], B: any[] = []; let n = 0, rejOld = 0, rejNew = 0, newRej: string[] = [], same = 0, peakDown10 = 0;
  for (const c of list) {
    n++;
    const a = genO(c.input), b = genN(c.input);
    if (!a.ok) rejOld++; if (!b.ok) { rejNew++; if (a.ok) newRej.push(`${c.id}: ${b.reasons.map((r: any) => r.code + " " + (r.message ?? "").slice(0, 90)).join("; ")}`); }
    if (!a.ok || !b.ok) continue;
    if (strip(a.plan) === strip(b.plan)) { stable.push(c.id); same++; }
    const ma = m(a.plan), mb = m(b.plan); A.push(ma); B.push(mb);
    if (mb.peak < 0.9 * ma.peak - 1e-9) peakDown10++;
  }
  const keys = Object.keys(A[0]);
  out[fam] = { ulaza: n, odbijenoStaro: rejOld, odbijenoNovo: rejNew, novaOdbijanja: newRej.slice(0, 30), novaOdbijanjaN: newRej.length, bajtIsto: same, vrhPao10: peakDown10,
    mere: Object.fromEntries(keys.map((k) => { const xa = A.map((x) => x[k]), xb = B.map((x) => x[k]); const r = (x: number) => Math.round(x * 10) / 10;
      return [k, ["over25", "test", "dropped", "capLimited", "warnings"].includes(k) ? { preSum: xa.reduce((s, x) => s + x, 0), posleSum: xb.reduce((s, x) => s + x, 0) } : { pre: [r(med(xa)), r(Math.min(...xa)), r(Math.max(...xa))], posle: [r(med(xb)), r(Math.min(...xb)), r(Math.max(...xb))] }]; })) };
  console.log(fam, n, "odbijeno", rejOld, "→", rejNew, "nova", newRej.length, "isto", same, Math.round((Date.now() - t0) / 1000) + " s");
}
writeFileSync(`${NEW}/segmentP8.stable-${sha}.json`, JSON.stringify(stable.sort(), null, 0) + "\n");
writeFileSync(new URL(`./classify-${sha}.json`, import.meta.url), JSON.stringify(out, null, 1) + "\n");
