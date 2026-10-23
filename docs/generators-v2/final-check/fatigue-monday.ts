// Organizator (pouka 36 precizno): umor, asOf PONEDELJAK nedelje k, zapisi u k−1 → koja nedelja je prinudno rasterećenje (cilj: „tekuca+0"). Iz web/: node ../docs/generators-v2/final-check/fatigue-monday.ts
import { DISTS, addDays } from "/home/user/sub-19/docs/generators-v2/final-check/lib.ts";
for (const d of DISTS) {
  const all = d.all(); const tally: Record<string, number> = {}; let n = 0;
  for (const [i, b] of all.entries()) {
    if (i % 211 !== 0) continue;
    const g: any = d.generate(b.input); if (!g.ok) continue; const p = g.plan; const N = p.weeks.length;
    for (const k of [2, 4]) {
      if (k >= N - 3) continue;
      const at = p.weeks[k].startDate; // ponedeljak nedelje k+1 (indeks k)
      const f = d.facts(p, 'fatigue' as any, at);
      const a: any = d.adapt(p, f, at); if (!a.ok) { tally['odbijeno'] = (tally['odbijeno'] ?? 0) + 1; continue; }
      n++;
      const newDl = a.plan.weeks.map((w: any, j: number) => (w.deload && !p.weeks[j]?.deload ? j - k : null)).filter((x: any) => x !== null);
      const key = newDl.length ? 'tekuca+' + newDl.join(',') : 'bez novog';
      tally[key] = (tally[key] ?? 0) + 1;
    }
  }
  console.log(d.name, n, tally);
}
