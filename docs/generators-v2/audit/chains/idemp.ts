/* UGAO 3 (chains) — razlaganje neidempotentnosti po uslovu adaptacije (SAMO ČITANJE). Isti lanci kao chains.ts
   (isti seed i indeksi), za svaki uspešan korak:
   - same: adapt(novi plan, iste činjenice, isti asOf) — weeks različit? po kombinaciji primenjenih uslova;
   - next: realno „sutra bez novih zapisa": asOf + 1 kad asOf + 1 NIJE dan trčanja plana (nema propuštenog dana), iste
     činjenice, pokrivenost (ako postoji) produžena do asOf + 1 — da li neki budući cilj padne > 10 % (kaskada);
   - fatigue36: kontrola pouke 36 (umor vezan za zapise) u istom merenju.
   Iz web/: node ../docs/generators-v2/audit/chains/idemp.ts <dist> <seed> <od> <do> */
import { addDays, distOf } from "../../final-check/lib.ts";
import { runChain } from "./chains.ts";

const [n, seedS, fromS, toS] = process.argv.slice(2);
const d = distOf(n!);
const seed = Number(seedS);
const S = JSON.stringify;
const out = { dist: n, seed, from: Number(fromS), to: Number(toS), steps: 0, same: {} as Record<string, [number, number]>, next: {} as Record<string, [number, number]>, ex: {} as Record<string, string[]>, seconds: 0 };
const t0 = Date.now();
const bump = (o: Record<string, [number, number]>, k: string, hit: boolean) => { const x = (o[k] ??= [0, 0]); x[0]++; if (hit) x[1]++; };
for (let i = out.from; i < out.to; i++) {
  const tr: any[] = [];
  runChain(d, seed, i, { trace: tr });
  for (const [k, t] of tr.entries()) {
    if (!t.after) continue;
    out.steps++;
    const cond = (t.reasons ?? []).filter((x: any) => x.applied && x.condition !== "NO_FACTS").map((x: any) => x.condition).sort().join("+") || "NO_FACTS";
    const r3: any = d.adapt(t.after, structuredClone(t.facts), t.asOf);
    const hit = !r3.ok || S(r3.plan.weeks) !== S(t.after.weeks);
    bump(out.same, cond, hit);
    if (hit && (out.ex["same " + cond] ??= []).length < 2) out.ex["same " + cond]!.push(`${i}/${k}`);
    const a1 = addDays(t.asOf, 1);
    if (a1 >= t.after.input.raceDate) continue;
    const runDay = t.after.weeks.flatMap((w: any) => w.days).some((x: any) => x.date === a1 && x.countsToWeek);
    if (runDay) continue;
    const f = structuredClone(t.facts);
    if (f.coverage) f.coverage.to = a1;
    const r4: any = d.adapt(t.after, f, a1);
    let drop = !r4.ok;
    if (r4.ok) {
      const m = new Map(t.after.weeks.map((w: any) => [w.index, w.targetKm]));
      drop = r4.plan.weeks.some((w: any) => w.startDate > a1 && w.phase !== "race" && w.targetKm < (m.get(w.index) as number) * 0.9 - 0.05);
    }
    bump(out.next, cond, drop);
    if (drop && (out.ex["next " + cond] ??= []).length < 2) out.ex["next " + cond]!.push(`${i}/${k}${r4.ok ? "" : " odbijeno " + (r4.reasons[0]?.code ?? "")}`);
  }
}
out.seconds = (Date.now() - t0) / 1000;
console.log(JSON.stringify(out, null, 1));
