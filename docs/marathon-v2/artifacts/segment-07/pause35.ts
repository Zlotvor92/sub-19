/* MAR-07 pouka 35 (N5): isti uzorak kao final-check/targeted.ts (c) — svaki 61./31./17. plan mreže R/F/B, pauza 35 na
   kraju nedelje 3 … N − 4 (nov start). Po toku: nedelje izgradnje posle asOf sa DVA dana kvaliteta u kojima je dan
   kvaliteta duži od dugog (trajanje treninga), nedelje sa napomenom pouke 35 (drugi dan lagan), nedelje izgradnje
   sa JEDNIM kvalitetom dužim od dugog (upozorenje pouke 14), odbijanja. Iz korena repoa:
   node docs/marathon-v2/artifacts/segment-07/pause35.ts → JSON na stdout. Uvozi lib.ts (samo čitanje). */

import { distOf, type Plan } from "../../../generators-v2/final-check/lib.ts";

const d = distOf("MAR");
const every = { R: 61, F: 31, B: 17 } as Record<string, number>;
const seen: Record<string, number> = {};
const bases = d.all().filter((b) => {
  const i = (seen[b.family] = (seen[b.family] ?? -1) + 1);
  return i % every[b.family]! === 0;
});
const out = {
  flows: 0,
  rejected: 0,
  weeks: 0,
  twoQOver: 0,
  plansTwoQOver: 0,
  easy35: 0,
  oneQOver: 0,
  ex: [] as string[],
};
for (const b of bases) {
  const g = d.generate(b.input);
  if (!g.ok) continue;
  const p = g.plan as Plan;
  const N = p.weeks.length;
  for (let i = 3; i <= N - 4; i++) {
    const at = p.weeks[i - 1]!.endDate;
    out.flows++;
    const r = d.adapt(p, d.facts(p, "pause35", at), at);
    if (!r.ok) {
      out.rejected++;
      continue;
    }
    let two = false;
    for (const w of r.plan.weeks.filter((x) => x.startDate > at)) {
      if (!["base", "development", "specific"].includes(w.phase) || w.deload)
        continue;
      const L = w.days.find((x) => x.role === "long");
      if (!L) continue;
      out.weeks++;
      const qs = w.days.filter((x) => x.workout.kind === "quality");
      if (w.notes.some((n) => n.endsWith("(pouka 35)."))) out.easy35++;
      const over = qs.some((x) => x.workout.sec > L.workout.sec);
      if (over && qs.length === 2) {
        out.twoQOver++;
        two = true;
        if (out.ex.length < 4)
          out.ex.push(
            `${b.id}/w${i}end ned ${w.index}: dugi ${L.workout.km} km ${Math.round(L.workout.sec / 60)} min < ${qs.map((x) => Math.round(x.workout.sec / 60)).join("/")} min`,
          );
      } else if (over) out.oneQOver++;
    }
    if (two) out.plansTwoQOver++;
  }
}
console.log(JSON.stringify(out, null, 1));
