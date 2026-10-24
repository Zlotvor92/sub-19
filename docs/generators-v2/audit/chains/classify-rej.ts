/* UGAO 3 (chains) — klasifikacija odbijenih lanaca (SAMO ČITANJE): pravilo (validator/razlog) × zavisnost od
   zaključanih dana: „lock-ranije" (bez zaključavanja u RANIJIM koracima poslednji korak prolazi), „lock-sada" (prolazi
   bez zaključanih dana tekućeg koraka), „rezultat" (prolazi bez rezultata), „ostalo". Isti lanci kao chains.ts.
   Iz web/: node ../docs/generators-v2/audit/chains/classify-rej.ts <dist> <seed> <od> <do> */
import { distOf } from "../../final-check/lib.ts";
import { runChain } from "./chains.ts";
const [n, seedS, fromS, toS] = process.argv.slice(2);
const d = distOf(n!);
const ok = (r: any) => r.ok;
const rule = (r: any) => {
  const vs = (r.violations ?? []).filter((v: any) => v.severity === "error");
  if (vs.length) return [...new Set(vs.map((v: any) => v.rule))].join("+");
  const m = r.reasons?.[0]?.message ?? "";
  const x = /^([A-Z_]+):/.exec(m);
  return x ? x[1] : r.reasons?.[0]?.code;
};
const out: Record<string, Record<string, number>> = {};
const ex: Record<string, string[]> = {};
let rejected = 0;
for (let i = Number(fromS); i < Number(toS); i++) {
  const tr: any[] = [];
  const o = runChain(d, Number(seedS), i, { trace: tr });
  const t = tr[tr.length - 1];
  if (!t || !t.rejected) continue;
  rejected++;
  const L = tr.length - 1;
  const r0 = t.rejected;
  let why = "ostalo";
  // bez zaključanih dana u ranijim koracima
  let p = tr[0].before, chainOk = true;
  for (let k = 0; k < L; k++) { const r: any = d.adapt(p, { ...tr[k].facts, lockedDayIds: [] }, tr[k].asOf); if (!r.ok) { chainOk = false; break; } p = r.plan; }
  if (L > 0 && chainOk && ok(d.adapt(p, tr[L].facts, tr[L].asOf))) why = "lock-ranije";
  else if ((t.facts.lockedDayIds ?? []).length && ok(d.adapt(t.before, { ...t.facts, lockedDayIds: [] }, t.asOf))) why = "lock-sada";
  else if ((t.facts.results ?? []).length && ok(d.adapt(t.before, { ...t.facts, results: [] }, t.asOf))) why = "rezultat";
  const k = `${rule(r0)}${o.real ? "" : " (nerealno)"}`;
  (out[k] ??= {})[why] = (out[k]![why] ?? 0) + 1;
  const xs = (ex[`${k} ${why}`] ??= []);
  if (xs.length < 2) xs.push(`i=${i} koraka ${L + 1}`);
}
console.log(JSON.stringify({ dist: n, from: Number(fromS), to: Number(toS), rejected, out, ex }, null, 1));
