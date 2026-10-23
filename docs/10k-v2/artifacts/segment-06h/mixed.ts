// asOf = prvi dan nedelje k, umor (zapisi asOf−1, asOf−3) → rasterećenje tekuće nedelje k (mešovita). planned vs cilj.
import { DISTS } from "/home/user/sub-19/docs/generators-v2/final-check/lib.ts";
const d = DISTS.find((x) => x.name === '10K')!;
const stride = Number(process.argv[2] ?? 25);
const t: Record<string, number> = {}; const ex: string[] = [];
for (const [i, b] of d.all().entries()) {
  if (i % stride) continue;
  const g: any = d.generate(b.input); if (!g.ok) continue; const p = g.plan;
  for (const k of [0, 1, 2, 3]) {
    const w0 = p.weeks[k]; if (!w0) continue; const at = w0.startDate;
    const a: any = d.adapt(p, d.facts(p, 'fatigue' as any, at), at);
    if (!a.ok) { t[`k${k} odbijeno`] = (t[`k${k} odbijeno`] ?? 0) + 1; continue; }
    const w = a.plan.weeks[k];
    const runDay1 = w.days.some((x: any) => x.date === at && x.countsToWeek);
    const key = `k${k} ${w.deload && !p.weeks[k].deload ? 'R' : '-'} dan1 ${runDay1 ? 'trc' : 'ne'} ${w.plannedKm > w.targetKm + 0.05 ? 'plan>cilj' : w.plannedKm < w.targetKm - 0.05 ? 'plan<cilj' : 'plan=cilj'}`;
    t[key] = (t[key] ?? 0) + 1;
    if (key.includes('plan>') && ex.length < 4) ex.push(`${b.id} k${k} cilj ${w.targetKm} plan ${w.plannedKm}`);
  }
}
console.log(JSON.stringify(t, null, 1), ex);
