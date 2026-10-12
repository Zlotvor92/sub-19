// node --experimental-strip-types docs/probes/limited-preparation.mjs   (Node 22.15+ or 24)
// Reads frozen QA evidence from docs/qa/generator-ab/ and writes new outputs only to
// docs/qa/limited-preparation/. Source SHA256 is verified before and after.
import { registerHooks } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
registerHooks({ resolve(s, c, n) { try { return n(s, c); } catch (e) { if (s.startsWith('.')) for (const x of ['.ts', '/index.ts']) try { return n(s + x, c); } catch {} throw e; } } });
const { buildExecutionAdjustment, executionBasis } = await import('../../web/src/domain/plan/executionAdjustment.ts');
const { buildPreparationChoice } = await import('../../web/src/domain/plan/preparationDecision.ts');
const { preparationSummary } = await import('../../web/src/domain/plan/preparation.ts');
const { resolvePlan } = await import('../../web/src/domain/plan/resolve.ts');
const { isDemanding } = await import('../../web/src/domain/plan/finalize.ts');

const LOCKED = 'f8cb2081ed4ba223fe7efe14a621144beb9bce0d';
const out = new URL('../qa/limited-preparation/', import.meta.url);
mkdirSync(out, { recursive: true });
const hash = (x) => createHash('sha256').update(x).digest('hex');
const pick = (id, doc) => (id === 'U08' ? doc.event : id === 'U10' ? { ...doc.event, profile: doc.profile } : doc);
// Confirmed return window of the policy (exclusive end), identical for every option of an event.
const window = (plan, today, end) => {
  const view = resolvePlan(plan.weeks, { alts: {}, moves: {} });
  return view.dated.filter((d) => d.date > today && d.date < end);
};
const brief = (d) => ({ date: d.date, tag: d.tag ?? null, km: d.km ?? null, demanding: isDemanding(d), desc: d.desc });
const summary = [];
for (const id of ['U08', 'U09', 'U10']) {
  const url = new URL(`../qa/generator-ab/users/${id}-event.json`, import.meta.url);
  const bytes = readFileSync(url);
  const e = pick(id, JSON.parse(bytes));
  const today = e.today ?? e.input.today ?? e.profile.eventToday;
  const frozen = JSON.stringify(e.input);
  const r = buildExecutionAdjustment(e.input.current, today, e.analysis, e.input.options, e.input.context);
  assert.equal(JSON.stringify(e.input), frozen);
  const basis = executionBasis(e.input.current, today, e.analysis, e.input.options);
  let end = null;
  const choices = (r.decision?.options ?? []).map((o) => {
    const built = buildPreparationChoice(e.input.current, today, basis, o.choice, e.input.context);
    assert(!('error' in built), built.error);
    const label = preparationSummary(built.result.meta);
    end ??= built.result.meta.finalization.returnWindow.end;
    assert.equal(built.result.meta.finalization.returnWindow.end, end);
    return {
      option: o,
      summary: built.summary,
      change: built.change,
      notes: built.notes,
      label: label && { fullPreparation: label.fullPreparation, mode: label.mode },
      preparation: built.result.meta.preparation,
      returnWindow: window(built.result, today, end).map(brief),
      result: built.result
    };
  });
  const before = {
    // Locked QA output at f8cb2081 (historical evidence; not regenerated).
    adjustment: id === 'U08' ? { error: e.adjustment.error } : { summary: e.adjustment.summary, preparation: e.adjustment.result.meta.preparation, cycleDecision: e.adjustment.result.meta.cycleDecision ?? null },
    returnWindowEnd: end,
    oldScheduleInReturnWindow: window(e.input.current, today, end).map(brief)
  };
  const after = 'error' in r
    ? { error: r.error }
    : { summary: r.summary, preparation: r.result.meta.preparation, cycleDecision: r.result.meta.cycleDecision ?? null, label: preparationSummary(r.result.meta) };
  assert.equal(hash(readFileSync(url)), hash(bytes));
  const doc = { id, today, lockedQaCommit: LOCKED, sourceEvidenceSha256: hash(bytes), before, after, decision: r.decision ?? null, choices };
  writeFileSync(new URL(`${id}.json`, out), JSON.stringify(doc, null, 2) + '\n');
  summary.push({
    id,
    today,
    sourceEvidenceSha256: hash(bytes),
    before: before.adjustment.error ?? before.adjustment.summary,
    returnWindowEnd: end,
    oldScheduleInReturnWindow: { demanding: before.oldScheduleInReturnWindow.filter((d) => d.demanding).length, maxKm: Math.max(...before.oldScheduleInReturnWindow.map((d) => d.km ?? 0)) },
    after: after.error ?? after.summary,
    mode: after.label?.mode ?? null,
    statement: r.decision?.statement ?? null,
    conditions: r.decision?.conditions ?? [],
    unavailable: r.decision?.unavailable ?? [],
    options: choices.map((c) => ({ id: c.option.id, title: c.option.title, raceDate: c.option.raceDate, raceDistM: c.option.raceDistM, goalSec: c.option.goalSec, coverage: c.option.coverage, peakLongRunKm: c.option.peakLongRunKm, peakWeeklyKm: c.option.peakWeeklyKm, demandingInReturnWindow: c.returnWindow.filter((d) => d.demanding).length, maxKmInReturnWindow: Math.max(...c.returnWindow.map((d) => d.km ?? 0)) }))
  });
}
writeFileSync(new URL('summary.json', out), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary.map(({ id, after, mode, options, unavailable, oldScheduleInReturnWindow }) => ({ id, after, mode, unavailable, oldScheduleInReturnWindow, options: options.map((o) => `${o.id} ${o.raceDate} ${o.coverage} LR${o.peakLongRunKm} W${o.peakWeeklyKm} hardInReturn=${o.demandingInReturnWindow} maxKm=${o.maxKmInReturnWindow}`) })), null, 2));
