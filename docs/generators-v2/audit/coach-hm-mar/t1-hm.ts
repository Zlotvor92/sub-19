/* Krug T (HM-10, T1): lagan prema dugom u nedeljama izgradnje (ne rasterećenje/taper/trkačka), svi ulazi mreža.
   Broji: planove sa laganim ≥ 0,9 × dugi (1b #4), > 0,8 × dugi (T1), lagan < 20 min; planove sa nedeljom izgradnje
   spuštenom ispod cilja po pravilu (fitted 'down'), odbijene; zbir planiranog obima.
   Iz web/: node ../docs/generators-v2/audit/coach-hm-mar/t1-hm.ts */
import { distOf, type Plan } from "../../final-check/lib.ts";
const d = distOf("HM");
const o = { plans: 0, rejected: 0, e09: 0, e08: 0, e20min: 0, down: 0, downWeeks: 0, planned: 0, rejCodes: {} as Record<string, number> };
for (const b of d.all()) {
  const g = d.generate(b.input);
  if (!g.ok) { o.rejected++; for (const r of (g as unknown as { reasons: { code: string }[] }).reasons) o.rejCodes[r.code] = (o.rejCodes[r.code] ?? 0) + 1; continue; }
  const p = g.plan as Plan & { weeks: (Plan["weeks"][number] & { fitted?: string | null })[] };
  o.plans++;
  let a = false, b8 = false, m20 = false, dn = false;
  for (const w of p.weeks) {
    o.planned += w.plannedKm;
    if (w.deload || !["base", "development", "specific"].includes(w.phase)) continue;
    if (w.fitted === "down") { dn = true; o.downWeeks++; }
    const L = w.days.find((x) => x.role === "long");
    if (!L) continue;
    for (const x of w.days.filter((y) => y.role === "easy")) {
      if (x.workout.km >= 0.9 * L.workout.km) a = true;
      if (x.workout.km > 0.8 * L.workout.km + 1e-9) b8 = true;
      if (x.workout.sec < 1200) m20 = true;
    }
  }
  if (a) o.e09++; if (b8) o.e08++; if (m20) o.e20min++; if (dn) o.down++;
}
o.planned = Math.round(o.planned);
console.log(JSON.stringify(o));
