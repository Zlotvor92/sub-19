// Node 24. Frozen QA inputs are read-only. Outputs always go to this separate directory.
import { registerHooks } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
registerHooks({ resolve(s,c,n) { try { return n(s,c); } catch(e) { if(s.startsWith('.')) for(const x of ['.ts','/index.ts']) try { return n(s+x,c); } catch {} throw e; } } });
const root = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const codeRoot = process.env.SUB20_RECOVERY_CODE_ROOT ?? root;
const label = process.env.SUB20_RECOVERY_LABEL ?? 'after';
if (!['before','after'].includes(label)) throw new Error('Expected before/after label');
const { buildExecutionAdjustment } = await import(pathToFileURL(resolve(codeRoot, 'web/src/domain/plan/executionAdjustment.ts')));
const { resolvePlan } = await import(pathToFileURL(resolve(codeRoot, 'web/src/domain/plan/resolve.ts')));
const { sessQKm } = await import(pathToFileURL(resolve(codeRoot, 'web/src/domain/training/sessions/calc.ts')));
const hash = x => createHash('sha256').update(x).digest('hex');
const output = { codeRoot, label, frozenQACommit: 'f8cb2081ed4ba223fe7efe14a621144beb9bce0d', profiles: {} };
for (const id of ['U02','U03','U07']) {
  const path = resolve(root, `docs/qa/generator-ab/users/${id}-event.json`);
  const bytes = readFileSync(path);
  const e = JSON.parse(bytes);
  const context = e.input.context ?? { log: e.input.log };
  const stamp = JSON.stringify({ input: e.input, analysis: e.analysis });
  const built = buildExecutionAdjustment(e.input.current,e.today,e.analysis,e.input.options,context);
  if ('error' in built) throw new Error(built.error);
  if (stamp !== JSON.stringify({ input: e.input, analysis: e.analysis })) throw new Error('Mutated fixture');
  const view = resolvePlan(built.result.weeks,{alts:context.alts??{},moves:context.moves??{}});
  const weeks = built.result.weeks.map(w => ({week:w.w,start:w.start,deload:w.deload,km:+w.days.reduce((n,d)=>n+(d.km??0),0).toFixed(1),futureKm:+view.dated.filter(d=>d.date>e.today&&d.date>=w.start&&d.date<new Date(Date.parse(w.start)+7*86400000).toISOString().slice(0,10)).reduce((n,d)=>n+(d.km??0),0).toFixed(1),qualityMinutes:+w.days.reduce((n,d)=>n+(d.session?sessQKm(d.session)*d.session.paceSec/60:0),0).toFixed(2)}));
  output.profiles[id] = { sourceSha256:hash(bytes),today:e.today,summary:built.summary,input:built.result.ulaz,athlete:built.result.meta.athlete,recovery:built.result.meta.fatigueRecovery,weeks,result:built.result,notes:built.notes };
}
writeFileSync(new URL(`${label}.json`,import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(output.profiles).map(([id,p])=>[id,{continuity:p.athlete.consistentWeeks,readiness:p.athlete.currentReadiness,W8:p.weeks.find(w=>w.week===8),summary:p.summary}])),null,2));
if (label === 'after' && process.env.SUB20_RECOVERY_PREVIOUS_ROOT) {
  const { reentryPlan: before } = await import(pathToFileURL(resolve(process.env.SUB20_RECOVERY_PREVIOUS_ROOT,'web/src/domain/plan/replan.ts')));
  const { reentryPlan: after } = await import(pathToFileURL(resolve(root,'web/src/domain/plan/replan.ts')));
  const changes = [];
  for (const [dist,sec] of [[5000,1237],[10000,2570],[21097.5,5700],[42195,13500]]) {
    for (const resume of [3,9]) {
      const input = {startDate:'2026-01-05',raceDate:'2026-05-25',raceDistM:dist,pb:{distM:dist,sec},weeklyKm:50,runDays:5,quality:2,intensity:'std',trainedRecently:true};
      const old = JSON.parse(JSON.stringify(before(input,resume,22.5,47.3)));
      const next = JSON.parse(JSON.stringify(after(input,resume,22.5,47.3)));
      const paths = [];
      function diff(a,b,path='') {
        if (JSON.stringify(a) === JSON.stringify(b)) return;
        if (Array.isArray(a) && Array.isArray(b)) { paths.push({path,before:a,after:b}); return; }
        if (a && b && typeof a === 'object' && typeof b === 'object') {
          for(const k of new Set([...Object.keys(a),...Object.keys(b)])) diff(a[k],b[k],path?`${path}.${k}`:k);
        } else paths.push({path,before:a,after:b});
      }
      diff(old,next);
      if(paths.some(p=>!['meta.athlete.consistentWeeks','meta.athlete.currentReadiness','meta.athlete.assumptions','meta.dayWarnings'].includes(p.path))) throw new Error('Unexpected reentry change: '+JSON.stringify(paths));
      for (const p of paths.filter(p=>['meta.athlete.assumptions','meta.dayWarnings'].includes(p.path)))
        if(p.after[0] !== 'Kontinuitet nije potvrđen; kvalitet i dužina uvode se postepeno.' || JSON.stringify(p.after.slice(1)) !== JSON.stringify(p.before)) throw new Error('Unexpected warning change');
      changes.push({dist,resume,identicalWeeks:JSON.stringify(old.weeks)===JSON.stringify(next.weeks),identicalPrediction:JSON.stringify(old.pred)===JSON.stringify(next.pred),changes:paths});
    }
  }
  writeFileSync(new URL('reentry-parity.json',import.meta.url),JSON.stringify(changes,null,2)+'\n');
}
if (label === 'after') {
  const { mkdirSync } = await import('node:fs');
  const { generatePlan } = await import(pathToFileURL(resolve(root,'web/src/domain/training/generator/generatePlan.ts')));
  const profiles = JSON.parse(readFileSync(resolve(root,'docs/qa/generator-ab/inputs.json')));
  const previous = process.env.SUB20_RECOVERY_PREVIOUS_ROOT
    ? (await import(pathToFileURL(resolve(process.env.SUB20_RECOVERY_PREVIOUS_ROOT,'web/src/domain/training/generator/generatePlan.ts')))).generatePlan
    : null;
  const directory = new URL('current/',import.meta.url);
  mkdirSync(directory,{recursive:true});
  const summary = [];
  for (const p of profiles) {
    const plan = generatePlan(structuredClone(p.input));
    if ('error' in plan) throw new Error(plan.error);
    const old = previous?.(structuredClone(p.input));
    if (old && ('error' in old || JSON.stringify(old.weeks)!==JSON.stringify(plan.weeks) || JSON.stringify(old.pred)!==JSON.stringify(plan.pred))) throw new Error('Completed-segment prescriptions changed: '+p.id);
    writeFileSync(new URL(`${p.id}.json`,directory),JSON.stringify({input:p.input,plan},null,2)+'\n');
    summary.push({id:p.id,sha256:hash(JSON.stringify(plan)),...(old?{previousWeeksAndPredUnchanged:true}:{})});
  }
  writeFileSync(new URL('current-summary.json',import.meta.url),JSON.stringify(summary,null,2)+'\n');
}
