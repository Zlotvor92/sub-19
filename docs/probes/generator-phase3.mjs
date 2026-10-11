// Reproducible independent criteria: node docs/probes/generator-phase3.mjs
// Inputs are synthetic QA fixtures, never claims about a real athlete.
import { registerHooks } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
registerHooks({
  resolve(s, c, n) {
    try {
      return n(s, c);
    } catch (e) {
      if (s.startsWith("."))
        for (const x of [".ts", "/index.ts"])
          try {
            return n(s + x, c);
          } catch {}
      throw e;
    }
  },
});
const { generatePlan } =
  await import("../../web/src/domain/training/generator/generatePlan.ts");
const { adaptGeneratedPlan } =
  await import("../../web/src/domain/plan/adapt.ts");
const { resolvePlan } = await import("../../web/src/domain/plan/resolve.ts");
const { analyzeExecution, recommendExecution } =
  await import("../../web/src/domain/training/execution.ts");
const { fitnessEvidence } =
  await import("../../web/src/domain/training/adaptation/evidence.ts");
const { matchPlanRows } =
  await import("../../web/src/domain/training/adaptation/matching.ts");
const { sessKm, sessQKm, sessDesc } =
  await import("../../web/src/domain/training/sessions/calc.ts");
const { deriveQSById } =
  await import("../../web/src/domain/training/prediction/index.ts");
const { buildExecutionAdjustment } =
  await import("../../web/src/domain/plan/executionAdjustment.ts");
const { graftFuturePlan } = await import("../../web/src/domain/plan/future.ts");
const { recordPlanRevision, getPlanRevisions, PLAN_REVISION_LIMIT } =
  await import("../../web/src/domain/plan/versions.ts");
const { planWithNewGoal, planRecalibrated, reentryPlan } =
  await import("../../web/src/domain/plan/replan.ts");
const today = "2026-11-25"; // Wednesday, week 7
const clone = (x) => JSON.parse(JSON.stringify(x));
const hash = (x) =>
  createHash("sha256")
    .update(typeof x === "string" ? x : JSON.stringify(x))
    .digest("hex");
const baseInput = {
  startDate: "2026-10-12",
  raceDate: "2027-02-28",
  raceDistM: 5000,
  pb: { distM: 5000, sec: 1235, date: "2026-09-20" },
  weeklyKm: 40,
  recentLongRunKm: 12,
  consistentWeeks: 24,
  breakWeeks: 0,
  qualityExperience: "experienced",
  runDays: 5,
  quality: 2,
  intensity: "std",
  volIntensity: "std",
  trainedRecently: true,
  goalSec: 1199,
};
const stored = (input) => {
  const result = generatePlan(input);
  if ("error" in result) throw new Error(result.error);
  return { ...adaptGeneratedPlan(result), ulaz: clone(input) };
};
const baseline = stored(baseInput);
const resolved = resolvePlan(baseline.weeks, { alts: {}, moves: {} });
const past = resolved.dated.filter(
  (d) => d.date <= today && !d.rest && d.km > 0 && d.tag !== "snaga",
);
const fullLog = Object.fromEntries(
  past.map((d) => [
    d.id,
    { status: "done", km: d.km, runDate: d.date, rpe: 4 },
  ]),
);
const cases = [];
function record(id, log, extra = {}, expect) {
  const plan = extra.plan ?? baseline;
  const view = resolvePlan(plan.weeks, {
    alts: extra.alts ?? {},
    moves: extra.moves ?? {},
  });
  const analysis = analyzeExecution({
    plan: view,
    log,
    today: extra.today ?? today,
    extras: extra.extras ?? {},
  });
  const recommendation = recommendExecution(analysis);
  const evidence = fitnessEvidence({
    plan: view,
    pred: plan.pred,
    meta: plan.meta,
    log,
    vdotChain: extra.chain ?? [],
    tests: extra.tests ?? [],
    today: extra.today ?? today,
  });
  const checks = expect?.({ analysis, recommendation, evidence }) ?? {};
  const item = {
    id,
    input: {
      today: extra.today ?? today,
      plan,
      log,
      alts: extra.alts ?? {},
      moves: extra.moves ?? {},
      chain: extra.chain ?? [],
      tests: extra.tests ?? [],
    },
    analysis,
    recommendation,
    evidence,
    checks,
  };
  cases.push(item);
  return item;
}
record("P01", clone(fullLog), {}, ({ analysis: a, recommendation: r }) => ({
  adequateBase: a.recentWeeklyKm > 0,
  noUnpromptedChange: r.kind === null,
}));
const one = clone(fullLog);
const easy = past
  .filter((d) => d.date >= "2026-11-12" && d.tag === "lako")
  .at(-1);
