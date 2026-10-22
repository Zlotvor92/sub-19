/* Faza 4 pre-final (22. 10.) — provera nalaza K3 (cilj predaje): lanac od 2 koraka na OBIČNOM planu, bez predaje.
   Korak 1 pre starta (start − 1): bol 8, bol 5, umor, pauza 20; korak 2 u ned 1 (sreda i kraj), svih 17 scenarija,
   činjenice kumulativne (pre-lib.mergeFacts). Svaki 97. ulaz mreže, sve 4 distance.
   Iz web/: node ../docs/generators-v2/final-check/prestart-chain.ts */
import { distOf, addDays, wedOf, SCENARIOS } from "./lib.ts";
import { mergeFacts } from "./pre-lib.ts";
for (const name of ["HM", "MAR", "10K", "5K"]) {
const d = distOf(name);
let n = 0; const rej: Record<string, number> = {}; const ex: string[] = [];
for (const [i, b] of d.all().entries()) {
  if (i % 97) continue;
  const g: any = d.generate(b.input); if (!g.ok) continue; const p = g.plan;
  for (const s1 of ["pain8", "pain5", "fatigue", "pause20"] as const) {
  const at1 = addDays(p.input.startDate, -1);
  const f1 = d.facts(p, s1, at1);
  const r1: any = d.adapt(p, f1, at1); if (!r1.ok) { rej["step1 " + s1] = (rej["step1 " + s1] ?? 0) + 1; continue; }
  for (const at2 of [wedOf(p.weeks[0].startDate), p.weeks[0].endDate])
    for (const s2 of SCENARIOS) {
      const f2 = mergeFacts(f1, d.facts(r1.plan, s2, at2));
      const r2: any = d.adapt(r1.plan, f2, at2); n++;
      if (!r2.ok) { const k = `${s1}→${s2}: ${(r2.violations?.find((v: any) => v.severity === "error")?.rule ?? r2.reasons[0].code)}`; rej[k] = (rej[k] ?? 0) + 1; if (ex.length < 3) ex.push(`${b.id} ${s1}@${at1} → ${s2}@${at2}: ${r2.reasons.map((x: any) => x.message).join(" | ").slice(0, 200)}`); }
    }
  }
}
console.log(name, n, rej, ex);
}
