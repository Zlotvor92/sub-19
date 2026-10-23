/* HM v2 Segment 03b (hm-v2.2.1, pouka 32) — K1–K6 (MASTER § 3) po mreži: 02 (16 896), r (10 944), 03 po osećaju
   (6336) i početnik (1890). Gusta mreža nedelje 1: measure-32.ts (K1 i regresija). Pokretanje iz korena repoa:
     node docs/hm-v2/artifacts/segment-03b/k-metrics.ts [koren v2 generatora, npr. worktree 5e09a02]
   Invarijante: web/src/domain/generators/halfMarathon/v2/gridInvariants.ts (nezavisno od validatora). */

import {
  checkPlan,
  emptyStats,
  type GridStats,
} from "../../../../web/src/domain/generators/halfMarathon/v2/gridInvariants.ts";
import {
  beginnerInputs,
  DAY_COUNTS,
  feelInputs,
  grid02Inputs,
  inputOf,
  KM_BY_DAYS,
  SCHEDULES_BY_DAYS,
} from "../../../../web/src/domain/generators/halfMarathon/v2/testInputs.ts";

const root =
  process.argv[2] ?? "../../../../web/src/domain/generators/halfMarathon/v2";
const { generateHmV2 } = (await import(`${root}/generate.ts`)) as {
  generateHmV2: typeof import("../../../../web/src/domain/generators/halfMarathon/v2/generate.ts").generateHmV2;
};
const t0 = process.hrtime.bigint();
const recent = DAY_COUNTS.flatMap((days) => {
  const xs: { id: string; input: Record<string, unknown> }[] = [];
  for (let r = 5; r <= 42; r++)
    for (let km = KM_BY_DAYS[days].min; km <= KM_BY_DAYS[days].max; km += 5)
      for (const vdot of [30, 45, 70])
        for (const weeks of [10, 14, 20])
          xs.push({
            id: `r-d${days}-${weeks}w-${km}km-v${vdot}-r${r}`,
            input: inputOf({
              weeks,
              km,
              vdot,
              days: SCHEDULES_BY_DAYS[days].A.days,
              recentLongRunKm: r,
            }),
          });
  return xs;
});
const GRIDS: [string, { id: string; input: Record<string, unknown> }[]][] = [
  ["02", grid02Inputs()],
  ["r", recent],
  ["feel", feelInputs()],
  ["beginner", beginnerInputs()],
];

const out: Record<string, unknown> = {};
for (const [name, inputs] of GRIDS) {
  const st: GridStats = emptyStats();
  const bad: Record<string, string[]> = {};
  const rejected: Record<string, number> = {};
  const errors: Record<string, number> = {};
  const warnPlans: Record<string, number> = {};
  for (const g of inputs) {
    const r = generateHmV2(g.input);
    if (!r.ok) {
      for (const x of r.reasons)
        rejected[`${x.code} ned ${x.week ?? "—"}`] =
          (rejected[`${x.code} ned ${x.week ?? "—"}`] ?? 0) + 1;
      continue;
    }
    for (const v of r.plan.warnings)
      if (v.severity === "error") errors[v.rule] = (errors[v.rule] ?? 0) + 1;
    for (const rule of new Set(r.plan.warnings.map((v) => v.rule)))
      warnPlans[rule] = (warnPlans[rule] ?? 0) + 1;
    checkPlan(g.id, r.plan, bad, st);
  }
  out[name] = {
    plans: st.plans,
    K1: { rejected, validatorErrors: errors },
    K2: { week1Below: st.week1Below, notAtAbsCap: st.week1BelowNotTime },
    K3: st.buildNoQuality,
    K5: [
      st.raceOverTaper,
      st.dropOutsideCapacity,
      st.hardAdjacent,
      st.longBelowEasy,
    ],
    K6: {
      slotRepeatWeeks: st.slotRepeatWeeks,
      qualityLongerThanLongBuildPlans: st.longerQualityPlans,
      capacityLimitedPlans: st.capacityPlans,
      peakOverStart: +(st.peakRatioSum / Math.max(1, st.plans)).toFixed(3),
    },
    pouka32: {
      overLong: st.overLong,
      lowestOverLongPlans: st.lowestOverLongPlans,
      lowestOverLongWeek1: st.lowestOverLongWeek1,
      durationDropWeeks: st.durationDropWeeks,
      reducedDeloadTaper: st.reducedDeloadTaper,
      longJump12MaxL: +st.longJump12MaxL.toFixed(3),
    },
    warningPlans: warnPlans,
    invariantViolations: Object.fromEntries(
      Object.entries(bad).map(([k, v]) => [k, [v.length, v[0]]]),
    ),
  };
}
console.log(
  JSON.stringify(
    {
      ...out,
      seconds: +(Number(process.hrtime.bigint() - t0) / 1e9).toFixed(1),
    },
    null,
    1,
  ),
);
