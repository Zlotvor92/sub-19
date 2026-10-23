/* Prikaz odbijenog koraka lanca: činjenice, koraci prethodnog plana, razlozi i greške validatora.
   Iz web/: node ../docs/generators-v2/audit/chains/rej.ts <dist> <seed> <i> */
import { distOf } from "../../final-check/lib.ts";
import { runChain } from "./chains.ts";
const [n, seed, i] = process.argv.slice(2);
const d = distOf(n!);
const tr: any[] = [];
const o = runChain(d, Number(seed), Number(i), { trace: tr });
console.log(o.id, "real", o.real, JSON.stringify(o.steps));
const t = tr[tr.length - 1];
if (!t.rejected) { console.log("nije odbijen"); process.exit(0); }
const f = t.facts;
console.log("asOf", t.asOf, "cov", JSON.stringify(f.coverage), "breaks", JSON.stringify(f.breaks), "locked", JSON.stringify(f.lockedDayIds), "results", JSON.stringify(f.results));
console.log("pain/rpe", JSON.stringify(f.workouts.filter((w: any) => w.pain || w.rpe >= 8 || !w.completed)));
console.log("reasons", JSON.stringify(t.rejected.reasons).slice(0, 1500));
console.log("viol", JSON.stringify((t.rejected.violations ?? []).filter((v: any) => v.severity === "error")).slice(0, 1500));
const w = (p: any) => p.weeks.map((w: any) => `${w.index}${w.deload ? "d" : ""}${w.test ? "T" : ""}[${w.startDate.slice(5)}]:${w.targetKm}`).join(" ");
console.log("before", w(t.before));
console.log("prevSteps", JSON.stringify(t.before.adaptation?.steps ?? []).slice(0, 2500));
