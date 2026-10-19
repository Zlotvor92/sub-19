/* Kontrolne metrike K1–K6 mreže 02 po broju dana (MASTER § 3), K4 prema MAR-01 (segment01.baseline.json),
   ponavljanja slota pre/posle piramide (M10a) i mreža skorašnjeg najdužeg trka (M13a). Pokretanje iz korena:
     node --experimental-strip-types docs/marathon-v2/artifacts/segment-02/metrics.ts
   Upisuje metrics.json pored skripte (bajt-isto pri svakom pokretanju). */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateMarathonV2 } from "../../../../web/src/domain/generators/marathon/v2/index.ts";
import type {
  MarathonV2Plan,
  PlanWeek,
} from "../../../../web/src/domain/generators/marathon/v2/index.ts";
import { longTimeCap10 } from "../../../../web/src/domain/generators/marathon/v2/lengths.ts";
import {
  gridInputs,
  recentInputs,
} from "../../../../web/src/domain/generators/marathon/v2/testInputs.ts";

const OUT = dirname(fileURLToPath(import.meta.url));
const V2 = join(OUT, "../../../../web/src/domain/generators/marathon/v2");
const BUILD = ["base", "development", "specific"];
const steady = (w: PlanWeek): boolean => BUILD.includes(w.phase) && !w.deload;
const r3 = (x: number): number => Math.round(x * 1000) / 1000;
const daysBetween = (a: string, b: string): number =>
  (Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8)) -
    Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8))) /
  86400000;
const longOf = (w: PlanWeek): number | null =>
  w.days.find((d) => d.role === "long")?.workout.km ?? null;

function blank() {
  return {
    plans: 0,
    K1: { rejected: 0, validatorErrors: 0 },
    K2: { week1BelowStart: 0, withoutLongOnCap: 0, maxDropKm: 0 },
    K3: { buildWeeksWithoutQuality: 0 },
    K5: {
      raceOverTaper: 0,
      doseDropOutsideCapacity: 0,
      adjacentHardDays: 0,
      longShorterThanEasy: 0,
    },
    K6: {
      slotRepeatWeeks: 0,
      pyramidWeeks: 0,
      qualityLongerThanLong: 0,
      capacityLimited: 0,
      peakOverStart: 0,
      doseDropped: 0,
      marathonLongShort: 0,
      taperMpOverCap: 0,
      longJumpBoundWeeks: 0,
      longJumpPlans: 0,
      longestLongMedianKm: 0,
    },
  };
}
type M = ReturnType<typeof blank>;
const by: Record<string, M> = {};
const longest: Record<string, number[]> = {};
const ratio: Record<string, number> = {};
const base01 = JSON.parse(
  readFileSync(join(V2, "segment01.baseline.json"), "utf8"),
) as Record<string, string>;
const K4 = { lowerPeak: 0, maxDropKm: 0, ids: [] as string[] };

function measure(m: M, p: MarathonV2Plan, key: string): void {
  const W = p.weeks;
  const N = W.length;
  const rules = new Set(p.warnings.map((w) => w.rule));
  const w1 = W[0]!;
  if (w1.targetKm < p.startKm) {
    m.K2.week1BelowStart++;
    m.K2.maxDropKm = Math.max(m.K2.maxDropKm, r3(p.startKm - w1.targetKm));
    if (Math.round(longOf(w1)! * 10) !== longTimeCap10(p.paces))
      m.K2.withoutLongOnCap++;
  }
  let bound = 0;
  for (const w of W) {
    if (steady(w) && !w.days.some((d) => d.workout.kind === "quality"))
      m.K3.buildWeeksWithoutQuality++;
    if (w.notes.some((n) => n.includes("ponovljen"))) m.K6.slotRepeatWeeks++;
    if (
      w.days.some(
        (d) =>
          d.workout.dose?.structure.form === "pyramid" &&
          d.workout.dose.doseM === 5000,
      )
    )
      m.K6.pyramidWeeks++;
    if (w.notes.some((n) => n.includes("plafon skoka"))) bound++;
    const long = longOf(w);
    if (long !== null)
      for (const d of w.days)
        if (d.role === "easy" && d.workout.km > long)
          m.K5.longShorterThanEasy++;
  }
  m.K6.longJumpBoundWeeks += bound;
  if (bound > 0) m.K6.longJumpPlans++;
  const hard = W.flatMap((w) =>
    w.days.filter((d) => d.hard).map((d) => d.date),
  ).sort();
  for (let i = 1; i < hard.length; i++)
    if (daysBetween(hard[i - 1]!, hard[i]!) < 2) m.K5.adjacentHardDays++;
  if (W[N - 1]!.plannedKm > W[N - 2]!.plannedKm) m.K5.raceOverTaper++;
  for (const v of p.warnings)
    if (v.rule === "DOSE_DROPPED" && W[v.week! - 1]!.fitted !== "down")
      m.K5.doseDropOutsideCapacity++;
  if (rules.has("LONG_SHORTER_THAN_QUALITY")) m.K6.qualityLongerThanLong++;
  if (rules.has("CAPACITY_LIMITED")) m.K6.capacityLimited++;
  if (rules.has("DOSE_DROPPED")) m.K6.doseDropped++;
  if (rules.has("MARATHON_LONG_SHORT")) m.K6.marathonLongShort++;
  if (rules.has("TAPER_MP_OVER_CAP")) m.K6.taperMpOverCap++;
  ratio[key] = (ratio[key] ?? 0) + p.peakKm / p.startKm;
  (longest[key] ??= []).push(Math.max(...W.map((w) => longOf(w) ?? 0)));
}

