/* 10K-08 T1: planovi sa nedeljom izgradnje ispod pravila (fitted 'down', CAPACITY_LIMITED) i odbijeni, svaki k-ti ulaz
   mreže generatora; plus nedelje izgradnje sa laganim > 0,8 × dugi ili < 20 min. Iz web/:
   node ../docs/10k-v2/artifacts/segment-08/t1-capacity.ts <k> */
import { distOf } from "../../../generators-v2/final-check/lib.ts";

const k = Number(process.argv[2] ?? 3);
const d = distOf("10K");
const all = d.all();
const o = { plans: 0, ok: 0, rejected: 0, capacityLimited: 0, fittedDownPlans: 0, fittedDownWeeks: 0, plannedBelowNominalKm: 0, easyOver08: 0, easyUnder20min: 0, restDays: 0, rej: [] as string[] };
for (let i = 0; i < all.length; i += k) {
  o.plans++;
  const g = d.generate(all[i]!.input);
  if (!g.ok) { o.rejected++; if (o.rej.length < 5) o.rej.push(`${all[i]!.id}: ${g.reasons.map((r) => r.code).join(",")}`); continue; }
  o.ok++;
  if (g.plan.warnings.some((w: any) => (w.code ?? w.rule) === "CAPACITY_LIMITED")) o.capacityLimited++;
  let down = false;
  for (const w of g.plan.weeks as any[]) {
    const build = !w.deload && !["taper", "race"].includes(w.phase);
    if (!build) continue;
    if (w.fitted === "down") { down = true; o.fittedDownWeeks++; o.plannedBelowNominalKm += w.nominalKm - w.targetKm; }
    const L = w.days.find((x: any) => x.role === "long");
    if (L) for (const x of w.days.filter((y: any) => y.role === "easy")) {
      if (x.workout.km > Math.floor(8 * L.workout.km + 1e-9) / 10 + 1e-9) o.easyOver08++;
      if (x.workout.sec < 1200) o.easyUnder20min++;
    }
    o.restDays += (g.plan.input.runDays as string[]).length - w.days.length;
  }
  if (down) o.fittedDownPlans++;
}
o.plannedBelowNominalKm = Math.round(o.plannedBelowNominalKm * 10) / 10;
console.log(JSON.stringify(o, null, 1));
