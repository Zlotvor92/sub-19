/* HM v2 Segment 01 — K1–K6 (MASTER § 3) na mreži 01 (3696) i gustoj mreži nedelje 1. Pokretanje iz korena repoa:
     node docs/hm-v2/artifacts/segment-01/k-metrics.ts
   Invarijante: web/src/domain/generators/halfMarathon/v2/gridInvariants.ts (nezavisno od validatora). */

import { generateHmV2 } from "../../../../web/src/domain/generators/halfMarathon/v2/generate.ts";
import {
  checkPlan,
  emptyStats,
} from "../../../../web/src/domain/generators/halfMarathon/v2/gridInvariants.ts";
import {
  denseWeek1Inputs,
  gridInputs,
} from "../../../../web/src/domain/generators/halfMarathon/v2/testInputs.ts";

const t0 = process.hrtime.bigint();
const bad: Record<string, string[]> = {};
const st = emptyStats();
const rejected: Record<string, number> = {};
const errors: Record<string, number> = {};
const warnPlans: Record<string, number> = {};
for (const g of gridInputs()) {
  const r = generateHmV2(g.input);
  if (!r.ok) {
    for (const x of r.reasons) rejected[x.code] = (rejected[x.code] ?? 0) + 1;
    continue;
  }
  for (const v of r.plan.warnings)
    if (v.severity === "error") errors[v.rule] = (errors[v.rule] ?? 0) + 1;
  for (const rule of new Set(r.plan.warnings.map((v) => v.rule)))
    warnPlans[rule] = (warnPlans[rule] ?? 0) + 1;
  checkPlan(g.id, r.plan, bad, st);
}
// Gusta mreža nedelje 1 (obim 30,0–60,0 korak 0,1 × VDOT 30–80 korak 0,5; 10 ned, raspored A): ceo plan.
const dBad: Record<string, string[]> = {};
const dSt = emptyStats();
const dRejected: Record<string, number> = {};
for (const g of denseWeek1Inputs()) {
  const r = generateHmV2(g.input);
  if (!r.ok) {
    for (const x of r.reasons) dRejected[x.code] = (dRejected[x.code] ?? 0) + 1;
    continue;
  }
  checkPlan(g.id, r.plan, dBad, dSt);
}
const ms = Number(process.hrtime.bigint() - t0) / 1e6;
console.log(
  JSON.stringify(
    {
      inputs: gridInputs().length,
      K1: { rejected, validatorErrors: errors },
      K2: { week1Below: st.week1Below, notAtTimeCap: st.week1BelowNotTime },
      K3: { buildWeeksWithoutTwoQualities: st.buildNoQuality },
      K4: "nema prethodnog segmenta",
      K5: {
        raceOverTaper: st.raceOverTaper,
        doseDropOutsideCapacity: st.dropOutsideCapacity,
        hardAdjacent: st.hardAdjacent,
        longBelowEasy: st.longBelowEasy,
      },
      K6: {
        slotRepeatWeeks: st.slotRepeatWeeks,
        qualityLongerThanLongPlans: st.longerQualityPlans,
        capacityLimitedPlans: st.capacityPlans,
        peakOverStart: +(st.peakRatioSum / st.plans).toFixed(3),
      },
      other: {
        doseDroppedPlans: st.doseDroppedPlans,
        fittedWeeks: st.fittedWeeks,
        fittedUpWeeks: st.fittedUpWeeks,
        longestBelow16Plans: st.longShortPlans,
        taperRelaxed: st.taperRelaxed,
        deloadNoQuality: st.deloadNoQuality,
        warningPlans: warnPlans,
      },
      invariantViolations: Object.fromEntries(
        Object.entries(bad).map(([k, v]) => [k, [v.length, v[0]]]),
      ),
      dense: {
        inputs: denseWeek1Inputs().length,
        K1rejected: dRejected,
        K2: { week1Below: dSt.week1Below, notAtTimeCap: dSt.week1BelowNotTime },
        K3: dSt.buildNoQuality,
        fittedUpWeeks: dSt.fittedUpWeeks,
        K5: [
          dSt.raceOverTaper,
          dSt.dropOutsideCapacity,
          dSt.hardAdjacent,
          dSt.longBelowEasy,
        ],
        K6: {
          slotRepeatWeeks: dSt.slotRepeatWeeks,
          qualityLongerThanLongPlans: dSt.longerQualityPlans,
          capacityLimitedPlans: dSt.capacityPlans,
          peakOverStart: +(dSt.peakRatioSum / dSt.plans).toFixed(3),
        },
        invariantViolations: Object.fromEntries(
          Object.entries(dBad).map(([k, v]) => [k, [v.length, v[0]]]),
        ),
      },
      ms: Math.round(ms),
    },
    null,
    2,
  ),
);
