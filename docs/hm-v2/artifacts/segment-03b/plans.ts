/* HM v2 Segment 03b — primer pouke 32 (plans.md): d6-13w-40km-v70-A-sat pre (5e09a02) i posle (ovo stablo).
   Pokretanje iz korena repoa: node docs/hm-v2/artifacts/segment-03b/plans.ts <koren v2 5e09a02> */

import {
  inputOf,
  SCHEDULES_BY_DAYS,
} from "../../../../web/src/domain/generators/halfMarathon/v2/testInputs.ts";
import { generateHmV2 as after } from "../../../../web/src/domain/generators/halfMarathon/v2/generate.ts";
import type { PlanWeek } from "../../../../web/src/domain/generators/halfMarathon/v2/types.ts";

const root = process.argv[2];
if (!root) throw new Error("upotreba: plans.ts <koren v2 5e09a02>");
const before = (
  (await import(`${root}/generate.ts`)) as { generateHmV2: typeof after }
).generateHmV2;
const sc = SCHEDULES_BY_DAYS[6].A;
const x = inputOf({
  weeks: 13,
  km: 40,
  vdot: 70,
  days: sc.days,
  long: sc.long,
  race: "sat",
});
const a = before(x);
const b = after(x);
if (!a.ok || !b.ok) throw new Error("plan");
const q = (w: PlanWeek): string =>
  w.days
    .filter((d) => d.workout.kind === "quality")
    .map((d) => {
      const s = d.workout.dose!.structure;
      const t =
        s.form === "continuous"
          ? `${s.km} km`
          : s.form === "reps"
            ? `${s.reps} × ${s.repM}`
            : s.repsM.join("+");
      return `${d.workout.dose!.zone} ${t} (${Math.round(d.workout.sec / 60)}′)`;
    })
    .join(", ");
const l = (w: PlanWeek): string => {
  const d = w.days.find((x) => x.role === "long");
  return d ? `${d.workout.km} (${Math.round(d.workout.sec / 60)}′)` : "—";
};
console.log(
  "# HM v2 Segment 03b — primer pouke 32: d6-13w-40km-v70-A-sat (5e09a02 → hm-v2.2.1)\n",
);
console.log(
  "Trajanje dana u zagradi (min; WU/CD vremenom, km srednjim E); `node docs/hm-v2/artifacts/segment-03b/plans.ts <koren 5e09a02>`.\n",
);
console.log(
  "| ned | faza | cilj | pre: kvalitet | pre: dugi | posle: kvalitet | posle: dugi |",
);
console.log("| --- | --- | --- | --- | --- | --- | --- |");
a.plan.weeks.forEach((w, i) => {
  const v = b.plan.weeks[i]!;
  console.log(
    `| ${w.index} | ${w.phase}${w.deload ? " rast." : ""} | ${w.targetKm} → ${v.targetKm} | ${q(w)} | ${l(w)} | ${q(v)} | ${l(v)} |`,
  );
});
