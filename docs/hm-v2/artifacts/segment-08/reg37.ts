/* HM-08 regresija: po toku heš sadržaja (bez napomena, upozorenja, policyVersion), ciljevi nedelja, mešovite nedelje
   sa planirano > cilj (+0,005) i nedelje sa promenom. node reg37.ts <koren> <gen|early|targeted> <i> <n> */
import { createHash } from "node:crypto";
const [root, set, si, sn] = process.argv.slice(2) as [string, string, string, string];
const lib = await import(`${root}/docs/generators-v2/final-check/lib.ts`);
const d = lib.distOf("HM");
const shard = Number(si), shards = Number(sn);
const h = (x: unknown) => createHash("sha1").update(JSON.stringify(x)).digest("hex").slice(0, 12);
const out: Record<string, unknown> = {};
const rec = (p: any) => {
  const mixed = new Set(p.adaptation?.mixedWeeks ?? []);
  const weeks = p.weeks.map((w: any) => { const { notes, ...rest } = w; return rest; });
  const { notes, warnings, policyVersion, weeks: _w, adaptation, ...plan } = p;
  return {
    c: h({ ...plan, adaptation: adaptation ? { ...adaptation } : null, weeks }),
    t: p.weeks.map((w: any) => w.targetKm),
    wk: weeks.map((w: any) => h(w)),
    mo: p.weeks.filter((w: any) => mixed.has(w.index) && w.phase !== "race" && w.plannedKm > w.targetKm + 0.005).map((w: any) => w.index),
  };
};
const put = (k: string, r: any) => (out[k] = r.ok ? rec(r.plan) : { rej: r.reasons.map((x: any) => x.code).join(",") });
if (set === "gen") {
  d.all().forEach((b: any, i: number) => { if (i % shards === shard) put(b.id, d.generate(b.input)); });
} else if (set === "early") {
  const { bases } = lib.sampleBases(d, { R: 193, F: 97, B: 29 });
  bases.forEach((b: any, bi: number) => {
    if (bi % shards !== shard) return;
    const g = d.generate(b.input); if (!g.ok) return; const p = g.plan; const N = p.weeks.length;
    const asOfs: [string, string][] = [1, 3, 6].map((k) => [`pre${k}`, lib.addDays(p.input.startDate, -k)]);
    for (let i = 1; i <= N - 2; i++) { const w = p.weeks[i - 1]; asOfs.push([`w${i}wed`, lib.wedOf(w.startDate)], [`w${i}end`, w.endDate]); }
    for (const [tag, at] of asOfs) for (const s of lib.SCENARIOS) {
      const k = `${b.id}/${tag}/${s}`; const r = d.adapt(p, d.facts(p, s, at), at); put(k, r);
      if (r.ok && s === "chain") { const at2 = lib.addDays(at, 7); if (at2 < p.input.raceDate) put(`${k}/2`, d.adapt(r.plan, d.chain2(p, at2), at2)); }
    }
  });
} else {
  const every: Record<string, number> = { R: 61, F: 31, B: 17 }; const seen: Record<string, number> = {};
  const bases = d.all().filter((b: any) => { const i = (seen[b.family] = (seen[b.family] ?? -1) + 1); return i % every[b.family]! === 0; });
  bases.forEach((b: any, bi: number) => {
    if (bi % shards !== shard) return;
    const g = d.generate(b.input); if (!g.ok) return; const p = g.plan; const N = p.weeks.length;
    for (let i = 3; i <= N - 4; i++) for (const s of ["pause35", "pause20", "pain5"]) {
      const asOf = s === "pain5" ? lib.wedOf(p.weeks[i - 1].startDate) : p.weeks[i - 1].endDate;
      put(`${b.id}/w${i}/${s}`, d.adapt(p, d.facts(p, s, asOf), asOf));
    }
  });
}
console.log(JSON.stringify(out));
