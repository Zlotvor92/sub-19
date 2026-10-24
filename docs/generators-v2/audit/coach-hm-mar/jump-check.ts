/* Revizija v2, ugao 1b — provera uzroka skoka dugog u maraton pauza 35 (coach.ts bazni plan 4 d / 50 km / VDOT 45 /
   18 ned, asOf kraj ned 8): L plafona skoka M13a (jumpBase10) za buduće nedelje, uz broj km stvarno trčanih po
   nedeljama (činjenice). Iz web/: node ../docs/generators-v2/audit/coach-hm-mar/jump-check.ts */
import * as TM from "../../../../web/src/domain/generators/marathon/v2/testInputs.ts";
import { jumpBase10, longJumpCap10, longsOf } from "../../../../web/src/domain/generators/marathon/v2/lengths.ts";
import { distOf } from "../../final-check/lib.ts";
const d = distOf("MAR");
const s = TM.SCHEDULES_BY_DAYS[4].A;
const g = d.generate(TM.inputOf({ weeks: 18, km: 50, vdot: 45, days: s.days, long: s.long, goalTimeSec: 12600 }));
if (!g.ok) throw new Error("gen");
const p0 = g.plan;
const at = p0.weeks[7]!.endDate;
const f = d.facts(p0, "pause35", at) as { workouts: { date: string; km: number }[] };
const r = d.adapt(p0, f, at);
if (!r.ok) throw new Error("adapt");
const L = longsOf(r.plan.weeks as never);
const ran = new Map<number, number>();
for (const w of r.plan.weeks) ran.set(w.index, f.workouts.filter((x) => x.date >= w.startDate && x.date <= w.endDate).reduce((a, x) => a + x.km, 0));
console.log(`asOf ${at}; činjenice: ${f.workouts.length} treninga, ${f.workouts[0]?.date} … ${f.workouts.at(-1)?.date}`);
for (const w of r.plan.weeks.slice(4, 16)) {
  const i = w.index;
  console.log(`ned ${i}: dugi ${(L[i - 1] ?? 0) / 10} km, trčano (činjenice) ${Math.round(ran.get(i)! * 10) / 10} km, L ${(jumpBase10(L, i, null) ?? 0) / 10}, plafon skoka ${(longJumpCap10(L, i, null) ?? 0) / 10}`);
}
