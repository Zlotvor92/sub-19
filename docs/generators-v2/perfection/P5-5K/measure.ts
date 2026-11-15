/* P5 (5K) — mreža generatora pre/posle F1 (kontrolni test u planu sa rezultatom ≥ 10 ned).
   Ulazi: P0 mreža 5K (148) + gusta mreža trkača sa rezultatom: dani 3/4/5 × svaki ceo km tabele dana × 6–16 ned ×
   VDOT 35/45/55/65 (4 224) + profili (a) i (b). Po planu: odbijanje, nedelja testa (faza, nedelja do trke), otisak
   svake nedelje (dani), upozorenja, % km bržih od E po fazi. Samo čitanje.
   Iz web/: node ../docs/generators-v2/perfection/P5-5K/measure.ts <oznaka> → P5-5K/raw-<oznaka>.json */
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { distOf } from "../../final-check/lib.ts";
import { grid, SCHED, START } from "../P0/common.ts";
import { FIVE_K_V2_POLICY as P } from "../../../../web/src/domain/generators/fiveK/v2/policy.ts";
import { timeForVdot } from "../../../../web/src/domain/generators/tenK/v2/testInputs.ts";

const tag = process.argv[2] ?? "posle";
const dist = distOf("5K");
const addDays = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const h = (x: unknown) => createHash("sha1").update(JSON.stringify(x)).digest("hex").slice(0, 12);
type C = { id: string; net: string; family: string; days: number; weeks: number; input: Record<string, unknown> };
const cases: C[] = grid("5K").map((c) => ({ id: c.id, net: "P0", family: c.family, days: c.days, weeks: c.weeks, input: c.input }));
for (const v of [35, 45, 55, 65])
  for (const days of [3, 4, 5]) {
    const r0 = P.days[days as 3 | 4 | 5].weeklyKm;
    for (let km = r0.min; km <= r0.max; km++) for (let weeks = 6; weeks <= 16; weeks++)
      cases.push({ id: `D-d${days}-${km}km-${weeks}w-v${v}`, net: "D", family: "R", days, weeks, input: { startDate: START, raceDate: addDays(START, weeks * 7 - 1), runDays: SCHED[days], currentWeeklyKm: km, goalTimeSec: null, recentResult: { distanceM: 10000, timeSec: timeForVdot(v, 10000), date: addDays(START, -14) } } });
  }
// Profil (a): 10 km 46:00, 40 km, uto/čet/sub/ned, 16 ned; profil (b): 5K 20:25, 30 km, 4 d, 8 ned (P0).
cases.push({ id: "profil-a", net: "A", family: "R", days: 4, weeks: 16, input: { startDate: START, raceDate: addDays(START, 16 * 7 - 1), runDays: ["tue", "thu", "sat", "sun"], currentWeeklyKm: 40, goalTimeSec: 1304, recentResult: { distanceM: 10000, timeSec: 2760, date: addDays(START, -14) } } });
cases.push({ id: "profil-b", net: "A", family: "R", days: 4, weeks: 8, input: { startDate: "2026-10-19", raceDate: "2026-12-13", runDays: ["tue", "thu", "sat", "sun"], currentWeeklyKm: 30, goalTimeSec: 1199, recentResult: { distanceM: 5000, timeSec: 1225, date: "2026-10-12" } } });

type Seg = { kind: string; zone: string; km: number };
type Wk = { index: number; phase: string; deload: boolean; test?: boolean; targetKm: number; plannedKm: number; days: { role: string; workout: { kind: string; qualityType: string | null; km: number; sec: number; segments: Seg[] } }[]; notes: string[] };
const FAST = (s: Seg) => s.kind !== "recovery" && s.kind !== "warmup" && s.kind !== "cooldown" && !["E", "jog", "walk"].includes(s.zone);
const rows: Record<string, unknown>[] = [];
const t0 = Date.now();
for (const c of cases) {
  const r = dist.generate(c.input);
  const base = { id: c.id, net: c.net, family: c.family, days: c.days, weeks: c.weeks };
  if (!r.ok) { rows.push({ ...base, rejected: r.reasons.map((x) => x.code).join(",") }); continue; }
  const plan = r.plan as unknown as { weeks: Wk[]; warnings: { rule: string }[]; policyVersion: string; experience: string; paceMode: string };
  const W = plan.weeks;
  const tw = W.filter((w) => w.days.some((d) => d.workout.qualityType === "TEST_3K"));
  const fast = W.filter((w) => w.phase !== "race").map((w) => {
    let f = 0, t = 0;
    for (const d of w.days) for (const s of d.workout.segments) { t += s.km; if (FAST(s)) f += s.km; }
    return { ph: w.deload ? `${w.phase}-r` : w.phase, pct: t > 0 ? (100 * f) / t : 0, i: w.index };
  });
  rows.push({ ...base, mode: plan.paceMode, exp: plan.experience, ver: plan.policyVersion,
    tests: tw.length, testWeek: tw[0]?.index ?? null, testPhase: tw[0]?.phase ?? null, toRace: tw[0] ? W.length - tw[0].index : null,
    flagged: W.filter((w) => w.test).map((w) => w.index),
    weekHash: W.map((w) => h(w.days)), notesHash: W.map((w) => h(w.notes)),
    fast: fast.map((x) => [x.ph, Math.round(x.pct * 10) / 10]), over25: fast.filter((x) => x.pct > 25).length,
    peak: Math.max(...W.map((w) => w.targetKm)), warnings: [...new Set(plan.warnings.map((x) => x.rule))].sort() });
}
writeFileSync(new URL(`./raw-${tag}.json`, import.meta.url), JSON.stringify(rows));
console.log(`5K ${tag}: ulaza ${rows.length}, ok ${rows.filter((r) => !r["rejected"]).length}, odbijeno ${rows.filter((r) => r["rejected"]).length}, ${Date.now() - t0} ms`);
