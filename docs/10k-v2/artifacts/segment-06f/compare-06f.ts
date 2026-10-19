/* Segment 06f: poređenje measure-06f.ts pre (7ba9717) i posle. Promenjen tok = drugi heš ili druga traka. Klase:
   ponovljen umor (ključ /+k, scenario fatigue), ostalo. Iz web/: node ../docs/10k-v2/artifacts/segment-06f/compare-06f.ts
   <pre.json> <posle.json> */
import { readFileSync } from "node:fs";

const [b, a] = process.argv.slice(2).map((f) => JSON.parse(readFileSync(f!, "utf8")));
const out: any = { flows: Object.keys(a.flowsData).length, rejectedBefore: b.rejected, rejectedAfter: a.rejected };
const cls: Record<string, number> = {};
const ex: Record<string, string[]> = {};
let bannerNewVsOld = 0;
const bannerEx: string[] = [];
for (const [k, x] of Object.entries<any>(a.flowsData)) {
  const y = b.flowsData[k];
  if (x.nb !== undefined && x.nb !== x.old) {
    bannerNewVsOld++;
    if (bannerEx.length < 5) bannerEx.push(k);
  }
  if (!y) continue;
  const hash = x.h !== y.h;
  const banner = (x.nb ?? x.old) !== y.old;
  if (!hash && !banner) continue;
  const rep = /\/\+\d+$/.test(k);
  const c = `${rep && k.includes("/fatigue/") ? "ponovljen umor" : rep ? "ponovljen drugi" : "prvi korak"}${hash ? " heš" : ""}${banner ? " traka" : ""}${x.dl !== undefined && y.dl !== undefined && x.dl < y.dl ? " (manje rasterećenja)" : ""}`;
  cls[c] = (cls[c] ?? 0) + 1;
  (ex[c] ??= []).length < 3 && ex[c]!.push(`${k}: rasterećenja ${y.dl} → ${x.dl}, traka ${y.old} → ${x.nb ?? x.old}`);
}
const moreDeloads = (d: any) =>
  Object.entries<any>(d.flowsData).filter(([k, x]) => {
    if (!/fatigue\/\+\d+$/.test(k)) return false;
    const base = d.flowsData[k.replace(/\/\+\d+$/, "")];
    return base?.dl !== undefined && x.dl > base.dl;
  }).length;
Object.assign(out, {
  changed: cls,
  examples: ex,
  repeatedFatigueMoreDeloads: { before: moreDeloads(b), after: moreDeloads(a) },
  bannerNewVsOldSameCode: bannerNewVsOld,
  bannerEx,
  p35: { genPlans: Object.keys(a.p35gen).length, adaptFlows: Object.keys(a.p35adapt).length, adaptFlowsBefore: Object.keys(b.p35adapt).length },
  p25: { before: Object.keys(b.p25).length, after: Object.keys(a.p25).length },
});
console.log(JSON.stringify(out, null, 1));
