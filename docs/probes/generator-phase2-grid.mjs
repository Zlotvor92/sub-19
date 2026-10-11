// Node 24: node docs/probes/generator-phase2-grid.mjs [optional-output.json]
// This probe does not modify application state or source. An optional path saves
// its evidence. The volume-collapse margin is a regression policy, not a
// universal physiological threshold or a verdict that a plan is adequate.
import { registerHooks } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".")) {
        for (const suffix of [".ts", "/index.ts"]) {
          try {
            return nextResolve(specifier + suffix, context);
          } catch {}
        }
      }
      throw error;
    }
  },
});

const { generatePlan } =
  await import("../../web/src/domain/training/generator/generatePlan.ts");
const sourceFiles = [
  "generator/generatePlan.ts",
  "generator/allocation.ts",
  "generator/athleteAssessment.ts",
  "generator/longRunProgression.ts",
  "sessions/constraints.ts",
  "sessions/deload.ts",
  "distances/profile5k.ts",
  "distances/profile10k.ts",
  "distances/profile21k.ts",
  "distances/profile42k.ts",
  "distances/qualityDose.ts",
].sort();
const digest = createHash("sha256");
for (const path of sourceFiles) {
  digest.update(path + "\n");
  digest.update(
    readFileSync(
      new URL("../../web/src/domain/training/" + path, import.meta.url),
    ),
  );
  digest.update("\n");
}

const base = {
  startDate: "2026-10-12",
  raceDate: "2027-02-28",
  pb: { distM: 5000, sec: 1620, date: "2026-09-20" },
  quality: 2,
  intensity: "std",
  trainedRecently: true,
  _noSuggest: true,
};
const profiles = ["missing", "experienced", "beginner", "returning"];
const distances = [5000, 10000, 21097.5, 42195];
const startingVolumes = [12, 22, 45, 70];
const frequencies = [3, 4, 5];
const scenarios = [];
const failures = [];
const collapseMargin = 0.75;

for (const raceDistM of distances) {
  for (const weeklyKm of startingVolumes) {
    for (const runDays of frequencies) {
      for (const history of profiles) {
        const extra =
          history === "experienced"
            ? {
                qualityExperience: "experienced",
                consistentWeeks: 12,
                recentLongRunKm: Math.min(22, weeklyKm * 0.3),
              }
            : history === "beginner"
              ? {
                  trainedRecently: false,
                  qualityExperience: "none",
                  consistentWeeks: 0,
                }
              : history === "returning"
                ? {
                    qualityExperience: "some",
                    consistentWeeks: 1,
                    breakWeeks: 8,
                    recentLongRunKm: Math.min(5, weeklyKm * 0.3),
                  }
                : {};
        const id = `${raceDistM}/${weeklyKm}/${runDays}/${history}`;
        const input = { ...base, raceDistM, weeklyKm, runDays, ...extra };
        const result = generatePlan(input);
        if ("error" in result) {
          failures.push({ id, kind: "generation", error: result.error });
          scenarios.push({ id, history, input, error: result.error });
          continue;
        }
        let arithmeticFailures = 0;
        let qualityCountFailures = 0;
        for (const week of result.weeks) {
          const calculated =
            Math.round(
              week.days.reduce((sum, day) => sum + (day.km ?? 0), 0) * 10,
            ) / 10;
          if (!Number.isFinite(week.vol) || calculated !== week.vol) {
            arithmeticFailures++;
            failures.push({
              id,
              kind: "arithmetic",
              week: week.w,
              deliveredKm: week.vol,
              calculatedKm: calculated,
            });
          }
          const count = week.days.filter((day) => day.session).length;
          if (week.w < result.meta.weeks && count > (runDays === 3 ? 1 : 2)) {
            qualityCountFailures++;
            failures.push({ id, kind: "quality-count", week: week.w, count });
          }
        }
        const normal = result.weeks.filter(
          (week) =>
            !week.deload &&
            !week.taper &&
            week.w < result.meta.weeks &&
            week.w > result.meta.baseWeeks,
        );
        const first = normal[0] ?? null;
        const last = normal.at(-1) ?? null;
        const collapse =
          first && last ? last.vol < first.vol * collapseMargin : false;
        if (collapse)
          failures.push({
            id,
            kind: "sustained-collapse",
            firstKm: first.vol,
            lastKm: last.vol,
          });
        scenarios.push({
          id,
          history,
          input,
          metadata: {
            weeks: result.meta.weeks,
            baseWeeks: result.meta.baseWeeks,
            effectiveQuality: result.meta.quality,
            athlete: result.meta.athlete,
            preparation: result.meta.preparation,
          },
          metrics: {
            weeksChecked: result.weeks.length,
            arithmeticFailures,
            qualityCountFailures,
            sustainedCollapse: Boolean(collapse),
            firstNormalWeek: first?.w ?? null,
            firstNormalKm: first?.vol ?? null,
            lastNormalWeek: last?.w ?? null,
            lastNormalKm: last?.vol ?? null,
            normalVolumeRatio: first && last ? last.vol / first.vol : null,
          },
        });
      }
    }
  }
}

const summary = {
  scenarioCount: scenarios.length,
  successful: scenarios.filter((scenario) => !scenario.error).length,
  weeksChecked: scenarios.reduce(
    (sum, scenario) => sum + (scenario.metrics?.weeksChecked ?? 0),
    0,
  ),
  generationFailures: failures.filter(
    (failure) => failure.kind === "generation",
  ).length,
  arithmeticFailures: failures.filter(
    (failure) => failure.kind === "arithmetic",
  ).length,
  qualityCountFailures: failures.filter(
    (failure) => failure.kind === "quality-count",
  ).length,
  sustainedCollapses: failures.filter(
    (failure) => failure.kind === "sustained-collapse",
  ).length,
};
const evidence = {
  schemaVersion: 1,
  engineDigest: {
    algorithm: "sha256",
    files: sourceFiles,
    value: digest.digest("hex"),
  },
  matrix: {
    distances,
    startingVolumes,
    frequencies,
    historyProfiles: profiles,
  },
  policies: {
    sustainedCollapseMinimumRatio: collapseMargin,
    qualityLimit:
      "At most one session on three running days, otherwise two; the race week is excluded.",
    normalWeeks:
      "After the base phase, excluding deload, taper and race weeks.",
    limitation:
      "These checks verify bookkeeping and gross load regressions. Passing them does not prove race readiness or coaching quality.",
  },
  summary,
  failures,
  scenarios,
};
if (process.argv[2])
  writeFileSync(process.argv[2], JSON.stringify(evidence, null, 2) + "\n");
console.log(
  JSON.stringify(
    { ...summary, engineDigest: evidence.engineDigest.value, failures },
    null,
    2,
  ),
);
if (failures.length) process.exitCode = 1;