one[easy.id] = { status: "skip" };
record("P02", one, {}, ({ recommendation: r }) => ({
  singleMissAdviceOnly: r.kind === "single-miss" && !r.actionable,
  noMakeup: !r.actionable && r.kind === "single-miss",
}));
record("P03", {}, {}, ({ analysis: a, recommendation: r }) => ({
  unknownIsNotMiss: a.unknown > 0 && a.missed === 0,
  noInferredPause: a.daysSinceLastRun === null,
  zeroActual: a.actualKm === 0,
  noInferredBase: a.recentWeeklyKm === null,
  insufficient: r.kind === "insufficient-data",
}));
const lower = clone(fullLog);
for (const d of past)
  if (d.date >= "2026-11-09") lower[d.id].km = Math.round(d.km * 0.5 * 10) / 10;
record("P04", lower, {}, ({ analysis: a, recommendation: r }) => ({
  twoLowWeeks: a.lowerVolumeWeeks >= 2,
  reduce: r.kind === "reduce",
  baseBelowPlanned: a.recentWeeklyKm < 30,
}));
for (const [id, days] of [
  ["P05", 7],
  ["P06", 14],
  ["P07", 28],
]) {
  const last = new Date(today + "T00:00:00Z");
  last.setUTCDate(last.getUTCDate() - days);
  const cutoff = last.toISOString().slice(0, 10);
  const log = clone(fullLog);
  for (const d of past) if (d.date > cutoff) log[d.id] = { status: "skip" };
  const input = {
    ...clone(baseInput),
    ...(days === 28 ? { pb: { ...baseInput.pb, date: "2025-01-01" } } : {}),
  };
  record(id, log, { plan: stored(input) }, ({ recommendation: r }) => ({
    asksConfirmation:
      r.kind === "return" && r.requiresConfirmation && !r.actionable,
    notAutomaticallyChanged: !r.actionable,
  }));
}
const nearToday = "2027-02-15";
const nearView = resolvePlan(baseline.weeks, { alts: {}, moves: {} });
const nearLog = {};
for (const d of nearView.dated.filter(
  (d) => d.date <= nearToday && !d.rest && d.km > 0,
))
  nearLog[d.id] = {
    status: d.date > "2027-02-01" ? "skip" : "done",
    km: d.km,
    runDate: d.date,
  };
const near = record("P08", nearLog, { today: nearToday }, () => ({}));
const blocked = reentryPlan(baseInput, 19, 20, 50);
near.returnResult = blocked;
near.checks = { shortRemainingBlocked: "error" in blocked };
const matched = matchPlanRows(resolved.weeks, baseline.pred);
const quality = [...matched]
  .map(([id, row]) => ({ day: resolved.byId.get(id), row }))
  .filter((x) => x.day.date <= today);
