// Node 24. Replay the literal locked historical inputs; never write original evidence.
import { registerHooks } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
registerHooks({ resolve(s,c,n) { try { return n(s,c); } catch(e) { if(s.startsWith('.')) for(const x of ['.ts','/index.ts']) try { return n(s+x,c); } catch {} throw e; } } });
const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const directory = resolve(root, 'docs/qa/generator-final');
const manifest = JSON.parse(readFileSync(resolve(directory,'manifest.json')));
manifest.localRoots.old = process.env.SUB20_QA_OLD_ROOT ?? manifest.localRoots.old;
manifest.localRoots.new = process.env.SUB20_QA_NEW_ROOT ?? manifest.localRoots.new;
const profiles = JSON.parse(readFileSync(resolve(directory,'inputs.json')));
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value) ?? 'undefined').digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const loaded = {};
async function modules(version) {
  if (loaded[version]) return loaded[version];
  const imp = path => import(pathToFileURL(resolve(manifest.localRoots[version], 'web/src', path)));
  const paths = ['domain/plan/executionAdjustment.ts','domain/plan/resolve.ts','domain/training/sessions/calc.ts','domain/training/adaptation/matching.ts','domain/training/prediction/index.ts','domain/training/execution.ts'];
  const parts = await Promise.all(paths.map(imp));
  loaded[version] = Object.assign({}, ...parts);
  loaded[version].sourceHashes = Object.fromEntries(paths.map(p => [p,hash(readFileSync(resolve(manifest.localRoots[version],'web/src',p),'utf8'))]));
  return loaded[version];
}
function contextOf(input) { return input.context ?? { log:input.log ?? {} }; }
function normalized(event, profile) {
  return {current:event.input.current ?? event.input.plan,context:contextOf(event.input),options:event.input.options ?? {},analysis:event.analysis ?? event.input.analysis,today:event.today ?? event.input.today ?? profile.eventToday};
}
export function lockedCases(id) {
  const path = resolve(root, `docs/qa/generator-ab/users/${id}-event.json`);
  const bytes = readFileSync(path), doc = JSON.parse(bytes);
  const profile = profiles.find(p => p.id === id);
  const primary = ['U08','U10'].includes(id) ? doc.event : doc;
  const cases = { primary:normalized(primary,profile) };
  if (doc.earlierControlled) cases.earlierControlled = normalized(doc.earlierControlled,profile);
  if (doc.protection?.input) cases.protection = normalized(doc.protection,profile);
  return {sourceEvidenceSha256:hash(bytes.toString()),sourcePath:path,profile,cases};
}
function inspect(current, result, context, today, m) {
  if ('error' in result) return {rejected:true,error:result.error,decision:result.decision ?? null};
  const plan = result.result;
  const view = m.resolvePlan(plan.weeks,{alts:context.alts ?? {},moves:context.moves ?? {}});
  const old = m.resolvePlan(current.weeks,{alts:context.alts ?? {},moves:context.moves ?? {}});
  const matching = m.matchPlanRows(m.resolvePlan(current.weeks,{alts:{},moves:context.moves ?? {}}).weeks,current.pred);
  const oldDays = new Map(current.weeks.flatMap(w => w.days).map(d => [d.id,d]));
  const newDays = new Map(plan.weeks.flatMap(w => w.days).map(d => [d.id,d]));
  const rows = new Map(plan.pred.map(r => [r.id,r]));
  const protectedIds = [], changedProtectedDays = [], changedProtectedRows = [], changedProtectedQs = [];
  for (const d of old.dated) {
    const body = oldDays.get(d.id), row = matching.get(d.id), alt = context.alts?.[d.id];
    const manualAlt = alt && (!alt.paceAuto || alt.tag !== (body.rest?'odmor':body.tag) || alt.km !== (body.km??null) || alt.desc !== (body.desc??(body.rest?'Odmor':'')) || alt.rw != null || alt.snaga);
    const protectedDay = d.date<=today || context.log?.[d.id]?.status==='done' || (row && (context.pred?.[row.id]!=null || context.predLock?.[row.id])) || Object.values(body.session?.overrides??{}).some(Boolean) || manualAlt;
    if (!protectedDay) continue;
    protectedIds.push(d.id);
    if (hash(body)!==hash(newDays.get(d.id))) changedProtectedDays.push(d.id);
    if (row && hash(row)!==hash(rows.get(row.id))) changedProtectedRows.push(row.id);
    if (hash(current.qs?.[d.id])!==hash(plan.qs?.[d.id])) changedProtectedQs.push(d.id);
  }
  const protectedSet = new Set(protectedIds), future = view.dated.filter(d => d.date>today);
  const editable = future.filter(d => !protectedSet.has(d.id));
  const staleDescriptions = editable.filter(d => !d.session && !d.strides && !d.finish && /ubrzanja|poslednjih .*km @/.test(d.desc??'')).map(d => ({id:d.id,date:d.date,desc:d.desc}));
  const arithmeticFailures = [], descriptionFailures = [], predictionFailures = [];
  for(const d of editable) {
    const body = newDays.get(d.id);
    if (!body.session) continue;
    if (Math.abs(m.sessKm(body.session)-body.km)>.051) arithmeticFailures.push({id:d.id,km:body.km,calculated:m.sessKm(body.session)});
    if (body.desc!==m.sessDesc(body.session)) descriptionFailures.push({id:d.id,desc:body.desc,calculated:m.sessDesc(body.session)});
    const expectedQs = m.deriveQSById([{...plan.weeks.find(w=>w.days.some(x=>x.id===d.id)),days:[body]}])[d.id];
    if (hash(expectedQs)!==hash(plan.qs?.[d.id])) predictionFailures.push({id:d.id,reason:'QS'});
  }
  const weeks = plan.weeks.map(w => {
    const days = view.dated.filter(d => d.week===w.w || w.days.some(x=>x.id===d.id));
    const work = days.reduce((n,d)=>n+(d.session?(d.session.type==='fartlek'?d.session.reps*d.session.repSec/60:m.sessQKm(d.session)*d.session.paceSec/60):0)+(d.finish?d.finish.km*d.finish.paceSec/60:0),0);
    return {w:w.w,start:w.start,km:+days.reduce((n,d)=>n+(d.km??0),0).toFixed(3),futureKm:+days.filter(d=>d.date>today).reduce((n,d)=>n+(d.km??0),0).toFixed(3),deload:!!w.deload,taper:!!w.taper,focus:w.focus,lrKm:Math.max(0,...days.filter(d=>d.tag==='lr'&&!d.mlr).map(d=>d.km??0)),workMinutes:+work.toFixed(3),days:days.map(d=>({...d,origin:undefined}))};
  });
  const staleFocus = weeks.filter(w => w.days.some(d=>d.date>today) && !w.days.some(d=>d.session||d.finish||d.strides||d.tag==='trka') && /Tempo|Fartlek|Intervali|oštrina/i.test(w.focus)).map(w=>({w:w.w,focus:w.focus}));
  const changedDates = old.dated.filter(d => view.byId.get(d.id)?.date!==d.date).map(d=>({id:d.id,before:d.date,after:view.byId.get(d.id)?.date}));
  const measuredRowsChanged = current.pred.filter(r=>context.pred?.[r.id]!=null||context.predLock?.[r.id]).filter(r=>hash(r)!==hash(rows.get(r.id))).map(r=>r.id);
  return {rejected:false,protectedIds,changedProtectedDays,changedProtectedRows,changedProtectedQs,measuredRowsChanged,changedDates,staleDescriptions,staleFocus,arithmeticFailures,descriptionFailures,predictionFailures,weeks,peakFutureWeeklyKm:Math.max(0,...weeks.filter(w=>!w.taper&&w.w<plan.meta.weeks&&w.futureKm>0).map(w=>w.futureKm)),peakFutureLongRunKm:Math.max(0,...future.filter(d=>d.tag==='lr'&&!d.mlr).map(d=>d.km??0)),athlete:plan.meta.athlete,preparation:plan.meta.preparation,finalization:plan.meta.finalization,fatigueRecovery:plan.meta.fatigueRecovery,conflicts:plan.meta.futureChanges?.conflicts??[],warnings:plan.meta.dayWarnings};
}
export async function replayProfile(id) {
  assert(!['U01','U05'].includes(id),'Special event probes owned by user agents');
  const locked = lockedCases(id);
  const output = {id,scope:'Literal historical event payload replay on both code versions. Primary inputs are unchanged. Protection and earlier-controlled cases remain supplemental; browser evidence is separate.',sourceEvidenceSha256:locked.sourceEvidenceSha256,profile:locked.profile,cases:{}};
  for(const [name,payload] of Object.entries(locked.cases)) {
    output.cases[name] = {input:clone(payload),inputSha256:hash(payload),versions:{}};
    for(const version of ['old','new']) {
      const m = await modules(version), input = clone(payload), before = hash(input);
      const actualAnalysis = m.analyzeExecution({plan:m.resolvePlan(input.current.weeks,{alts:input.context.alts??{},moves:input.context.moves??{}}),today:input.today,log:input.context.log??{}});
      const adjustment = m.buildExecutionAdjustment(input.current,input.today,input.analysis,input.options,input.context);
      assert.equal(hash(input),before,`${id} ${name} ${version}: mutated frozen input`);
      const audit = inspect(input.current,adjustment,input.context,input.today,m);
      output.cases[name].versions[version] = {sourceHashes:m.sourceHashes,adjustment,audit,inputPure:true,recomputedAnalysis:actualAnalysis,analysisMatchesFrozen:hash(actualAnalysis)===hash(input.analysis)};
      if(version==='new'&&!audit.rejected) {
        for(const key of ['changedProtectedDays','changedProtectedRows','changedProtectedQs','measuredRowsChanged','changedDates','arithmeticFailures','descriptionFailures','staleDescriptions','staleFocus','predictionFailures']) assert.equal(audit[key].length,0,`${id} ${name}: ${key}`);
      }
    }
  }
  assert.equal(hash(readFileSync(locked.sourcePath,'utf8')),locked.sourceEvidenceSha256);
  mkdirSync(resolve(directory,'users'),{recursive:true});
  writeFileSync(resolve(directory,`users/${id}-event.json`),JSON.stringify(output,null,2)+'\n');
  return output;
}
if (process.argv[1]===fileURLToPath(import.meta.url)) {
  for(const id of process.argv[2]?[process.argv[2]]:['U02','U03','U04','U06','U07','U08','U09','U10']) {
    const out = await replayProfile(id);
    console.log(JSON.stringify({id,cases:Object.fromEntries(Object.entries(out.cases).map(([k,c])=>[k,Object.fromEntries(Object.entries(c.versions).map(([v,x])=>[v,{rejected:x.audit.rejected,protected:x.audit.protectedIds?.length,staleDescriptions:x.audit.staleDescriptions?.length,staleFocus:x.audit.staleFocus?.length,continuity:x.audit.athlete?.consistentWeeks}]))]))}));
  }
}
