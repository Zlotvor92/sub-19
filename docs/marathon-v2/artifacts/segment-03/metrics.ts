/* Kontrolne metrike K1–K6 mreže 03 (MASTER § 3): po osećaju (M16) po broju dana, početnik (M17) po broju dana i
   osnovi tempa; regresija mreže 02 (planovi sa rezultatom) prema MAR-02 (segment02.baseline.json, planHash02).
   Pokretanje iz korena:
     node --experimental-strip-types docs/marathon-v2/artifacts/segment-03/metrics.ts
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
  beginnerInputs,
  denseInputs,
  feelInputs,
  gridInputs,
  planHash02,
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
    K1: {
      rejected: 0,
      validatorErrors: 0,
      codes: {} as Record<string, number>,
    },
    K2: { week1BelowStart: 0, withoutLongOnCap: 0 },
    K3: { buildWeeksWithoutQuality: 0 },
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
      longestLongMedianKm: 0,
    },
    M16: {
      testInDeload: 0,
      testOnQ1: 0,
      deloadLongShortened: 0,
      testLongerThanLong: 0,
      vdotMin: 99,
      vdotMax: 0,
    },
    M17: {
      tContinuousFallbackWeeks: 0,
      buildNoQualityWeeks: 0,
      taperMpWithoutMpInBuild: 0,
      noSharpener: 0,
    },
  };
}
type M = ReturnType<typeof blank>;

function measure(
  m: M,
  p: MarathonV2Plan,
  acc: { ratio: number; longest: number[] },
): void {
  const W = p.weeks;
  const N = W.length;
  const rules = new Set(p.warnings.map((w) => w.rule));
  const w1 = W[0]!;
  if (w1.targetKm < p.startKm) {
    m.K2.week1BelowStart++;
    if (Math.round(longOf(w1)! * 10) !== longTimeCap10(p.paces))
      m.K2.withoutLongOnCap++;
  }
  const intro = p.input.experience === "beginner" ? 2 : 0;
  for (const w of W) {
    const test = w.days.find((d) => d.role === "test");
    if (
      steady(w) &&
      w.index > intro &&
      !test &&
      !w.days.some((d) => d.workout.kind === "quality")
    )
      m.K3.buildWeeksWithoutQuality++;
    if (w.notes.some((n) => n.includes("ponovljen"))) m.K6.slotRepeatWeeks++;
    if (test) {
      if (w.deload) m.M16.testInDeload++;
      else m.M16.testOnQ1++;
      if (test.workout.km > (longOf(w) ?? 0)) m.M16.testLongerThanLong++;
    }
    if (w.notes.some((n) => n.includes("skraćen sa 0,8 ×")))
      m.M16.deloadLongShortened++;
    if (w.notes.some((n) => n.startsWith("T kontinuirano (M17)")))
      m.M17.tContinuousFallbackWeeks++;
    if (w.notes.some((n) => n.startsWith("Bez kvaliteta:")))
      m.M17.buildNoQualityWeeks++;
    const long = longOf(w);
    if (long !== null)
      for (const d of w.days)
        if (d.role === "easy" && d.workout.km > long)
          m.K5.longShorterThanEasy++;
  }
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
  if (p.paceBasis === "feel") {
    m.M16.vdotMin = Math.min(m.M16.vdotMin, p.vdot);
    m.M16.vdotMax = Math.max(m.M16.vdotMax, p.vdot);
  }
  if (p.input.experience === "beginner") {
    const mpInBuild = W.some(
      (w) => steady(w) && w.days.some((d) => d.workout.dose?.zone === "MP"),
    );
    if (!mpInBuild) m.M17.taperMpWithoutMpInBuild++;
  }
  if (!W[N - 1]!.days.some((d) => d.role === "sharpener")) m.M17.noSharpener++;
  acc.ratio += p.peakKm / p.startKm;
  acc.longest.push(Math.max(...W.map((w) => longOf(w) ?? 0)));
}

function run(
  inputs: { id: string; input: Record<string, unknown> }[],
  key: (id: string) => string,
) {
  const by: Record<string, M> = {};
  const acc: Record<string, { ratio: number; longest: number[] }> = {};
  for (const g of inputs) {
    const k = key(g.id);
    const m = (by[k] ??= blank());
    const a = (acc[k] ??= { ratio: 0, longest: [] });
    m.plans++;
    const r = generateMarathonV2(g.input);
    if (!r.ok) {
      if (r.reasons.some((x) => x.code === "PLAN_VIOLATES_POLICY"))
        m.K1.validatorErrors++;
      else m.K1.rejected++;
      for (const x of r.reasons)
        m.K1.codes[x.code] = (m.K1.codes[x.code] ?? 0) + 1;
      continue;
    }
    measure(m, r.plan, a);
  }
  for (const [k, m] of Object.entries(by)) {
    const a = acc[k]!;
    const ok = a.longest.length;
    m.K6.peakOverStart = ok ? r3(a.ratio / ok) : 0;
    const s = [...a.longest].sort((x, y) => x - y);
    m.K6.longestLongMedianKm = ok ? s[Math.floor(s.length / 2)]! : 0;
  }
  return by;
}

const feel = run(feelInputs(), (id) => id.split("-")[1]!);
const beginner = run(
  beginnerInputs(),
  (id) =>
    `${id.split("-")[1]}-${id.split("-")[4]!.startsWith("e") ? "feel" : "result"}`,
);

// Regresija mreže 02 prema MAR-02: plan sa rezultatom bajt-isti osim paceBasis (planHash02).
const base02 = JSON.parse(
  readFileSync(join(V2, "segment02.baseline.json"), "utf8"),
) as Record<string, string>;
const regression: Record<
  string,
  { same: number; changed: number; ids: string[] }
> = {};
for (const g of gridInputs()) {
  const k = `d${g.days}`;
  const x = (regression[k] ??= { same: 0, changed: 0, ids: [] });
  const r = generateMarathonV2(g.input);
  if (r.ok && planHash02(r.plan) === base02[g.id]!.split("|").pop()) x.same++;
  else {
    x.changed++;
    if (x.ids.length < 5) x.ids.push(g.id);
  }
}

// Mreža M13a (35 910): odbijanja po r; planovi sa kvalitetnim danom dužim od dugog (sve zone) po r / VDOT /
// danima; od toga MP (izuzetak najnižeg nivoa MP) i najveća razlika MP dan − dugi [min].
const inc = (o: Record<string, number>, k: string | number): void => {
  o[String(k)] = (o[String(k)] ?? 0) + 1;
};
const recent = {
  total: 0,
  rejected: 0,
  rejectedByR: {} as Record<string, number>,
  otherRejections: 0,
  longerPlans: 0,
  longerByR: {} as Record<string, number>,
  longerByVdot: {} as Record<string, number>,
  longerByDays: {} as Record<string, number>,
  /** Od toga MP dan duži od dugog (izuzetak najnižeg nivoa MP, dugi na plafonu skoka M13a). */
  mpLongerPlans: 0,
  mpLongerByR: {} as Record<string, number>,
  mpLongerByVdot: {} as Record<string, number>,
  mpLongerByDays: {} as Record<string, number>,
  mpMaxDiffMin: 0,
  mpMaxDiffExample: "",
};
for (const g of recentInputs()) {
  recent.total++;
  const rl = g.input["recentLongRunKm"] as number;
  const r = generateMarathonV2(g.input);
  if (!r.ok) {
    if (r.reasons[0]!.code === "RECENT_LONG_TOO_SHORT") {
      recent.rejected++;
      inc(recent.rejectedByR, rl);
    } else recent.otherRejections++;
    continue;
  }
  if (!r.plan.warnings.some((w) => w.rule === "LONG_SHORTER_THAN_QUALITY"))
    continue;
  recent.longerPlans++;
  inc(recent.longerByR, rl);
  inc(recent.longerByVdot, g.vdot);
  inc(recent.longerByDays, g.days);
  let mp = false;
  for (const w of r.plan.weeks) {
    const long = w.days.find((d) => d.role === "long");
    if (!steady(w) || !long) continue;
    for (const d of w.days) {
      if (d.workout.kind !== "quality" || d.workout.dose?.zone !== "MP")
        continue;
      const diff = Math.round((d.workout.sec - long.workout.sec) / 6) / 10;
      if (diff <= 0) continue;
      mp = true;
      if (diff > recent.mpMaxDiffMin) {
        recent.mpMaxDiffMin = diff;
        recent.mpMaxDiffExample = `${g.id} ned ${w.index}: ${d.workout.title} ${Math.round(d.workout.sec / 60)} min, dugi ${long.workout.km} km ${Math.round(long.workout.sec / 60)} min`;
      }
    }
  }
  if (mp) {
    recent.mpLongerPlans++;
    inc(recent.mpLongerByR, rl);
    inc(recent.mpLongerByVdot, g.vdot);
    inc(recent.mpLongerByDays, g.days);
  }
}

// Gusta ned 1 (157 954): K1 i kvalitetni dan duži od dugog po broju dana (58 = T 3,0 km kont., 6 d).
const dense: Record<
  string,
  { plans: number; rejected: number; longer: number; example: string }
> = {};
for (const g of denseInputs()) {
  const x = (dense[`d${g.days}`] ??= {
    plans: 0,
    rejected: 0,
    longer: 0,
    example: "",
  });
  x.plans++;
  const r = generateMarathonV2(g.input);
  if (!r.ok) {
    x.rejected++;
    continue;
  }
  const v = r.plan.warnings.find((w) => w.rule === "LONG_SHORTER_THAN_QUALITY");
  if (v) {
    x.longer++;
    if (!x.example) x.example = `${g.id}: ${v.message}`;
  }
}

const out = { feel, beginner, regression02: regression, recent, dense };
writeFileSync(join(OUT, "metrics.json"), `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify(out, null, 2));
