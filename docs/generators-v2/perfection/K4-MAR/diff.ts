/* K4-MAR — poređenje dva snimka (snap.ts): odbijanja, nova odbijanja, promenjeni planovi, vrh niži > 10 % po grupi
   (porodica × dani), i medijana/min/max izabranih mera po porodici za promenjene planove.
   node docs/generators-v2/perfection/K4-MAR/diff.ts <pre> <posle> [mera,mera,...] */
import { readFileSync } from "node:fs";
const dir = new URL(".", import.meta.url).pathname;
const [a, b, keysArg] = process.argv.slice(2);
const A = JSON.parse(readFileSync(`${dir}snap-${a}.json`, "utf8")), B = JSON.parse(readFileSync(`${dir}snap-${b}.json`, "utf8"));
const keys = (keysArg ?? "peak,longest,atTop,topRun,blocks,mpLongKm,easyLong,easyMin,shortEasyWeeks").split(",");
const med = (xs: number[]) => { const s = [...xs].sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : NaN; };
const r1 = (x: number) => Math.round(x * 100) / 100;
const groups: Record<string, any> = {};
const newRej: string[] = [];
for (const id of Object.keys(B)) {
  const x = A[id], y = B[id];
  const g = `${y.fam}-d${y.days}`;
  const G = (groups[g] ??= { n: 0, rejA: 0, rejB: 0, changed: 0, peakDown10: 0, ch: [] as [any, any][] });
  G.n++; if (!x.ok) G.rejA++; if (!y.ok) G.rejB++;
  if (!y.ok && x.ok) newRej.push(`${id}: ${y.reasons.join(" | ")}`);
  if (!x.ok || !y.ok) continue;
  if (x.h !== y.h) { G.changed++; G.ch.push([x.m, y.m]); }
  if (y.m.peak < 0.9 * x.m.peak - 1e-9) G.peakDown10++;
}
for (const [g, G] of Object.entries(groups) as [string, any][]) {
  const s = keys.map((k) => { const xa = G.ch.map((p: any) => p[0][k]), xb = G.ch.map((p: any) => p[1][k]);
    return `${k} ${r1(med(xa))}→${r1(med(xb))} [${r1(Math.min(...xb))}..${r1(Math.max(...xb))}]`; }).join("; ");
  console.log(`${g}: n ${G.n} odb ${G.rejA}→${G.rejB} prom ${G.changed} vrh<-10% ${G.peakDown10}${G.changed ? " | " + s : ""}`);
}
console.log("nova odbijanja:", newRej.length); for (const r of newRej.slice(0, 15)) console.log("  ", r);
