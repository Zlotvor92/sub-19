/* HM v2 Segment 03 — K1–K6 (MASTER § 3) po broju dana na mreži 03: po osećaju (6336) i početnik (1890; sudar
   SEGMENT-03-STOP.md se broji posebno). Pokretanje iz korena repoa:
     node docs/hm-v2/artifacts/segment-03/k-metrics.ts
   Invarijante: web/src/domain/generators/halfMarathon/v2/gridInvariants.ts (nezavisno od validatora). K4 (vrh
   niži od prethodnog segmenta) ne postoji za nove planove; planovi sa rezultatom: regression-hm02.ts. */

import { generateHmV2 } from "../../../../web/src/domain/generators/halfMarathon/v2/generate.ts";
import {
  checkPlan,
  emptyStats,
  type GridStats,
} from "../../../../web/src/domain/generators/halfMarathon/v2/gridInvariants.ts";
import {
  beginnerInputs,
  feelInputs,
  type Grid03Input,
} from "../../../../web/src/domain/generators/halfMarathon/v2/testInputs.ts";

const t0 = process.hrtime.bigint();

interface Acc {
  st: GridStats;
  bad: Record<string, string[]>;
  rejected: Record<string, number>;
  errors: Record<string, number>;
  warnPlans: Record<string, number>;
}
const acc = (): Acc => ({
  st: emptyStats(),
  bad: {},
  rejected: {},
  errors: {},
  warnPlans: {},
});
const add = (o: Record<string, number>, k: string): void => {
  o[k] = (o[k] ?? 0) + 1;
};

function run(
  inputs: readonly Grid03Input[],
  key: (g: Grid03Input) => string,
): Record<string, Acc> {
  const out: Record<string, Acc> = {};
  for (const g of inputs) {
    const a = (out[key(g)] ??= acc());
    const r = generateHmV2(g.input);
    if (!r.ok) {
      for (const x of r.reasons)
        add(a.rejected, `${x.code} ned ${x.week ?? "—"}`);
      continue;
    }
    for (const v of r.plan.warnings)
      if (v.severity === "error") add(a.errors, v.rule);
    for (const rule of new Set(r.plan.warnings.map((v) => v.rule)))
      add(a.warnPlans, rule);
    checkPlan(g.id, r.plan, a.bad, a.st);
  }
  return out;
}

const summary = (a: Acc) => ({
  plans: a.st.plans,
  K1: { rejected: a.rejected, validatorErrors: a.errors },
  K2: {
    week1Below: a.st.week1Below,
    notAtAbsCap: a.st.week1BelowNotTime,
    at: a.st.week1BelowAt,
  },
  K3: a.st.buildNoQuality,
  K5: [
    a.st.raceOverTaper,
    a.st.dropOutsideCapacity,
    a.st.hardAdjacent,
    a.st.longBelowEasy,
  ],
  K6: {
    slotRepeatWeeks: a.st.slotRepeatWeeks,
    qualityLongerThanLongPlans: a.st.longerQualityPlans,
    capacityLimitedPlans: a.st.capacityPlans,
    peakOverStart: +(a.st.peakRatioSum / Math.max(1, a.st.plans)).toFixed(3),
  },
  test: {
    inDeload: a.st.testInDeload,
    deloadLongShortened: a.st.testDeloadShortLong,
    testDayLongerThanLong: a.st.testLongerThanLong,
  },
  beginner: {
    tFallbackWeeks: a.st.beginnerTFallbackWeeks,
    taperT: a.st.beginnerTaperT,
    longestBelow14: a.st.beginnerLongShort,
  },
  other: {
    doseDroppedPlans: a.st.doseDroppedPlans,
    fittedWeeks: a.st.fittedWeeks,
    fittedUpWeeks: a.st.fittedUpWeeks,
    longestBelow16Plans: a.st.longShortPlans,
    taperRelaxed: a.st.taperRelaxed,
    deloadNoQuality: a.st.deloadNoQuality,
    warningPlans: a.warnPlans,
  },
  invariantViolations: Object.fromEntries(
    Object.entries(a.bad).map(([k, v]) => [k, [v.length, v[0]]]),
  ),
});

const feel = run(feelInputs(), (g) => `${g.days} dana`);
const beg = run(
  beginnerInputs(),
  (g) => `${g.days} dana ${g.easy !== null ? "po osećaju" : "rezultat"}`,
);
console.log(
  JSON.stringify(
    {
      feel: Object.fromEntries(
        Object.entries(feel).map(([k, a]) => [k, summary(a)]),
      ),
      beginner: Object.fromEntries(
        Object.entries(beg).map(([k, a]) => [k, summary(a)]),
      ),
      seconds: +(Number(process.hrtime.bigint() - t0) / 1e9).toFixed(1),
    },
    null,
    1,
  ),
);
