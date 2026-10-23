// Organizator (posle MAR-07c): svih 17 scenarija (lanac: drugi korak) sa asOf = prvi dan plana (start + 0) i start + 1
// → odbijanja po scenariju (cilj 0). Iz web/: node ../docs/generators-v2/final-check/start-day.ts [5K|10K|HM|MAR] [korak]
import { DISTS, SCENARIOS, addDays } from "/home/user/sub-19/docs/generators-v2/final-check/lib.ts";
const only = process.argv[2];
const stride = Number(process.argv[3] ?? 1);
for (const d of DISTS) {
  if (only && d.name !== only) continue;
  let plans = 0, flows = 0, inv = 0;
  const rej: Record<string, number> = {};
  const ex: string[] = [];
  for (const [i, b] of d.all().entries()) {
    if (i % stride !== 0) continue;
    const g: any = d.generate(b.input); if (!g.ok) continue; const p = g.plan;
    plans++;
    for (const k of [0, 1])
      for (const s of SCENARIOS) {
        const at = addDays(p.weeks[0].startDate, k);
        let f: any;
        try { f = d.facts(p, s, at); } catch { continue; }
        let a: any = d.adapt(p, f, at); flows++;
        let before = p, at2 = at, used = f;
        if (a.ok && s === 'chain') { before = a.plan; at2 = addDays(at, 7); used = d.chain2(a.plan, at2); a = d.adapt(before, used, at2); }
        if (!a.ok) {
          const m = `+${k} ${s}: ${String(a.reasons[0]?.message ?? '').replace(/\d+([.,]\d+)? km/g, 'X km').slice(0, 70)}`;
          rej[m] = (rej[m] ?? 0) + 1;
          if (ex.length < 8) ex.push(`${b.id} ${s} asOf ${at}`);
          continue;
        }
        if (d.inv) { const bad = d.inv(before, a.plan, at2, used); if (bad.length) { inv++; if (ex.length < 8) ex.push(`INV ${b.id} ${s} ${at}: ${bad[0]}`); } }
      }
  }
  console.log(JSON.stringify({ dist: d.name, stride, plans, flows, inv, rejected: rej, examples: ex }));
}
