/* Ugao 1a — potvrda M2: napomena „planirano X km < cilj“ ≠ planirano nedelje samo u tekućoj (mešovitoj) nedelji. 5K, svaki 60. ulaz mreže, pain5/pain8/painPause, asOf sreda i kraj ned 2…N−2. Iz web/: node ../docs/generators-v2/audit/coach-5k-10k/note-mixed.ts */
import { distOf, wedOf, type Plan } from "../../final-check/lib.ts";
const d = distOf("5K"); const all = d.all();
let mixed = 0, future = 0, ex = "";
for (let i = 0; i < all.length; i += 60) {
  const g = d.generate(all[i]!.input); if (!g.ok) continue; const p = g.plan;
  for (let wi = 2; wi <= p.weeks.length - 2; wi++) for (const at of [wedOf(p.weeks[wi-1]!.startDate), p.weeks[wi-1]!.endDate]) for (const s of ["pain5","pain8","painPause"] as const) {
    const r = d.adapt(p, d.facts(p as Plan, s, at), at); if (!r.ok) continue;
    for (const w of r.plan.weeks) { if (w.endDate <= at) continue;
      for (const n of w.notes) { const m = /planirano ([0-9.]+) km < cilj/.exec(n); if (m && Math.abs(Number(m[1]) - w.plannedKm) > 0.15) { if (w.startDate <= at) mixed++; else { future++; if (!ex) ex = `${all[i]!.id}/${s}@${at} ned ${w.index}: ${n} | planned ${w.plannedKm} | ${w.days.map(x=>x.role+" "+x.workout.km).join(", ")}`; } } } }
  }
}
console.log({ mixed, future, ex });
