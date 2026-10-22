// Trkačka nedelja (izuzeta od pouke 37, pouka 30): asOf u nedelji pre i u trkačkoj × 17 scenarija, svaki 48. plan — planirano vs cilj i taper. Iz web/: node race-week-08i.ts
import { DISTS, SCENARIOS, addDays } from "/home/user/sub-19/docs/generators-v2/final-check/lib.ts";
const d = DISTS[0]!;
let n = 0, over = 0, overBound = 0, overTaper = 0; const diffs: number[] = []; const byS: Record<string, number> = {}; const ex: string[] = [];
for (const [i, b] of d.all().entries()) {
  if (i % 48 !== 0) continue;
  const g: any = d.generate(b.input); if (!g.ok) continue; const p = g.plan; const N = p.weeks.length;
  for (const s of SCENARIOS) for (let o = -7; o < 6; o++) {
    const at = addDays(p.weeks[N - 1].startDate, o);
    const a: any = d.adapt(p, d.facts(p, s === 'chain' ? 'pause10' : s as any, at), at); n++;
    if (!a.ok) continue;
    const w = a.plan.weeks[N - 1];
    const bound = +(w.notes.join(' ').match(/gornja granica ([\d.]+) km/)?.[1] ?? 'NaN');
    if (w.plannedKm > w.targetKm + 0.05) { over++; diffs.push(w.plannedKm - w.targetKm); byS[s] = (byS[s] ?? 0) + 1;
      if (w.plannedKm > bound + 0.05) { overBound++; if (ex.length < 4) ex.push(`${b.id} ${s} ${at} cilj ${w.targetKm} plan ${w.plannedKm} granica ${bound} ${w.days.map((x: any) => x.date.slice(5) + ' ' + x.role + ':' + x.workout.km).join(' | ')}`); }
      if (w.plannedKm > a.plan.weeks[N - 2].plannedKm + 0.05) overTaper++; }
  }
}
diffs.sort((x, y) => x - y);
console.log({ n, over, overBound, overTaper, med: diffs[diffs.length >> 1], max: diffs[diffs.length - 1], byS, ex });
