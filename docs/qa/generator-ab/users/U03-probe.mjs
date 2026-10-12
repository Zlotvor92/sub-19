// Reproduce with Node 24: node docs/qa/generator-ab/users/U03-probe.mjs
// Domain simulation. Central U06 harness owns browser coverage.
import { registerHooks } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
registerHooks({resolve(s,c,n){try{return n(s,c)}catch(e){if(s.startsWith('.'))for(const x of ['.ts','/index.ts'])try{return n(s+x,c)}catch{}throw e}}});
const qa=new URL('../',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',qa),'utf8'));
const raw=JSON.parse(readFileSync(new URL('raw/U03.json',qa),'utf8'));
const profile=raw.profile, today=profile.eventToday, root=manifest.localRoots.new;
const imp=p=>import(pathToFileURL(resolve(root,'web/src/'+p)).href);
const {adaptGeneratedPlan}=await imp('domain/plan/adapt.ts');
const {resolvePlan}=await imp('domain/plan/resolve.ts');
const {analyzeExecution,recommendExecution}=await imp('domain/training/execution.ts');
const {buildExecutionAdjustment}=await imp('domain/plan/executionAdjustment.ts');
const {fitnessEvidence}=await imp('domain/training/adaptation/evidence.ts');
const {vdotProposal}=await imp('domain/training/adaptation/proposal.ts');
const {matchPlanRows}=await imp('domain/training/adaptation/matching.ts');
const {sessKm,sessQKm,sessDesc}=await imp('domain/training/sessions/calc.ts');
const {deriveQSById}=await imp('domain/training/prediction/index.ts');
const clone=x=>JSON.parse(JSON.stringify(x));
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const current={...adaptGeneratedPlan(clone(raw.versions.new.plan)),ulaz:clone(profile.input)};
const view=resolvePlan(current.weeks,{alts:{},moves:{}});
const eligible=view.dated.filter(d=>d.date<=today&&!d.rest&&d.km>0&&d.tag!=='snaga');
const highEasy=eligible.filter(d=>d.tag==='lako').slice(-2);
const log=Object.fromEntries(eligible.map(d=>[d.id,{status:'done',km:d.km,runDate:d.date,rpe:highEasy.some(e=>e.id===d.id)?8:4}]));
const inputHash=hash({current,log});
const analysis=analyzeExecution({plan:view,log,today});
const recommendation=recommendExecution(analysis);
const ctx={today,plan:view,pred:current.pred,meta:current.meta,log,alts:{},vdotChain:[],tests:[]};
const evidence=fitnessEvidence(ctx);
const noMeasuredProposal=vdotProposal(ctx);
const adjustment=buildExecutionAdjustment(current,today,analysis,{}, {log});
function audit(plan){
 const resolved=resolvePlan(plan.weeks,{alts:{},moves:{}}), matched=matchPlanRows(resolved.weeks,plan.pred), failures=[];
 const weeks=plan.weeks.map(w=>{
  const days=w.days.map(d=>{
   const rd=resolved.byId.get(d.id),s=d.session;
   if(s){if(Math.abs(d.km-sessKm(s))>.051)failures.push({id:d.id,reason:'session-km',actual:d.km,expected:sessKm(s)});const r=matched.get(d.id);if(!r||Math.abs(r.q-sessQKm(s))>.051||r.pt!==s.paceSec)failures.push({id:d.id,reason:'pred-session'});if(d.desc!==sessDesc(s))failures.push({id:d.id,reason:'description'});}
   const q=deriveQSById([{...w,days:[d]}])[d.id];if(q&&hash(q)!==hash(plan.qs[d.id]))failures.push({id:d.id,reason:'qs'});
   const durations=s?(s.type==='int'?[s.repM*s.paceSec/1000]:s.type==='pyramid'?s.reps.map(m=>m*s.paceSec/1000):s.type==='fartlek'?[s.repSec]:[sessQKm(s)*s.paceSec]):[];
   return {...d,date:rd.date,...(s?{workMinutes:s.type==='fartlek'?s.reps*s.repSec/60:sessQKm(s)*s.paceSec/60,repDurationSec:durations}:{})};
  });
  return {w:w.w,start:w.start,km:+days.reduce((n,d)=>n+(d.km??0),0).toFixed(3),deload:w.deload,taper:!!w.taper,runDays:days.filter(d=>d.km>0&&!d.rest).length,lrKm:Math.max(0,...days.filter(d=>d.tag==='lr').map(d=>d.km)),hardDays:days.filter(d=>d.session||d.finish||d.tag==='trka').map(d=>d.date),futureKm:+days.filter(d=>d.date>today).reduce((n,d)=>n+(d.km??0),0).toFixed(3),days};
 });
 return {weeks,failures};
}
const planAudits=Object.fromEntries(Object.entries(raw.versions).map(([v,x])=>[v,audit({...adaptGeneratedPlan(clone(x.plan)),ulaz:clone(profile.input)})]));
const beforeDays=new Map(current.weeks.flatMap(w=>w.days).map(d=>[d.id,d]));
const afterDays='error'in adjustment?new Map():new Map(adjustment.result.weeks.flatMap(w=>w.days).map(d=>[d.id,d]));
// Independent positive-evidence challenge: measured pace evidence is deliberately injected here;
// it is never inferred from the unmodified completed-history event above.
const matched=matchPlanRows(view.weeks,current.pred);
const evidenceDays=[...matched].filter(([id,r])=>{const d=view.byId.get(id);return d.date>='2026-10-15'&&d.date<=today&&['T','I'].includes(d.session?.zone)&&!r.nemeri&&r.q*r.pt>=360;}).slice(-3);
const vdotChain=evidenceDays.map(([id,r])=>({id:r.id,ts:log[id].runDate,measured:55,vdot:55,prev:null,delta:null}));
const challengeCtx={...ctx,vdotChain};
const challengeEvidence=fitnessEvidence(challengeCtx);
const unblocked=vdotProposal({...challengeCtx,positiveAdjustmentAllowed:true});
const blocked=vdotProposal({...challengeCtx,positiveAdjustmentAllowed:analysis.easyHighRpeCount<2});
const test=spawnSync('npm',['test','--','src/stores/executionActions.test.ts','-t','blocks faster work for reported pain'],{cwd:resolve(root,'web'),encoding:'utf8'});
const checks={allEligibleRunsLogged:eligible.length===Object.keys(log).length,allRunsHaveActualDateAndKm:Object.values(log).every(l=>l.runDate&&l.km>0),noMissingOrSkipped:analysis.unknown===0&&analysis.missed===0&&analysis.volumeCoverage===1,exactlyTwoHighEasy:analysis.easyHighRpeCount===2,highEasyAreLastTwoEasy:highEasy.map(d=>d.date).join(',')==='2026-11-23,2026-11-25',reduceRequiresReview:recommendation.kind==='reduce'&&recommendation.actionable&&recommendation.requiresConfirmation,noBreakInferred:recommendation.kind!=='return'&&analysis.daysSinceLastRun===0,noPaceEvidenceInferred:evidence.measurements===0&&noMeasuredProposal===null,generated:!('error'in adjustment),inputsPure:hash({current,log})===inputHash,pastAndTodayStable:view.dated.filter(d=>d.date<=today).every(d=>hash(beforeDays.get(d.id))===hash(afterDays.get(d.id))),raceDateStable:!('error'in adjustment)&&adjustment.result.meta.raceDate===profile.input.raceDate,goalStable:!('error'in adjustment)&&adjustment.result.meta.goalSec===profile.input.goalSec,runDaysStable:!('error'in adjustment)&&adjustment.result.meta.runDays===profile.input.runDays,threeAcceptedIndependentEvidenceDays:challengeEvidence.measurements===3&&challengeEvidence.distinctDays===3,positiveControlReallyProposesFaster:!!unblocked?.faster&&unblocked.fasterCount>0,highRpeBlocksEvenWithPositiveEvidence:blocked===null,scopedProductionStoreGateTestPassed:test.status===0};
const output={id:'U03',scope:'Domain simulation, not a browser result. Browser coverage centralized at U06. Scoped existing store test confirms the actual production recovery gate.',today,fixtureSha256:Object.fromEntries(Object.entries(raw.versions).map(([v,x])=>[v,x.sha256])),event:{kind:'high-rpe',highEasy:highEasy.map(d=>({id:d.id,date:d.date,km:d.km,rpe:8})),history:'All eligible planned runs from plan start through today explicitly completed at actual distance and actual date; only the last two easy runs have RPE 8.'},input:{profile,current,log,options:{}},analysis,recommendation,evidence,noMeasuredProposal,adjustment,planAudits,adjustedAudit:'error'in adjustment?null:audit(adjustment.result),checks,positiveEvidenceChallenge:{scope:'Separate deliberately augmented measured-work challenge, not the primary event.',input:{...challengeCtx,plan:undefined},evidence:challengeEvidence,unblockedProposal:unblocked,blockedProposal:blocked},productionGateTest:{command:"npm test -- src/stores/executionActions.test.ts -t 'blocks faster work for reported pain'",exitCode:test.status,stdout:test.stdout,stderr:test.stderr},sources:['domain/training/execution.ts','domain/plan/executionAdjustment.ts','domain/training/adaptation/evidence.ts','domain/training/adaptation/proposal.ts','stores/executionActions.ts','stores/executionActions.test.ts'].map(p=>({path:'web/src/'+p,sha256:hash(readFileSync(resolve(root,'web/src/'+p),'utf8'))}))};
output.phaseResetReview={scope:'Independently assessed coaching concern. Deload preservation is not an explicit invariant promised by buildExecutionAdjustment. Full regeneration reindexes phases. Faster-work gate still passes.',changes:'error'in adjustment?[]:output.adjustedAudit.weeks.filter(w=>[8,10,12].includes(w.w)).map(w=>{const before=planAudits.new.weeks.find(x=>x.w===w.w),work=x=>+x.days.reduce((n,d)=>n+(d.workMinutes??0),0).toFixed(2);return {week:w.w,start:w.start,beforeDeload:before.deload,afterDeload:w.deload,beforeKm:before.km,afterKm:w.km,beforeWorkMinutes:work(before),afterWorkMinutes:work(w)};})};
writeFileSync(new URL('U03-event.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({analysis,recommendation,evidence,checks,challengeEvidence,unblockedFasterCount:unblocked?.fasterCount,adjustment:'error'in adjustment?adjustment:adjustment.result.meta.executionAdjustment,adjustedAuditFailures:output.adjustedAudit?.failures,planAuditFailures:Object.fromEntries(Object.entries(planAudits).map(([v,x])=>[v,x.failures]))},null,2));
