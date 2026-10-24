/* Trenerska ocena početnog plana 5K v2 (BRIEF.md, D = 5K). SAMO generator: bez adaptacija, predaje i testova.
   Profili po uzoru na audit/coach-5k-10k/coach.ts (deo „generator") + dopune (VDOT 65, 6 nedelja/16 nedelja, 3/4/5 d).
   Iz web/: node ../docs/generators-v2/audit/coach-final/5K-gen.ts > /tmp/5K-out.md */

import { addDays, distOf } from "../../final-check/lib.ts";
import { START as START5 } from "../../../../web/src/domain/generators/fiveK/v2/testInputs.ts";
import { raceTimeForVdot as rt5 } from "../../../../web/src/domain/generators/fiveK/v2/paces.ts";

const d = distOf("5K");
type P = Record<string, unknown>;
const D5: Record<3 | 4 | 5, string[]> = { 3: ["tue", "thu", "sun"], 4: ["tue", "thu", "sat", "sun"], 5: ["mon", "tue", "thu", "sat", "sun"] };
const res5 = (vdot: number) => ({ distanceM: 5000, timeSec: Math.round(rt5(vdot, 5000)), date: addDays(START5, -14) });
const inp = (o: { weeks: number; km: number; days: 3 | 4 | 5; vdot?: number; easy?: number; beg?: boolean; goal?: number }): P => ({
  startDate: START5,
  raceDate: addDays(START5, o.weeks * 7 - 1),
  runDays: D5[o.days],
  currentWeeklyKm: o.km,
  ...(o.vdot ? { recentResult: res5(o.vdot) } : { typicalEasyPaceSecPerKm: o.easy }),
  ...(o.beg ? { experience: "beginner", canRun30Min: true } : {}),
  goalTimeSec: o.goal ?? null,
});
const USER = (runDays: string[]): P => ({
  startDate: "2026-10-19",
  raceDate: "2026-12-13",
  runDays,
  currentWeeklyKm: 30,
  recentResult: { distanceM: 5000, timeSec: 1225, date: "2026-10-12" },
  goalTimeSec: 1199,
});
const PROFILES: [string, P][] = [
  ["KORISNIK 20:25 → <20:00, 30 km, 4 d (uto/čet/sub/ned), 8 n", USER(["tue", "thu", "sat", "sun"])],
  ["KORISNIK 20:25 → <20:00, 30 km, 4 d (pon/sre/pet/ned), 8 n", USER(["mon", "wed", "fri", "sun"])],
  ["3d mali v40 10n (15 km)", inp({ weeks: 10, km: 15, days: 3, vdot: 40 })],
  ["3d veliki v50 12n (30 km)", inp({ weeks: 12, km: 30, days: 3, vdot: 50 })],
  ["4d mali spor v33 10n (18 km)", inp({ weeks: 10, km: 18, days: 4, vdot: 33 })],
  ["4d veliki brz v58 12n (42 km)", inp({ weeks: 12, km: 42, days: 4, vdot: 58 })],
  ["5d srednji v48 12n (40 km)", inp({ weeks: 12, km: 40, days: 5, vdot: 48 })],
  ["5d veliki brz v60 14n (60 km)", inp({ weeks: 14, km: 60, days: 5, vdot: 60 })],
  ["5d vrlo brz v65 12n (65 km)", inp({ weeks: 12, km: 65, days: 5, vdot: 65 })],
  ["5d mali spor v35 10n (25 km)", inp({ weeks: 10, km: 25, days: 5, vdot: 35 })],
  ["4d osećaj e330 10n (30 km)", inp({ weeks: 10, km: 30, days: 4, easy: 330 })],
  ["3d osećaj spor e480 12n (15 km)", inp({ weeks: 12, km: 15, days: 3, easy: 480 })],
  ["početnik 4d e420 12n (18 km)", inp({ weeks: 12, km: 18, days: 4, easy: 420, beg: true })],
  ["početnik 3d v35 10n (12 km)", inp({ weeks: 10, km: 12, days: 3, vdot: 35, beg: true })],
  ["najkraća 4d v45 6n (30 km)", inp({ weeks: 6, km: 30, days: 4, vdot: 45 })],
  ["najduža 5d v45 16n (40 km)", inp({ weeks: 16, km: 40, days: 5, vdot: 45 })],
  ["najduža 3d v42 16n (20 km)", inp({ weeks: 16, km: 20, days: 3, vdot: 42 })],
];
const RUN_WALK: [string, P][] = [
  ["trčanje/hodanje početnik 3d 8n", { startDate: START5, raceDate: addDays(START5, 55), runDays: ["tue", "thu", "sun"], currentWeeklyKm: 5, experience: "beginner", canRun30Min: false, goalTimeSec: null }],
  ["trčanje/hodanje e480 3d 12n", { startDate: START5, raceDate: addDays(START5, 83), runDays: ["mon", "wed", "sat"], currentWeeklyKm: 8, experience: "beginner", canRun30Min: false, typicalEasyPaceSecPerKm: 480, goalTimeSec: null }],
];

const f1 = (x: number) => (Math.round(x * 10) / 10).toString().replace(".", ",");
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
type Seg = { kind: string; km: number; zone?: string; paceSecPerKm?: number };
type AnyDay = { date: string; weekday: string; role: string; workout: { km: number; sec: number; title: string; qualityType?: string; segments?: Seg[]; workKm?: Record<string, number> } };
const QR = ["q1", "q2", "test", "sharpener", "race"];

