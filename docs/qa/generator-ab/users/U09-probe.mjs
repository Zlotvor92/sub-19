// Reproduce: node docs/qa/generator-ab/users/U09-probe.mjs (Node 24).
// Production domain only. Browser/store/UI/watch evidence belongs to U06.
import {registerHooks} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
registerHooks({resolve(s,c,n){try{return n(s,c)}catch(e){if(s.startsWith('.'))for(const x of ['.ts','/index.ts'])try{return n(s+x,c)}catch{}throw e}}});
const qa=new URL('../',import.meta.url), manifest=JSON.parse(readFileSync(new URL('manifest.json',qa),'utf8'));
const raw=JSON.parse(readFileSync(new URL('raw/U09.json',qa),'utf8'));
const profile=JSON.parse(readFileSync(new URL('inputs.json',qa),'utf8')).find(p=>p.id==='U09');
const root=manifest.localRoots.new, imp=p=>import(pathToFileURL(resolve(root,'web/src/'+p)).href);
const [{adaptGeneratedPlan},{resolvePlan},{analyzeExecution,recommendExecution},{buildExecutionAdjustment},{matchPlanRows},{sessKm,sessQKm,sessDesc},{derivePred,deriveQSById}]=await Promise.all(['domain/plan/adapt.ts','domain/plan/resolve.ts','domain/training/execution.ts','domain/plan/executionAdjustment.ts','domain/training/adaptation/matching.ts','domain/training/sessions/calc.ts','domain/training/prediction/index.ts'].map(imp));
const clone=x=>JSON.parse(JSON.stringify(x)), hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)??'undefined').digest('hex');
const today=profile.eventToday, lastRun='2026-11-11', options={breakDays:14,weeklyKm:profile.input.weeklyKm,recentLongRunKm:profile.input.recentLongRunKm};
const current={...adaptGeneratedPlan(clone(raw.versions.new.plan)),ulaz:clone(profile.input)};
const context={log:{},alts:{},moves:{},pred:{},predLock:{}};
const view=resolvePlan(current.weeks,context);
const eligible=view.dated.filter(d=>d.date<=today&&!d.rest&&d.km>0&&d.tag!=='snaga');
for(const d of eligible)context.log[d.id]=d.date<=lastRun?{status:'done',km:d.km,sec:Math.round(d.km*(d.session?.paceSec??349)),runDate:d.date,rpe:d.session?6:4}:{status:'skip'};
function audit(plan,ctx={alts:{},moves:{}}){
 const v=resolvePlan(plan.weeks,ctx),match=matchPlanRows(v.weeks,plan.pred),failures=[];
 const weeks=plan.weeks.map(w=>{
  const days=w.days.map(d=>{const s=d.session,rd=v.byId.get(d.id),q=s?sessQKm(s):0;
   if(s){if(Math.abs(sessKm(s)-d.km)>.051)failures.push({id:d.id,reason:'session-km',expected:sessKm(s),actual:d.km});const r=match.get(d.id);if(!r||Math.abs(r.q-q)>.051||r.pt!==s.paceSec)failures.push({id:d.id,reason:'prediction-session',expected:{q,pace:s.paceSec},actual:r??null});if(d.desc!==sessDesc(s))failures.push({id:d.id,reason:'description',expected:sessDesc(s),actual:d.desc});const derived=deriveQSById([{...w,days:[d]}])[d.id];if(hash(derived)!==hash(plan.qs[d.id]))failures.push({id:d.id,reason:'qs'});}
   return {...d,date:rd.date,displayDow:d.dow+1,workKm:q,workMinutes:s?+(s.type==='fartlek'?s.reps*s.repSec/60:q*s.paceSec/60).toFixed(2):0};});
  return {w:w.w,start:w.start,km:+days.reduce((n,d)=>n+(d.km??0),0).toFixed(3),deload:!!w.deload,taper:!!w.taper,runDays:days.filter(d=>d.km>0&&!d.rest).length,lrKm:Math.max(0,...days.filter(d=>d.tag==='lr'&&!d.mlr).map(d=>d.km)),lrMinutes:+(Math.max(0,...days.filter(d=>d.tag==='lr'&&!d.mlr).map(d=>d.km))*357/60).toFixed(1),hardDates:days.filter(d=>d.session||d.finish||d.tag==='trka').map(d=>d.date),workMinutes:+days.reduce((n,d)=>n+d.workMinutes,0).toFixed(2),futureKm:+days.filter(d=>d.date>today).reduce((n,d)=>n+(d.km??0),0).toFixed(3),days};
 });return {weeks,failures};
}
function checks(before,result,ctx){
 if('error'in result)return {generated:false,error:result.error};
 const b=new Map(before.weeks.flatMap(w=>w.days).map(d=>[d.id,d])),a=new Map(result.result.weeks.flatMap(w=>w.days).map(d=>[d.id,d])),v=resolvePlan(before.weeks,ctx);
 const rows=new Map(result.result.pred.map(r=>[r.id,r])),match=matchPlanRows(resolvePlan(before.weeks,{alts:{},moves:ctx.moves}).weeks,before.pred);
 const protectedIds=v.dated.filter(d=>d.date<=today||ctx.log[d.id]?.status==='done').map(d=>d.id);
 const protectedRows=[...match].filter(([id,r])=>protectedIds.includes(id)||ctx.pred[r.id]!=null||ctx.predLock[r.id]).map(([,r])=>r);
 return {generated:true,pastAndCompletedCount:protectedIds.length,pastAndCompletedChanged:protectedIds.filter(id=>hash(b.get(id))!==hash(a.get(id))),protectedPredictionChanged:protectedRows.filter(r=>hash(r)!==hash(rows.get(r.id))).map(r=>r.id),raceDateStable:result.result.meta.raceDate===profile.input.raceDate,goalStable:result.result.meta.goalSec===profile.input.goalSec,runDaysStable:result.result.meta.runDays===4,startingKm21:result.result.meta.executionAdjustment.startingKm===21,unchangedFitness:result.result.meta.vdot0===before.meta.vdot0&&result.result.meta.vdotGoal===before.meta.vdotGoal,firstThreeFreshWeeksEasy:result.result.weeks.filter(w=>w.start>='2026-11-23'&&w.start<='2026-12-07').flatMap(w=>w.days).filter(d=>v.byId.get(d.id).date>today).every(d=>!d.session&&!d.finish&&!d.strides),futureChanges:result.result.meta.futureChanges};
}
const inputHash=hash({current,context}),analysis=analyzeExecution({plan:view,today,log:context.log}),recommendation=recommendExecution(analysis),adjustment=buildExecutionAdjustment(current,today,analysis,options,context);
const primary=checks(current,adjustment,context);Object.assign(primary,{allHistoryThroughCutoffExplicit:eligible.length===Object.keys(context.log).length,historyRecords:Object.keys(context.log).length,allDoneHaveActualKmAndDate:Object.values(context.log).filter(l=>l.status==='done').every(l=>l.km>0&&l.runDate),noUnknown:analysis.unknown===0,breakConfirmedAndLastRun14Days:analysis.daysSinceLastRun===14&&analysis.lastRunDate===lastRun,returnRequiresConfirmation:recommendation.kind==='return'&&recommendation.requiresConfirmation&&!recommendation.actionable,inputsPure:hash({current,context})===inputHash});
if(!('error'in adjustment)){let established=21;primary.returnGrowth=adjustment.result.weeks.filter(w=>w.start>'2026-11-23'&&w.start<'2027-02-22').map(w=>{const km=+w.days.reduce((n,d)=>n+(d.km??0),0).toFixed(1),limit=+(established*1.08).toFixed(2),check={w:w.w,km,limit,withinCeiling:km<=limit+.1,deload:!!w.deload,taper:!!w.taper};if(!w.deload&&!w.taper)established=km;return check;});primary.returnGrowthAllWithinCeiling=primary.returnGrowth.every(w=>w.withinCeiling);}
// Separate protection challenge: seed previously adjusted past, manual future,
// early-completed future, moved past, and measured/locked future prescriptions.
const protectedPlan=clone(current),protectedContext=clone(context),pd=new Map(protectedPlan.weeks.flatMap(w=>w.days).map(d=>[d.id,d]));
function refresh(id){const d=pd.get(id),w=protectedPlan.weeks.find(w=>w.days.includes(d));d.km=sessKm(d.session);d.desc=sessDesc(d.session);const row=matchPlanRows(resolvePlan(protectedPlan.weeks,{alts:{},moves:{}}).weeks,protectedPlan.pred).get(id);if(row)Object.assign(row,derivePred([{...w,days:[d]}],protectedPlan.meta.raceDistM,protectedPlan.meta)[0]);Object.assign(protectedPlan.qs,deriveQSById([{...w,days:[d]}]));}
pd.get('g5d3').session.paceSec=295;refresh('g5d3');
pd.get('g9d3').session.wuKm=3.7;pd.get('g9d3').session.overrides.wuKm=true;refresh('g9d3');
pd.get('g10d3').session.paceSec=295;refresh('g10d3');
const measured=matchPlanRows(resolvePlan(protectedPlan.weeks,{alts:{},moves:{}}).weeks,protectedPlan.pred).get('g10d3');protectedContext.pred[measured.id]=295;protectedContext.predLock[measured.id]=true;
protectedContext.alts.g8d5={tag:'lako',km:4.2,desc:'U09 manual future easy 4.2 km'};
protectedContext.log.g9d5={status:'done',km:pd.get('g9d5').km,sec:Math.round(pd.get('g9d5').km*349),runDate:lastRun,rpe:4};
pd.get('g11d7').km+=0.4;pd.get('g11d7').desc+=' · prior adjusted LR';protectedContext.moves.g11d7='2026-11-24';protectedContext.moves.g7d2='2026-12-27'; // Swap the occupied strength slot out so resolvePlan accepts the move.
const challengeHash=hash({protectedPlan,protectedContext}),protectedView=resolvePlan(protectedPlan.weeks,protectedContext),protectedAnalysis=analyzeExecution({plan:protectedView,today,log:protectedContext.log}),protectedAdjustment=buildExecutionAdjustment(protectedPlan,today,protectedAnalysis,options,protectedContext),protectionChecks=checks(protectedPlan,protectedAdjustment,protectedContext);
if(!('error'in protectedAdjustment)){const after=new Map(protectedAdjustment.result.weeks.flatMap(w=>w.days).map(d=>[d.id,d]));protectionChecks.days=Object.fromEntries(['g5d3','g9d3','g10d3','g8d5','g9d5','g11d7'].map(id=>[id,{stable:hash(pd.get(id))===hash(after.get(id)),before:pd.get(id),after:after.get(id)}]));protectionChecks.measuredRowStable=protectedAdjustment.result.pred.some(r=>hash(r)===hash(measured));const resolvedAfter=resolvePlan(protectedAdjustment.result.weeks,protectedContext);protectionChecks.resolvedManualAltStable=hash(protectedView.byId.get('g8d5'))===hash(resolvedAfter.byId.get('g8d5'));protectionChecks.movedPastDateStable=resolvedAfter.byId.get('g11d7').date==='2026-11-24';}
protectionChecks.inputsPure=challengeHash===hash({protectedPlan,protectedContext});
const output={id:'U09',scope:'Independent synthetic user and production domain simulation; not blind, human, browser, backend, store lifecycle or watch QA. U06 owns centralized browser coverage.',profile,fixtureSha256:Object.fromEntries(Object.entries(raw.versions).map(([k,v])=>[k,v.sha256])),history:'Every eligible prescribed run from 2026-10-12 through 2026-11-25 explicitly logged. Done at actual km/date through 2026-11-11; all scheduled running from Nov 12 through Nov 25 explicitly skipped. Confirmed 14-day break. Reported repeatable pre-break base 30 km and LR 10 km reused explicitly, not inferred from prescribed loads.',input:{current,context,options,today},analysis,recommendation,adjustment,checks:primary,planAudits:Object.fromEntries(Object.entries(raw.versions).map(([k,v])=>[k,audit({...adaptGeneratedPlan(clone(v.plan)),ulaz:clone(profile.input)})])),adjustedAudit:'error'in adjustment?null:audit(adjustment.result),protection:{scope:'Independent seeded preservation challenge, not actual primary history; manual/locked future days may conflict with return policy and must remain reviewable.',input:{current:protectedPlan,context:protectedContext,options,today},analysis:protectedAnalysis,adjustment:protectedAdjustment,checks:protectionChecks,audit:'error'in protectedAdjustment?null:audit(protectedAdjustment.result)},sources:Object.fromEntries(['domain/plan/resolve.ts','domain/training/execution.ts','domain/plan/executionAdjustment.ts','domain/plan/future.ts','domain/plan/returnGrowth.ts','domain/training/generator/generatePlan.ts'].map(p=>[p,hash(readFileSync(resolve(root,'web/src/'+p),'utf8'))]))};
writeFileSync(new URL('U09-event.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({analysis,recommendation,checks:primary,adjustedAuditFailures:output.adjustedAudit?.failures,planAuditFailures:Object.fromEntries(Object.entries(output.planAudits).map(([k,a])=>[k,a.failures])),protection:{...protectionChecks,days:Object.fromEntries(Object.entries(protectionChecks.days??{}).map(([id,x])=>[id,x.stable]))}},null,2));
