/* HM v2 Segment 02 — K1–K6 (MASTER § 3) po broju dana na mreži 02 (16 896) i gustoj mreži nedelje 1 svakog
   broja dana (141 804). Pokretanje iz korena repoa:
     node docs/hm-v2/artifacts/segment-02/k-metrics.ts [--no-dense]
   Invarijante: web/src/domain/generators/halfMarathon/v2/gridInvariants.ts (nezavisno od validatora).
   K4: vrh 4 dana prema segment01.baseline.json (3979237). */

import { readFileSync } from "node:fs";
import { generateHmV2 } from "../../../../web/src/domain/generators/halfMarathon/v2/generate.ts";
import {
  checkPlan,
  emptyStats,
  type GridStats,
} from "../../../../web/src/domain/generators/halfMarathon/v2/gridInvariants.ts";
import {
  DAY_COUNTS,
  denseInputs,
  grid02Inputs,
} from "../../../../web/src/domain/generators/halfMarathon/v2/testInputs.ts";

const base = JSON.parse(
  readFileSync(
    new URL(
      "../../../../web/src/domain/generators/halfMarathon/v2/segment01.baseline.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as Record<string, [number, number, string]>;
const dense = !process.argv.includes("--no-dense");
const t0 = process.hrtime.bigint();

interface Acc {
  st: GridStats;
  bad: Record<string, string[]>;
  rejected: Record<string, number>;
  errors: Record<string, number>;
  warnPlans: Record<string, number>;
  capByKm: Record<string, number>;
  k4: { lower: number; maxDrop: number; maxDropId: string };
}
const acc = (): Acc => ({
  st: emptyStats(),
  bad: {},
  rejected: {},
  errors: {},
  warnPlans: {},
  capByKm: {},
  k4: { lower: 0, maxDrop: 0, maxDropId: "" },
});
const add = (o: Record<string, number>, k: string): void => {
  o[k] = (o[k] ?? 0) + 1;
};

const grid: Record<number, Acc> = {};
for (const g of grid02Inputs()) {
  const a = (grid[g.days] ??= acc());
  const r = generateHmV2(g.input);
  if (!r.ok) {
    for (const x of r.reasons) add(a.rejected, x.code);
    continue;
  }
  for (const v of r.plan.warnings)
    if (v.severity === "error") add(a.errors, v.rule);
  const rules = new Set(r.plan.warnings.map((v) => v.rule));
  for (const rule of rules) add(a.warnPlans, rule);
  if (rules.has("CAPACITY_LIMITED")) add(a.capByKm, String(g.km));
  checkPlan(g.id, r.plan, a.bad, a.st);
  if (g.days === 4) {
    const old = base[g.id.slice(3)]![0];
    if (r.plan.peakKm < old) {
      a.k4.lower++;
      if (old - r.plan.peakKm > a.k4.maxDrop) {
        a.k4.maxDrop = +(old - r.plan.peakKm).toFixed(1);
        a.k4.maxDropId = g.id;
      }
    }
  }
}

const denseRes: Record<number, Acc & { n: number }> = {};
if (dense)
  for (const days of DAY_COUNTS) {
    const a = { ...acc(), n: 0 };
    for (const g of denseInputs(days)) {
      a.n++;
      const r = generateHmV2(g.input);
      if (!r.ok) {
        for (const x of r.reasons) add(a.rejected, x.code);
        continue;
      }
      for (const v of r.plan.warnings)
        if (v.severity === "error") add(a.errors, v.rule);
      for (const rule of new Set(r.plan.warnings.map((v) => v.rule)))
        add(a.warnPlans, rule);
      checkPlan(g.id, r.plan, a.bad, a.st);
    }
    denseRes[days] = a;
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
  K4: a.k4,
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
  other: {
    doseDroppedPlans: a.st.doseDroppedPlans,
    fittedWeeks: a.st.fittedWeeks,
    fittedUpWeeks: a.st.fittedUpWeeks,
    longestBelow16Plans: a.st.longShortPlans,
    longestAt24Plans: a.st.longAt24Plans,
    taperRelaxed: a.st.taperRelaxed,
    deloadNoQuality: a.st.deloadNoQuality,
    capacityLimitedByKm: a.capByKm,
    warningPlans: a.warnPlans,
  },
  invariantViolations: Object.fromEntries(
    Object.entries(a.bad).map(([k, v]) => [k, [v.length, v[0]]]),
  ),
});

console.log(
  JSON.stringify(
    {
      grid02: Object.fromEntries(
        Object.entries(grid).map(([d, a]) => [`${d} dana`, summary(a)]),
      ),
      dense: Object.fromEntries(
        Object.entries(denseRes).map(([d, a]) => [
          `${d} dana`,
          { inputs: a.n, ...summary(a) },
        ]),
      ),
      seconds: +(Number(process.hrtime.bigint() - t0) / 1e9).toFixed(1),
    },
    null,
    1,
  ),
);
