/* Ponovljiv prikaz jednog lanca: koraci, razlozi adaptacije, i šta ponovna primena menja.
   Iz web/: node ../docs/generators-v2/audit/chains/dbg.ts <dist> <seed> <i> <korak> */
import { distOf } from "../../final-check/lib.ts";
import { runChain } from "./chains.ts";
const [n, seed, i, k] = process.argv.slice(2);
const d = distOf(n!);
const tr: any[] = [];
const o = runChain(d, Number(seed), Number(i), { trace: tr });
const t = tr[Number(k)];
console.log("id", o.id, "real", o.real, "cov", JSON.stringify(t.facts.coverage), "asOf", t.asOf);
console.log("facts", JSON.stringify(t.facts).slice(0, 1500));
console.log("reasons1", t.reasons.filter((x: any) => x.applied).map((x: any) => x.condition + ": " + x.message));
const r3: any = d.adapt(t.after, structuredClone(t.facts), t.asOf);
console.log("reasons2", r3.ok ? r3.reasons.filter((x: any) => x.applied).map((x: any) => x.condition + ": " + x.message) : r3.reasons);
const tgt = (p: any) => p.weeks.map((w: any) => `${w.index}${w.deload ? "d" : ""}:${w.targetKm}/${w.plannedKm}`).join(" ");
console.log("before", tgt(t.before)); console.log("after1", tgt(t.after)); if (r3.ok) console.log("after2", tgt(r3.plan));
console.log("steps1", JSON.stringify(t.after.adaptation?.steps?.map((s: any) => ({ ...s })), null, 0).slice(0, 2500));
if (r3.ok) console.log("steps2", JSON.stringify(r3.plan.adaptation?.steps, null, 0).slice(0, 3000));
