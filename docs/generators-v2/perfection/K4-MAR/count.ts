/* K4-MAR — brojanje po snimku: node count.ts <oznaka> [dani] — planovi sa blokom, raspodela broja blokova, niz dugog na
   najdužem (topRun > 3), kratki lagani (shortEasyWeeks > 2). */
import { readFileSync } from "node:fs";
const dir = new URL(".", import.meta.url).pathname;
const [tag, days] = process.argv.slice(2);
const S = JSON.parse(readFileSync(`${dir}snap-${tag}.json`, "utf8"));
const g: Record<string, any> = {};
for (const [id, x] of Object.entries(S) as [string, any][]) {
  if (days && String(x.days) !== days) continue;
  const k = `${x.fam}-d${x.days}`;
  const G = (g[k] ??= { n: 0, rej: 0, withBlock: 0, blocks: {} as Record<number, number>, run4: 0, short: 0, shortWeeks: 0 });
  G.n++; if (!x.ok) { G.rej++; continue; }
  if (x.m.blocks > 0) G.withBlock++;
  G.blocks[x.m.blocks] = (G.blocks[x.m.blocks] ?? 0) + 1;
  if (x.m.topRun > 3) G.run4++;
  if (x.m.shortEasyWeeks > 2) { G.short++; G.shortWeeks += x.m.shortEasyWeeks; }
}
for (const [k, G] of Object.entries(g)) console.log(k, JSON.stringify(G));
