// Independent U03 final QA. Read-only frozen inputs; only U03 supplemental output is written.
import { registerHooks } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
registerHooks({resolve(s,c,n){try{return n(s,c)}catch(e){if(s.startsWith('.'))for(const x of ['.ts','/index.ts'])try{return n(s+x,c)}catch{}throw e}}});
const root=resolve(fileURLToPath(new URL('../../../../',import.meta.url)));
const read=p=>JSON.parse(readFileSync(resolve(root,p),'utf8'));
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)??'undefined').digest('hex');
const clone=x=>JSON.parse(JSON.stringify(x));
const sourcePath='docs/qa/generator-ab/users/U03-event.json';
const sourceBytes=readFileSync(resolve(root,sourcePath),'utf8'), frozen=JSON.parse(sourceBytes);
const raw=read('docs/qa/generator-final/raw/U03.json'), event=read('docs/qa/generator-final/users/U03-event.json');
const manifest=read('docs/qa/generator-final/manifest.json');
const primary=event.cases.primary, input=primary.input;
assert.equal(hash(sourceBytes),event.sourceEvidenceSha256);
assert.equal(hash(input),primary.inputSha256);
assert.equal(hash(input),hash({current:frozen.input.current,context:{log:frozen.input.log},options:frozen.input.options,analysis:frozen.analysis,today:frozen.today}));
assert.equal(hash(readFileSync(resolve(root,'docs/qa/generator-final/inputs.json'),'utf8')),manifest.inputFileSha256);
const m=Object.assign({},...await Promise.all(['domain/plan/adapt.ts','domain/plan/resolve.ts','domain/training/sessions/calc.ts','domain/training/adaptation/matching.ts','domain/training/prediction/index.ts','domain/training/execution.ts','domain/training/adaptation/evidence.ts','domain/training/adaptation/proposal.ts'].map(p=>import(pathToFileURL(resolve(root,'web/src',p))))));
function auditPlan(plan){
 const view=m.resolvePlan(plan.weeks,{alts:{},moves:{}}), matching=m.matchPlanRows(view.weeks,plan.pred), failures=[];
 const weeks=plan.weeks.map(w=>({w:w.w,start:w.start,deload:!!w.deload,taper:!!w.taper,km:+w.days.reduce((n,d)=>n+(d.km??0),0).toFixed(3),days:w.days.map(d=>{
  const r=matching.get(d.id),s=d.session,qs=m.deriveQSById([{...w,days:[d]}])[d.id];
  if(s){
   if(Math.abs(d.km-m.sessKm(s))>.051)failures.push({id:d.id,kind:'session-km'});
   if(d.desc!==m.sessDesc(s))failures.push({id:d.id,kind:'description'});
   if(!r||Math.abs(r.q-m.sessQKm(s))>.051||r.pt!==s.paceSec)failures.push({id:d.id,kind:'prediction'});
  }
  if(hash(qs)!==hash(plan.qs?.[d.id]))failures.push({id:d.id,kind:'QS'});
  return {...d,date:view.byId.get(d.id).date};
 })}));
 return {weeks:weeks.length,days:view.dated.length,runningDays:view.dated.filter(d=>d.km>0&&!d.rest).length,sessions:view.dated.filter(d=>d.session).length,strideDays:view.dated.filter(d=>d.strides).length,failures,dayReview:weeks};
}
const planAudits={};
for(const v of ['old','new']){
 assert.equal(hash(raw.versions[v].plan),raw.versions[v].sha256);
 planAudits[v]=auditPlan(m.adaptGeneratedPlan(clone(raw.versions[v].plan)));
}
const after=primary.versions.new.adjustment.result, view=m.resolvePlan(input.current.weeks,{alts:{},moves:{}}), afterView=m.resolvePlan(after.weeks,{alts:{},moves:{}});
const analysis=m.analyzeExecution({plan:view,today:input.today,log:input.context.log});
assert.equal(hash(analysis),hash(input.analysis));
const recommendation=m.recommendExecution(analysis);
const highEasy=view.dated.filter(d=>d.tag==='lako'&&input.context.log[d.id]?.rpe===8).map(d=>({id:d.id,date:d.date,km:input.context.log[d.id].km,rpe:8}));
assert.deepEqual(highEasy.map(d=>d.date),['2026-11-23','2026-11-25']);
const future=afterView.dated.filter(d=>d.date>input.today);
const immediate=future.filter(d=>d.date<'2026-12-07');
const addedVolume=immediate.filter(d=>(d.km??0)>(view.byId.get(d.id).km??0)+.001).map(d=>d.id);
const quality=immediate.filter(d=>d.session||d.finish||d.strides||['int','tempo','trka','lr'].includes(d.tag)).map(d=>d.id);
const protectedDays=view.dated.filter(d=>d.date<=input.today);
const beforeDays=new Map(input.current.weeks.flatMap(w=>w.days).map(d=>[d.id,d]));
const afterDays=new Map(after.weeks.flatMap(w=>w.days).map(d=>[d.id,d]));
const changedProtectedDays=protectedDays.filter(d=>hash(beforeDays.get(d.id))!==hash(afterDays.get(d.id))).map(d=>d.id);
const changedDates=view.dated.filter(d=>d.date!==afterView.byId.get(d.id)?.date).map(d=>d.id);
const week8=afterView.dated.filter(d=>d.date>='2026-11-30'&&d.date<'2026-12-07');
const ctx={today:input.today,plan:view,pred:input.current.pred,meta:input.current.meta,log:input.context.log,alts:{},vdotChain:[],tests:[]};
const evidence=m.fitnessEvidence(ctx), noMeasuredProposal=m.vdotProposal(ctx);
// Separate literal augmented historical control; the primary log is never regenerated.
const challengeCtx={...clone(frozen.positiveEvidenceChallenge.input),plan:view};
const challengeEvidence=m.fitnessEvidence(challengeCtx);
const unblocked=m.vdotProposal({...challengeCtx,positiveAdjustmentAllowed:true});
const blocked=m.vdotProposal({...challengeCtx,positiveAdjustmentAllowed:analysis.easyHighRpeCount<2});
const test=spawnSync('npm',['test','--','src/stores/executionActions.test.ts','-t','blocks faster work|active calendar recovery blocks faster work'],{cwd:resolve(root,'web'),encoding:'utf8'});
const recoveryWeeklyCaps=Object.entries(after.meta.fatigueRecovery.weekCapsKm).map(([start,cap])=>({start,cap,actual:+immediate.filter(d=>d.date>=start&&d.date<new Date(Date.parse(start+'T00:00:00Z')+7*86400000).toISOString().slice(0,10)).reduce((n,d)=>n+(d.km??0),0).toFixed(3)}));
const checks={literalSourceHash:true,literalNormalizedInputHash:true,inputFileHash:true,rawPlanHashes:true,analysisExactlyFrozen:true,highEasyCount:analysis.easyHighRpeCount===2,reduceRequiresReview:recommendation.kind==='reduce'&&recommendation.actionable&&recommendation.requiresConfirmation,noBreakInferred:analysis.daysSinceLastRun===0&&after.meta.athlete.breakWeeks===0,continuity24:after.meta.athlete.consistentWeeks===24,readinessFatigued:after.meta.athlete.currentReadiness==='fatigued',immediate11Days:immediate.length===11,noImmediateAddedVolume:addedVolume.length===0,noImmediateQuality:quality.length===0,week8Deload:after.weeks.find(w=>w.w===8).deload===true,week8WithinOldVolume:week8.reduce((n,d)=>n+(d.km??0),0)<=40.2+.001,recoveryWithinWeeklyCaps:recoveryWeeklyCaps.every(w=>w.actual<=w.cap+.001),protected45Days:protectedDays.length===45&&changedProtectedDays.length===0,all112DatesPreserved:changedDates.length===0&&afterView.dated.length===112,raceAndGoalAndRunDaysPreserved:['raceDate','goalSec','runDays'].every(k=>after.meta[k]===input.current.meta[k]),noInferredFitnessEvidence:evidence.measurements===0&&noMeasuredProposal===null,challenge3DistinctDays:challengeEvidence.measurements===3&&challengeEvidence.distinctDays===3,positiveControlFaster:!!unblocked?.faster&&unblocked.fasterCount>0,highEffortBlocksPositiveEvidence:blocked===null,productionGateTests:test.status===0,frozenBytesUnchanged:readFileSync(resolve(root,sourcePath),'utf8')===sourceBytes};
const result={id:'U03',scope:'Independent full plan/day review and literal final event verification. Separate positive-evidence control; no browser evidence.',sourceEvidenceSha256:hash(sourceBytes),inputSha256:hash(input),checks,analysis,recommendation,highEasy,rawAudits:planAudits,eventAudit:auditPlan(after),recoveryWeeklyCaps,immediateRecovery:immediate.map(d=>({id:d.id,date:d.date,beforeKm:view.byId.get(d.id).km,afterKm:d.km,tag:d.tag,quality:!!(d.session||d.finish||d.strides)})),challenge:{evidence:challengeEvidence,unblockedFasterCount:unblocked?.fasterCount,blockedProposal:blocked},productionGateTest:{exitCode:test.status,stdout:test.stdout,stderr:test.stderr},protection:{count:protectedDays.length,changedProtectedDays,changedDates,measuredEntries:Object.keys(input.context.pred??{}).length,locks:Object.keys(input.context.predLock??{}).length,manualAlts:Object.keys(input.context.alts??{}).length}};
writeFileSync(resolve(root,'docs/qa/generator-final/users/U03-findings.json'),JSON.stringify(result,null,2)+'\n');
assert(Object.values(checks).every(Boolean),JSON.stringify(checks));
assert.equal(result.rawAudits.old.failures.length,0);
assert.equal(result.rawAudits.new.failures.length,0);
assert.equal(result.eventAudit.failures.length,0);
console.log(JSON.stringify({checks,raw:Object.fromEntries(Object.entries(planAudits).map(([k,v])=>[k,{weeks:v.weeks,days:v.days,runningDays:v.runningDays,sessions:v.sessions,strideDays:v.strideDays,failures:v.failures.length}])),eventFailures:result.eventAudit.failures.length,challenge:result.challenge,productionGateTestExit:test.status}));