for (const g of gridInputs()) {
  const key = `${g.days}`;
  const m = (by[key] ??= blank());
  m.plans++;
  const r = generateMarathonV2(g.input);
  if (!r.ok) {
    if (r.reasons.some((x) => x.code === "PLAN_VIOLATES_POLICY"))
      m.K1.validatorErrors++;
    else m.K1.rejected++;
    continue;
  }
  measure(m, r.plan, key);
  if (g.days === 4) {
    const old = Number(base01[g.id.slice(3)]!.split("|")[0]);
    if (r.plan.peakKm < old) {
      K4.lowerPeak++;
      K4.maxDropKm = Math.max(K4.maxDropKm, r3(old - r.plan.peakKm));
      if (K4.ids.length < 5) K4.ids.push(g.id);
    }
  }
}
for (const [k, m] of Object.entries(by)) {
  m.K6.peakOverStart = r3(ratio[k]! / m.plans);
  const s = [...longest[k]!].sort((a, b) => a - b);
  m.K6.longestLongMedianKm = s[Math.floor(s.length / 2)]!;
}

// Mreža M13a: odbijanja po r, broju dana, nedeljama i nedelji plana; skok dugog; ned 1 ispod obima.
const recent = {
  total: 0,
  rejected: 0,
  codes: {} as Record<string, number>,
  byR: {} as Record<string, number>,
  byDays: {} as Record<string, number>,
  byWeeks: {} as Record<string, number>,
  byPlanWeek: {} as Record<string, number>,
  jumpViolations: 0,
  maxJump1to2: { ratio: 0, id: "" },
  week1BelowStart: 0,
};
const inc = (o: Record<string, number>, k: string | number): void => {
  o[String(k)] = (o[String(k)] ?? 0) + 1;
};
for (const g of recentInputs()) {
  recent.total++;
  const rl = g.input["recentLongRunKm"] as number;
  const r = generateMarathonV2(g.input);
  if (!r.ok) {
    recent.rejected++;
    inc(recent.codes, r.reasons[0]!.code);
    inc(recent.byR, rl);
    inc(recent.byDays, g.days);
    inc(recent.byWeeks, g.weeks);
    inc(recent.byPlanWeek, r.reasons[0]!.week ?? 0);
    continue;
  }
  const L = [rl, ...r.plan.weeks.map(longOf)];
  for (let i = 1; i < L.length; i++) {
    const l = L[i];
    const prev = L.slice(Math.max(0, i - 4), i).filter(
      (x): x is number => x !== null,
    );
    if (l === null || l === undefined) continue;
    const mx = Math.max(...prev);
    if (Math.round(l * 10) > Math.floor(Math.max(1.1 * mx, mx + 1) * 10 + 1e-9))
      recent.jumpViolations++;
  }
  const q = L[2]! / L[1]!;
  if (q > recent.maxJump1to2.ratio)
    recent.maxJump1to2 = { ratio: r3(q), id: `${g.id}: ${L[1]} → ${L[2]}` };
  if (r.plan.weeks[0]!.targetKm < r.plan.startKm) recent.week1BelowStart++;
}

const out = { byDays: by, K4, recent };
writeFileSync(join(OUT, "metrics.json"), `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify(out, null, 2));
