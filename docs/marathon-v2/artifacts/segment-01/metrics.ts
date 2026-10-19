/* Kontrolne metrike K1–K6 mreže 01 (MASTER § 3) i raspodela tapera po obimu. Pokretanje iz korena repoa:
     node --experimental-strip-types docs/marathon-v2/artifacts/segment-01/metrics.ts
   Upisuje metrics.json pored skripte (bajt-isto pri svakom pokretanju). */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateMarathonV2 } from "../../../../web/src/domain/generators/marathon/v2/index.ts";
import type { PlanWeek } from "../../../../web/src/domain/generators/marathon/v2/index.ts";
import { longTimeCap10 } from "../../../../web/src/domain/generators/marathon/v2/lengths.ts";
import { gridInputs } from "../../../../web/src/domain/generators/marathon/v2/testInputs.ts";

const OUT = dirname(fileURLToPath(import.meta.url));
const BUILD = ["base", "development", "specific"];
const steady = (w: PlanWeek): boolean => BUILD.includes(w.phase) && !w.deload;
const r3 = (x: number): number => Math.round(x * 1000) / 1000;
const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2
    ? s[(s.length - 1) / 2]!
    : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
};

const m = {
  plans: 0,
  K1: { rejected: 0, validatorErrors: 0 },
  K2: { week1BelowStart: 0, withoutLongOnCap: 0, maxDropKm: 0 },
  K3: { buildWeeksWithoutQuality: 0 },
  K4: "n/p (prvi segment; bazna linija segment01.baseline.json za MAR-02)",
  K5: {
    raceOverTaper: 0,
    doseDropOutsideCapacity: 0,
    adjacentHardDays: 0,
    longShorterThanEasy: 0,
  },
  K6: {
    slotRepeatWeeks: 0,
    qualityLongerThanLong: 0,
    capacityLimited: 0,
    peakOverStart: 0,
    doseDropped: 0,
    marathonLongShort: 0,
    taperMpOverCap: 0,
    buildWeeksFittedDown: 0,
    buildWeeksFittedUp: 0,
  },
  taper: {
    n2FittedDown: 0,
    n1FittedDown: 0,
    byKm: {} as Record<string, unknown>,
  },
  raceWeek: { easyInKm: 0, easyBelow5Km: 0, noSharpener: 0 },
};
const ratios = new Map<number, { n2: number[]; n1: number[] }>();
let ratioSum = 0;
for (const g of gridInputs()) {
  m.plans++;
  const r = generateMarathonV2(g.input);
  if (!r.ok) {
    if (r.reasons.some((x) => x.code === "PLAN_VIOLATES_POLICY"))
      m.K1.validatorErrors++;
    else m.K1.rejected++;
    continue;
  }
  const p = r.plan;
  const W = p.weeks;
  const N = W.length;
  const rules = new Set(p.warnings.map((w) => w.rule));
  const w1 = W[0]!;
  if (w1.targetKm < p.startKm) {
    m.K2.week1BelowStart++;
    m.K2.maxDropKm = Math.max(m.K2.maxDropKm, r3(p.startKm - w1.targetKm));
    const l = w1.days.find((d) => d.role === "long")!;
    if (Math.round(l.workout.km * 10) !== longTimeCap10(p.paces))
      m.K2.withoutLongOnCap++;
  }
  for (const w of W) {
    if (steady(w) && !w.days.some((d) => d.workout.kind === "quality"))
      m.K3.buildWeeksWithoutQuality++;
    if (w.notes.some((n) => n.includes("ponovljen"))) m.K6.slotRepeatWeeks++;
    if (steady(w) && w.fitted === "down") m.K6.buildWeeksFittedDown++;
    if (steady(w) && w.fitted === "up") m.K6.buildWeeksFittedUp++;
    const long = w.days.find((d) => d.role === "long");
    if (long && w.phase !== "race")
      for (const d of w.days)
        if (d.role === "easy" && d.workout.km > long.workout.km)
          m.K5.longShorterThanEasy++;
  }
  const hard = W.flatMap((w) =>
    w.days.filter((d) => d.hard).map((d) => d.date),
  ).sort();
  for (let i = 1; i < hard.length; i++) {
    const a = Date.UTC(
      +hard[i - 1]!.slice(0, 4),
      +hard[i - 1]!.slice(5, 7) - 1,
      +hard[i - 1]!.slice(8),
    );
    const b = Date.UTC(
      +hard[i]!.slice(0, 4),
      +hard[i]!.slice(5, 7) - 1,
      +hard[i]!.slice(8),
    );
    if (b - a < 2 * 86400000) m.K5.adjacentHardDays++;
  }
  if (W[N - 1]!.plannedKm > W[N - 2]!.plannedKm) m.K5.raceOverTaper++;
  for (const v of p.warnings)
    if (v.rule === "DOSE_DROPPED" && W[v.week! - 1]!.fitted !== "down")
      m.K5.doseDropOutsideCapacity++;
  if (rules.has("LONG_SHORTER_THAN_QUALITY")) m.K6.qualityLongerThanLong++;
  if (rules.has("CAPACITY_LIMITED")) m.K6.capacityLimited++;
  if (rules.has("DOSE_DROPPED")) m.K6.doseDropped++;
  if (rules.has("MARATHON_LONG_SHORT")) m.K6.marathonLongShort++;
  if (rules.has("TAPER_MP_OVER_CAP")) m.K6.taperMpOverCap++;
  ratioSum += p.peakKm / p.startKm;
  if (W[N - 3]!.fitted === "down") m.taper.n2FittedDown++;
  if (W[N - 2]!.fitted === "down") m.taper.n1FittedDown++;
  const q = ratios.get(g.km) ?? { n2: [], n1: [] };
  q.n2.push(W[N - 3]!.targetKm / p.peakKm);
  q.n1.push(W[N - 2]!.targetKm / p.peakKm);
  ratios.set(g.km, q);
  const rw = W[N - 1]!;
  const easy = rw.days.filter((d) => d.role === "easy");
  if (easy.some((d) => d.workout.blocks[0]!.kind === "easy"))
    m.raceWeek.easyInKm++;
  if (easy.some((d) => d.workout.km < 5)) m.raceWeek.easyBelow5Km++;
  if (!rw.days.some((d) => d.role === "sharpener")) m.raceWeek.noSharpener++;
}
m.K6.peakOverStart = r3(ratioSum / m.plans);
for (const [km, q] of [...ratios].sort((a, b) => a[0] - b[0]))
  m.taper.byKm[`${km}`] = {
    n2: { min: r3(Math.min(...q.n2)), median: r3(median(q.n2)) },
    n1: { min: r3(Math.min(...q.n1)), median: r3(median(q.n1)) },
  };
writeFileSync(join(OUT, "metrics.json"), `${JSON.stringify(m, null, 2)}\n`);
console.log(JSON.stringify(m, null, 2));
