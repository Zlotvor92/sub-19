// start+0 umor (posle ispravke ključa): nedelja 1 — cilj T, upisani dan 1 W, ostatak dana; izvodljivost ostatka = T − W
import { DISTS } from "/home/user/sub-19/docs/generators-v2/final-check/lib.ts";
const d = DISTS.find((x) => x.name === '10K')!;
const stride = Number(process.argv[2] ?? 25);
const t: Record<string, number> = {}; const ex: string[] = []; let over = 0, sumOver = 0, maxOver = 0;
for (const [i, b] of d.all().entries()) {
  if (i % stride) continue;
  const g: any = d.generate(b.input); if (!g.ok) continue; const p = g.plan;
  const at = p.weeks[0].startDate;
  const a: any = d.adapt(p, d.facts(p, 'fatigue' as any, at), at);
  if (!a.ok) { t.odbijeno = (t.odbijeno ?? 0) + 1; continue; }
  const w = a.plan.weeks[0];
  const d1 = w.days.find((x: any) => x.date === at && x.countsToWeek);
  if (!d1) { t['dan 1 nije trčanje'] = (t['dan 1 nije trčanje'] ?? 0) + 1; continue; }
  const rest = w.days.filter((x: any) => x.date !== at && x.countsToWeek);
  const R = w.targetKm - d1.workout.km;
  const minRest = rest.length * 3.0;
  const k = `dan1 ${d1.role}: ${R >= minRest ? 'ostatak izvodljiv (≥ 3 km/dan)' : R > 0 ? 'ostatak < 3 km/dan' : 'dan 1 ≥ cilj'}`;
  t[k] = (t[k] ?? 0) + 1;
  const o = Math.round((w.plannedKm - w.targetKm) * 100) / 100;
  if (o > 0.05) { over++; sumOver += o; maxOver = Math.max(maxOver, o); }
  if (R < minRest && ex.length < 4) ex.push(`${b.id}: cilj ${w.targetKm}, dan 1 ${d1.role} ${d1.workout.km}, ostatak ${rest.length} dana`);
}
console.log(JSON.stringify({ t, planIznadCilja: over, prosecnoIznad: Math.round(sumOver / over * 100) / 100, maxIznad: maxOver }, null, 1), ex);
