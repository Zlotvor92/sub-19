/* P4 — fina mreža B2: 3 dana × 12–14 km korak 0,1 × 6–16 ned × VDOT 62–70 korak 0,5 (3 927). Iz web/: node ../docs/generators-v2/perfection/P4/fine.ts */
import { distOf } from "../../final-check/lib.ts";
import { SCHED, START } from "../P0/common.ts";
import { timeForVdot } from "../../../../web/src/domain/generators/tenK/v2/testInputs.ts";
const addDays = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
// 3 dana, 12–14 km korak 0,1, 6–16 ned, VDOT 62–70 korak 0,5: WEEK_DEGENERATE / QUALITY_REDUCED / odbijanja
const deg: string[] = [], rej: Record<string, number> = {}; let qr = 0, n = 0;
for (let v = 62; v <= 70; v += 0.5) for (let k = 120; k <= 140; k++) for (let weeks = 6; weeks <= 16; weeks++) {
  const km = k / 10; n++;
  const r = distOf("5K").generate({ startDate: START, raceDate: addDays(START, weeks * 7 - 1), runDays: SCHED[3], currentWeeklyKm: km, goalTimeSec: null, recentResult: { distanceM: 10000, timeSec: timeForVdot(v, 10000), date: addDays(START, -14) } });
  if (!r.ok) { const c = r.reasons.map((x) => x.code).join(","); rej[c] = (rej[c] ?? 0) + 1; continue; }
  const w = (r.plan as any).warnings;
  if (w.some((x: any) => x.rule === "WEEK_DEGENERATE")) deg.push(`v${v} ${km}km ${weeks}w`);
  if (w.some((x: any) => x.rule === "QUALITY_REDUCED")) qr++;
}
console.log(`ulaza ${n}; odbijanja ${JSON.stringify(rej)}; WEEK_DEGENERATE ${deg.length} ${deg.slice(0, 30).join("; ")}; QUALITY_REDUCED ${qr}`);
