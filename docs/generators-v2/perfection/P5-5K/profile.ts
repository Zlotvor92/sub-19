/* P5 (5K) — ispis profila (a) i (b) (P0) nedelju po nedelju: faza, test, cilj/planirano, treninzi, napomene.
   Iz web/: node ../docs/generators-v2/perfection/P5-5K/profile.ts <v2 dir> <a|b> → stdout
   (pre: v2 dir git worktree-a 8e87fd4; posle: ../web/src/domain/generators/fiveK/v2/). */
const dir = process.argv[2]!.replace(/\/?$/, "/");
const which = process.argv[3] ?? "a";
const G = await import(`${dir}generate.ts`);
const add = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const START = "2026-11-02";
const input = which === "a"
  ? { startDate: START, raceDate: add(START, 16 * 7 - 1), runDays: ["tue", "thu", "sat", "sun"], currentWeeklyKm: 40, goalTimeSec: 1304, recentResult: { distanceM: 10000, timeSec: 2760, date: add(START, -14) } }
  : { startDate: "2026-10-19", raceDate: "2026-12-13", runDays: ["tue", "thu", "sat", "sun"], currentWeeklyKm: 30, goalTimeSec: 1199, recentResult: { distanceM: 5000, timeSec: 1225, date: "2026-10-12" } };
const r = G.generateFiveKV2(input);
if (!r.ok) { console.log(JSON.stringify(r.reasons)); process.exit(); }
const p = r.plan;
console.log(`${p.policyVersion} VDOT ${p.vdot}; napomene plana:`); for (const n of p.notes) console.log("  · " + n);
for (const w of p.weeks) {
  console.log(`${w.index} ${w.phase}${w.deload ? "*" : ""}${w.test ? " TEST" : ""} cilj ${w.targetKm} plan ${w.plannedKm}: ` + w.days.map((d: any) => `${d.role}:${d.workout.title} [${d.workout.km} km ${Math.round(d.workout.sec / 60)} min]`).join(" | "));
  for (const n of w.notes) console.log("    · " + n);
}
console.log("upozorenja: " + p.warnings.map((x: any) => `${x.rule}@${x.week ?? "-"}`).join(", "));
