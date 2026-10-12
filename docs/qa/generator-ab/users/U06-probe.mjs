// Reproduce with Node 24: node docs/qa/generator-ab/users/U06-probe.mjs
// Synthetic athlete domain simulation. Browser evidence is produced independently by the Playwright spec.
import { registerHooks } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
registerHooks({ resolve(s,c,n) { try { return n(s,c); } catch(e) { if(s.startsWith('.')) for(const x of ['.ts','/index.ts']) try { return n(s+x,c); } catch {} throw e; } } });
const qa=new URL('../',import.meta.url),manifest=JSON.parse(readFileSync(new URL('manifest.json',qa),'utf8'));
const profile=JSON.parse(readFileSync(new URL('inputs.json',qa),'utf8')).find(p=>p.id==='U06');
const raw=JSON.parse(readFileSync(new URL('raw/U06.json',qa),'utf8'));
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)??'undefined').digest('hex');
const clone=x=>JSON.parse(JSON.stringify(x)),round=x=>Math.round(x*100)/100;
const imp=(root,p)=>import(pathToFileURL(resolve(root,'web/src/'+p)).href),root=manifest.localRoots.new;
const {adaptGeneratedPlan}=await imp(root,'domain/plan/adapt.ts');
const {resolvePlan}=await imp(root,'domain/plan/resolve.ts');
const {analyzeExecution,recommendExecution}=await imp(root,'domain/training/execution.ts');
const {buildExecutionAdjustment}=await imp(root,'domain/plan/executionAdjustment.ts');
const {recordPlanRevision,getPlanRevisions}=await imp(root,'domain/plan/versions.ts');
const {graftFuturePlan}=await imp(root,'domain/plan/future.ts');
const {sessKm,sessQKm,sessDesc}=await imp(root,'domain/training/sessions/calc.ts');
const {deriveQSById}=await imp(root,'domain/training/prediction/index.ts');
const {matchPlanRows}=await imp(root,'domain/training/adaptation/matching.ts');
const reproduction={};
for(const version of ['old','new']) {
 const {generatePlan}=await imp(manifest.localRoots[version],'domain/training/generator/generatePlan.ts');
 const reproduced=generatePlan(clone(profile.input));
 reproduction[version]={lockedSha256:raw.versions[version].sha256,reproducedSha256:hash(reproduced),exact:hash(reproduced)===raw.versions[version].sha256};
 assert(reproduction[version].exact,`${version} frozen hash differs`);
}
function weekSummary(plan,stored=false,context={}) {
 const view=stored?resolvePlan(plan.weeks,context):null;
 return plan.weeks.map(w=>{
  let workMinutes=0;const sessions=[],finishes=[];
  for(const d of w.days) {
   if(d.session) {const s=d.session,q=sessQKm(s),min=s.type==='fartlek'?s.reps*s.repSec/60:q*s.paceSec/60;workMinutes+=min;sessions.push({dow:stored?d.dow+1:d.dow,id:d.id,date:view?.byId.get(d.id)?.date,type:s.type,kind:s.kind,zone:s.zone,qKm:round(q),workMinutes:round(min),paceSec:s.paceSec,restSec:s.restSec,desc:d.desc,reps:s.reps,repM:s.repM,repSec:s.repSec});}
   if(d.finish) {const min=d.finish.km*d.finish.paceSec/60;workMinutes+=min;finishes.push({dow:stored?d.dow+1:d.dow,...d.finish,workMinutes:round(min)});}
  }
  return {w:w.w,start:w.start,km:round(w.days.reduce((n,d)=>n+(d.km??0),0)),futureKm:view?round(w.days.filter(d=>view.byId.get(d.id)?.date>profile.eventToday).reduce((n,d)=>n+(d.km??0),0)):undefined,longestScheduledRunKm:Math.max(0,...w.days.filter(d=>d.km>0&&d.tag!=='trka').map(d=>d.km)),lrKm:Math.max(0,...w.days.filter(d=>d.tag==='lr'&&!d.mlr).map(d=>d.km)),runDays:w.days.filter(d=>d.km>0&&!d.rest).length,deload:w.deload,taper:!!w.taper,focus:w.focus,workMinutes:round(workMinutes),sessions,finishes,strideDows:w.days.filter(d=>d.strides).map(d=>stored?d.dow+1:d.dow),days:w.days};
 });
}
const current={...adaptGeneratedPlan(clone(raw.versions.new.plan)),ulaz:clone(profile.input)};
const today=profile.eventToday,context={log:{},alts:{},moves:{},pred:{},predLock:{}};
const view=resolvePlan(current.weeks,context),matched=matchPlanRows(view.weeks,current.pred);
for(const d of view.dated.filter(d=>d.date<=today&&!d.rest&&d.km>0&&d.tag!=='snaga')) {
 context.log[d.id]=d.date>='2026-10-29'?{status:'skip',ts:d.date}:{status:'done',km:d.km,sec:Math.round(d.km*420),rpe:4,runDate:d.date,ts:d.date};
 const row=matched.get(d.id);if(row&&context.log[d.id].status==='done'){context.pred[row.id]=d.session.paceSec;context.predLock[row.id]=true;}
}
const analysis=analyzeExecution({plan:view,today,log:context.log}),recommendation=recommendExecution(analysis);
const options={breakDays:profile.event.breakDays,weeklyKm:profile.input.weeklyKm,recentLongRunKm:profile.input.recentLongRunKm};
const beforeHash=hash({current,context,analysis,options});
const adjustment=buildExecutionAdjustment(current,today,analysis,options,context);
assert(!('error'in adjustment),'confirmed 28-day return unexpectedly blocked');
const result=adjustment.result,out=resolvePlan(result.weeks,context);
const checks={
 frozenOldReproduces:reproduction.old.exact,frozenNewReproduces:reproduction.new.exact,
 eventGenerated:!('error'in adjustment),pureInputs:hash({current,context,analysis,options})===beforeHash,
 lastActualRunIsOct28:analysis.lastRunDate==='2026-10-28',exact28DayGap:analysis.daysSinceLastRun===28,
 noUnknownHistory:analysis.unknown===0,allConfirmedBreakRunsSkipped:view.dated.filter(d=>d.date>='2026-10-29'&&d.date<=today&&d.km>0&&!d.rest&&d.tag!=='snaga').every(d=>context.log[d.id]?.status==='skip'),
 requiresReturnConfirmation:recommendation.kind==='return'&&recommendation.requiresConfirmation,
 unchangedPastAndToday:view.dated.filter(d=>d.date<=today).every(d=>hash(d.origin)===hash(out.byId.get(d.id)?.origin)),
 calendarIdentitiesStable:view.dated.every(d=>out.byId.get(d.id)?.date===d.date),
 raceDateUnchanged:result.meta.raceDate===profile.input.raceDate&&out.dated.find(d=>d.tag==='trka')?.date===profile.input.raceDate,
 startBase55Percent:result.meta.executionAdjustment.startingKm===8.3,
 fourInitialCalendarWeeksEasy:out.dated.filter(d=>d.date>today&&d.date<='2026-12-20'&&d.tag!=='trka').every(d=>!d.session&&!d.finish&&!d.strides),
 noProjectedFitnessGain:result.meta.vdot0===result.meta.vdotGoal,
 logAndMeasuredPredUnchanged:beforeHash===hash({current,context,analysis,options})
};
const auditFailures=[];
for(const [version,plan]of Object.entries(raw.versions)) for(const w of plan.plan.weeks) {
 const sum=w.days.reduce((n,d)=>n+(d.km??0),0);if(Math.abs(sum-w.vol)>.051)auditFailures.push({version,w:w.w,reason:'week-sum',sum,vol:w.vol});
 for(const d of w.days)if(d.session&&Math.abs(sessKm(d.session)-d.km)>.051)auditFailures.push({version,w:w.w,dow:d.dow,reason:'session-km'});
}
const matchedAfter=matchPlanRows(out.weeks,result.pred);
for(const w of result.weeks) for(const d of w.days)if(d.session) {
 const row=matchedAfter.get(d.id);
 if(Math.abs(sessKm(d.session)-d.km)>.051)auditFailures.push({version:'return',id:d.id,reason:'session-km'});
 if(d.desc!==sessDesc(d.session))auditFailures.push({version:'return',id:d.id,reason:'description'});
 if(!row||Math.abs(row.q-sessQKm(d.session))>.051||row.pt!==d.session.paceSec)auditFailures.push({version:'return',id:d.id,reason:'prediction'});
 if(hash(result.qs[d.id])!==hash(deriveQSById([{...w,days:[d]}])[d.id]))auditFailures.push({version:'return',id:d.id,reason:'qs'});
}
const recorded=recordPlanRevision(current,result,{reason:'execution',date:today,summary:adjustment.summary});
const persisted=clone(recorded),revision=getPlanRevisions(persisted)[0];
const logAtRestore=clone(context.log);logAtRestore.g7d3={status:'done',km:6.2,sec:2040,runDate:today,ts:today};
const restoreContext={...context,log:logAtRestore};
const restoreContextHash=hash(restoreContext);
const restored=graftFuturePlan(persisted,revision.snapshot,today,restoreContext);
const restoredRecorded=recordPlanRevision(persisted,restored,{reason:'restore',date:today,summary:'Restore original plan'});
checks.historySnapshotExact=hash(revision.snapshot)===hash(current);
checks.domainRevisionPersistsJsonRoundTrip=getPlanRevisions(clone(restoredRecorded)).length===2;
checks.domainRestoreContextNotMutated=hash(restoreContext)===restoreContextHash;
checks.revisionSnapshotsExcludeExecutionLog=getPlanRevisions(restoredRecorded).every(r=>!('log'in r.snapshot));
checks.domainRestorePreservesCompletedCutoffDay=hash(restored.weeks.flatMap(w=>w.days).find(d=>d.id==='g7d3'))===hash(current.weeks.flatMap(w=>w.days).find(d=>d.id==='g7d3'));
checks.zeroAuditFailures=auditFailures.length===0;
for(const[key,value]of Object.entries(checks))assert(value,`${key} failed`);
const output={id:'U06',scope:'Independent AI synthetic athlete simulation. Domain APIs executed locally; no human or browser-pass claims.',profile,reproduction,review:{old:weekSummary(raw.versions.old.plan),new:weekSummary(raw.versions.new.plan)},event:{confirmedBreakFrom:'2026-10-29',confirmedBreakThrough:today,lastActualRun:'2026-10-28',reportedPreBreakBaseKm:15,reportedRepeatableLongRunKm:4,history:'Every eligible running slot is explicitly recorded: prescribed distance actually completed through October 28, explicitly skipped October 29 through November 25. Synthetic observations, not assumed actual user history.'},input:{current,context,options},analysis,recommendation,adjustment,returnWeeks:weekSummary(result,true,context),checks,auditFailures,domainRevisionRoundTrip:{recorded,persisted,restoredRecorded,logAtRestore},sources:['domain/plan/executionAdjustment.ts','domain/plan/future.ts','domain/plan/returnGrowth.ts','domain/plan/versions.ts','domain/training/generator/generatePlan.ts'].map(p=>({path:'web/src/'+p,sha256:hash(readFileSync(resolve(root,'web/src/'+p),'utf8'))}))};
writeFileSync(new URL('U06-event.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({id:'U06',checks,analysis,recommendation,auditFailures,weeks:output.review.new.map(({days,...w})=>w),returnWeeks:output.returnWeeks.map(({days,...w})=>w)},null,2));
