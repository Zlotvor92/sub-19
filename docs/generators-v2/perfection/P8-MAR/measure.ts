/* P8-MAR — merenje u MINUTIMA (brojači glavnog trenera, coach/ROUND-01.md § 7) na 12 profila P7 i mreži P0.
   Pokretanje iz web/: node ../docs/generators-v2/perfection/P8-MAR/measure.ts <oznaka> [--plans]
   Izlaz: P8-MAR/raw-<oznaka>.json, P8-MAR/sum-<oznaka>.md; uz --plans ispisi u P8-MAR/plans-<oznaka>/. */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { generateMarathonV2 } from "../../../../web/src/domain/generators/marathon/v2/generate.ts";
import { grid } from "../P0/common.ts";
import { renderPlan } from "./render-one.ts";

const dir = new URL(".", import.meta.url).pathname;
const tag = process.argv[2] ?? "x";
const withPlans = process.argv.includes("--plans");
type Seg = { kind: string; km: number; sec: number; zone?: string };
type Day = { date: string; role: string; countsToWeek: boolean; workout: { km: number; sec: number; kind: string; segments?: Seg[] } };
type Week = { index: number; phase: string; deload: boolean; test?: boolean; targetKm: number; plannedKm: number; days: Day[]; notes: string[] };
const FAST = (s: Seg) => s.zone !== undefined && !["E", "jog", "walk"].includes(s.zone) && s.kind !== "recovery" && s.kind !== "warmup" && s.kind !== "cooldown";
const WORK = (s: Seg) => FAST(s) && s.kind !== "stride";
const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;
const workMin = (d: Day, z?: string) => (d.workout.segments ?? []).filter((s) => WORK(s) && (!z || s.zone === z)).reduce((a, s) => a + s.sec, 0) / 60;

function metrics(plan: { weeks: Week[]; warnings?: unknown[] }, startKm: number) {
  const W = plan.weeks;
  const build = W.filter((w) => !w.deload && w.phase !== "taper" && w.phase !== "race");
  const taper = W.filter((w) => w.phase === "taper");
  const race = W.find((w) => w.phase === "race");
  const mid = (w: Week) => w.days.filter((d) => d.role === "q1" || d.role === "q2");
  const maxOf = (ws: Week[], f: (d: Day) => number, ds = mid) => Math.max(0, ...ws.flatMap((w) => ds(w).map(f)));
  const peak = Math.max(...build.map((w) => w.targetKm));
  const hours = Math.max(...W.filter((w) => w.phase !== "race").map((w) => w.days.filter((d) => d.countsToWeek).reduce((a, d) => a + d.workout.sec, 0) / 3600));
  const plateau = (f: (w: Week) => number | null) => {
    let best = 0, run = 0, prev: number | null = null;
    for (const w of build) { const v = f(w); if (v === null) continue; run = prev !== null && Math.abs(v - prev) < 0.05 ? run + 1 : 1; prev = v; best = Math.max(best, run); }
    return best;
  };
  const longOf = (w: Week) => w.days.find((d) => d.role === "long") ?? null;
  let ratio = 0, ratioTaper = 0, over25 = 0, qLongerKm = 0, qLongerSec = 0, mpTBlock = 0, tinyGrow = 0;
  let prevT: number | null = null;
  for (const w of W) {
    if (w.phase === "race") continue;
    const L = longOf(w);
    const easy = w.days.filter((d) => d.role === "easy").map((d) => d.workout.km);
    if (L && easy.length) { const r = Math.max(...easy) / L.workout.km; if (w.phase === "taper") ratioTaper = Math.max(ratioTaper, r); else if (!w.deload) ratio = Math.max(ratio, r); }
    const tot = w.days.filter((d) => d.countsToWeek).flatMap((d) => d.workout.segments ?? []);
    const fast = tot.filter(WORK).reduce((a, s) => a + s.km, 0), all = tot.reduce((a, s) => a + s.km, 0);
    if (all > 0 && fast / all > 0.25) over25++;
    if (L) for (const d of mid(w)) { if (d.workout.km > L.workout.km + 1e-9) qLongerKm++; if (d.workout.sec > L.workout.sec) qLongerSec++; }
    const blk = L ? workMin(L, "MP") > 0 : false;
    if (blk && mid(w).some((d) => workMin(d, "MP") > 0) && mid(w).some((d) => workMin(d, "T") > 0)) mpTBlock++;
    if (!w.deload && w.phase !== "taper") { if (prevT !== null && w.targetKm > prevT + 1e-9 && w.targetKm - prevT < 0.03 * prevT - 1e-9) tinyGrow++; prevT = w.targetKm; }
  }
  const sharp = race?.days.find((d) => d.role === "sharpener");
  const testW = W.find((w) => w.days.some((d) => d.role === "test"));
  return {
    weeks: W.length, startKm, peakKm: r1(peak), peakRatio: r2(peak / startKm), peakHours: r1(hours),
    peakWeek: build.find((w) => w.targetKm === peak)!.index,
    volPlateau: plateau((w) => w.targetKm), longPlateau: plateau((w) => longOf(w)?.workout.km ?? null),
    longMaxKm: r1(Math.max(0, ...W.map((w) => longOf(w)?.workout.km ?? 0))),
    longMaxMin: Math.round(Math.max(0, ...W.map((w) => longOf(w)?.workout.sec ?? 0)) / 60),
    mpMidMaxMin: r1(maxOf(W.filter((w) => w.phase !== "taper"), (d) => workMin(d, "MP"))),
    tMaxMin: r1(maxOf(W, (d) => workMin(d, "T"))), iMaxMin: r1(maxOf(W, (d) => workMin(d, "I"))),
    blockMaxMin: r1(maxOf(W, (d) => workMin(d, "MP"), (w) => w.days.filter((d) => d.role === "long"))),
    taper2MpMin: taper[0] ? r1(maxOf([taper[0]], (d) => workMin(d, "MP"))) : 0,
    taper2TMin: taper[0] ? r1(maxOf([taper[0]], (d) => workMin(d, "T"))) : 0,
    taper1MpMin: taper[1] ? r1(maxOf([taper[1]], (d) => workMin(d, "MP"))) : 0,
    taper1TMin: taper[1] ? r1(maxOf([taper[1]], (d) => workMin(d, "T"))) : 0,
    sharpMin: sharp ? r1(workMin(sharp)) : 0, sharpener: !!sharp,
    easyLongMax: r2(ratio), easyLongTaper: r2(ratioTaper),
    easyMaxMin: Math.round(Math.max(0, ...W.flatMap((w) => w.days.filter((d) => d.role === "easy").map((d) => d.workout.sec))) / 60),
    over25, qLongerKm, qLongerSec, mpTBlock, tinyGrow,
    test: testW ? testW.index : 0, testOnlyQ: testW ? (testW.days.filter((d) => d.role === "q1" || d.role === "q2").length === 0 ? 1 : 0) : null,
    fitted: W.filter((w) => w.notes.some((n) => n.includes("nije izvodljiv"))).length,
    warnings: (plan.warnings ?? []).length,
  };
}

