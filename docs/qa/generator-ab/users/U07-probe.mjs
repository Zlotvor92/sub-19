// Reproduce with Node 24: node docs/qa/generator-ab/users/U07-probe.mjs
// Independent U07 synthetic domain QA; central U06 owns browser/store lifecycle.
import { registerHooks } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
registerHooks({resolve(s,c,n){try{return n(s,c)}catch(e){if(s.startsWith('.'))for(const x of ['.ts','/index.ts'])try{return n(s+x,c)}catch{}throw e}}});
const qa=new URL('../',import.meta.url),manifest=JSON.parse(readFileSync(new URL('manifest.json',qa),'utf8'));
const profile=JSON.parse(readFileSync(new URL('inputs.json',qa),'utf8')).find(p=>p.id==='U07');
const raw=JSON.parse(readFileSync(new URL('raw/U07.json',qa),'utf8'));
const root=manifest.localRoots.new,imp=p=>import(pathToFileURL(resolve(root,'web/src/'+p)).href);
const {generatePair}=await import('../../../probes/generator-ab-qa.mjs');
const {adaptGeneratedPlan}=await imp('domain/plan/adapt.ts');
const {resolvePlan}=await imp('domain/plan/resolve.ts');
const {analyzeExecution,recommendExecution}=await imp('domain/training/execution.ts');
const {buildExecutionAdjustment}=await imp('domain/plan/executionAdjustment.ts');
const {matchPlanRows}=await imp('domain/training/adaptation/matching.ts');
const {sessKm,sessQKm,sessDesc}=await imp('domain/training/sessions/calc.ts');
const {deriveQSById}=await imp('domain/training/prediction/index.ts');
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)??'undefined').digest('hex');
const clone=x=>JSON.parse(JSON.stringify(x)),round=x=>Math.round(x*10)/10,today=profile.eventToday;
const rerun=await generatePair(profile);
const current={...adaptGeneratedPlan(clone(raw.versions.new.plan)),ulaz:clone(profile.input)};
const context={log:{},alts:{},moves:{},pred:{},predLock:{}};
const before=resolvePlan(current.weeks,context),matched=matchPlanRows(before.weeks,current.pred);
for(const d of before.dated.filter(d=>d.date<=today&&!d.rest&&d.km>0&&d.tag!=='snaga')) {
 const under=d.date>='2026-11-09'; // W5/W6 full, and W7 through the cutoff, at 60% prescription.
 const km=+(d.km*(under?0.6:1)).toFixed(3);
 context.log[d.id]={status:'done',km,runDate:d.date,ts:d.date+'T18:00:00Z',rpe:d.session?6:4};
 const row=matched.get(d.id);if(row){context.pred[row.id]=d.session.paceSec+3;context.predLock[row.id]=true;}
}
function audit(plan,ctx) {
 const v=resolvePlan(plan.weeks,ctx),m=matchPlanRows(v.weeks,plan.pred),failures=[];
 const weeks=plan.weeks.map(w=>({w:w.w,start:w.start,km:round(w.days.reduce((n,d)=>n+(d.km??0),0)),lrKm:Math.max(0,...w.days.filter(d=>d.tag==='lr').map(d=>d.km)),deload:w.deload,taper:!!w.taper,focus:w.focus,runDays:w.days.filter(d=>d.km>0&&!d.rest).length,days:w.days.map(d=>({...d,date:v.byId.get(d.id)?.date})),sessions:w.days.filter(d=>d.session).map(d=>({id:d.id,date:v.byId.get(d.id).date,kind:d.session.kind,zone:d.session.zone,qKm:sessQKm(d.session),paceSec:d.session.paceSec,restSec:d.session.restSec,km:d.km,workMinutes:d.session.type==='fartlek'?d.session.reps*d.session.repSec/60:sessQKm(d.session)*d.session.paceSec/60,desc:d.desc}))}));
 for(const w of plan.weeks)for(const d of w.days)if(d.session){const row=m.get(d.id);if(Math.abs(d.km-sessKm(d.session))>.051)failures.push({w:w.w,id:d.id,date:v.byId.get(d.id).date,reason:'session-km',expected:sessKm(d.session),actual:d.km});if(!row||Math.abs(row.q-sessQKm(d.session))>.051||row.pt!==d.session.paceSec)failures.push({w:w.w,id:d.id,reason:'matched-pred',expected:{q:sessQKm(d.session),pt:d.session.paceSec},actual:row??null});if(d.desc!==sessDesc(d.session))failures.push({w:w.w,id:d.id,reason:'description',expected:sessDesc(d.session),actual:d.desc});const q=deriveQSById([{...w,days:[d]}])[d.id];if(hash(q)!==hash(plan.qs[d.id]))failures.push({w:w.w,id:d.id,reason:'qs',expected:q,actual:plan.qs[d.id]});}
 return {weeks,failures};
}
const analysis=analyzeExecution({plan:before,log:context.log,today}),recommendation=recommendExecution(analysis),options={};
const originalHash=hash({current,context,analysis,options});
const adjustment=buildExecutionAdjustment(current,today,analysis,options,context);
function preserveChecks(plan,ctx,result) {
 if('error'in result)return {generated:false,error:result.error};
 const v0=resolvePlan(plan.weeks,ctx),v1=resolvePlan(result.result.weeks,ctx),d0=new Map(plan.weeks.flatMap(w=>w.days).map(d=>[d.id,d])),d1=new Map(result.result.weeks.flatMap(w=>w.days).map(d=>[d.id,d]));
 const m0=matchPlanRows(resolvePlan(plan.weeks,{alts:{},moves:ctx.moves}).weeks,plan.pred),m1=matchPlanRows(resolvePlan(result.result.weeks,{alts:{},moves:ctx.moves}).weeks,result.result.pred);
 return {generated:true,pastAndTodayStable:v0.dated.filter(d=>d.date<=today).every(d=>hash(d0.get(d.id))===hash(d1.get(d.id))),completedDaysStable:Object.keys(ctx.log).filter(id=>ctx.log[id].status==='done').every(id=>hash(d0.get(id))===hash(d1.get(id))),calendarIdentitiesStable:v0.dated.every(d=>v1.byId.get(d.id)?.date===d.date),measuredRowsStable:[...m0].filter(([,r])=>ctx.pred[r.id]!=null||ctx.predLock[r.id]).every(([id,r])=>hash(m1.get(id))===hash(r)),protectedQsStable:[...m0].filter(([,r])=>ctx.pred[r.id]!=null||ctx.predLock[r.id]).every(([id])=>hash(plan.qs[id])===hash(result.result.qs[id])),raceDateStable:result.result.meta.raceDate===profile.input.raceDate,raceDayStable:v1.dated.find(d=>d.tag==='trka')?.date===profile.input.raceDate,goalStable:result.result.meta.goalSec===6300&&result.result.ulaz.goalSec===6300,noProjectedFitnessGain:result.result.meta.vdotGoal===result.result.meta.vdot0};
}
const checks={rerunOldFrozen:rerun.versions.old.sha256===raw.versions.old.sha256,rerunNewFrozen:rerun.versions.new.sha256===raw.versions.new.sha256,historyComplete:analysis.unknown===0&&analysis.volumeCoverage===1,twoFullRecentWeeks60Percent:analysis.completeWeeks.slice(-2).every(w=>Math.abs(w.actualKm/w.plannedKm-0.6)<0.002&&w.volumeCoverage===1&&w.statusCoverage===1),underexecutionDetected:analysis.lowerVolumeWeeks===2,reduceRecommended:recommendation.kind==='reduce'&&recommendation.requiresConfirmation,inputsPure:originalHash===hash({current,context,analysis,options}),...preserveChecks(current,context,adjustment)};
// Separate preservation challenge: future completed day, manually edited future session,
// manual alternate easy day, and future session with an entered/locked actual pace.
const protectedPlan=clone(current),protectedContext=clone(context);
protectedContext.log.g8d3={status:'done',km:4.26,runDate:'2026-11-24',ts:'2026-11-24T18:00:00Z',rpe:4};
const manual=protectedPlan.weeks.flatMap(w=>w.days).find(d=>d.id==='g9d3');
manual.session.wuKm=3.7;manual.session.overrides.wuKm=true;manual.km=sessKm(manual.session);manual.desc=sessDesc(manual.session);
const manualWeek=protectedPlan.weeks.find(w=>w.w===9);protectedPlan.qs.g9d3=deriveQSById([{...manualWeek,days:[manual]}]).g9d3;
const manualRow=matchPlanRows(resolvePlan(protectedPlan.weeks,protectedContext).weeks,protectedPlan.pred).get('g9d3');if(manualRow){manualRow.q=sessQKm(manual.session);manualRow.pt=manual.session.paceSec;}
protectedContext.alts.g9d1={tag:'lako',km:6,desc:'Ručni laki trening 6 km',paceAuto:false};
const measured=matchPlanRows(resolvePlan(protectedPlan.weeks,protectedContext).weeks,protectedPlan.pred).get('g10d3');protectedContext.pred[measured.id]=314;protectedContext.predLock[measured.id]=true;
const protectedAnalysis=analyzeExecution({plan:resolvePlan(protectedPlan.weeks,protectedContext),log:protectedContext.log,today}),protectionHash=hash({protectedPlan,protectedContext,protectedAnalysis});
const protectedAdjustment=buildExecutionAdjustment(protectedPlan,today,protectedAnalysis,options,protectedContext);
const p0=new Map(protectedPlan.weeks.flatMap(w=>w.days).map(d=>[d.id,d])),p1='error'in protectedAdjustment?new Map():new Map(protectedAdjustment.result.weeks.flatMap(w=>w.days).map(d=>[d.id,d]));
const protectionChecks={...preserveChecks(protectedPlan,protectedContext,protectedAdjustment),inputsPure:protectionHash===hash({protectedPlan,protectedContext,protectedAnalysis}),manualSessionStable:hash(p0.get('g9d3'))===hash(p1.get('g9d3')),manualAltUnderlyingDayStable:hash(p0.get('g9d1'))===hash(p1.get('g9d1')),manualWarningsPresent:!('error'in protectedAdjustment)&&['2026-12-07','2026-12-09'].every(date=>protectedAdjustment.result.meta.dayWarnings.some(x=>x.includes(date)))};
const sources=['domain/plan/resolve.ts','domain/training/execution.ts','domain/plan/executionAdjustment.ts','domain/plan/future.ts','domain/plan/returnGrowth.ts'].map(p=>({path:'web/src/'+p,sha256:hash(readFileSync(resolve(root,'web/src/'+p),'utf8'))}));
const output={id:'U07',scope:'Synthetic domain QA only; no actual human training, browser, persistence, undo or watch-integration claim.',manifest,fixtureSha256:{old:raw.versions.old.sha256,new:raw.versions.new.sha256},today,event:{kind:'underexecution',fraction:0.6,fullRecentWeeks:['2026-11-09/2026-11-15','2026-11-16/2026-11-22'],history:'Every eligible run from start through today explicitly completed with actual km/runDate/ts/RPE. W1-W4 at 100% prescription; W5/W6 and W7 through today at 60%. No missing logs, inferred skip, or confirmed break.'},input:{profile,current,context,options},analysis,recommendation,adjustment,checks,adjustmentAudit:'error'in adjustment?null:audit(adjustment.result,context),protection:{input:{current:protectedPlan,context:protectedContext,analysis:protectedAnalysis,options},adjustment:protectedAdjustment,checks:protectionChecks},sources};
output.protection.audit = 'error' in protectedAdjustment ? null : audit(protectedAdjustment.result,protectedContext);
output.allChecksPassed = Object.values(checks).every(x=>x===true) && Object.values(protectionChecks).every(x=>x===true) && output.adjustmentAudit?.failures.length===0 && output.protection.audit?.failures.length===0;
writeFileSync(new URL('U07-event.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
if(!output.allChecksPassed) process.exitCode=1;
console.log(JSON.stringify({analysis,recommendation,checks,protectionChecks,adjustmentWeeks:output.adjustmentAudit?.weeks.map(w=>({w:w.w,start:w.start,km:w.km,lr:w.lrKm,deload:w.deload,taper:w.taper,focus:w.focus,sessions:w.sessions})),auditFailures:output.adjustmentAudit?.failures,meta:adjustment.result?.meta},null,2));
