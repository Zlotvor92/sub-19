// Reproduce: node docs/qa/generator-ab/users/U04-probe.mjs (Node 24).
// Domain simulation only. Browser and store lifecycle coverage is owned by U06.
import { registerHooks } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
registerHooks({resolve(s,c,n){try{return n(s,c)}catch(e){if(s.startsWith('.'))for(const x of ['.ts','/index.ts'])try{return n(s+x,c)}catch{}throw e}}});
const qa=new URL('../',import.meta.url),manifest=JSON.parse(readFileSync(new URL('manifest.json',qa),'utf8'));
const profile=JSON.parse(readFileSync(new URL('inputs.json',qa),'utf8')).find(p=>p.id==='U04');
const raw=JSON.parse(readFileSync(new URL('raw/U04.json',qa),'utf8'));
const root=manifest.localRoots.new,imp=p=>import(pathToFileURL(resolve(root,'web/src/'+p)).href);
const {adaptGeneratedPlan}=await imp('domain/plan/adapt.ts');
const {resolvePlan}=await imp('domain/plan/resolve.ts');
const {analyzeExecution,recommendExecution}=await imp('domain/training/execution.ts');
const {buildExecutionAdjustment}=await imp('domain/plan/executionAdjustment.ts');
const {matchPlanRows}=await imp('domain/training/adaptation/matching.ts');
const {sessKm,sessQKm,sessDesc}=await imp('domain/training/sessions/calc.ts');
const {deriveQSById}=await imp('domain/training/prediction/index.ts');
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)??'undefined').digest('hex');
const clone=x=>JSON.parse(JSON.stringify(x)),round=x=>Math.round(x*10)/10,today=profile.eventToday;
const current={...adaptGeneratedPlan(clone(raw.versions.new.plan)),ulaz:clone(profile.input)};
const context={log:{},alts:{},moves:{},pred:{},predLock:{}};
const view=resolvePlan(current.weeks,context),matched=matchPlanRows(view.weeks,current.pred);
for(const d of view.dated.filter(d=>d.date<=today&&!d.rest&&d.km>0&&d.tag!=='snaga')){
 if(d.date>='2026-11-19')context.log[d.id]={status:'skip',ts:d.date+'T18:00:00Z'};
 else {const delta=d.dow===0?-0.1:d.dow===4?0.1:0;context.log[d.id]={status:'done',km:round(d.km+delta),runDate:d.date,ts:d.date+'T18:00:00Z',rpe:d.session?6:4};const row=matched.get(d.id);if(row){context.pred[row.id]=d.session.paceSec+2;context.predLock[row.id]=true;}}
}
const analysis=analyzeExecution({plan:view,log:context.log,today});
const recommendation=recommendExecution(analysis);
// Reported repeatable pre-break base, corroborated by completed W3 (29.5 km) and W5 (32.7 km); W6 is only partial due to the break.
const options={breakDays:7,weeklyKm:30,recentLongRunKm:9.2};
const inputHash=hash({current,context,analysis,options});
const adjustment=buildExecutionAdjustment(current,today,analysis,options,context);
const beforeDays=new Map(current.weeks.flatMap(w=>w.days).map(d=>[d.id,d]));
function audit(plan,ctx=context){
 const v=resolvePlan(plan.weeks,ctx),m=matchPlanRows(v.weeks,plan.pred),failures=[];
 const weeks=plan.weeks.map(w=>({w:w.w,start:w.start,km:round(w.days.reduce((n,d)=>n+(d.km??0),0)),lrKm:Math.max(0,...w.days.filter(d=>d.tag==='lr').map(d=>d.km)),deload:w.deload,taper:!!w.taper,focus:w.focus,futureKm:round(w.days.filter(d=>v.byId.get(d.id).date>today).reduce((n,d)=>n+(d.km??0),0)),sessions:w.days.filter(d=>d.session).map(d=>({id:d.id,date:v.byId.get(d.id).date,kind:d.session.kind,zone:d.session.zone,qKm:sessQKm(d.session),paceSec:d.session.paceSec,restSec:d.session.restSec,desc:d.desc}))}));
 for(const w of plan.weeks)for(const d of w.days)if(d.session){const row=m.get(d.id);if(Math.abs(d.km-sessKm(d.session))>.051)failures.push({id:d.id,reason:'session-km'});if(!row||Math.abs(row.q-sessQKm(d.session))>.051||row.pt!==d.session.paceSec)failures.push({id:d.id,reason:'matched-pred'});if(d.desc!==sessDesc(d.session))failures.push({id:d.id,reason:'description'});const q=deriveQSById([{...w,days:[d]}])[d.id];if(hash(q)!==hash(plan.qs[d.id]))failures.push({id:d.id,reason:'qs'});}
 return {weeks,failures};
}
const afterDays='error'in adjustment?new Map():new Map(adjustment.result.weeks.flatMap(w=>w.days).map(d=>[d.id,d]));
const checks={historyComplete:analysis.unknown===0&&analysis.volumeCoverage===1,confirmedGapExactlySevenDays:analysis.daysSinceLastRun===7&&analysis.lastRunDate==='2026-11-18',returnOffered:recommendation.kind==='return'&&recommendation.requiresConfirmation,generated:!('error'in adjustment),inputsPure:inputHash===hash({current,context,analysis,options}),pastAndTodayStable:view.dated.filter(d=>d.date<=today).every(d=>hash(beforeDays.get(d.id))===hash(afterDays.get(d.id))),logAndMeasurementsStable:inputHash===hash({current,context,analysis,options})};
if(!('error'in adjustment)){
 const out=resolvePlan(adjustment.result.weeks,context);checks.calendarIdentitiesStable=view.dated.every(d=>out.byId.get(d.id)?.date===d.date);checks.raceDateStable=adjustment.result.meta.raceDate===profile.input.raceDate;checks.raceDayStable=out.dated.find(d=>d.tag==='trka')?.date===profile.input.raceDate;checks.reportedStartingKmCorrect=adjustment.result.meta.executionAdjustment.startingKm===25.5;checks.firstTwoCalendarWeeksEasy=out.dated.filter(d=>d.date>today&&d.date<='2026-12-06').every(d=>!d.session&&!d.finish&&!d.strides);checks.noProjectedFitnessGain=adjustment.result.meta.vdotGoal===adjustment.result.meta.vdot0;checks.measuredMatchedRowsStable=[...matched].filter(([id])=>context.log[id]?.status==='done').every(([id,row])=>adjustment.result.pred.some(r=>hash(r)===hash(row))&&matchPlanRows(out.weeks,adjustment.result.pred).get(id)?.id===row.id);
}
// Separate challenge for already completed future slot, manual future session, and move to past.
const protectedPlan=clone(current),protectedContext=clone(context);
protectedContext.log.g8d3={status:'done',km:5.9,runDate:'2026-11-17',rpe:4};
protectedContext.moves.g7d7='2026-11-24';
const manual=protectedPlan.weeks.flatMap(w=>w.days).find(d=>d.id==='g9d3');manual.session.wuKm=3.3;manual.session.overrides.wuKm=true;manual.km=sessKm(manual.session);manual.desc=sessDesc(manual.session);
const protectedHash=hash({protectedPlan,protectedContext});
const preserved=buildExecutionAdjustment(protectedPlan,today,analysis,options,protectedContext);
const pd0=new Map(protectedPlan.weeks.flatMap(w=>w.days).map(d=>[d.id,d])),pd1='error'in preserved?new Map():new Map(preserved.result.weeks.flatMap(w=>w.days).map(d=>[d.id,d]));
const pv=resolvePlan(protectedPlan.weeks,protectedContext);
const protectionChecks={generated:!('error'in preserved),inputsPure:protectedHash===hash({protectedPlan,protectedContext}),effectivePastStable:pv.dated.filter(d=>d.date<=today).every(d=>hash(pd0.get(d.id))===hash(pd1.get(d.id))),futureCompletedStable:hash(pd0.get('g8d3'))===hash(pd1.get('g8d3')),manualSessionStable:hash(pd0.get('g9d3'))===hash(pd1.get('g9d3')),manualConflictWarning:!('error'in preserved)&&preserved.result.meta.dayWarnings.some(x=>x.includes('2026-12-09'))};
const output={id:'U04',scope:'Synthetic athlete domain simulation only; no human actions, browser or store lifecycle claims.',today,fixtureSha256:{old:raw.versions.old.sha256,new:raw.versions.new.sha256},event:{confirmedBreakFrom:'2026-11-19',confirmedBreakThrough:today,cutoffInclusive:today,lastRun:'2026-11-18',history:'All eligible scheduled runs from start through cutoff explicitly recorded; before break actual km vary by -0.1/+0.1 km on Monday/Friday; last seven days explicitly skipped.',reportedPreBreakBaseKm:30,reportedRepeatableLongRunKm:9.2},input:{profile,current,context,options},analysis,recommendation,adjustment,checks,audit:'error'in adjustment?null:audit(adjustment.result),protection:{input:{plan:protectedPlan,context:protectedContext,analysis,options},output:preserved,checks:protectionChecks},sources:['domain/plan/resolve.ts','domain/training/execution.ts','domain/plan/executionAdjustment.ts','domain/plan/future.ts','domain/plan/returnGrowth.ts'].map(p=>({path:'web/src/'+p,sha256:hash(readFileSync(resolve(root,'web/src/'+p),'utf8'))}))};
writeFileSync(new URL('U04-event.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({analysis,recommendation,checks,protectionChecks,audit:output.audit,notes:adjustment.notes},null,2));
