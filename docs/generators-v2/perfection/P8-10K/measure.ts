/* P8-10K — metrike za zamerke slepe ocene (plato obima/dugog, doza, trkački tempo, % brzih, tekst) na mreži P0 (192),
   mrežama 01/02/F/B (34 146) i 12 profila P7. Samo čitanje.
   Iz web/: node ../docs/generators-v2/perfection/P8-10K/measure.ts <oznaka> [brzo] → P8-10K/raw-<oznaka>.json
   „brzo" = bez mreža 01/02/F/B. */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { generateTenKV2 } from "../../../../web/src/domain/generators/tenK/v2/generate.ts";
import { beginnerGridInputs, feelGridInputs, grid02Inputs, gridInputs } from "../../../../web/src/domain/generators/tenK/v2/testInputs.ts";
import { grid } from "../P0/common.ts";

const tag = process.argv[2] ?? "posle";
const quick = process.argv[3] === "brzo";
const dir = new URL(".", import.meta.url).pathname;
const p7 = (JSON.parse(readFileSync(`${dir}p7-inputs-10K.json`, "utf8")) as Record<string, { input: Record<string, unknown> }[]>)["10K"]!;
type Seg = { kind: string; zone?: string; km: number; sec: number };
type Day = { role: string; date: string; hard?: boolean; workout: { kind: string; km: number; sec: number; title?: string; segments: Seg[]; dose?: { zone: string; doseM: number } } };
type Wk = { index: number; phase: string; deload: boolean; targetKm: number; plannedKm: number; nominalKm: number; fitted: string | null; days: Day[]; notes: string[] };
const sets: [string, { id: string; input: Record<string, unknown> }[]][] = [
  ["P7", p7.map((p, i) => ({ id: `p${String(i + 1).padStart(2, "0")}`, input: p.input }))],
  ["P0", grid("10K").map((c) => ({ id: c.id, input: c.input as Record<string, unknown> }))],
  ...(quick ? [] : ([
    ["01", gridInputs()],
    ["02", ([3, 4, 5, 6] as const).flatMap((d) => grid02Inputs(d))],
    ["F", ([3, 4, 5, 6] as const).flatMap((d) => feelGridInputs(d))],
    ["B", ([3, 4] as const).flatMap((d) => beginnerGridInputs(d))],
  ] as [string, { id: string; input: Record<string, unknown> }[]][])),
];
const FASTZ = (z?: string) => z !== undefined && !["E", "jog", "walk"].includes(z);
const run = (xs: (number | null)[]) => { let best = 0, r = 0, prev: number | null = null; for (const x of xs) { if (x !== null && x === prev) r++; else r = x === null ? 0 : 1; prev = x; best = Math.max(best, r); } return best; };
const out: Record<string, unknown[]> = {};
const t0 = Date.now();
for (const [name, list] of sets) {
  const rows: unknown[] = [];
  for (const c of list) {
    const r = generateTenKV2(c.input);
    if (!r.ok) { rows.push({ id: c.id, rejected: r.reasons.map((x) => `${x.code}: ${x.message}`.slice(0, 200)) }); continue; }
    const plan = r.plan as unknown as { weeks: Wk[]; notes: string[]; warnings: { rule: string; severity: string; message: string }[]; input: { experience?: string; runDays: string[]; currentWeeklyKm: number } };
    const W = plan.weeks;
    const build = W.filter((w) => ["base", "development", "specific"].includes(w.phase));
    const nd = build.filter((w) => !w.deload);
    const lastDev = Math.max(0, ...W.filter((w) => w.phase === "development").map((w) => w.index));
    const peak = Math.max(...nd.map((w) => w.targetKm));
    const firstPeak = nd.find((w) => w.targetKm === peak)?.index ?? 0;
    const longKm = (w: Wk) => w.days.find((d) => d.role === "long")?.workout.km ?? null;
    const zoneKm = (w: Wk, z: string) => w.days.flatMap((d) => d.workout.segments).filter((s) => s.zone === z && (s.kind === "rep" || s.kind === "continuous")).reduce((a, s) => a + s.km, 0);
    const pct = (w: Wk) => { let f = 0, t = 0; for (const d of w.days) for (const s of d.workout.segments) { t += s.km; if (FASTZ(s.zone)) f += s.km; } return t > 0 ? (100 * f) / t : 0; };
    const qual = (w: Wk) => w.days.filter((d) => d.workout.kind === "quality" || d.role === "test").length;
    const taper = W.filter((w) => w.phase === "taper");
    const race = W.find((w) => w.phase === "race");
    const rows1 = {
      id: c.id, beginner: plan.input.experience === "beginner", days: plan.input.runDays.length, km: plan.input.currentWeeklyKm, weeks: W.length,
      peak, firstPeak, lastDev, lastBuild: build.length,
      volPlateau: run(build.map((w) => (w.deload ? null : w.targetKm))),
      longPlateau: run(build.map((w) => (w.deload ? null : longKm(w)))),
      longMax: Math.max(...W.filter((w) => w.phase !== "race").map((w) => longKm(w) ?? 0)),
      over25: W.filter((w) => w.phase !== "race" && pct(w) > 25).length,
      over30: W.filter((w) => w.phase !== "race" && pct(w) > 30).length,
      rpWeeks: W.filter((w) => w.phase !== "race" && zoneKm(w, "RP") > 0).length,
      rpMaxKm: Math.max(0, ...W.map((w) => zoneKm(w, "RP"))),
      tMinKm: Math.min(...W.filter((w) => zoneKm(w, "T") > 0).map((w) => zoneKm(w, "T")), 99),
      taperNoQ: taper.filter((w) => qual(w) === 0).length,
      taperNoRP: taper.filter((w) => zoneKm(w, "RP") === 0).length,
      raceNoFast: race ? (race.days.some((d) => d.role === "sharpener" || d.workout.segments.some((s) => s.zone === "RP")) ? 0 : 1) : 0,
      buildNoQ: nd.filter((w) => qual(w) === 0).length,
      deloadNoQ: build.filter((w) => w.deload && qual(w) === 0).length,
      fitted: W.filter((w) => w.fitted !== null).length,
      easyMin: Math.min(...W.flatMap((w) => w.days.filter((d) => d.role === "easy").map((d) => d.workout.km)), 99),
      targets: W.map((w) => w.targetKm), longs: W.map((w) => longKm(w)),
      notes: [...new Set([...plan.notes, ...W.flatMap((w) => w.notes)])],
      warnings: plan.warnings.map((x) => x.rule),
      hash: createHash("sha1").update(JSON.stringify(W)).digest("hex").slice(0, 12),
    };
    rows.push(rows1);
  }
  out[name] = rows;
  console.log(name, list.length, "odbijeno", rows.filter((x) => (x as { rejected?: unknown }).rejected).length, `${Date.now() - t0} ms`);
}
writeFileSync(`${dir}raw-${tag}.json`, JSON.stringify(out));
