/* P4 — granica VDOT 60–70 (gusta mreža R, kao dense.ts): WEEK_DEGENERATE, QUALITY_REDUCED, oštrenje trkačke < 60 s; "REJ:" = odbijanje.
   Iz web/: node ../docs/generators-v2/perfection/P4/edge.ts   (opcija O-c: ista komanda posle izmene iz P4-STOP.md § O-c) */
import { distOf } from "../../final-check/lib.ts";
import { SCHED, START } from "../P0/common.ts";
import { timeForVdot } from "../../../../web/src/domain/generators/tenK/v2/testInputs.ts";
const addDays = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
for (const v of [60, 61, 62, 63, 64, 65, 66, 67, 67.5, 68, 69, 70]) {
  const deg: string[] = []; const qr: string[] = []; const sh: Record<string, number> = {}; let shPlans = 0;
  for (const days of [3, 4, 5]) for (let km = days === 3 ? 12 : days === 4 ? 15 : 25; km <= (days === 3 ? 35 : days === 4 ? 45 : 65); km++) for (let weeks = 6; weeks <= 16; weeks++) {
    const r = distOf("5K").generate({ startDate: START, raceDate: addDays(START, weeks * 7 - 1), runDays: SCHED[days], currentWeeklyKm: km, goalTimeSec: null, recentResult: { distanceM: 10000, timeSec: timeForVdot(v, 10000), date: addDays(START, -14) } });
    if (!r.ok) { deg.push("REJ:" + r.reasons.map((x) => x.code).join(",")); continue; }
    const p = r.plan as any;
    if (p.warnings.some((x: any) => x.rule === "WEEK_DEGENERATE")) deg.push(`d${days} ${km}km ${weeks}w`);
    if (p.warnings.some((x: any) => x.rule === "QUALITY_REDUCED")) qr.push(`d${days} ${km}km ${weeks}w`);
    let f = false;
    for (const w of p.weeks) for (const d of w.days) if (d.workout.qualityType === "RP_sharpener") { const b = d.workout.blocks.find((b: any) => b.kind === "reps"); const s = d.workout.segments.find((x: any) => x.kind === "rep"); if (s.sec < 60) { f = true; const k = `${b.reps}x${b.rep.km * 1000}m ${s.sec}s`; sh[k] = (sh[k] ?? 0) + 1; } }
    if (f) shPlans++;
  }
  console.log(`v${v}: WEEK_DEGENERATE ${deg.length} [${deg.join("; ")}]; QUALITY_REDUCED ${qr.length} [${qr.join("; ")}]; oštrenje < 60 s ${shPlans} ${JSON.stringify(sh)}`);
}
