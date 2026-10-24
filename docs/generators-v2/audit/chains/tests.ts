/* Dani testa u planovima lanca (pre odbijenog koraka) i uloga zaključanih dana. Iz web/:
   node ../docs/generators-v2/audit/chains/tests.ts <dist> <seed> <i> */
import { distOf } from "../../final-check/lib.ts";
import { runChain } from "./chains.ts";
const [n, seed, i] = process.argv.slice(2);
const tr: any[] = [];
runChain(distOf(n!), Number(seed), Number(i), { trace: tr });
const isT = (x: any) => x.workout.kind === "test" || (x.workout.segments ?? []).some((s: any) => s.kind === "test");
for (const [k, t] of tr.entries()) {
  const days = t.before.weeks.flatMap((w: any) => w.days.map((d: any) => ({ ...d, wk: w.index })));
  console.log(k, t.asOf, "testovi pre:", days.filter(isT).map((d: any) => `${d.date}(ned ${d.wk})`).join(","),
    "| zaključani:", (t.facts.lockedDayIds ?? []).map((x: string) => { const d = days.find((y: any) => y.date === x); return `${x}:${d?.role}/${d?.workout.kind}`; }).join(","),
    t.after ? "| testovi posle: " + t.after.weeks.flatMap((w: any) => w.days).filter(isT).map((d: any) => d.date).join(",") : "| ODBIJEN");
}