const chain = [];
const log9 = {};
for (const [index, fixture] of quality.slice(0, 3).entries()) {
  log9[fixture.day.id] = {
    status: "done",
    km: fixture.day.km,
    runDate: "2026-08-01",
  };
  chain.push({
    id: fixture.row.id,
    ts: fixture.day.date,
    measured: 60,
    vdot: 60,
    prev: 50,
    delta: 10,
  });
}
const recentQ = quality.filter((x) => x.day.date >= "2026-11-18");
for (const [index, x] of recentQ.entries()) {
  log9[x.day.id] = {
    status: "done",
    ...(index === 0 ? {} : { km: x.day.km }),
    runDate: index === 1 ? "2027-01-01" : x.day.date,
  };
  chain.push({
    id: x.row.id,
    ts: x.day.date,
    measured: 60,
    vdot: 60,
    prev: 50,
    delta: 10,
  });
}
const isolated = quality
  .filter(
    (x) =>
      x.day.date >= "2026-11-01" &&
      x.day.date < "2026-11-18" &&
      x.row.zone !== "R" &&
      !x.row.nemeri,
  )
  .at(-1);
log9[isolated.day.id] = {
  status: "done",
  km: isolated.day.km,
  runDate: isolated.day.date,
};
chain.push({
  id: isolated.row.id,
  ts: isolated.day.date,
  measured: 60,
  vdot: 60,
  prev: 50,
  delta: 10,
});
record("P09", log9, { chain }, ({ evidence: e }) => ({
  noThreeDayEvidence: e.distinctDays < 3,
  staleExcluded: e.excluded.some((x) => x.reason === "stale"),
  incompleteExcluded: e.excluded.some((x) => x.reason === "incomplete-work"),
  futureExcluded: e.excluded.some((x) => x.reason === "future"),
}));
const high = clone(fullLog);
for (const d of past
  .filter((d) => d.tag === "lako" && d.date >= "2026-11-12")
  .slice(-2))
  high[d.id].rpe = 8;
const recentChain = quality
  .filter(
    (x) => x.day.date >= "2026-11-01" && x.row.zone !== "R" && !x.row.nemeri,
  )
  .slice(-4)
  .map((x) => ({
    id: x.row.id,
    ts: x.day.date,
    measured: 60,
    vdot: 60,
    prev: 50,
    delta: 10,
  }));
record("P10", high, { chain: recentChain }, ({ analysis: a }) => ({
  repeatedHighEasyRpe: a.easyHighRpeCount >= 2,
}));
const history = clone(baseline);
const log11 = clone(fullLog);
const ctx = { log: log11, alts: {}, moves: {}, pred: {}, predLock: {} };
const friday = resolved.dated.find((d) => d.date === "2026-11-27");
ctx.log[friday.id] = {
  status: "done",
  km: friday.km ?? 0,
  runDate: "2026-11-24",
};
const manual = history.weeks
  .flatMap((w) => w.days)
  .find((d) => d.id === "g8d2" && d.session);
if (manual) {
  manual.session.wuKm = 3;
  manual.session.overrides.wuKm = true;
  manual.km = sessKm(manual.session);
  manual.desc = sessDesc(manual.session);
}
const measuredFuture = [...matched]
  .map(([id, row]) => ({ day: resolved.byId.get(id), row }))
  .find((x) => x.day.date >= "2026-12-01");