function plan(id: string, input: P) {
  const r = d.generate(input) as unknown as { ok: boolean; plan?: any; reasons?: any[] };
  console.log(`\n## ${id}\n`);
  if (!r.ok) { console.log("ODBIJENO:", JSON.stringify(r.reasons)); return; }
  const p = r.plan;
  if (p.planType === "runWalk" || p.weeks?.[0]?.days?.[0]?.session !== undefined) return rw(p);
  const pc = p.paces;
  console.log(`policy ${p.policyId}/${p.policyVersion}; VDOT ${p.vdot ?? "—"}; mod ${p.paceMode}; iskustvo ${p.experience}; start ${p.startKm} → vrh ${p.peakKm} (kapacitet ${p.capacityKm}); obrazac ${JSON.stringify(p.pattern)}`);
  if (pc) console.log(`tempo: E ${mmss(pc.E.fast)}–${mmss(pc.E.slow)}, T ${pc.T ? mmss(pc.T) : "—"}, I ${pc.I ? mmss(pc.I) : "—"}, R ${pc.R ? mmss(pc.R) : "—"}, RP ${pc.RP ? mmss(pc.RP) : "—"}; prognoza 5K ${p.predicted5kSec ? mmss(p.predicted5kSec) : "—"}`);
  if (p.goal) console.log(`cilj: ${JSON.stringify(p.goal)}`);
  console.log("\n| n | faza | cilj/plan | dugi | lagani | kvalitet [WU+CD, rad km] | lagano % | I/T/R % | napomene |\n|---|---|---|---|---|---|---|---|---|");
  for (const w of p.weeks) {
    const days = w.days as AnyDay[];
    const L = days.find((x) => x.role === "long");
    const easy = days.filter((x) => x.role === "easy").map((x) => `${x.weekday} ${f1(x.workout.km)}${/ubrzanj/.test(x.workout.title) ? "+ubrz" : ""}`);
    let hard = 0, I = 0, T = 0, R = 0, RP = 0;
    const q = days.filter((x) => QR.includes(x.role)).map((x) => {
      const s = x.workout.segments ?? [];
      const wu = s.filter((g) => g.kind === "warmup").reduce((a, g) => a + g.km, 0);
      const cd = s.filter((g) => g.kind === "cooldown").reduce((a, g) => a + g.km, 0);
      const wk = x.workout.workKm ?? {};
      I += wk.I ?? 0; T += wk.T ?? 0; R += wk.R ?? 0; RP += wk.RP ?? 0;
      const work = (wk.I ?? 0) + (wk.T ?? 0) + (wk.R ?? 0) + (wk.RP ?? 0);
      hard += work;
      return `${x.weekday} ${x.role}: ${x.workout.title.replace(/\s+/g, " ")} [${f1(wu)}+${f1(cd)}, rad ${f1(work)}; ${f1(x.workout.km)} km]`;
    }).join("<br>") || "—";
    const tot = w.plannedKm || 1;
    const pct = (x: number) => Math.round((x / tot) * 100);
    const ph = `${w.phase}${w.deload ? " R" : ""}${w.test ? " test" : ""}${w.taperStep != null ? ` t${w.taperStep}` : ""}`;
    console.log(`| ${w.index} | ${ph} | ${f1(w.targetKm)}/${f1(w.plannedKm)} | ${L ? f1(L.workout.km) : "—"} | ${easy.join(", ")} | ${q} | ${pct(tot - hard)} | ${pct(I)}/${pct(T)}/${pct(R)}${RP ? ` RP ${pct(RP)}` : ""} | ${(w.notes ?? []).join(" / ").slice(0, 300)} |`);
  }
  const last = p.weeks.at(-1);
  console.log("\ntrkačka nedelja: " + (last.days as AnyDay[]).map((x) => `${x.date} ${x.weekday} ${x.role} ${f1(x.workout.km)} „${x.workout.title}"`).join(" | "));
  console.log("napomene plana: " + JSON.stringify(p.notes));
  console.log("upozorenja: " + (p.warnings ?? []).map((v: any) => `[${v.rule ?? v.code}${v.week ? " n" + v.week : ""}] ${v.message}`).join(" || "));
}
function rw(p: any) {
  console.log(`policy ${p.policyId}/${p.policyVersion}; tip ${p.planType}`);
  console.log("\n| n | faza | sesije (nivo ukupno/trčanje min) | napomene |\n|---|---|---|---|");
  for (const w of p.weeks) {
    const ss = w.days.map((x: any) => (x.session ? `${x.weekday} L${x.level} ${Math.round(x.session.totalSec / 60)}/${Math.round(x.session.runTotalSec / 60)} „${x.session.title}"` : `${x.weekday} ${x.role}`)).join("; ");
    console.log(`| ${w.index} | ${w.phase} | ${ss} | ${(w.notes ?? []).join(" / ").slice(0, 200)} |`);
  }
  console.log("upozorenja: " + (p.warnings ?? []).map((v: any) => `[${v.rule ?? v.code}] ${v.message}`).join(" || "));
}
for (const [id, i] of [...PROFILES, ...RUN_WALK]) plan(id, i);
