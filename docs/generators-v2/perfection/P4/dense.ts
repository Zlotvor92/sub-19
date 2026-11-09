/* P4 — gusta mreža 5K (R): dani 3/4/5 × svaki ceo km tabele dana × 6–16 ned × VDOT 50/55/58/60/62/64/66/68/70; rezultat 10 km
   pre 14 dana, start 2. 11. 2026. Po VDOT-u: planova, odbijenih, upozorenja (WEEK_DEGENERATE, QUALITY_REDUCED,
   LONG_SHORTER_THAN_QUALITY), nedelja izgradnje ispod minWeekKm (plan), I/RP deonica < 60 s (izgradnja / oštrenje trkačke),
   oporavak > 2 × rad (I/RP/T), i ulazi sa WEEK_DEGENERATE. Iz web/: node ../docs/generators-v2/perfection/P4/dense.ts <oznaka> */
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { distOf } from "../../final-check/lib.ts";
import { SCHED, START } from "../P0/common.ts";
import { FIVE_K_V2_POLICY as P } from "../../../../web/src/domain/generators/fiveK/v2/policy.ts";
import { timeForVdot } from "../../../../web/src/domain/generators/tenK/v2/testInputs.ts";
const tag = process.argv[2] ?? "posle";
const addDays = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const stat: Record<string, Record<string, number | string[]>> = {};
const hashes: Record<string, string> = {};
const W = ["WEEK_DEGENERATE", "QUALITY_REDUCED", "LONG_SHORTER_THAN_QUALITY"];
for (const v of [50, 55, 58, 60, 62, 64, 66, 68, 70]) {
  const s: Record<string, number | string[]> = { plans: 0, rejected: 0, belowMinWeek: 0, shortBuild: 0, shortSharpener: 0, recOver2: 0, degenerate: [] };
  for (const w of W) s[w] = 0;
  for (const days of [3, 4, 5]) {
    const r0 = P.days[days as 3 | 4 | 5];
    for (let km = r0.weeklyKm.min; km <= r0.weeklyKm.max; km++) for (let weeks = 6; weeks <= 16; weeks++) {
      const id = `d${days}-${km}km-${weeks}w-v${v}`;
      const r = distOf("5K").generate({ startDate: START, raceDate: addDays(START, weeks * 7 - 1), runDays: SCHED[days], currentWeeklyKm: km, goalTimeSec: null, recentResult: { distanceM: 10000, timeSec: timeForVdot(v, 10000), date: addDays(START, -14) } });
      if (!r.ok) { (s.rejected as number)++; hashes[id] = "REJ " + r.reasons.map((x) => x.code).join(","); continue; }
      (s.plans as number)++;
      const plan = r.plan as any;
      hashes[id] = createHash("sha1").update(JSON.stringify(plan.weeks.map((w: any) => w.days))).digest("hex").slice(0, 16);
      const ws = new Set<string>(plan.warnings.map((x: any) => x.rule));
      for (const w of W) if (ws.has(w)) (s[w] as number)++;
      if (ws.has("WEEK_DEGENERATE")) (s.degenerate as string[]).push(id);
      let below = false, sb = false, ss = false, ro = false;
      for (const w of plan.weeks) {
        if (w.phase !== "race" && w.plannedKm + 1e-9 < r0.minWeekKm) below = true;
        for (const d of w.days) for (const b of d.workout.blocks) if (b.kind === "reps" && (b.zone === "I" || b.zone === "RP" || b.zone === "T")) {
          const seg = d.workout.segments.find((x: any) => x.kind === "rep" && x.zone === b.zone);
          if (!seg) continue;
          if (seg.sec < 60 && b.zone !== "T") { if (d.workout.qualityType === "RP_sharpener") ss = true; else sb = true; }
          if ((b.recovery?.sec ?? 0) > 2 * seg.sec + 1e-9) ro = true;
        }
      }
      if (below) (s.belowMinWeek as number)++; if (sb) (s.shortBuild as number)++; if (ss) (s.shortSharpener as number)++; if (ro) (s.recOver2 as number)++;
    }
  }
  stat[`v${v}`] = s;
}
writeFileSync(new URL(`./dense-${tag}.json`, import.meta.url), JSON.stringify(hashes));
console.log(`gusta mreža ${tag} (planova, odbijeno, upozorenja po planu, nedelja < minWeekKm, I/RP deonica < 60 s izgradnja / oštrenje trkačke, oporavak > 2 × rad):`);
for (const [k, s] of Object.entries(stat)) console.log(`  ${k}: ${s.plans} / odb ${s.rejected}; WEEK_DEGENERATE ${s.WEEK_DEGENERATE}, QUALITY_REDUCED ${s.QUALITY_REDUCED}, LONG_SHORTER_THAN_QUALITY ${s.LONG_SHORTER_THAN_QUALITY}; < minWeekKm ${s.belowMinWeek}; < 60 s ${s.shortBuild} / ${s.shortSharpener}; oporavak > 2× ${s.recOver2}${(s.degenerate as string[]).length ? " — " + (s.degenerate as string[]).join(", ") : ""}`);