ctx.pred[measuredFuture.row.id] = 200;
ctx.predLock[measuredFuture.row.id] = true;
// Swap a future running day with a past calendar rest slot: effective dates, not week index.
const moved = resolved.dated.find((d) => d.date === "2026-11-29");
const pastRest = resolved.dated.find((d) => d.date === "2026-11-23");
ctx.moves[moved.id] = "2026-11-23";
ctx.moves[pastRest.id] = "2026-11-29";
const beforeHash = hash({ history, ctx });
const changed = graftFuturePlan(
  history,
  stored({ ...baseInput, pb: { ...baseInput.pb, sec: 1100 }, weeklyKm: 25 }),
  today,
  ctx,
);
const protectedIds = new Set(
  resolvePlan(history.weeks, ctx)
    .dated.filter(
      (d) =>
        d.date <= today ||
        ctx.log[d.id]?.status === "done" ||
        ctx.alts[d.id] ||
        Object.values(d.session?.overrides ?? {}).some(Boolean),
    )
    .map((d) => d.id),
);
const oldDay = new Map(
  history.weeks.flatMap((w) => w.days).map((d) => [d.id, d]),
);
const newDay = new Map(
  changed.weeks.flatMap((w) => w.days).map((d) => [d.id, d]),
);
const oldMatch = matchPlanRows(
  resolvePlan(history.weeks, { alts: {}, moves: ctx.moves }).weeks,
  history.pred,
);
const checks11 = {
  allProtectedDaysStable: [...protectedIds].every(
    (id) => hash(oldDay.get(id)) === hash(newDay.get(id)),
  ),
  futureDoneStable: hash(oldDay.get(friday.id)) === hash(newDay.get(friday.id)),
  movedEffectivePastStable:
    hash(oldDay.get(moved.id)) === hash(newDay.get(moved.id)),
  measuredFutureRowStable: changed.pred.some(
    (r) => hash(r) === hash(measuredFuture.row),
  ),
  measuredFutureDayStable:
    hash(oldDay.get(measuredFuture.day.id)) ===
    hash(newDay.get(measuredFuture.day.id)),
  protectedPredStable: [...protectedIds].every(
    (id) =>
      !oldMatch.has(id) ||
      changed.pred.some((r) => hash(r) === hash(oldMatch.get(id))),
  ),
  protectedQsStable: [...protectedIds].every(
    (id) => !history.qs[id] || hash(history.qs[id]) === hash(changed.qs[id]),
  ),
  inputsPure: hash({ history, ctx }) === beforeHash,
};
const goalPublic = planWithNewGoal(history, 1100, today, ctx);
const fitnessPublic = planRecalibrated(history, 60, today, ctx);
for (const [name, plan] of [
  ["goal", goalPublic],
  ["fitness", fitnessPublic],
]) {
  checks11[name + "PublicValid"] = !("error" in plan);
  if (!("error" in plan)) {
    const days = new Map(
      plan.weeks.flatMap((w) => w.days).map((d) => [d.id, d]),
    );
    checks11[name + "PublicPreservesHistory"] = [
      ...protectedIds,
      measuredFuture.day.id,
    ].every((id) => hash(oldDay.get(id)) === hash(days.get(id)));
    checks11[name + "PublicPreservesPred"] = [
      ...protectedIds,
      measuredFuture.day.id,
    ].every(
      (id) =>
        !oldMatch.has(id) ||
        plan.pred.some((r) => hash(r) === hash(oldMatch.get(id))),
    );
  }
}
cases.push({
  id: "P11",
  input: { today, plan: history, context: ctx },
  output: changed,
  checks: checks11,
});
let versioned = recordPlanRevision(history, changed, {
  reason: "execution",
  date: today,
  summary: "P12: confirmed change",
});
const roundTrip = JSON.parse(JSON.stringify(versioned));
const latest = getPlanRevisions(roundTrip).at(-1);
const restoreLog = clone(log11);
restoreLog["new-run-after-apply"] = { status: "done", km: 5, runDate: today };
const restored = graftFuturePlan(versioned, latest.snapshot, today, {
  ...ctx,
  log: restoreLog,
});
for (let i = 0; i < 8; i++)
  versioned = recordPlanRevision(versioned, changed, {
    reason: "goal",
    date: today,
    summary: "P12 bounded " + i,
  });
