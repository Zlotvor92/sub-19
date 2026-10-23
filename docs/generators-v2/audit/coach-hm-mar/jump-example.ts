/* Revizija v2, ugao 1b — najveći primer iz measure-jump.ts (HM i MAR, painPause): dugi po nedeljama, trčano po
   činjenicama, napomene budućih nedelja. Iz web/: node ../docs/generators-v2/audit/coach-hm-mar/jump-example.ts */
import { distOf, type Plan } from "../../final-check/lib.ts";
const cases: [string, Record<string, unknown>, string][] = [
  ["HM", { startDate: "2026-11-02", raceDate: "2027-02-28", runDays: ["tue", "wed", "thu", "fri", "sat", "sun"], longRunDay: "sun", currentWeeklyKm: 75, recentResult: null, goalTimeSec: null, easyPaceSecPerKm: 405 }, "2027-01-10"],
  ["MAR", { startDate: "2026-11-02", raceDate: "2027-04-11", runDays: ["tue", "wed", "thu", "sat", "sun"], longRunDay: "sun", currentWeeklyKm: 70, recentResult: null, goalTimeSec: null, easyPaceSecPerKm: 315 }, "2027-01-31"],
];
for (const [n, input, at] of cases) {
  const d = distOf(n);
  const g = d.generate(input);
  if (!g.ok) throw new Error("gen");
  const f = d.facts(g.plan, "painPause", at) as { workouts: { date: string; km: number; completed: boolean; pain?: number }[] };
  const r = d.adapt(g.plan, f, at);
  if (!r.ok) { console.log(n, "odbijeno"); continue; }
  console.log(`## ${n} painPause asOf ${at}; zapisi ${f.workouts[0]!.date} … ${f.workouts.at(-1)!.date} (bol ${f.workouts.at(-1)!.pain})`);
  console.log(`upozorenja: ${r.plan.warnings.map((w) => (w as { rule?: string }).rule ?? w.code).join(", ")}`);
  for (const w of (r.plan as Plan).weeks) {
    const L = w.days.find((x) => x.role === "long");
    const ran = f.workouts.filter((x) => x.completed && x.date >= w.startDate && x.date <= w.endDate);
    const lr = Math.max(0, ...ran.map((x) => x.km));
    console.log(`ned ${w.index} ${w.startDate} ${w.phase}${w.deload ? " R" : ""}: cilj ${w.targetKm}, dugi ${L?.workout.km ?? "—"}${w.endDate <= at ? `, trčano najduži ${lr}` : ""}${w.startDate > at ? " | " + w.notes.join(" / ").slice(0, 220) : ""}`);
  }
}
