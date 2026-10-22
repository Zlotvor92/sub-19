// Organizator (posle MAR-07c, pouke 23 i 36): umor sa asOf svaki dan nedelje testa i nedelje pre nje, planovi sa testom
// (po osećaju) → odbijanja (cilj 0) i plan sa dva testa. Iz web/: node ../docs/generators-v2/final-check/fatigue-testweek.ts [5K|10K|HM|MAR] [korak]
import { DISTS, addDays } from "/home/user/sub-19/docs/generators-v2/final-check/lib.ts";
const only = process.argv[2];
// Dan testa: 10K/HM/MAR workout.kind 'test'; 5K blok/segment 'test' u treningu.
const isTest = (x: any): boolean =>
  x.workout.kind === 'test' || (x.workout.segments ?? []).some((s: any) => s.kind === 'test');
const stride = Number(process.argv[3] ?? 1);
for (const d of DISTS) {
  if (only && d.name !== only) continue;
  const all = d.all();
  let plans = 0, flows = 0, twoTests = 0;
  const rej: Record<string, number> = {};
  const ex: string[] = [];
  for (const [i, b] of all.entries()) {
    if (i % stride !== 0) continue;
    const g: any = d.generate(b.input); if (!g.ok) continue; const p = g.plan;
    const tw = p.weeks.findIndex((w: any) => w.days.some(isTest));
    if (tw < 1) continue;
    plans++;
    const from = p.weeks[tw - 1].startDate;
    for (let k = 0; k < 14; k++) {
      const at = addDays(from, k);
      const f = d.facts(p, 'fatigue' as any, at);
      const a: any = d.adapt(p, f, at); flows++;
      if (!a.ok) {
        const m = String(a.reasons[0]?.message ?? '').slice(0, 80);
        rej[m] = (rej[m] ?? 0) + 1;
        if (ex.length < 6) ex.push(`${b.id} asOf ${at} (ned testa ${tw + 1}, dan ${k - 7})`);
        continue;
      }
      const nT = a.plan.weeks.flatMap((w: any) => w.days).filter(isTest).length;
      if (nT > 1) { twoTests++; if (ex.length < 6) ex.push(`DVA TESTA ${b.id} asOf ${at}`); }
    }
  }
  console.log(JSON.stringify({ dist: d.name, stride, plans, flows, rejected: rej, twoTests, examples: ex }));
}
