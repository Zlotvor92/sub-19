/* HM v2 Segment 04 — K1–K6 na adaptiranim planovima mreže 04 (MASTER § 3) i tabela jednog plana pre/posle
   (bol 5 i pauza 20). Pokretanje iz korena repoa:
     node docs/hm-v2/artifacts/segment-04/k04.ts > docs/hm-v2/artifacts/segment-04/k04.json
     node docs/hm-v2/artifacts/segment-04/k04.ts table > docs/hm-v2/artifacts/segment-04/plan-table.md */

import { adaptHmV2 } from "../../../../web/src/domain/generators/halfMarathon/v2/adapt.ts";
import {
  adaptBases,
  asOfs04,
  factsOf,
  SCENARIOS,
} from "../../../../web/src/domain/generators/halfMarathon/v2/adaptInputs.ts";
import {
  addDays,
  daysBetween,
  weekdayOf,
} from "../../../../web/src/domain/generators/halfMarathon/v2/dates.ts";
import { generateHmV2 } from "../../../../web/src/domain/generators/halfMarathon/v2/generate.ts";
import type {
  HmV2Plan,
  PlanWeek,
} from "../../../../web/src/domain/generators/halfMarathon/v2/types.ts";

const isBuild = (w: PlanWeek) =>
  ["base", "development", "specific"].includes(w.phase);
const q = (w: PlanWeek) => w.days.filter((d) => d.workout.kind === "quality");

function k(): void {
  const out = {
    flows: 0,
    K1: 0,
    K3_buildNoQualityUnexplained: 0,
    K5: { raceOverTaper: 0, adjacentHard: 0, longUnderEasy: 0 },
    K6: {
      slotRepeat: 0,
      qualityOverLong: 0,
      longShorterThanQuality: 0,
      capacityLimited: 0,
      doseDropped: 0,
    },
    warnings: { plannedBelowTargetLimits: 0, raceWeekShort: 0 },
    peakOverStartMax: 0,
  };
  for (const b of adaptBases()) {
    const g = generateHmV2(b.input);
    if (!g.ok) throw new Error(b.id);
    for (const a of asOfs04(g.plan))
      for (const s of SCENARIOS) {
        out.flows++;
        const r = adaptHmV2(g.plan, factsOf(g.plan, s, a.asOf), a.asOf);
        if (!r.ok) {
          out.K1++;
          continue;
        }
        const p = r.plan;
        const W = p.weeks;
        const mixed = new Set(p.adaptation!.mixedWeeks);
        for (const w of W) {
          if (mixed.has(w.index) || w.endDate <= a.asOf) continue;
          if (
            isBuild(w) &&
            !w.deload &&
            q(w).length === 0 &&
            !w.test &&
            w.limits?.quality === undefined &&
            !w.notes.some((n) => /A9|Uvod|H11 ispred/.test(n))
          )
            out.K3_buildNoQualityUnexplained++;
          const long = w.days.find((d) => d.role === "long");
          if (
            long &&
            w.days.some(
              (d) => d.role === "easy" && d.workout.km > long.workout.km + 1e-9,
            )
          )
            out.K5.longUnderEasy++;
          const hard = w.days.filter((d) => d.hard).map((d) => d.date);
          for (let i = 1; i < hard.length; i++)
            if (daysBetween(hard[i - 1]!, hard[i]!) === 1)
              out.K5.adjacentHard++;
        }
        const [taper, race] = [W.at(-2)!, W.at(-1)!];
        if (race.plannedKm > taper.plannedKm + 1e-9) out.K5.raceOverTaper++;
        for (const v of p.warnings) {
          if (v.rule === "SLOT_REPEAT") out.K6.slotRepeat++;
          if (v.rule === "QUALITY_OVER_LONG") out.K6.qualityOverLong++;
          if (v.rule === "CAPACITY_LIMITED") out.K6.capacityLimited++;
          if (v.rule === "DOSE_DROPPED") out.K6.doseDropped++;
          if (v.rule === "LONG_SHORTER_THAN_QUALITY")
            out.K6.longShorterThanQuality++;
          if (v.rule === "PLANNED_BELOW_TARGET_LIMITS")
            out.warnings.plannedBelowTargetLimits++;
          if (v.rule === "RACE_WEEK_SHORT") out.warnings.raceWeekShort++;
        }
        out.peakOverStartMax = Math.max(
          out.peakOverStartMax,
          p.peakKm / p.startKm,
        );
      }
  }
  console.log(JSON.stringify(out, null, 1));
}

function table(): void {
  const b = adaptBases().find((x) => x.id === "d4-r-14w")!;
  const g = generateHmV2(b.input);
  if (!g.ok) throw new Error(b.id);
  const p0 = g.plan;
  let at = p0.weeks[5]!.startDate;
  while (weekdayOf(at) !== "wed") at = addDays(at, 1);
  const cell = (w: PlanWeek) => {
    const long = w.days.find((d) => d.role === "long")?.workout.km ?? "—";
    const qs = q(w)
      .map((d) => `${d.workout.dose!.zone} ${d.workout.dose!.doseM}`)
      .join(" + ");
    return `${w.targetKm} / ${w.plannedKm} · ${long} · ${qs || "—"}${w.deload ? " (R)" : ""}`;
  };
  const lines = [
    `Plan d4-r-14w (4 dana, 40 km, VDOT 45, 14 ned), asOf ${at} (sreda ned 6). Ćelija: cilj / planirano km · dugi km · kvalitet (zona doza m), R = rasterećenje.`,
    "",
    "| ned | faza | pre | bol 5 | pauza 20 |",
    "| --- | --- | --- | --- | --- |",
  ];
  const after = (s: "pain5" | "pause20"): HmV2Plan => {
    const r = adaptHmV2(p0, factsOf(p0, s, at), at);
    if (!r.ok) throw new Error(s);
    return r.plan;
  };
  const [a5, a20] = [after("pain5"), after("pause20")];
  p0.weeks.forEach((w, i) =>
    lines.push(
      `| ${w.index} | ${w.phase} | ${cell(w)} | ${cell(a5.weeks[i]!)} | ${cell(a20.weeks[i]!)} |`,
    ),
  );
  console.log(lines.join("\n"));
}

if (process.argv[2] === "table") table();
else k();
