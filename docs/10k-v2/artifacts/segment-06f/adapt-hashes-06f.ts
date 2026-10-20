/* Segment 06f: heševi (planHash06c, bez oznake verzije) trajnih mreža adaptacije 10K v2 — mreža 04 (adapt.node: 30 planova
   × 4 asOf × 17 scenarija, lanac: drugi korak), E (earlyFlows), R (reliefGrid), P (painGrid). Iz web/:
     node ../docs/10k-v2/artifacts/segment-06f/adapt-hashes-06f.ts <izlaz.json> [<koren>]
   Poređenje pre/posle daje tokove koje 06f menja (fixture segment06f.adapt-changed-7ba9717.json). */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const [outArg, rootArg] = process.argv.slice(2);
const ROOT = resolve(rootArg ?? fileURLToPath(new URL("../../../../", import.meta.url)));
const V = `${ROOT}/web/src/domain/generators/tenK/v2/`;
const T = await import(`${V}testInputs.ts`);
const { generateTenKV2 } = await import(`${V}generate.ts`);
const { adaptTenKV2 } = await import(`${V}adapt.ts`);
const { addDays } = await import(`${V}dates.ts`);
const gen = (input: unknown) => {
  const r: any = generateTenKV2(input);
  if (!r.ok) throw new Error(JSON.stringify(r.reasons));
  return r.plan;
};
const out: Record<string, Record<string, number>> = { grid04: {}, early: {}, relief: {}, pain: {} };
const p35: Record<string, string[]> = { grid04: [], early: [], relief: [], pain: [] };
const rec = (net: string, key: string, r: unknown) => {
  out[net]![key] = T.planHash06c(r);
  if (JSON.stringify(r).includes("Pouka 35:")) p35[net]!.push(key);
};
// Mreža 04 (adapt.node.test.ts, isti lanac: drugi korak manjak 50 % u 7 dana do asOf + 7).
const chainFacts = (p: any, a2: string) => ({
  workouts: [...T.runsIn(p, addDays(a2, -13), addDays(a2, -7)), ...T.runsIn(p, addDays(a2, -6), a2, 0.5)],
  coverage: { from: addDays(a2, -13), to: a2, complete: true },
});
for (const b of T.adaptBases()) {
  const p0 = gen(b.input);
  for (const k of T.AS_OF_KINDS)
    for (const s of T.SCENARIOS) {
      const asOf = T.asOfOf(p0, k);
      let r: any = adaptTenKV2(p0, T.factsOf(p0, s, asOf), asOf);
      if (r.ok && s === "chain") {
        const at = addDays(asOf, 7);
        r = adaptTenKV2(r.plan, chainFacts(r.plan, at), at);
      }
      rec("grid04", `${b.id}/${k}/${s}`, r);
    }
}
const eplans = new Map<string, any>();
const eplan = (b: any) => (eplans.has(b.id) ? eplans.get(b.id) : (eplans.set(b.id, gen(b.input)), eplans.get(b.id)));
for (const f of T.earlyFlows(eplan)) {
  const p0 = eplan(f.base);
  rec("early", f.key, adaptTenKV2(p0, T.earlyFacts(p0, f.s, f.asOf), f.asOf));
}
for (const b of T.reliefGridBases()) {
  const p0 = gen(b.input);
  for (const a of T.reliefAsOfs(p0))
    for (const s of T.RELIEF_SCENARIOS) rec("relief", `${b.id}/w${a.week}/${s}`, adaptTenKV2(p0, T.reliefFacts(p0, s, a.asOf), a.asOf));
}
for (const b of T.painGridBases()) {
  const p0 = gen(b.input);
  for (const c of T.painCases(b.id, p0)) rec("pain", c.key, adaptTenKV2(p0, T.painFacts(c.asOf, c.level), c.asOf));
}
writeFileSync(outArg!, JSON.stringify({ out, p35 }));
console.log(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [Object.keys(v).length, p35[k]!.length]])));
