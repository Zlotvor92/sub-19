// Organizator (pouka 37): tekuća nedelja rasterećenja (umor, asOf = prvi dan nedelje k ∈ {2,4}, zapisi u k−1) — planirano vs cilj nedelje i prema prethodnoj. Iz web/: node ../docs/generators-v2/final-check/mixed-deload.ts
import { DISTS } from "/home/user/sub-19/docs/generators-v2/final-check/lib.ts";
for (const d of DISTS) {
  let n = 0, over = 0, sum = 0, max = 0, overPrev = 0, overNoWarn = 0; const ex: string[] = [], exNoWarn: string[] = [];
  for (const [i, b] of d.all().entries()) {
    if (i % 97 !== 0) continue;
    const g: any = d.generate(b.input); if (!g.ok) continue; const p = g.plan; const N = p.weeks.length;
    for (const k of [2, 4]) {
      if (k >= N - 3) continue;
      const at = p.weeks[k].startDate;
      const a: any = d.adapt(p, d.facts(p, 'fatigue' as any, at), at); if (!a.ok) continue;
      const w = a.plan.weeks[k]; if (!w.deload || p.weeks[k].deload) continue;
      n++;
      const diff = w.plannedKm - w.targetKm;
      if (diff > 0.5) { over++; sum += diff; max = Math.max(max, diff); if (ex.length < 3) ex.push(`${b.id} k${k + 1} cilj ${w.targetKm} plan ${w.plannedKm}`); }
      // Pouka 37: planirano > cilj (tolerancija 0,1 km zaokruživanja) samo uz upozorenje mešovite nedelje („MIXED", nedelja k + 1).
      if (diff > 0.1 + 1e-9 && !(a.plan.warnings ?? []).some((x: any) => /MIXED/.test(x.rule) && (x.week === undefined || x.week === k + 1))) {
        overNoWarn++; if (exNoWarn.length < 3) exNoWarn.push(`${b.id} k${k + 1} cilj ${w.targetKm} plan ${w.plannedKm}`);
      }
      const prev = a.plan.weeks[k - 1];
      if (w.plannedKm >= prev.plannedKm - 0.05) overPrev++;
    }
  }
  console.log(d.name, { tekucaRasterecenja: n, planIznadCilja: over, prosek: over ? +(sum / over).toFixed(2) : 0, max: +max.toFixed(2), neNizeOdPrethodne: overPrev, ex, iznadCiljaBezUpozorenja: overNoWarn, exNoWarn });
}