cases.push({
  id: "P12",
  input: { before: history, after: changed, newLog: restoreLog },
  output: { revision: latest, restored },
  checks: {
    oneVersion: getPlanRevisions(roundTrip).length === 1,
    persistenceRoundTrip: getPlanRevisions(roundTrip).length === 1,
    latestSnapshotPlanOnly: Object.keys(latest.snapshot).every((k) =>
      ["weeks", "pred", "qs", "meta", "ulaz"].includes(k),
    ),
    newLogsNotMutated: restoreLog["new-run-after-apply"].km === 5,
    historyBounded: getPlanRevisions(versioned).length === PLAN_REVISION_LIMIT,
  },
  scope:
    "Pure version snapshots/graft only; actual preview/apply stale/replay requires store lifecycle tests.",
});
function auditPlan(plan) {
  const failures = [];
  const auditedMatched = matchPlanRows(
    resolvePlan(plan.weeks, { alts: {}, moves: {} }).weeks,
    plan.pred,
  );
  const weeks = plan.weeks.map((w) => {
    const days = w.days.filter((d) => d.km > 0 && !d.rest);
    const sessions = days.filter((d) => d.session);
    for (const d of sessions) {
      const row = auditedMatched.get(d.id);
      if (!row) failures.push({ w: w.w, id: d.id, reason: "missing-pred" });
      if (
        row &&
        (Math.abs(row.q - sessQKm(d.session)) > 0.051 ||
          Math.abs(row.pt - d.session.paceSec) > 0.051)
      )
        failures.push({ w: w.w, id: d.id, reason: "pred-session" });
      if (Math.abs(d.km - sessKm(d.session)) > 0.051)
        failures.push({ w: w.w, id: d.id, reason: "session-km" });
      if (d.desc !== sessDesc(d.session))
        failures.push({ w: w.w, id: d.id, reason: "session-description" });
    }
    const qs = deriveQSById([w]);
    for (const [id, row] of Object.entries(qs))
      if (!plan.qs?.[id] || hash(row) !== hash(plan.qs[id]))
        failures.push({ w: w.w, id, reason: "qs" });
    return {
      w: w.w,
      start: w.start,
      taper: !!w.taper,
      deload: !!w.deload,
      km: Math.round(days.reduce((n, d) => n + d.km, 0) * 10) / 10,
      lrKm: Math.max(
        0,
        ...days.filter((d) => d.tag === "lr" && !d.mlr).map((d) => d.km),
      ),
      demanding: days.filter((d) => d.session || d.finish).length,
      workMinutes:
        Math.round(
          (sessions.reduce(
            (n, d) =>
              n +
              (d.session.type === "fartlek"
                ? d.session.reps * d.session.repSec
                : sessQKm(d.session) * d.session.paceSec) /
                60,
            0,
          ) +
            days.reduce(
              (n, d) =>
                n + (d.finish ? (d.finish.km * d.finish.paceSec) / 60 : 0),
              0,
            )) *
            10,
        ) / 10,
      qualityKinds: sessions.map((d) => ({
        id: d.id,
        kind: d.session.kind,
        zone: d.session.zone,
        km: d.km,
        q: sessQKm(d.session),
        pace: d.session.paceSec,
      })),
    };
  });
  if (new Set(plan.pred.map((r) => r.id)).size !== plan.pred.length)
    failures.push({ reason: "duplicate-pred-id" });
  return { weeks, failures };
}
for (const c of cases.filter((x) =>
  ["P04", "P05", "P06", "P07", "P08"].includes(x.id),
)) {
  const days = { P05: 7, P06: 14, P07: 28, P08: 14 }[c.id];
  const options = days
    ? { breakDays: days, weeklyKm: 40, recentLongRunKm: 12 }
    : {};
  const adjustment = buildExecutionAdjustment(
    c.input.plan,
    c.input.today,
    c.analysis,
    options,
    { log: c.input.log },
  );
  c.adjustment = adjustment;
  if (c.id === "P08") c.checks.newReturnBlocksTaper = "error" in adjustment;
  else {
    c.checks.hasFutureRebuild = !("error" in adjustment);
    if (!("error" in adjustment)) {
      c.futureAudit = auditPlan(adjustment.result);
      c.checks.allFutureArithmetic = c.futureAudit.failures.length === 0;
      c.checks.raceDatePreserved =
        adjustment.result.meta.raceDate === baseInput.raceDate;
      c.checks.sameAvailableDays =
        adjustment.result.meta.runDays === baseInput.runDays;
      const easyWeeks = { P05: 2, P06: 3, P07: 4 }[c.id];
      if (easyWeeks)
        c.checks.initialFutureEasy = c.futureAudit.weeks
          .filter((w) => w.start >= "2026-11-23")
          .slice(0, easyWeeks)
          .every((w) =>
            adjustment.result.weeks
              .find((x) => x.w === w.w)
              .days.filter(
                (d) =>
                  resolvePlan(adjustment.result.weeks, {
                    alts: {},
                    moves: {},
                  }).byId.get(d.id).date > today,
              )
              .every((d) => !d.session && !d.finish && !d.strides),
          );
    }
  }
}
const returnStarts = cases
  .filter((c) => ["P05", "P06", "P07"].includes(c.id))
  .map((c) => c.adjustment.result.meta.executionAdjustment.startingKm);
