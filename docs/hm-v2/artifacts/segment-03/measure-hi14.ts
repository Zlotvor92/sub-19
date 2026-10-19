/* HM-03 HI14 (odluka posle SEGMENT-03-STOP.md): mreža 03 — nedelje rasterećenja sa skraćenim dugim (DELOAD_LONG_SHORTENED
   i TEST_DELOAD_LONG): broj, raspodela dugi / poslednji ne-rasteretni dugi (min, p10, medijana), rasterećenja bez
   kvaliteta po HI14; dan testa duži od dugog (trajanje) u izgradnji i u rasterećenju. Iz korena repoa:
     node docs/hm-v2/artifacts/segment-03/measure-hi14.ts */

import { generateHmV2 } from "../../../../web/src/domain/generators/halfMarathon/v2/generate.ts";
import {
  beginnerInputs,
  feelInputs,
} from "../../../../web/src/domain/generators/halfMarathon/v2/testInputs.ts";

const isBuild = (ph: string): boolean =>
  ph === "base" || ph === "development" || ph === "specific";
for (const [name, inputs] of [
  ["početnik", beginnerInputs()],
  ["po osećaju", feelInputs()],
] as const) {
  const ratio: Record<string, number[]> = {
    DELOAD_LONG_SHORTENED: [],
    TEST_DELOAD_LONG: [],
  };
  const plans: Record<string, Set<string>> = {
    DELOAD_LONG_SHORTENED: new Set(),
    TEST_DELOAD_LONG: new Set(),
  };
  let noQ = 0;
  let rejected = 0;
  const testLonger = { build: 0, deload: 0 };
  for (const g of inputs) {
    const r = generateHmV2(g.input);
    if (!r.ok) {
      rejected++;
      continue;
    }
    let lastLong = 0;
    for (const w of r.plan.weeks) {
      const long = w.days.find((d) => d.role === "long")?.workout;
      const rules = r.plan.warnings
        .filter((v) => v.week === w.index)
        .map((v) => v.rule);
      for (const k of ["DELOAD_LONG_SHORTENED", "TEST_DELOAD_LONG"])
        if (rules.includes(k) && long) {
          ratio[k]!.push(long.km / lastLong);
          plans[k]!.add(g.id);
        }
      if (w.deload && w.notes.some((n) => n.includes("ni uz skraćen dugi")))
        noQ++;
      const t = w.days.find((d) => d.workout.kind === "test");
      if (t && long && t.workout.sec > long.sec)
        testLonger[w.deload ? "deload" : "build"]++;
      if (isBuild(w.phase) && !w.deload && long) lastLong = long.km;
    }
  }
  const stat = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    const q = (f: number) =>
      s.length ? +s[Math.floor(f * (s.length - 1))]!.toFixed(3) : null;
    return { weeks: s.length, min: q(0), p10: q(0.1), median: q(0.5) };
  };
  console.log(
    name,
    JSON.stringify({
      plans: inputs.length,
      rejected,
      shortened: {
        ...stat(ratio.DELOAD_LONG_SHORTENED!),
        planCount: plans.DELOAD_LONG_SHORTENED!.size,
      },
      testShortened: {
        ...stat(ratio.TEST_DELOAD_LONG!),
        planCount: plans.TEST_DELOAD_LONG!.size,
      },
      deloadNoQualityHI14: noQ,
      testLongerThanLongSec: testLonger,
    }),
  );
}
