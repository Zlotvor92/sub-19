/* Ugao 4, 5K v2 — polje plana `peakKm`: generator = vol.peakKm (generate.ts:400, vrh od kog se računa taper), adaptacija =
   max ciljeva izgradnje upisanog plana (adapt.ts:227), konstruktor koristi c.peakRefKm (volume.adaptVolume:383).
   Broji tokove gde plan.peakKm adaptiranog plana ≠ konstrukcijski vrh za taper (c.peakRefKm). Polje nema čitaoca
   (grep web/src). Tokovi: kao fiveK-volume-refs (bez drugog koraka). Bez slučajnosti.
   Iz web/: node ../docs/generators-v2/audit/owner/fiveK-peak-field.ts <kR> <kF> <kB> */
import { DISTS, SCENARIOS, wedOf, type Plan as LPlan } from "../../final-check/lib.ts";
import { adaptFiveKV2 } from "../../../../web/src/domain/generators/fiveK/v2/adapt.ts";
import { checkFacts, factKmOf } from "../../../../web/src/domain/generators/fiveK/v2/assess.ts";
import { mustDay } from "../../../../web/src/domain/generators/fiveK/v2/dates.ts";
import { construct } from "../../../../web/src/domain/generators/fiveK/v2/generate.ts";
import type { FiveKV2Plan, PlanDay } from "../../../../web/src/domain/generators/fiveK/v2/types.ts";
const [kR, kF, kB] = process.argv.slice(2, 5).map(Number) as [number, number, number];
const d5 = DISTS.find((d) => d.name === "5K")!;
const all = d5.all();
const fam: Record<string, number> = { R: kR, F: kF, B: kB };
const bases = ["R", "F", "B"].flatMap((fm) => all.filter((b) => b.family === fm).filter((_, i) => i % fam[fm]! === Math.floor(fam[fm]! / 2)));
const out = { flows: 0, ok: 0, differ: 0, ex: [] as string[] };
for (const b of bases) {
  const g = d5.generate(b.input);
  if (!g.ok) continue;
  const p = g.plan as unknown as FiveKV2Plan;
  const N = p.weeks.length;
  for (const at of [wedOf(p.weeks[1]!.startDate), p.weeks[2]!.endDate, wedOf(p.weeks[Math.floor(N / 2) - 1]!.startDate), p.weeks[N - 5]!.endDate])
    for (const sc of SCENARIOS) {
      const facts = d5.facts(p as unknown as LPlan, sc, at);
      out.flows++;
      const r = adaptFiveKV2(p, facts, at);
      if (!r.ok) continue;
      out.ok++;
      const cf = checkFacts(facts, at, new Set(p.weeks.flatMap((w) => w.days.map((d) => d.date))));
      if (!cf.ok) continue;
      const t = mustDay(at);
      const done = new Set(cf.facts.workouts.filter((x) => x.completed).map((x) => x.dayId ?? x.date));
      const locked = new Set(cf.facts.lockedDayIds);
      const keep = (d: PlanDay) => mustDay(d.date) <= t || done.has(d.date) || locked.has(d.date);
      const c = construct(p.input, r.plan.adaptation!.steps, { weeks: p.weeks, keep, asOf: t, at, factKm: factKmOf(cf.facts, at) });
      if (c.ok && Math.abs(c.c.peakRefKm - r.plan.peakKm) > 1e-6) {
        out.differ++;
        if (out.ex.length < 5) out.ex.push(`${b.id} asOf ${at} ${sc}: plan.peakKm ${r.plan.peakKm} vs vrh za taper ${c.c.peakRefKm}`);
      }
    }
}
console.log(JSON.stringify({ step: { R: kR, F: kF, B: kB }, bases: bases.length, ...out }, null, 1));
