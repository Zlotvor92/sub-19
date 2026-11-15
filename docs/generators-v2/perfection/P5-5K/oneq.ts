/* P5 (5K) — nalaz P4: posle adaptacije (trajna rana mreža 08g, testInputs.earlyFlows) koliko tokova i nedelja ima
   „Adaptacija: kvalitet ne staje u obim … jedan kvalitet doze rasterećenja" (lanac generate.construct), po scenariju i fazi
   te nedelje; za 'slower' i razlika sporiji rezultat → isti tok bez rezultata ('none'). Samo čitanje.
   Iz web/: node ../docs/generators-v2/perfection/P5-5K/oneq.ts <oznaka> → P5-5K/oneq-<oznaka>.json */
import { writeFileSync } from "node:fs";
const T = await import("../../../../web/src/domain/generators/fiveK/v2/testInputs.ts");
const tag = process.argv[2] ?? "posle";
const NOTE = "jedan kvalitet doze rasterećenja";
const by: Record<string, { flows: number; hit: number; weeks: number; phases: Record<string, number>; ex: string[] }> = {};
let rej = 0, n = 0;
const t0 = Date.now();
for (const eb of T.earlyGridBases()) {
  for (const f of T.earlyFlows(eb.id, eb.input)) {
    n++;
    const s = f.key.split("/")[2] + (f.key.split("/").length > 3 ? "/" + f.key.split("/").slice(3).join("/").replace(/\+\d/, "+k") : "");
    const b = (by[s] ??= { flows: 0, hit: 0, weeks: 0, phases: {}, ex: [] });
    b.flows++;
    if (!f.res.ok) { rej++; continue; }
    const asOf = f.asOf;
    const ws = f.res.plan.weeks.filter((w: any) => w.endDate > asOf && w.notes.some((x: string) => x.startsWith("Adaptacija: kvalitet ne staje") && x.includes(NOTE)));
    const before = f.plan.weeks.filter((w: any) => w.notes.some((x: string) => x.includes(NOTE))).length;
    if (ws.length > 0) {
      b.hit++; b.weeks += ws.length;
      for (const w of ws) b.phases[w.phase] = (b.phases[w.phase] ?? 0) + 1;
      if (b.ex.length < 6) b.ex.push(`${f.key} ned ${ws.map((w: any) => w.index).join(",")} (pre adaptacije u planu: ${before})`);
    }
  }
}
writeFileSync(new URL(`./oneq-${tag}.json`, import.meta.url), JSON.stringify({ n, rej, by }, null, 1));
console.log(`tokova ${n}, odbijeno ${rej}, ${Math.round((Date.now() - t0) / 1000)} s`);
for (const [k, v] of Object.entries(by)) if (v.hit) console.log(`${k}: ${v.hit}/${v.flows} tokova, ${v.weeks} ned ${JSON.stringify(v.phases)}`);
