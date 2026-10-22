// Organizator (posle MAR-07c): umor (factsOf 'fatigue') sa asOf = start − 1, start, start + 1, start + 2 → odbijanja (cilj 0).
// Iz web/: node ../docs/generators-v2/final-check/fatigue-startday.ts [5K|10K|HM|MAR] [korak]
import { DISTS, addDays, weekdayOf } from "/home/user/sub-19/docs/generators-v2/final-check/lib.ts";
const only = process.argv[2];
const stride = Number(process.argv[3] ?? 1);
for (const d of DISTS) {
  if (only && d.name !== only) continue;
  const all = d.all();
  let plans = 0;
  const flows: Record<string, number> = {};
  const rej: Record<string, number> = {};
  const ex: string[] = [];
  for (const [i, b] of all.entries()) {
    if (i % stride !== 0) continue;
    const g: any = d.generate(b.input); if (!g.ok) continue; const p = g.plan;
    plans++;
    const s = p.weeks[0].startDate;
    for (const k of [-1, 0, 1, 2]) {
      const at = addDays(s, k);
      const key = `start${k >= 0 ? '+' : ''}${k}`;
      flows[key] = (flows[key] ?? 0) + 1;
      const a: any = d.adapt(p, d.facts(p, 'fatigue' as any, at), at);
      if (!a.ok) {
        const m = `${key} ${String(a.reasons[0]?.message ?? '').replace(/\d+ km/, 'X km').slice(0, 70)}`;
        rej[m] = (rej[m] ?? 0) + 1;
        if (ex.length < 8) ex.push(`${b.id} asOf ${at} (${weekdayOf(at)}, ${key})`);
      }
    }
  }
  console.log(JSON.stringify({ dist: d.name, stride, plans, flows, rejected: rej, examples: ex }));
}
