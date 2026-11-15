/* P4 — 5K v2: mreža P0 (P0/common.ts grid) + mreža VDOT 62/65/68/70 + mreža gustine obima oko granice 40 km.
   Po planu: metrike P0 (M1–M8, uzrok vrha), RP trening, % km bržih od E po nedelji, uzrok vrha I/RP sa razdvojenim
   ograničenjima (budžet / maxReps / iRepMaxSec / ponuda), S3 uzrok doze po osećaju i početnika (feel.feelDoseHeld),
   kratke deonice i odnos oporavak/rad (S2), dan kvaliteta duži od dugog. Samo čitanje.
   Iz web/: node ../docs/generators-v2/perfection/P4/measure.ts <oznaka> → P4/raw-5K-<oznaka>.json */
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { distOf, type Plan } from "../../final-check/lib.ts";
import { grid, metrics, SCHED, START, type Case } from "../P0/common.ts";
import { FIVE_K_V2_POLICY as P } from "../../../../web/src/domain/generators/fiveK/v2/policy.ts";
import * as W5 from "../../../../web/src/domain/generators/fiveK/v2/workouts.ts";
import { feelDoseHeld } from "../../../../web/src/domain/generators/fiveK/v2/feel.ts";
import { timeForVdot } from "../../../../web/src/domain/generators/tenK/v2/testInputs.ts";

const tag = process.argv[2] ?? "posle";
const dist = distOf("5K");
const dir = new URL(".", import.meta.url).pathname;
const addDays = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const inp = (days: number, km: number, weeks: number, vdot: number) => ({
  startDate: START, raceDate: addDays(START, weeks * 7 - 1), runDays: SCHED[days], currentWeeklyKm: km, goalTimeSec: null,
  recentResult: { distanceM: 10000, timeSec: timeForVdot(vdot, 10000), date: addDays(START, -14) } });
const cases: (Case & { net: string })[] = grid("5K").map((c) => ({ ...c, net: "P0" }));
for (const days of [3, 4, 5]) {
  const r = P.days[days as 3 | 4 | 5].weeklyKm;
  for (const [band, km] of [["dno", r.min], ["sredina", Math.round((r.min + r.max) / 2)], ["vrh", r.max]] as const)
    for (const weeks of [6, 11, 16]) for (const vdot of [62, 65, 68, 70])
      cases.push({ id: `V-d${days}-${km}km-${weeks}w-v${vdot}`, family: "R", days, band, weeks, input: inp(days, km, weeks, vdot), net: "V" });
}
for (const days of [4, 5]) {
  const r = P.days[days as 4 | 5].weeklyKm;
  for (let km = 30; km <= r.max; km += 5) for (const weeks of [8, 12, 16]) for (const vdot of [45, 55])
    cases.push({ id: `G-d${days}-${km}km-${weeks}w-v${vdot}`, family: "R", days, band: "sredina", weeks, input: inp(days, km, weeks, vdot), net: "G" });
}

type Blk = { kind: string; zone?: string; reps?: number; rep?: { km?: number; sec?: number }; recovery?: { sec?: number }; km?: number };
type Seg = { kind: string; zone: string; km: number; sec: number };
type Day = { role: string; workout: { kind: string; qualityType: string | null; km: number; sec: number; blocks: Blk[]; segments: Seg[] } };
type Wk = { index: number; phase: string; deload: boolean; test?: boolean; targetKm: number; budgets: { I: number; T: number; R: number }; days: Day[]; notes: string[] };
const BUILD = (w: Wk) => (w.phase === "base" || w.phase === "peak" || w.phase === "sharpen") && !w.deload;
const isQ = (d: Day) => d.workout.kind === "quality";
const FAST = (s: Seg) => s.kind !== "recovery" && s.kind !== "warmup" && s.kind !== "cooldown" && !["E", "jog", "walk"].includes(s.zone);

/** Uzrok vrha I/RP trkača sa rezultatom, razdvojen po ograničenju (redom kontračinjenice). */
function holdIRP(z: "I" | "RP", budget: number, c: { reps: number; repKm: number }, pace: number): string {
  const q = P.quality;
  const opts = z === "I" ? q.repOptionsKm.I : q.repOptionsKm.RP;
  const minR = z === "I" ? q.minReps.I : q.minReps.RP, maxR = z === "I" ? q.maxReps.I : q.maxReps.RP;
  const minS = z === "I" ? q.iRepMinSec : 0;
  const f = (b: number, mr: number, ms: number) => W5.chooseProgressiveReps(b, opts, pace, minR, mr, ms, minS, 0, c, "strict");
  if (f(budget, maxR, q.iRepMaxSec)) return "≤ 1 korak nedeljno / kraj faze";
  if (f(1e6, maxR, q.iRepMaxSec)) return "plafon udela zone";
  if (f(1e6, 99, q.iRepMaxSec)) return "maxReps";
  if (f(1e6, 99, 1e6)) return "iRepMaxSec";
  return "kraj ponude (repOptionsKm)";
}
const feelKind = (d: Day): string | null => {
  const t = d.workout.qualityType; const z = d.workout.blocks.find((b) => b.kind === "reps")?.zone;
  if (t === "HILLS") return "HILLS"; if (t === "TEMPO_FEEL") return "TEMPO"; if (t === "FARTLEK_RP") return "FARTLEK_RP";
  if (t === "FARTLEK") return z === "T" ? "FARTLEK_T" : "FARTLEK_I"; if (t === "RP") return "RP_SHORT"; return null;
};
const FEEL_BUDGET: Record<string, "I" | "T" | "R"> = { HILLS: "R", TEMPO: "T", FARTLEK_I: "I", FARTLEK_T: "T", FARTLEK_RP: "I", RP_SHORT: "I" };