const p7 = (JSON.parse(readFileSync(`${dir}inputs.json`, "utf8")) as { MAR: { title: string; input: Record<string, unknown> }[] }).MAR;
const cases = [
  ...p7.map((p, i) => ({ id: `p${String(i + 1).padStart(2, "0")}`, family: "P7", title: p.title, input: p.input })),
  ...grid("MAR").map((c) => ({ id: c.id, family: c.family, title: c.id, input: c.input })),
];
if (withPlans) mkdirSync(`${dir}plans-${tag}`, { recursive: true });
const rows: Record<string, unknown>[] = [];
for (const c of cases) {
  const res = generateMarathonV2(c.input as never) as { ok: boolean; plan?: { weeks: Week[] }; reasons?: { code: string }[] };
  if (withPlans && c.family === "P7") writeFileSync(`${dir}plans-${tag}/${c.id}.txt`, renderPlan("MAR", c.title, c.input, res));
  rows.push(res.ok ? { id: c.id, family: c.family, ok: true, hash: createHash("sha1").update(JSON.stringify(res.plan!.weeks)).digest("hex").slice(0, 10), ...metrics(res.plan as never, c.input["currentWeeklyKm"] as number) } : { id: c.id, family: c.family, ok: false, codes: res.reasons!.map((r) => r.code) });
}
writeFileSync(`${dir}raw-${tag}.json`, JSON.stringify(rows));
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)]! : 0; };
const keys = Object.keys(rows.find((r) => r["ok"])!).filter((k) => !["id", "family", "ok", "hash"].includes(k));
const L: string[] = [`# P8-MAR merenje — ${tag}`, "", "## 12 profila P7", "", `| profil | ${keys.join(" | ")} |`, `|---|${keys.map(() => "---").join("|")}|`];
for (const r of rows.filter((r) => r["family"] === "P7")) L.push(`| ${r["id"]} | ${r["ok"] ? keys.map((k) => r[k]).join(" | ") : "ODBIJENO " + r["codes"]} |`);
L.push("", "## Mreža P0 (medijana [min–max]; Σ za brojače)", "", `| metrika | R | F | B |`, "|---|---|---|---|");
const fam = (f: string) => rows.filter((r) => r["family"] === f && r["ok"]);
L.push(`| planova / odbijeno | ${["R", "F", "B"].map((f) => `${fam(f).length} / ${rows.filter((r) => r["family"] === f && !r["ok"]).length}`).join(" | ")} |`);
const SUM = ["over25", "qLongerKm", "qLongerSec", "mpTBlock", "tinyGrow", "fitted", "warnings"];
for (const k of keys) L.push(`| ${k} | ${["R", "F", "B"].map((f) => { const v = fam(f).map((r) => Number(r[k] ?? 0)); return SUM.includes(k) ? `Σ ${v.reduce((a, b) => a + b, 0)} (planova ${v.filter((x) => x > 0).length})` : `${med(v)} [${Math.min(...v)}–${Math.max(...v)}]`; }).join(" | ")} |`);
writeFileSync(`${dir}sum-${tag}.md`, L.join("\n") + "\n");
console.log(`${tag}: ${rows.length} ulaza, odbijeno ${rows.filter((r) => !r["ok"]).length}`);