for (const c of cases.filter((c) => ["P05", "P06", "P07"].includes(c.id)))
  c.checks.longerBreakMoreConservative =
    returnStarts[0] > returnStarts[1] && returnStarts[1] > returnStarts[2];
const audits = [
  { id: "baseline", ...auditPlan(baseline) },
  { id: "P11", ...auditPlan(changed) },
  { id: "P12-restore", ...auditPlan(restored) },
  ...cases
    .filter((c) => c.futureAudit)
    .map((c) => ({ id: c.id, ...c.futureAudit })),
];
const supplemental = [];
for (const baseKm of [40, 10])
  for (const distance of [5000, 10000, 21097.5, 42195])
    for (const days of [7, 14, 28])
      for (const runDays of baseKm === 10 ? [5] : [3, 4, 5]) {
        const input = {
          ...baseInput,
          weeklyKm: baseKm,
          recentLongRunKm: baseKm === 10 ? 4 : 12,
          raceDistM: distance,
          runDays,
          goalSec: { 5000: 1199, 10000: 2400, 21097.5: 6000, 42195: 14400 }[
            distance
          ],
        };
        const source = stored(input);
        const profile = cases.find(
          (c) => c.id === { 7: "P05", 14: "P06", 28: "P07" }[days],
        );
        const adjustment = buildExecutionAdjustment(
          source,
          today,
          profile.analysis,
          {
            breakDays: days,
            weeklyKm: baseKm,
            recentLongRunKm: baseKm === 10 ? 4 : 12,
          },
          { log: profile.input.log },
        );
        const audit =
          "error" in adjustment ? null : auditPlan(adjustment.result);
        supplemental.push({
          baseKm,
          distance,
          breakDays: days,
          runDays,
          error: adjustment.error ?? null,
          audit,
          checks: {
            generated: !("error" in adjustment),
            arithmetic: !!audit && audit.failures.length === 0,
            dateUnchanged:
              !("error" in adjustment) &&
              adjustment.result.meta.raceDate === input.raceDate,
            daysUnchanged:
              !("error" in adjustment) &&
              adjustment.result.meta.runDays === runDays,
            earlyGrowthWithin8Percent:
              !!audit &&
              (() => {
                const full = audit.weeks
                  .filter((w) => w.start > today)
                  .slice(0, 2);
                return (
                  full.length === 2 && full[1].km <= full[0].km * 1.08 + 0.11
                );
              })(),
            allFutureGrowthWithin8Percent:
              !!audit &&
              (() => {
                let established = baseKm * { 7: 0.85, 14: 0.7, 28: 0.55 }[days];
                for (const week of audit.weeks.filter(
                  (w) =>
                    w.start > today && w.w < adjustment.result.weeks.at(-1).w,
                )) {
                  if (week.km > established * 1.08 + 0.11) return false;
                  if (!week.deload && !week.taper) established = week.km;
                }
                return true;
              })(),
            demandingDaysLimited:
              !!audit &&
              audit.weeks
                .filter((w) => w.start > today)
                .every((w) => w.demanding <= 2),
            noProjectedFitnessGain:
              !("error" in adjustment) &&
              adjustment.result.meta.vdotGoal === adjustment.result.meta.vdot0,
            availableDaysNotExceeded:
              !!audit &&
              audit.weeks.every(
                (w) =>
                  adjustment.result.weeks
                    .find((x) => x.w === w.w)
                    .days.filter((d) => d.km > 0 && !d.rest).length <= runDays,
              ),
          },
        });
      }
