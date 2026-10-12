// Node 24: node docs/qa/generator-ab/users/U08-probe.mjs
// U08-only synthetic domain simulation. No browser, UI, backend or store writes.
import { registerHooks } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
registerHooks({resolve(s,c,n){try{return n(s,c)}catch(e){if(s.startsWith('.'))for(const x of ['.ts','/index.ts'])try{return n(s+x,c)}catch{}throw e}}});
const qa=new URL('../',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',qa),'utf8'));
const profile=JSON.parse(readFileSync(new URL('inputs.json',qa),'utf8')).find(p=>p.id==='U08');
const raw=JSON.parse(readFileSync(new URL('raw/U08.json',qa),'utf8'));
const imp=(p,k='new')=>import(pathToFileURL(resolve(manifest.localRoots[k],'web/src/'+p)).href);
const {adaptGeneratedPlan}=await imp('domain/plan/adapt.ts');
const {resolvePlan}=await imp('domain/plan/resolve.ts');
const {analyzeExecution,recommendExecution}=await imp('domain/training/execution.ts');
const {buildExecutionAdjustment,RETURN_POLICY}=await imp('domain/plan/executionAdjustment.ts');
const {matchPlanRows}=await imp('domain/training/adaptation/matching.ts');
const {sessKm,sessQKm,sessDesc}=await imp('domain/training/sessions/calc.ts');
const {deriveQSById}=await imp('domain/training/prediction/index.ts');
const {paceForZone}=await imp('domain/training/vdot/paceForZone.ts');
const {addDays,diffDays,mondayOnOrBefore}=await imp('domain/date/index.ts');
const {generatePlan}=await imp('domain/training/generator/generatePlan.ts');
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)??'undefined').digest('hex');
const clone=x=>JSON.parse(JSON.stringify(x)),r=x=>Math.round(x*100)/100;
const roundKm=x=>Math.round(x*10)/10;
function audit(plan,context={alts:{},moves:{}}){
 const view=resolvePlan(plan.weeks,context),matched=matchPlanRows(view.weeks,plan.pred),failures=[];
 const weeks=plan.weeks.map(w=>{
  const days=w.days.map(d=>{
   const s=d.session, q=s?sessQKm(s):0, work=s?(s.type==='fartlek'?s.reps*s.repSec:q*s.paceSec)/60:0;
   const fm=d.finish?d.finish.km*d.finish.paceSec/60:0;
   if(s){const row=matched.get(d.id);if(Math.abs(sessKm(s)-d.km)>.051)failures.push({week:w.w,day:d.dow+1,id:d.id,reason:'session-km',actual:d.km,expected:sessKm(s)});if(!row||Math.abs(row.q-q)>.051||row.pt!==s.paceSec)failures.push({week:w.w,day:d.dow+1,id:d.id,reason:'prediction-row'});if(hash(deriveQSById([{...w,days:[d]}])[d.id])!==hash(plan.qs[d.id]))failures.push({week:w.w,day:d.dow+1,id:d.id,reason:'qs'});}
   return {id:d.id,date:view.byId.get(d.id).date,dow:d.dow+1,tag:d.tag??'rest',km:d.km??0,mlr:!!d.mlr,rest:!!d.rest,strides:d.strides??null,finish:d.finish??null,session:s??null,qKm:r(q),sessionWorkMinutes:r(work),finishWorkMinutes:r(fm),totalWorkMinutes:r(work+fm),desc:d.desc};
  });
  return {w:w.w,start:w.start,km:roundKm(days.reduce((n,d)=>n+d.km,0)),deload:!!w.deload,taper:!!w.taper,focus:w.focus,runDays:days.filter(d=>d.km>0&&!d.rest).length,lrKm:Math.max(0,...days.filter(d=>d.tag==='lr'&&!d.mlr).map(d=>d.km)),hardDows:days.filter(d=>d.session||d.finish||d.tag==='trka').map(d=>d.dow),hardDates:days.filter(d=>d.session||d.finish||d.tag==='trka').map(d=>d.date),workMinutes:r(days.reduce((n,d)=>n+d.totalWorkMinutes,0)),days};
 });
 return {weeks,failures};
}
const baselineAudits={},reproduced={};
for(const key of ['old','new']){
 const gen=await imp('domain/training/generator/generatePlan.ts',key);const p=gen.generatePlan(clone(profile.input));
 reproduced[key]={frozenHash:raw.versions[key].sha256,rerunHash:hash(p),matches:hash(p)===raw.versions[key].sha256};
 baselineAudits[key]=audit({...adaptGeneratedPlan(clone(p)),ulaz:clone(profile.input)});
}
function scenario(today,breakFrom,label){
 const current={...adaptGeneratedPlan(clone(raw.versions.new.plan)),ulaz:clone(profile.input)};
 const context={log:{},alts:{},moves:{},pred:{},predLock:{}};
 const view=resolvePlan(current.weeks,context),matched=matchPlanRows(view.weeks,current.pred);
 for(const d of view.dated.filter(d=>d.date<=today&&!d.rest&&d.km>0&&d.tag!=='snaga')){
  if(d.date>=breakFrom)context.log[d.id]={status:'skip',ts:d.date+'T18:00:00Z'};
  else{const actual=roundKm(d.km+(d.dow===0?-0.2:d.dow===4?0.1:0));context.log[d.id]={status:'done',km:actual,runDate:d.date,ts:d.date+'T18:00:00Z',rpe:d.session?6:4};const row=matched.get(d.id);if(row){context.pred[row.id]=d.session.paceSec+2;context.predLock[row.id]=true;}}
 }
 const analysis=analyzeExecution({plan:view,log:context.log,today}),recommendation=recommendExecution(analysis);
 // Confirmed repeatable pre-break base from frozen 24-week history; not the zero post-break week.
 const options={breakDays:14,weeklyKm:55,recentLongRunKm:16};
 const beforeHash=hash({current,context,analysis,options});
 const adjustment=buildExecutionAdjustment(current,today,analysis,options,context);
 const afterHash=hash({current,context,analysis,options});
 const rejected='error'in adjustment;
 const checks={historyComplete:analysis.unknown===0&&analysis.statusCoverage===1&&analysis.volumeCoverage===1,exact14DayGap:analysis.daysSinceLastRun===14&&analysis.lastRunDate===addDays(breakFrom,-1),returnRequiresConfirmation:recommendation.kind==='return'&&recommendation.requiresConfirmation,inputsUnchanged:beforeHash===afterHash,noResultWhenRejected:!rejected||!('result'in adjustment),raceDateInputUnchanged:current.meta.raceDate===profile.input.raceDate};
 let adjustedAudit=null;
 if(!rejected){
  adjustedAudit=audit(adjustment.result,context);
  const av=resolvePlan(adjustment.result.weeks,context),afterById=new Map(adjustment.result.weeks.flatMap(w=>w.days).map(d=>[d.id,d])),beforeById=new Map(current.weeks.flatMap(w=>w.days).map(d=>[d.id,d]));
  const easyEnd=addDays(mondayOnOrBefore(addDays(today,1)),RETURN_POLICY.medium.easyWeeks*7-1);
  Object.assign(checks,{pastAndTodayStable:view.dated.filter(d=>d.date<=today).every(d=>hash(beforeById.get(d.id))===hash(afterById.get(d.id))),calendarIdentitiesStable:view.dated.every(d=>av.byId.get(d.id)?.date===d.date),raceDateStable:adjustment.result.meta.raceDate===profile.input.raceDate&&av.dated.find(d=>d.tag==='trka')?.date===profile.input.raceDate,startingKmCorrect:adjustment.result.meta.executionAdjustment.startingKm===38.5,firstThreeCalendarWeeksEasy:av.dated.filter(d=>d.date>today&&d.date<=easyEnd).every(d=>!d.session&&!d.finish&&!d.strides),measuredRowsStable:[...matched].filter(([id])=>context.log[id]?.status==='done').every(([,row])=>adjustment.result.pred.some(r=>hash(r)===hash(row))),noInventedFitnessGain:adjustment.result.meta.vdotGoal===adjustment.result.meta.vdot0,easyReturnTextOmitsStrides:av.dated.filter(d=>d.date>today&&d.date<=easyEnd).every(d=>!(/ubrzanja|sprint|brzo/.test(d.desc??''))),easyWeekHeadingsReflectSessions:adjustedAudit.weeks.filter(w=>w.start>=addDays(mondayOnOrBefore(addDays(today,1)),7)&&w.start<=easyEnd).every(w=>w.days.some(d=>d.session)||!(/Fartlek|Intervali|Tempo/.test(w.focus)))});
 }
 return {label,today,breakFrom,breakThrough:today,cutoffInclusive:true,confirmedBreakDays:14,reportedBaseBasis:'Frozen synthetic profile reports 55 km/week, 16 km repeatable long run and 24 consistent weeks before the interruption. Actual completed prescribed sessions have explicit km with -0.2 km Monday/+0.1 km Friday variation; no running during interruption, eligible slots explicitly skipped.',input:{profile,current,context,options},analysis,recommendation,adjustment,checks,inputHashBefore:beforeHash,inputHashAfter:afterHash,remainingDays:diffDays(today,profile.input.raceDate),newCycleCalendarWeeks:Math.floor(diffDays(mondayOnOrBefore(addDays(today,1)),profile.input.raceDate)/7)+1,adjustedAudit};
}
const event=scenario(profile.eventToday,'2026-11-12','PRIMARY frozen event date: confirmed 14-day return, production gate respected');
const earlierControlled=scenario('2026-10-28','2026-10-15','SUPPLEMENTAL controlled earlier date: separate simulation, not a substitute for primary event');
const output={id:'U08',scope:'Independent synthetic experienced HM high-base user review. Actual production domain APIs; no browser, UI, backend, watch, store application or human-outcome claims.',profile,manifest,reproduced,baselineAudits,event,earlierControlled,raceActivationPaceReference:{vdot:48.2,currentFitnessR:paceForZone(48.2,'R'),currentFitnessT:paceForZone(48.2,'T'),actual:raw.versions.new.plan.weeks[13].days[4].session},sourceHashes:['domain/training/execution.ts','domain/plan/executionAdjustment.ts','domain/plan/future.ts','domain/plan/returnGrowth.ts','domain/training/distances/qualityDose.ts','domain/training/distances/profile21k.ts'].map(p=>({path:'web/src/'+p,sha256:hash(readFileSync(resolve(manifest.localRoots.new,'web/src/'+p),'utf8'))}))};
writeFileSync(new URL('U08-event.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({id:'U08',reproduced,baselineFailures:Object.fromEntries(Object.entries(baselineAudits).map(([k,v])=>[k,v.failures])),primary:{analysis:event.analysis,recommendation:event.recommendation,adjustment:event.adjustment,checks:event.checks,calendarWeeks:event.newCycleCalendarWeeks},earlier:{analysis:earlierControlled.analysis,recommendation:earlierControlled.recommendation,checks:earlierControlled.checks,adjustmentError:earlierControlled.adjustment.error,auditFailures:earlierControlled.adjustedAudit?.failures,weeks:earlierControlled.adjustedAudit?.weeks.map(({days,...w})=>w)}},null,2));
