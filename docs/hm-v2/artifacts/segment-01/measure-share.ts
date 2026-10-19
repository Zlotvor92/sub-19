/* HM v2 Segment 01 — merenje sudara H6/pouka 9 sa H13/H14/H10 (zaustavljanje). Pokretanje iz korena repoa:
     node docs/hm-v2/artifacts/segment-01/measure-share.ts [udeo …]
   (Node ≥ 22.18, type stripping). Bez argumenta meri udeo dugog iz politike (0,35); sa argumentima
   privremeno (samo u ovom procesu) zamenjuje `days[4].longMaxShare` i meri:
   (1) mrežu 01 (3696 ulaza): odbijanja po kodu i ćeliji, upozorenja, nedelja 1 ispod trenutnog obima;
   (2) gustu proveru nedelje 1 (obim 30,0–60,0 km korak 0,1 × VDOT 30–80 korak 0,5, raspored A): broj ulaza
       čija nedelja 1 ide ispod trenutnog obima, a dugi nije na 150 min (pouka 9), i najveći pad. */

import { checkInput } from "../../../../web/src/domain/generators/halfMarathon/v2/input.ts";
import { generateHmV2 } from "../../../../web/src/domain/generators/halfMarathon/v2/generate.ts";
import { longTimeCap10 } from "../../../../web/src/domain/generators/halfMarathon/v2/lengths.ts";
import {
  pacesFromVdot,
  predictedHm,
} from "../../../../web/src/domain/generators/halfMarathon/v2/paces.ts";
import { periodize } from "../../../../web/src/domain/generators/halfMarathon/v2/periodize.ts";
import { HM_V2_POLICY } from "../../../../web/src/domain/generators/halfMarathon/v2/policy.ts";
import { INITIAL_QUALITY } from "../../../../web/src/domain/generators/halfMarathon/v2/quality.ts";
import {
  gridInputs,
  inputOf,
  SCHEDULES,
} from "../../../../web/src/domain/generators/halfMarathon/v2/testInputs.ts";
import {
  fit10,
  peakCap10,
} from "../../../../web/src/domain/generators/halfMarathon/v2/volume.ts";
import { buildWeek } from "../../../../web/src/domain/generators/halfMarathon/v2/week.ts";
import { warmupCooldown } from "../../../../web/src/domain/generators/halfMarathon/v2/workouts.ts";

const row = HM_V2_POLICY.days[4] as { longMaxShare: number };
const shares = process.argv.slice(2).map(Number);

function grid(): Record<string, unknown> {
  const rej: Record<string, number> = {};
  const cells: Record<string, number> = {};
  const warns: Record<string, number> = {};
  let ok = 0;
  let below = 0;
  let belowNoTime = 0;
  for (const g of gridInputs()) {
    const r = generateHmV2(g.input);
    if (!r.ok) {
      for (const x of r.reasons) {
        const k = x.message.split(":")[0]!;
        rej[k] = (rej[k] ?? 0) + 1;
      }
      cells[`${g.km} km VDOT ${g.vdot}`] =
        (cells[`${g.km} km VDOT ${g.vdot}`] ?? 0) + 1;
      continue;
    }
    ok++;
    for (const w of r.plan.warnings) warns[w.rule] = (warns[w.rule] ?? 0) + 1;
    const w1 = r.plan.weeks[0]!;
    if (w1.targetKm < r.plan.startKm) {
      below++;
      const l = w1.days.find((d) => d.role === "long")!;
      if (Math.round(l.workout.km * 10) !== longTimeCap10(r.plan.paces))
        belowNoTime++;
    }
  }
  return {
    ok,
    rej,
    cells,
    warns,
    week1Below: below,
    week1BelowNotAtTimeCap: belowNoTime,
  };
}

function dense(): Record<string, unknown> {
  let n = 0;
  let bad = 0;
  let worst = 0;
  let worstId = "";
  for (let km10 = 300; km10 <= 600; km10++)
    for (let v = 300; v <= 800; v += 5) {
      n++;
      const c = checkInput(
        inputOf({
          weeks: 10,
          km: km10 / 10,
          vdot: v / 10,
          days: SCHEDULES.A.days,
          long: "sun",
        }),
      );
      if (!c.ok) throw new Error(JSON.stringify(c.reasons));
      const p = pacesFromVdot(c.vdotRaw);
      const fr = periodize(c.input.startDate, c.weeks)![0]!;
      const ctx = {
        input: c.input,
        paces: p,
        pattern: c.pattern,
        raceSec: predictedHm(p),
        wc: warmupCooldown(c.input.currentWeeklyKm),
        rule: c.rule,
      };
      const make = (t: number) =>
        buildWeek(ctx, fr, t, INITIAL_QUALITY, null, 0);
      const f = fit10(
        km10,
        fr,
        peakCap10(km10, c.rule),
        c.rule,
        (t) => make(t) !== null,
      );
      if (!f || f.target10 >= km10) continue;
      if (make(f.target10)!.long10 === longTimeCap10(p)) continue;
      bad++;
      if (km10 - f.target10 > worst) {
        worst = km10 - f.target10;
        worstId = `${km10 / 10} km, VDOT ${v / 10} → ned 1 ${f.target10 / 10} km`;
      }
    }
  return {
    inputs: n,
    week1BelowNotAtTimeCap: bad,
    worstDropKm: worst / 10,
    worst: worstId,
  };
}

for (const s of shares.length > 0 ? shares : [row.longMaxShare]) {
  row.longMaxShare = s;
  console.log(
    JSON.stringify(
      { longMaxShare: s, grid01: grid(), denseWeek1: dense() },
      null,
      2,
    ),
  );
}
