/* Trenerska ocena početnog plana MAR v2 (BRIEF.md): samo generator, bez adaptacija/predaje/testova. SAMO ČITANJE.
   Iz web/: node ../docs/generators-v2/audit/coach-final/MAR-gen.ts [--days] > /tmp/out.txt */
import * as TM from "../../../../web/src/domain/generators/marathon/v2/testInputs.ts";
import { raceTimeForVdot } from "../../../../web/src/domain/generators/marathon/v2/paces.ts";
import { addDays, distOf, weekdayOf } from "../../final-check/lib.ts";

type WD = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type O = { weeks: number; km: number; days: WD[]; long?: WD; vdot?: number; easy?: number; beg?: boolean; goal?: number; recent?: number };
const inp = (o: O) =>
  TM.inputOf({ weeks: o.weeks, km: o.km, vdot: o.vdot, days: o.days, long: o.long ?? "sun", easyPace: o.easy,
    experience: o.beg ? "beginner" : undefined, goalTimeSec: o.goal, recentLongRunKm: o.recent });
const D3: WD[] = ["tue", "thu", "sun"], D4: WD[] = ["tue", "thu", "sat", "sun"], D5: WD[] = ["mon", "tue", "thu", "sat", "sun"];
const D6: WD[] = ["mon", "tue", "wed", "thu", "sat", "sun"];
const M = 42195;
const PROFILES: [string, O][] = [
  ["3d-30km-v40-18w", { weeks: 18, km: 30, days: D3, vdot: 40 }],
  ["3d-45km-v50-20w-rl18", { weeks: 20, km: 45, days: D3, vdot: 50, recent: 18 }],
  ["3d-30km-v35-12w-najkraca", { weeks: 12, km: 30, days: D3, vdot: 35 }],
  ["4d-50km-v45-18w-bez-rl", { weeks: 18, km: 50, days: D4, vdot: 45 }],
  ["4d-50km-v45-18w-rl12", { weeks: 18, km: 50, days: D4, vdot: 45, recent: 12 }],
  ["4d-50km-v45-18w-rl25", { weeks: 18, km: 50, days: D4, vdot: 45, recent: 25 }],
  ["4d-35km-v33-16w-spor", { weeks: 16, km: 35, days: D4, vdot: 33 }],
  ["4d-65km-v58-16w-rl8", { weeks: 16, km: 65, days: D4, vdot: 58, recent: 8 }],
  ["4d-50km-v45-12w-najkraca", { weeks: 12, km: 50, days: D4, vdot: 45 }],
  ["4d-50km-v45-18w-cilj+4", { weeks: 18, km: 50, days: D4, vdot: 45, goal: TM.timeForVdot(49, M) }],
  ["5d-60km-v50-18w-rl20", { weeks: 18, km: 60, days: D5, vdot: 50, recent: 20 }],
  ["5d-80km-v55-20w-rl30", { weeks: 20, km: 80, days: D5, vdot: 55, recent: 30 }],
  ["6d-110km-v65-18w-rl32-brz", { weeks: 18, km: 110, days: D6, vdot: 65, recent: 32 }],
  ["6d-60km-v48-24w-najduza", { weeks: 24, km: 60, days: D6, vdot: 48 }],
  ["osecaj-4d-40km-e360-18w", { weeks: 18, km: 40, days: D4, easy: 360 }],
  ["osecaj-5d-50km-e330-16w-rl15", { weeks: 16, km: 50, days: D5, easy: 330, recent: 15 }],
  ["pocetnik-4d-30km-e420-20w", { weeks: 20, km: 30, days: D4, easy: 420, beg: true }],
  ["pocetnik-5d-35km-e400-16w-rl10", { weeks: 16, km: 35, days: D5, easy: 400, beg: true, recent: 10 }],
];
const f1 = (x: number) => (Math.round(x * 10) / 10).toFixed(1);
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const hms = (s: number) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const Q = ["q1", "q2", "test", "sharpener"];
const showDays = process.argv.includes("--days");
const d = distOf("MAR");
for (const [id, o] of PROFILES) {
  const input = inp(o);
  const g = d.generate(input);
  console.log(`\n## ${id}\n`);
  if (!g.ok) { console.log("ODBIJEN:", g.reasons.map((r) => `${r.code}: ${r.message}`).join(" | ")); continue; }
  const p = g.plan as any;
  const v = p.vdot;
  const ref = v ? ` | Daniels-ref: 5K ${mmss(raceTimeForVdot(v, 5000) / 5)}/km, 10K ${mmss(raceTimeForVdot(v, 10000) / 10)}/km, HM ${mmss(raceTimeForVdot(v, 21097.5) / 21.0975)}/km, MAR ${hms(raceTimeForVdot(v, M))}` : "";
  console.log(`vdot ${v ?? "—"} (${p.paceBasis}) · tempo ${JSON.stringify(p.paces)}${ref}`);
  console.log(`predikcija MAR ${p.predictedMarathonSec ? hms(p.predictedMarathonSec) : "—"} · cilj ${JSON.stringify(p.goal)} · start ${o.km} → startKm ${p.startKm} · vrh ${p.peakKm} (cap ${p.peakCapKm}) · ${p.policyId}@${p.policyVersion}`);
  console.log(`napomene plana: ${JSON.stringify(p.notes)}`);
  console.log(`upozorenja: ${p.warnings.map((w: any) => `${w.code}: ${w.message}`).join(" | ") || "—"}`);
  let prevT = 0, maxLong = 0, maxLongSec = 0;
  const issues: string[] = [];
  for (const w of p.weeks) {
    const days = [...w.days].sort((a: any, b: any) => (a.date < b.date ? -1 : 1));
    const L = days.find((x: any) => x.role === "long");
    const easy = days.filter((x: any) => x.role === "easy").map((x: any) => x.workout.km);
    const z: Record<string, number> = {};
    let wucd = "";
    for (const x of days) for (const s of x.workout.segments ?? []) z[s.zone] = (z[s.zone] ?? 0) + s.km;
    const tot = Object.values(z).reduce((a, b) => a + b, 0) || 1;
    const qd = days.filter((x: any) => Q.includes(x.role));
    for (const x of qd) {
      const seg = x.workout.segments ?? [];
      const wu = seg.find((s: any) => s.kind === "warmup"), cd = seg.find((s: any) => s.kind === "cooldown");
      wucd += ` [${x.role} ${f1(x.workout.km)}km/${Math.round(x.workout.sec / 60)}' WU ${wu ? Math.round(wu.sec / 60) : 0}' CD ${cd ? Math.round(cd.sec / 60) : 0}']`;
    }
    const eShare = ((z["E"] ?? 0) + (z["jog"] ?? 0)) / tot;
    const qual = qd.map((x: any) => x.workout.title.replace(/\s+/g, " ")).join(" + ") || "—";
    const zs = ["T", "I", "R", "MP", "M"].filter((k) => z[k]).map((k) => `${k} ${f1(z[k]!)}(${Math.round((z[k]! / w.plannedKm) * 100)}%)`).join(" ");
    const g = prevT ? Math.round((w.targetKm / prevT - 1) * 100) : 0;
    console.log(`ned ${String(w.index).padStart(2)} ${w.phase}${w.deload ? " R" : ""}${w.test ? " T" : ""} | ${f1(w.targetKm)}/${f1(w.plannedKm)} (${g >= 0 ? "+" : ""}${g}%) | dugi ${L ? `${f1(L.workout.km)} (${Math.round(L.workout.sec / 60)}', ${Math.round((L.workout.km / w.plannedKm) * 100)}%) ${L.workout.title.replace(/\s+/g, " ")}` : "—"} | lagani ${easy.map(f1).join(",") || "—"} | E ${Math.round(eShare * 100)}% ${zs} | ${qual}${wucd}${w.notes.length ? " | N: " + w.notes.join(" / ") : ""}`);
    if (L) {
      if (L.workout.km > maxLong) { maxLong = L.workout.km; maxLongSec = L.workout.sec; }
      for (const e of easy) if (e >= L.workout.km) issues.push(`ned ${w.index}: lagan ${f1(e)} ≥ dugi ${f1(L.workout.km)}`);
    }
    if (w.plannedKm < w.targetKm - 0.5) issues.push(`ned ${w.index}: plan ${f1(w.plannedKm)} < cilj ${f1(w.targetKm)}`);
    const hard = days.filter((x: any) => Q.includes(x.role) || x.role === "long").map((x: any) => x.date);
    for (let i = 1; i < hard.length; i++) if (addDays(hard[i - 1], 1) === hard[i]) issues.push(`ned ${w.index}: teški zaredom ${weekdayOf(hard[i - 1])}/${weekdayOf(hard[i])}`);
    if (showDays && (w.index <= 2 || w.index >= p.weeks.length - 1))
      for (const x of days) console.log(`     ${weekdayOf(x.date)} ${x.role}: ${x.workout.title.replace(/\s+/g, " ")} — ${f1(x.workout.km)} km / ${Math.round(x.workout.sec / 60)}'`);
    prevT = w.targetKm;
  }
  console.log(`najduži dugi ${f1(maxLong)} km / ${Math.round(maxLongSec / 60)}' · ${issues.join("; ") || "bez zastavica"}`);
}