const result = {
  supplemental,
  createdAt: "2026-10-11",
  today,
  sourcePolicy:
    "GENERATOR_PHASE3_CRITERIA.md; expectations fixed before reviewed outputs",
  summary: cases.map((c) => ({
    id: c.id,
    analysis: c.analysis
      ? {
          coverage: c.analysis.volumeCoverage,
          actualKm: c.analysis.actualKm,
          recentWeeklyKm: c.analysis.recentWeeklyKm,
          recentLongRunKm: c.analysis.recentLongRunKm,
          daysSinceLastRun: c.analysis.daysSinceLastRun,
        }
      : null,
    recommendation: c.recommendation?.kind,
    evidence: c.evidence
      ? {
          accepted: c.evidence.measurements,
          distinctDays: c.evidence.distinctDays,
          excluded: c.evidence.excluded,
        }
      : null,
    checks: c.checks,
    passed: Object.values(c.checks).every(Boolean),
  })),
  audits,
  cases,
};
mkdirSync(new URL("../qa/generator-phase3/", import.meta.url), {
  recursive: true,
});
writeFileSync(
  new URL("../qa/generator-phase3/profiles.json", import.meta.url),
  JSON.stringify(result, null, 2) + "\n",
);
const sources = [
  "domain/training/execution.ts",
  "domain/training/adaptation/evidence.ts",
  "domain/plan/future.ts",
  "domain/plan/replan.ts",
  "domain/plan/versions.ts",
  "domain/plan/executionAdjustment.ts",
  "domain/plan/returnGrowth.ts",
  "domain/training/generator/generatePlan.ts",
  "domain/training/adaptation/proposal.ts",
  "domain/training/adaptation/evidence.test.ts",
  "stores/executionActions.ts",
  "stores/executionActions.test.ts",
].map((p) => ({
  path: "web/src/" + p,
  sha256: hash(
    readFileSync(new URL("../../web/src/" + p, import.meta.url), "utf8"),
  ),
}));
writeFileSync(
  new URL("../qa/generator-phase3/digest.json", import.meta.url),
  JSON.stringify(
    {
      probeSha256: hash(readFileSync(new URL(import.meta.url), "utf8")),
      outputSha256: hash(
        readFileSync(
          new URL("../qa/generator-phase3/profiles.json", import.meta.url),
          "utf8",
        ),
      ),
      sources,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify(
    {
      summary: result.summary,
      audits: audits.map((a) => ({ id: a.id, failures: a.failures })),
      supplemental: {
        count: supplemental.length,
        failures: supplemental
          .filter((c) => !Object.values(c.checks).every(Boolean))
          .map((c) => ({
            distance: c.distance,
            breakDays: c.breakDays,
            runDays: c.runDays,
            checks: c.checks,
            error: c.error,
            auditFailures: c.audit?.failures,
          })),
      },
    },
    null,
    2,
  ),
);
if (
  supplemental.some((c) => !Object.values(c.checks).every(Boolean)) ||
  result.summary.some((c) => !c.passed) ||
  audits.some((a) => a.failures.length)
)
  process.exitCode = 1;
