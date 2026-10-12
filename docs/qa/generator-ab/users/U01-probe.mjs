// Reproduce: node docs/qa/generator-ab/users/U01-probe.mjs
// Pure production-domain probe. No browser/watch/cloud claim.
// Importing the shared probe installs the Node 24 TypeScript resolution hooks.
import { generatePair } from '../../../probes/generator-ab-qa.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const { adaptGeneratedPlan } = await import('../../../../web/src/domain/plan/adapt.ts');
const { resolvePlan } = await import('../../../../web/src/domain/plan/resolve.ts');
const { analyzeExecution, recommendExecution } = await import('../../../../web/src/domain/training/execution.ts');
const { buildExecutionAdjustment } = await import('../../../../web/src/domain/plan/executionAdjustment.ts');
const { sessKm, sessDesc } = await import('../../../../web/src/domain/training/sessions/calc.ts');

const root = new URL('../', import.meta.url);
const profile = JSON.parse(readFileSync(new URL('inputs.json', root))).find(x => x.id === 'U01');
const locked = JSON.parse(readFileSync(new URL('raw/U01.json', root)));
const manifest = JSON.parse(readFileSync(new URL('manifest.json', root)));
const pair = await generatePair(profile);
const hash = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const output = {
  id: 'U01', scope: 'Pure current production-domain consumers against both pinned generator outputs; no browser interaction',
  command: 'node docs/qa/generator-ab/users/U01-probe.mjs',
  nodeVersion: process.version, today: profile.eventToday, event: profile.event,
  historySource: 'Synthetic QA: every scheduled run before eventToday is explicitly recorded done at its prescribed distance and RPE 3; the event-day run is explicitly skipped. Prescription alone is not claimed as actual training.',
  commits: {old: manifest.oldCommit, new: manifest.newCommit}, versions: {}
};
for (const key of ['old', 'new']) {
  const plan = pair.versions[key].plan;
  assert.equal(pair.versions[key].sha256, locked.versions[key].sha256);
  const current = {...adaptGeneratedPlan(plan), ulaz: structuredClone(profile.input)};
  const before = hash(current);
  const resolved = resolvePlan(current.weeks, {alts: {}, moves: {}});
  const eligible = resolved.dated.filter(d => !d.rest && d.km > 0 && d.tag !== 'snaga' && d.date <= profile.eventToday);
  const missed = eligible.at(-1);
  assert.equal(missed.date, profile.eventToday);
  const log = Object.fromEntries(eligible.map(d => [d.id, d.id === missed.id
    ? {status: 'skip', runDate: d.date, src: 'U01-synthetic-QA'}
    : {status: 'done', km: d.km, runDate: d.date, rpe: 3, src: 'U01-synthetic-QA'}]));
  const logBefore = hash(log);
  const analysis = analyzeExecution({plan: resolved, log, today: profile.eventToday});
  const recommendation = recommendExecution(analysis);
  const adjustment = buildExecutionAdjustment(current, profile.eventToday, analysis, {}, {log});
  const sparseAnalysis = analyzeExecution({plan: resolved, log: {[missed.id]: log[missed.id]}, today: profile.eventToday});
  const sparseRecommendation = recommendExecution(sparseAnalysis);
  const sparseAdjustment = buildExecutionAdjustment(current, profile.eventToday, sparseAnalysis, {}, {log: {[missed.id]: log[missed.id]}});
  const checks = {
    frozenHashReproduced: pair.versions[key].sha256 === locked.versions[key].sha256,
    correctEventDay: missed.id === 'g7d3' && missed.date === profile.eventToday && missed.w === 7,
    oneExplicitMiss: analysis.missed === 1 && analysis.explicitMisses14d === 1,
    recentRunPreventsFalseBreak: analysis.lastRunDate === '2026-11-23' && analysis.daysSinceLastRun === 2,
    recommendationSingleMiss: recommendation.kind === 'single-miss',
    noActionOrConfirmationNeeded: recommendation.actionable === false && recommendation.requiresConfirmation === false,
    noRegeneration: 'error' in adjustment && !('result' in adjustment),
    reasonMatchesRecommendation: adjustment.error === recommendation.reason,
    sourcePlanUnchanged: hash(current) === before,
    logsUnchanged: hash(log) === logBefore,
    sparseUnloggedRunsStayUnknown: sparseAnalysis.completed === 0 && sparseAnalysis.unknown === eligible.filter(d => d.date >= sparseAnalysis.windowStart).length - 1,
    sparseNoInferredMileage: sparseAnalysis.actualKm === 0 && sparseAnalysis.recentWeeklyKm === null,
    sparseSingleMissNoRegeneration: sparseRecommendation.kind === 'single-miss' && 'error' in sparseAdjustment,
    noVolumeOrSessionArithmeticFailures: pair.versions[key].summary.failures.length === 0,
    allTwelveWeeksInspected: plan.weeks.length === 12
  };
  for (const [name, passed] of Object.entries(checks)) assert.equal(passed, true, `${key}: ${name}`);
  output.versions[key] = {
    sha256: pair.versions[key].sha256, missed: {id: missed.id, w: missed.w, generatorDow: missed.dow + 1, date: missed.date, km: missed.km, desc: missed.desc},
    log, analysis, recommendation, adjustment, sparseAnalysis, sparseRecommendation, sparseAdjustment, checks,
    weekInspection: pair.versions[key].summary.weeks.map(w => ({
      w: w.w, km: w.km, longestRunKm: Math.max(...w.days.filter(d => d.km > 0).map(d => d.km)),
      deload: w.deload, taper: w.taper, focus: w.focus,
      runDays: w.runDays, workMinutes: w.workMinutes,
      days: w.days.map(d => ({dow: d.dow, tag: d.tag, rest: !!d.rest, km: d.km ?? null,
        runWalk: d.runWalk ?? null, strides: d.strides ?? null, desc: d.desc,
        ...(d.session ? {session: d.session, calculatedKm: sessKm(d.session), currentFormatterDesc: sessDesc(d.session)} : {})}))
    }))
  };
}
output.allChecksPass = Object.values(output.versions).every(v => Object.values(v.checks).every(Boolean));
writeFileSync(new URL('users/U01-event.json', root), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({id: output.id, allChecksPass: output.allChecksPass, versions: Object.fromEntries(Object.entries(output.versions).map(([k,v]) => [k,{sha256: v.sha256, missed: v.missed.id, recommendation: v.recommendation.kind, regenerationBlocked: 'error' in v.adjustment}]))}));
