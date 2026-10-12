// Node 24: node docs/probes/plan-finalization.mjs
// Read frozen evidence; write new outputs to a separate directory. Never rerun the old writers.
import { registerHooks } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
registerHooks({ resolve(s,c,n) { try { return n(s,c); } catch(e) { if(s.startsWith('.')) for(const x of ['.ts','/index.ts']) try { return n(s+x,c); } catch {} throw e; } } });
const { buildExecutionAdjustment } = await import('../../web/src/domain/plan/executionAdjustment.ts');
const { resolvePlan } = await import('../../web/src/domain/plan/resolve.ts');
const { deliveredWeeks, isDemanding } = await import('../../web/src/domain/plan/finalize.ts');
const { alignAutomaticOverlays } = await import('../../web/src/domain/plan/automaticAlts.ts');
const root = new URL('../qa/plan-finalization/', import.meta.url);
mkdirSync(root, { recursive: true });
const summaries = [];
const hash = x => createHash('sha256').update(x).digest('hex');
for (const id of ['U04', 'U06', 'U08', 'U09', 'U10']) {
  const url = new URL(`../qa/generator-ab/users/${id}-event.json`, import.meta.url);
  const bytes = readFileSync(url);
  const doc = JSON.parse(bytes);
  const e = id === 'U08' ? doc.earlierControlled : id === 'U10' ? { ...doc.event, profile: doc.profile } : doc;
  const today = e.today ?? e.input.today ?? e.profile.eventToday;
  const before = JSON.stringify(e.input);
  const adjustment = buildExecutionAdjustment(e.input.current, today, e.analysis, e.input.options, e.input.context);
  assert(!('error' in adjustment));
  assert.equal(JSON.stringify(e.input), before);
  function audit(plan) {
    const ctx = { ...e.input.context, alts: alignAutomaticOverlays(e.input.current, plan, today, e.input.context) };
    const view = resolvePlan(plan.weeks, { alts: ctx.alts, moves: ctx.moves ?? {} });
    const staleDescriptions = view.dated.filter(d => d.date > today && !d.session && !d.strides && !d.finish && /ubrzanja|poslednjih .*km @/.test(d.desc ?? '')).map(d => ({ id: d.id, date: d.date, desc: d.desc }));
    const weeks = deliveredWeeks(plan, today, ctx);
    const staleFocus = weeks.filter(w => w.days.some(d => !d.rest && d.km > 0) && !w.days.some(isDemanding) && /Tempo|Fartlek|Intervali|oštrina/i.test(w.focus)).map(w => ({ w: w.w, focus: w.focus }));
    return { staleDescriptions, staleFocus, peakWeeklyKm: plan.meta.preparation.peakWeeklyKm, warnings: plan.meta.dayWarnings, finalization: plan.meta.finalization, conflicts: plan.meta.futureChanges?.conflicts ?? [] };
  }
  const old = audit(e.adjustment.result), after = audit(adjustment.result);
  assert.equal(after.staleDescriptions.length, 0);
  assert.equal(after.staleFocus.length, 0);
  assert.equal(hash(readFileSync(url)), hash(bytes));
  const output = { id, today, scope: id === 'U08' ? 'Earlier permitted supplemental return, not primary rejected event' : 'Locked QA event replay against new implementation', lockedQaCommit: 'f8cb2081ed4ba223fe7efe14a621144beb9bce0d', sourceEvidenceSha256: hash(bytes), before: old, after, adjustment };
  writeFileSync(new URL(`${id}.json`, root), JSON.stringify(output, null, 2) + '\n');
  summaries.push({ id, today, sourceEvidenceSha256: hash(bytes), before: old, after });
}
writeFileSync(new URL('summary.json', root), JSON.stringify(summaries, null, 2) + '\n');
console.log(JSON.stringify(summaries.map(({ id, before, after }) => ({ id, staleDescriptions: [before.staleDescriptions.length, after.staleDescriptions.length], staleFocus: [before.staleFocus.length, after.staleFocus.length], peak: [before.peakWeeklyKm, after.peakWeeklyKm], easyWeeks: after.finalization.initialEasyWeeks, conflicts: after.conflicts.length })), null, 2));
