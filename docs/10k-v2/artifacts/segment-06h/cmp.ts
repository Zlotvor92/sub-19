// start+0 vs start−1 (umor): nedelje 2..N iste? nedelja 1: dani posle dana 1 isti? cilj isti?
import { DISTS, addDays } from "/home/user/sub-19/docs/generators-v2/final-check/lib.ts";
const d = DISTS.find((x) => x.name === '10K')!;
const t: Record<string, number> = {}; const ex: string[] = [];
const inc = (k: string) => (t[k] = (t[k] ?? 0) + 1);
const J = JSON.stringify;
for (const [i, b] of d.all().entries()) {
  if (i % 25) continue;
  const g: any = d.generate(b.input); if (!g.ok) continue; const p = g.plan; const s = p.weeks[0].startDate;
  const A: any = d.adapt(p, d.facts(p, 'fatigue' as any, addDays(s, -1)), addDays(s, -1));
  const B: any = d.adapt(p, d.facts(p, 'fatigue' as any, s), s);
  if (!A.ok || !B.ok) { inc('odbijeno'); continue; }
  const strip = (w: any) => J({ ...w, notes: w.notes.filter((n: string) => !n.startsWith('Adaptacija')), plannedKm: 0, days: w.days.filter((x: any) => x.date !== s) });
  const later = J(A.plan.weeks.slice(1)) === J(B.plan.weeks.slice(1));
  const w1 = strip(A.plan.weeks[0]) === strip(B.plan.weeks[0]);
  const tg = A.plan.weeks[0].targetKm === B.plan.weeks[0].targetKm;
  inc(`ned 2..N ${later ? 'iste' : 'RAZLIČITE'}; ned 1 ${tg ? 'cilj isti' : 'cilj RAZLIČIT'}, ostali dani ${w1 ? 'isti' : 'RAZLIČITI'}`);
  if ((!later || !w1) && ex.length < 3) ex.push(b.id);
}
console.log(t, ex);
