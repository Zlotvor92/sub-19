/* HM v2 Segment 03b — pouka 32 i obim: nedelje čiji se cilj promenio (spuštene na izvodljiv cilj jer niža doza
   ostavlja lagane duže od dugog na granici pouke 28), vrh i zbir plana pre (5e09a02) i posle (ovo stablo).
   Pokretanje iz korena repoa: node docs/hm-v2/artifacts/segment-03b/volume-diff.ts <koren v2 5e09a02> */

import {
  beginnerInputs,
  DAY_COUNTS,
  feelInputs,
  grid02Inputs,
  inputOf,
  KM_BY_DAYS,
  SCHEDULES_BY_DAYS,
} from "../../../../web/src/domain/generators/halfMarathon/v2/testInputs.ts";
import { generateHmV2 as after } from "../../../../web/src/domain/generators/halfMarathon/v2/generate.ts";

const root = process.argv[2];
if (!root) throw new Error("upotreba: volume-diff.ts <koren v2 5e09a02>");
const before = (
  (await import(`${root}/generate.ts`)) as { generateHmV2: typeof after }
).generateHmV2;
const recent = DAY_COUNTS.flatMap((days) => {
  const xs: [string, Record<string, unknown>][] = [];
  for (let r = 5; r <= 42; r++)
    for (let km = KM_BY_DAYS[days].min; km <= KM_BY_DAYS[days].max; km += 5)
      for (const vdot of [30, 45, 70])
        for (const weeks of [10, 14, 20])
          xs.push([
            `r-d${days}-${weeks}w-${km}km-v${vdot}-r${r}`,
            inputOf({
              weeks,
              km,
              vdot,
              days: SCHEDULES_BY_DAYS[days].A.days,
              recentLongRunKm: r,
            }),
          ]);
  return xs;
});
const grids: [string, [string, Record<string, unknown>][]][] = [
  ["02", grid02Inputs().map((g) => [g.id, g.input])],
  ["r", recent],
  ["feel", feelInputs().map((g) => [g.id, g.input])],
  ["beginner", beginnerInputs().map((g) => [g.id, g.input])],
];
const out: Record<string, unknown> = {};
for (const [name, xs] of grids) {
  let plans = 0,
    weeks = 0,
    week1 = 0,
    peakLower = 0,
    maxPeakDrop = 0,
    maxWeekDrop = 0,
    sumDrop = 0;
  let ex = "";
  for (const [id, x] of xs) {
    const a = before(x),
      b = after(x);
    if (!a.ok || !b.ok) continue;
    let changed = false;
    a.plan.weeks.forEach((wa, i) => {
      const wb = b.plan.weeks[i]!;
      if (wa.targetKm === wb.targetKm) return;
      changed = true;
      weeks++;
      if (i === 0) {
        week1++;
        ex ||= `${id} ned 1: ${wa.targetKm} → ${wb.targetKm} km`;
      }
      maxWeekDrop = Math.max(
        maxWeekDrop,
        +(wa.targetKm - wb.targetKm).toFixed(1),
      );
    });
    if (changed) plans++;
    if (b.plan.peakKm < a.plan.peakKm) {
      peakLower++;
      maxPeakDrop = Math.max(
        maxPeakDrop,
        +(a.plan.peakKm - b.plan.peakKm).toFixed(1),
      );
    }
    const sum = (p: typeof a.plan) =>
      p.weeks.reduce((s, w) => s + w.plannedKm, 0);
    sumDrop = Math.max(sumDrop, +(sum(a.plan) - sum(b.plan)).toFixed(1));
  }
  out[name] = {
    plansWithTargetChange: plans,
    weeksChanged: weeks,
    week1Changed: week1,
    example: ex,
    maxWeekDropKm: maxWeekDrop,
    peakLowerPlans: peakLower,
    maxPeakDropKm: maxPeakDrop,
    maxPlanSumDropKm: sumDrop,
  };
}
console.log(JSON.stringify(out, null, 1));