const rows: Record<string, unknown>[] = [];
const t0 = Date.now();
for (const c of cases) {
  let r;
  try { r = dist.generate(c.input); } catch (e) { rows.push({ id: c.id, net: c.net, family: c.family, days: c.days, weeks: c.weeks, error: String((e as Error).message).slice(0, 200) }); continue; }
  if (!r.ok) { rows.push({ id: c.id, net: c.net, family: c.family, days: c.days, weeks: c.weeks, km: c.input["currentWeeklyKm"], rejected: r.reasons.map((x) => `${x.code}: ${x.message}`.slice(0, 160)) }); continue; }
  const plan = r.plan as Plan;
  const W = plan.weeks as unknown as Wk[];
  const paces = plan["paces"] as { vdot: number | null; E: { fast: number; slow: number }; I: number; RP: number };
  const feelOrBeg = paces.vdot === null || plan.input["experience"] === "beginner";
  let rpTrainMax = 0; const fastPct: { w: number; ph: string; pct: number }[] = [];
  const top: Record<string, { w: Wk; reps: number; len: number; work: number; target: number }> = {};
  const short: string[] = []; const recRatio: string[] = []; const qLonger: string[] = [];
  for (const w of W) {
    const longSec = w.days.find((d) => d.role === "long")?.workout.sec ?? 0;
    const warned = ((plan as unknown as { warnings: { rule: string; week?: number }[] }).warnings).some((x) => x.rule === "LONG_SHORTER_THAN_QUALITY" && x.week === w.index);
    for (const d of w.days) {
      if (!isQ(d)) continue;
      if (w.phase !== "race" && longSec > 0 && d.workout.sec > longSec) qLonger.push(`${w.index}${w.deload ? "r" : ""}:${warned ? "upoz" : "BEZ"}`);
      const rp = d.workout.segments.filter((s) => s.zone === "RP" && s.kind !== "recovery").reduce((a, s) => a + s.km, 0);
      if (d.workout.qualityType !== "RP_sharpener") rpTrainMax = Math.max(rpTrainMax, rp);
      for (const b of d.workout.blocks) if (b.kind === "reps" && b.zone && b.reps) {
        const seg = d.workout.segments.find((s) => s.kind === "rep" && s.zone === b.zone);
        const repSec = seg?.sec ?? 0; const rec = b.recovery?.sec ?? 0;
        if (repSec > 0 && repSec < 60 && (b.zone === "I" || b.zone === "RP") && !feelOrBeg) short.push(`${w.index}:${b.zone}:${repSec}s`);
        if (repSec > 0 && b.zone !== "R" && rec > 2 * repSec + 1e-9) recRatio.push(`${w.index}:${b.zone}:${rec}/${repSec}`);
      }
      if (BUILD(w) && d.workout.qualityType !== "TEST_3K") {
        const b = d.workout.blocks.find((x) => x.kind === "reps" || x.kind === "continuous");
        if (!b || !b.zone) continue;
        const key = feelOrBeg ? feelKind(d) : b.zone;
        if (!key) continue;
        const len = b.kind === "continuous" ? b.km! : b.rep?.km ?? b.rep?.sec ?? 0;
        const reps = b.kind === "continuous" ? 1 : b.reps!;
        const work = reps * len;
        if (!top[key] || work >= top[key]!.work - 1e-9) top[key] = { w, reps, len, work, target: w.targetKm };
      }
    }
    if (w.phase !== "race") {
      let f = 0, t = 0;
      for (const d of w.days) for (const s of d.workout.segments) { t += s.km; if (FAST(s)) f += s.km; }
      fastPct.push({ w: w.index, ph: w.deload ? `${w.phase}-r` : w.phase, pct: t > 0 ? Math.round((1000 * f) / t) / 10 : 0 });
    }
  }
  const hold: Record<string, string> = {};
  for (const [k, t] of Object.entries(top)) {
    if (feelOrBeg) {
      const bud = t.w.budgets[FEEL_BUDGET[k]!];
      hold[k] = feelDoseHeld(k as never, t.w.phase as never, bud, paces as never, { reps: t.reps, len: t.len });
    } else if (k === "I" || k === "RP") hold[k] = holdIRP(k, t.w.budgets.I, { reps: t.reps, repKm: t.len }, k === "I" ? paces.I : paces.RP);
  }
  const m = metrics("5K", plan);
  rows.push({ id: c.id, net: c.net, family: c.family, days: c.days, band: c.band, weeks: c.weeks, km: c.input["currentWeeklyKm"],
    vdot: plan.vdot, policyVersion: plan["policyVersion"], m,
    p4: { rpTrainMax: Math.round(rpTrainMax * 100) / 100, fastPct, hold, top: Object.fromEntries(Object.entries(top).map(([k, t]) => [k, `${t.reps}x${t.len}@w${t.w.index}/${t.target}km`])),
      short, recRatio, qLonger, peakTarget: Math.max(...W.map((w) => w.targetKm)),
      warnings: [...new Set(((plan as unknown as { warnings: { rule: string }[] }).warnings).map((x) => x.rule))] },
    weeksJson: createHash("sha1").update(JSON.stringify(plan.weeks.map((w) => w.days))).digest("hex").slice(0, 16) });
}
writeFileSync(`${dir}raw-5K-${tag}.json`, JSON.stringify(rows));
console.log(`5K ${tag}: ulaza ${rows.length}, ok ${rows.filter((r) => r["m"]).length}, odbijeno ${rows.filter((r) => r["rejected"]).length}, greška ${rows.filter((r) => r["error"]).length}, ${Date.now() - t0} ms`);
