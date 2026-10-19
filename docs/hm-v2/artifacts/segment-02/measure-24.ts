/* HM v2 Segment 02 — merenje granice dugog 24 km (H13, odluka organizatora HM-01 → 02) na mreži 02 (16 896).
   Pokretanje iz korena repoa:
     node docs/hm-v2/artifacts/segment-02/measure-24.ts
   Isti kod, dva prolaza: (pre) `lengths.longMaxKm` privremeno = ∞ (samo u ovom procesu), (posle) = 24 km iz
   politike. Po broju dana: odbijanja, najduži dugi (> 24 km planova, max), vrh (prosek vrh/start, planova sa
   nižim vrhom, najveći pad), K2 (ned 1 < obim: ukupno / dugi na 24 km), CAPACITY_LIMITED po obimu. */

import { generateHmV2 } from "../../../../web/src/domain/generators/halfMarathon/v2/generate.ts";
import { HM_V2_POLICY } from "../../../../web/src/domain/generators/halfMarathon/v2/policy.ts";
import { grid02Inputs } from "../../../../web/src/domain/generators/halfMarathon/v2/testInputs.ts";

const lengths = HM_V2_POLICY.lengths as { longMaxKm: number };
const inputs = grid02Inputs();

interface Row {
  peak: number;
  longest: number;
  w1Below: boolean;
  w1Long: number;
  capacity: boolean;
}
function pass(cap: number): Record<string, Row | string> {
  lengths.longMaxKm = cap;
  const out: Record<string, Row | string> = {};
  for (const g of inputs) {
    const r = generateHmV2(g.input);
    if (!r.ok) {
      out[g.id] = r.reasons.map((x) => x.code).join();
      continue;
    }
    const w1 = r.plan.weeks[0]!;
    out[g.id] = {
      peak: r.plan.peakKm,
      longest: Math.max(
        ...r.plan.weeks.flatMap((w) =>
          w.days.filter((d) => d.role === "long").map((d) => d.workout.km),
        ),
      ),
      w1Below: w1.targetKm < r.plan.startKm,
      w1Long: w1.days.find((d) => d.role === "long")!.workout.km,
      capacity: r.plan.warnings.some((v) => v.rule === "CAPACITY_LIMITED"),
    };
  }
  return out;
}
const before = pass(Infinity);
const after = pass(24);
lengths.longMaxKm = 24;

const res: Record<string, unknown> = {};
for (const days of [3, 4, 5, 6]) {
  const ids = inputs.filter((g) => g.days === days);
  const s = {
    plans: ids.length,
    rejected: [0, 0],
    longestOver24: [0, 0],
    longestMax: [0, 0],
    peakOverStart: [0, 0],
    peakLower: 0,
    peakMaxDrop: [0, ""] as [number, string],
    week1Below: [0, 0],
    week1BelowLongAt24: 0,
    capacityLimited: [0, 0],
    capacityLimitedByKm: {} as Record<string, [number, number]>,
  };
  for (const g of ids) {
    const b = before[g.id]!;
    const a = after[g.id]!;
    if (typeof b === "string") s.rejected[0]++;
    if (typeof a === "string") s.rejected[1]++;
    if (typeof a === "string" || typeof b === "string") continue;
    const km = (s.capacityLimitedByKm[g.km] ??= [0, 0]);
    [b, a].forEach((x, i) => {
      if (x.longest > 24) s.longestOver24[i]++;
      s.longestMax[i] = Math.max(s.longestMax[i]!, x.longest);
      s.peakOverStart[i] += x.peak / g.km;
      if (x.w1Below) s.week1Below[i]++;
      if (x.capacity) {
        s.capacityLimited[i]++;
        km[i]++;
      }
    });
    if (a.w1Below && a.w1Long === 24) s.week1BelowLongAt24++;
    if (a.peak < b.peak) {
      s.peakLower++;
      if (b.peak - a.peak > s.peakMaxDrop[0])
        s.peakMaxDrop = [+(b.peak - a.peak).toFixed(1), g.id];
    }
  }
  s.peakOverStart = s.peakOverStart.map((x) => +(x / ids.length).toFixed(3));
  for (const k of Object.keys(s.capacityLimitedByKm))
    if (s.capacityLimitedByKm[k]!.every((x) => x === 0))
      delete s.capacityLimitedByKm[k];
  res[`${days} dana`] = s;
}
console.log(JSON.stringify(res, null, 1));
