/* P0 — mreža P0 po distanci: metrike M1–M8 i „šta drži dozu" po planu; odbijanja i greške se beleže.
   Iz web/: node ../docs/generators-v2/perfection/P0/measure.ts <5K|10K|HM|MAR>
   Izlaz: P0/raw-<D>.json (po planu) i P0/summary-<D>.json (agregati: medijana/min/max po dani × pojas obima). */
import { writeFileSync } from "node:fs";
import { distOf, type Plan } from "../../final-check/lib.ts";
import { grid, metrics, type DName, type Metrics } from "./common.ts";

const D = process.argv[2] as DName;
const dist = distOf(D);
const dir = new URL(".", import.meta.url).pathname;
const rows: { id: string; family: string; days: number; band: string; weeks: number; policyVersion?: string; m?: Metrics; rejected?: string[]; error?: string }[] = [];
for (const c of grid(D)) {
  try {
    const r = dist.generate(c.input);
    if (!r.ok) { rows.push({ id: c.id, family: c.family, days: c.days, band: c.band, weeks: c.weeks, rejected: r.reasons.map((x) => x.code) }); continue; }
    rows.push({ id: c.id, family: c.family, days: c.days, band: c.band, weeks: c.weeks, policyVersion: String(r.plan["policyVersion"]), m: metrics(D, r.plan as Plan) });
  } catch (e) {
    rows.push({ id: c.id, family: c.family, days: c.days, band: c.band, weeks: c.weeks, error: String((e as Error).message).slice(0, 200) });
  }
}
writeFileSync(`${dir}raw-${D}.json`, JSON.stringify(rows));

const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : null; };
const agg = (xs: number[]) => xs.length ? { med: Math.round(med(xs)! * 100) / 100, min: Math.min(...xs), max: Math.max(...xs), n: xs.length } : null;
const ok = rows.filter((r) => r.m);
const groups = new Map<string, typeof ok>();
for (const r of ok) for (const k of [`${r.family}|all|all`, `${r.family}|d${r.days}|${r.band}`, `ALL|all|all`]) (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
const summary: Record<string, unknown> = {
  distance: D,
  inputs: rows.length,
  ok: ok.length,
  rejected: rows.filter((r) => r.rejected).map((r) => `${r.id}: ${r.rejected!.join(",")}`),
  errors: rows.filter((r) => r.error).map((r) => `${r.id}: ${r.error}`),
  policyVersions: [...new Set(ok.map((r) => r.policyVersion))],
  groups: {},
};
const zones = ["T", "I", "R", "RP"];
for (const [k, rs] of [...groups.entries()].sort()) {
  const m = rs.map((r) => r.m!);
  const g: Record<string, unknown> = { n: rs.length };
  for (const z of zones) {
    const has = m.filter((x) => x.m1[z]);
    g[`M1_${z}_first`] = agg(has.map((x) => x.m1[z]!.firstMin));
    g[`M1_${z}_max`] = agg(has.map((x) => x.m1[z]!.maxMin));
    g[`M1_${z}_plansWith`] = has.length;
  }
  g["M2_first"] = agg(m.map((x) => x.m2.first).filter((v): v is number => v !== null));
  g["M2_atMax"] = agg(m.map((x) => x.m2.atMax).filter((v): v is number => v !== null));
  g["M3_maxKm"] = agg(m.map((x) => x.m3.maxKm));
  g["M3_maxPct"] = agg(m.map((x) => x.m3.maxPct));
  g["M3_totalKm"] = agg(m.map((x) => x.m3.totalKm));
  g["M3_weeksWith"] = agg(m.map((x) => x.m3.weeksWith));
  g["M4_maxKm"] = agg(m.map((x) => x.m4.maxKm));
  g["M4_maxMin"] = agg(m.map((x) => x.m4.maxMin));
  g["M4_pct"] = agg(m.map((x) => x.m4.pct));
  g["M4_withFast"] = agg(m.map((x) => x.m4.withFast));
  g["M4_plateau"] = agg(m.map((x) => x.m4.plateau));
  g["M5_strides"] = agg(m.map((x) => x.m5));
  g["M6_tests"] = agg(m.map((x) => x.m6.tests));
  g["M6_weeksToRace"] = agg(m.map((x) => x.m6.weeksToRace));
  g["M6_plansPaceChange"] = m.filter((x) => Object.values(x.m6.paceVariants).some((v) => v > 1)).length;
  for (const ph of [...new Set(m.flatMap((x) => Object.keys(x.m7)))]) g[`M7_${ph}`] = agg(m.map((x) => x.m7[ph]).filter((v): v is number => v !== undefined));
  g["M8_peakOverStart"] = agg(m.map((x) => x.m8.peakOverStart));
  g["M8_peakOverCurrent"] = agg(m.map((x) => x.m8.peakOverCurrent));
  g["M8_longShareAtPeak"] = agg(m.map((x) => x.m8.longShareAtPeak));
  const hold: Record<string, Record<string, number>> = {};
  for (const x of m) for (const [z, c] of Object.entries(x.hold)) { (hold[z] ??= {})[c] = (hold[z]![c] ?? 0) + 1; }
  g["hold"] = hold;
  g["repro"] = { checked: m.reduce((a, x) => a + x.repro.checked, 0), same: m.reduce((a, x) => a + x.repro.same, 0) };
  (summary["groups"] as Record<string, unknown>)[k] = g;
}
summary["reproDiffSample"] = ok.flatMap((r) => r.m!.repro.diff.map((d) => `${r.id} ${d}`)).slice(0, 40);
summary["reproDiffSteps"] = ok.flatMap((r) => r.m!.repro.diff.map((d) => d.split(":")[2])).reduce((a: Record<string, number>, s) => ((a[s!] = (a[s!] ?? 0) + 1), a), {});
writeFileSync(`${dir}summary-${D}.json`, JSON.stringify(summary, null, 1));
console.log(`${D}: ulaza ${rows.length}, ok ${ok.length}, odbijeno ${rows.filter((r) => r.rejected).length}, greška ${rows.filter((r) => r.error).length}`);
