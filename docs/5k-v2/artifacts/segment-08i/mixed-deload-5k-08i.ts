// mixed-deload samo 5K + razlaganje plan > cilj na upozorenje pouke 37
import { DISTS } from "/home/user/sub-19/docs/generators-v2/final-check/lib.ts";
const d = DISTS[0]!;
let n = 0, over = 0, sum = 0, max = 0, overPrev = 0, warned = 0, rej = 0; const ex: string[] = [];
for (const [i, b] of d.all().entries()) {
  if (i % 97 !== 0) continue;
  const g: any = d.generate(b.input); if (!g.ok) continue; const p = g.plan; const N = p.weeks.length;
  for (const k of [2, 4]) {
    if (k >= N - 3) continue;
    const at = p.weeks[k].startDate;
    const a: any = d.adapt(p, d.facts(p, 'fatigue' as any, at), at); if (!a.ok) { rej++; continue; }
    const w = a.plan.weeks[k]; if (!w.deload || p.weeks[k].deload) continue;
    n++;
    const diff = w.plannedKm - w.targetKm;
    if (diff > 0.5) { over++; sum += diff; max = Math.max(max, diff); if (a.plan.warnings.some((v: any) => v.rule === 'MIXED_OVER_TARGET' && v.week === w.index)) warned++; if (ex.length < 5) ex.push(`${b.id} k${k + 1} cilj ${w.targetKm} plan ${w.plannedKm} ${w.days.map((x: any) => x.role + ':' + x.workout.km).join(' ')}`); }
    if (w.plannedKm >= a.plan.weeks[k - 1].plannedKm - 0.05) overPrev++;
  }
}
console.log({ tekucaRasterecenja: n, planIznadCilja: over, uzUpozorenje37: warned, prosek: over ? +(sum / over).toFixed(2) : 0, max: +max.toFixed(2), neNizeOdPrethodne: overPrev, odbijeno: rej, ex });
