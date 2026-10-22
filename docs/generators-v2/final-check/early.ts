/* Faza 4a, zadatak 3 — rana i srednja adaptacija SVE 4 distance (pouka 23).
   Uzorak planova: svaki kR/kF/kB-ti ulaz porodice (R rezultat, F po osećaju, B početnik) od pomaka k/2, BEZ planova
   trajnih mreža rane/široke adaptacije (lib.sampleBases). asOf: start − 6/− 3/− 1, sreda i kraj svake nedelje
   1 … N − 2. Scenariji: svih 17 (lib.SCENARIOS; 'chain' + drugi korak asOf + 7). Po toku: odbijanje (klasa),
   nezavisne provere lib.commonChecks (prošlost bajt-ista, prazan trening, dugi ≥ lagan, trkačka ≤ taper),
   'none' = generator (nedelje bajt-iste), invarijante distance (adaptInvariants; 5K nema).
   Iz korena repoa: node docs/generators-v2/final-check/early.ts <5K|10K|HM|MAR> <kR> <kF> <kB> > out.json */

import { commonChecks, addDays, distOf, SCENARIOS, sampleBases, wedOf, type Plan } from "./lib.ts";

const [name, kR, kF, kB] = [process.argv[2]!, ...process.argv.slice(3, 6).map(Number)] as [string, number, number, number];
const d = distOf(name);
const t0 = Date.now();
const { bases, excluded } = sampleBases(d, { R: kR, F: kF, B: kB });
const out = {
  dist: name,
  step: { R: kR, F: kF, B: kB },
  sampled: bases.length,
  excludedPermanent: excluded,
  plans: 0,
  generatorRejected: 0,
  flows: 0,
  rejectedFlows: 0,
  rejected: {} as Record<string, number>,
  rejectedEx: {} as Record<string, string[]>,
  common: {} as Record<string, number>,
  commonEx: {} as Record<string, string[]>,
  noneMismatch: 0,
  noneEx: [] as string[],
  inv: {} as Record<string, number>,
  invEx: {} as Record<string, string[]>,
  byScenario: {} as Record<string, number>,
  byAsOf: {} as Record<string, number>,
  seconds: 0,
};
const add = (o: Record<string, number>, ex: Record<string, string[]>, k: string, e: string) => {
  o[k] = (o[k] ?? 0) + 1;
  const xs = (ex[k] ??= []);
  if (xs.length < 3) xs.push(e);
};
const cls = (r: { code: string; message: string }): string =>
  `${r.code}:${r.message.split(":")[0]!.replace(/[0-9]+([.,][0-9]+)?/g, "#").slice(0, 70)}`;

function flow(p: Plan, facts: Record<string, unknown>, at: string, keyS: string, s: string, tag: string): Plan | null {
  out.flows++;
  const r = d.adapt(p, facts, at);
  if (!r.ok) {
    out.rejectedFlows++;
    out.byScenario[s] = (out.byScenario[s] ?? 0) + 1;
    const t = tag.replace(/[0-9]+/, "#");
    out.byAsOf[t] = (out.byAsOf[t] ?? 0) + 1;
    const vs = ((r as { violations?: { rule: string; severity: string; message: string }[] }).violations ?? []).filter((v) => v.severity === "error");
    if (vs.length) for (const v of vs) add(out.rejected, out.rejectedEx, `VALIDATOR:${v.rule}`, `${keyS}: ${v.message.slice(0, 260)}`);
    else for (const x of r.reasons) add(out.rejected, out.rejectedEx, cls(x), `${keyS}: ${x.message.slice(0, 260)}`);
    return null;
  }
  for (const v of commonChecks(p, r.plan, at, facts)) add(out.common, out.commonEx, v, keyS);
  if (d.inv)
    for (const v of d.inv(p, r.plan, at, facts)) add(out.inv, out.invEx, v.replace(/[0-9-]+/g, "#").slice(0, 80), `${keyS}: ${v}`);
  return r.plan;
}

for (const b of bases) {
  const g = d.generate(b.input);
  if (!g.ok) {
    out.generatorRejected++;
    continue;
  }
  out.plans++;
  const p = g.plan;
  const N = p.weeks.length;
  const asOfs: [string, string][] = [1, 3, 6].map((k) => [`pre${k}`, addDays(p.input.startDate, -k)]);
  for (let i = 1; i <= N - 2; i++) {
    const w = p.weeks[i - 1]!;
    asOfs.push([`w${i}wed`, wedOf(w.startDate)], [`w${i}end`, w.endDate]);
  }
  for (const [tag, at] of asOfs)
    for (const s of SCENARIOS) {
      const k = `${b.id}/${tag}/${s}`;
      const facts = d.facts(p, s, at);
      const p1 = flow(p, facts, at, k, s, tag);
      if (!p1) continue;
      if (s === "none" && JSON.stringify(p1.weeks) !== JSON.stringify(p.weeks)) {
        out.noneMismatch++;
        if (out.noneEx.length < 3) out.noneEx.push(k);
      }
      if (s === "chain") {
        const at2 = addDays(at, 7);
        if (at2 < p.input.raceDate) flow(p1, d.chain2(p1, at2), at2, `${k}/2`, "chain2", tag);
      }
    }
}
out.seconds = (Date.now() - t0) / 1000;
console.log(JSON.stringify(out, null, 1));
