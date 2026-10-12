// Reproduce: node docs/qa/generator-ab/users/U02-probe.mjs (Node 24).
// Domain simulation; real browser/store lifecycle coverage is centralized separately.
import { registerHooks } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
registerHooks({resolve(s,c,n){try{return n(s,c)}catch(e){if(s.startsWith('.'))for(const x of ['.ts','/index.ts'])try{return n(s+x,c)}catch{}throw e}}});
const qa=new URL('../',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',qa),'utf8'));
const profile=JSON.parse(readFileSync(new URL('inputs.json',qa),'utf8')).find(p=>p.id==='U02');
const raw=JSON.parse(readFileSync(new URL('raw/U02.json',qa),'utf8'));
const root=manifest.localRoots.new;
const imp=p=>import(pathToFileURL(resolve(root,'web/src/'+p)).href);
const {adaptGeneratedPlan}=await imp('domain/plan/adapt.ts');
const {resolvePlan}=await imp('domain/plan/resolve.ts');
const {analyzeExecution,recommendExecution}=await imp('domain/training/execution.ts');
const {buildExecutionAdjustment}=await imp('domain/plan/executionAdjustment.ts');
const {matchPlanRows}=await imp('domain/training/adaptation/matching.ts');
const {sessKm,sessQKm,sessDesc}=await imp('domain/training/sessions/calc.ts');
const {deriveQSById}=await imp('domain/training/prediction/index.ts');
const {generatePair}=await import('../../../probes/generator-ab-qa.mjs');
const regenerated=await generatePair(profile);
const fixtureChecks=Object.fromEntries(['old','new'].map(k=>[k,regenerated.versions[k].sha256===raw.versions[k].sha256]));
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const clone=x=>JSON.parse(JSON.stringify(x));
const today=profile.eventToday;
const current={...adaptGeneratedPlan(clone(raw.versions.new.plan)),ulaz:clone(profile.input)};
const view=resolvePlan(current.weeks,{alts:{},moves:{}});
const lowFrom='2026-11-09',lowTo='2026-11-22';
const log=Object.fromEntries(view.dated.filter(d=>d.date<=today&&!d.rest&&d.km>0&&d.tag!=='snaga').map(d=>[d.id,{status:'done',km:d.km*(d.date>=lowFrom&&d.date<=lowTo?profile.event.fraction:1),runDate:d.date,rpe:4}]));
const analysis=analyzeExecution({plan:view,log,today});
const recommendation=recommendExecution(analysis);
const originalHash=hash({current,log});
const adjustment=buildExecutionAdjustment(current,today,analysis,{}, {log});
function audit(plan){
 const resolved=resolvePlan(plan.weeks,{alts:{},moves:{}}),matched=matchPlanRows(resolved.weeks,plan.pred),failures=[];
 const weeks=plan.weeks.map(w=>({w:w.w,start:w.start,km:+w.days.reduce((n,d)=>n+(d.km??0),0).toFixed(3),lrKm:Math.max(0,...w.days.filter(d=>d.tag==='lr').map(d=>d.km)),deload:w.deload,taper:!!w.taper,runDays:w.days.filter(d=>d.km>0&&!d.rest).length,sessions:w.days.filter(d=>d.session).map(d=>({id:d.id,date:resolved.byId.get(d.id).date,kind:d.session.kind,zone:d.session.zone,qKm:sessQKm(d.session),paceSec:d.session.paceSec,desc:d.desc})),futureKm:+w.days.filter(d=>resolved.byId.get(d.id).date>today).reduce((n,d)=>n+(d.km??0),0).toFixed(3)}));
 for(const w of plan.weeks)for(const d of w.days){if(d.session){if(Math.abs(d.km-sessKm(d.session))>.051)failures.push({id:d.id,reason:'session-km'});const r=matched.get(d.id);if(!r||Math.abs(r.q-sessQKm(d.session))>.051||r.pt!==d.session.paceSec)failures.push({id:d.id,reason:'pred-session'});if(d.desc!==sessDesc(d.session))failures.push({id:d.id,reason:'description'}); } const q=deriveQSById([{...w,days:[d]}])[d.id];if(q&&hash(q)!==hash(plan.qs[d.id]))failures.push({id:d.id,reason:'qs'});}
 const details=plan.weeks.map(w=>{
 const sessions=w.days.filter(d=>d.session).map(d=>{
  const s=d.session, legs=s.type==='pyramid'?s.reps:s.type==='int'?Array(s.reps).fill(s.repM):[];
  return {id:d.id,date:resolved.byId.get(d.id).date,kind:s.kind,type:s.type,zone:s.zone,workKm:sessQKm(s),sessionKm:d.km,wuKm:s.wuKm,cdKm:s.cdKm,paceSec:s.paceSec,restSec:s.restSec,recoveryMode:s.type==='fartlek'||['Tempo isprekidan','Tempo trke','Kontrolna trka'].includes(s.kind)?'jog':s.restSec?'walk':null,legMeters:legs,legSeconds:legs.map(m=>+(m*s.paceSec/1000).toFixed(2)),workSeconds:s.type==='fartlek'?s.reps*s.repSec:Math.round(sessQKm(s)*s.paceSec),description:d.desc};
 });
 const hard=w.days.filter(d=>d.session||d.finish).map(d=>d.dow);
 return {w:w.w,start:w.start,focus:w.focus,hardDows0Based:hard,adjacentQuality:hard.some((d,i)=>i>0&&d-hard[i-1]===1),longRunShare:+(weeks.find(x=>x.w===w.w).lrKm/weeks.find(x=>x.w===w.w).km).toFixed(4),sessions};
});
const growth=weeks.map((w,i)=>({w:w.w,weeklyDeltaPct:i?+((w.km/weeks[i-1].km-1)*100).toFixed(2):null,lrDeltaPct:i&&weeks[i-1].lrKm?+((w.lrKm/weeks[i-1].lrKm-1)*100).toFixed(2):null,relativeToPriorNonDeload: (()=>{const prev=weeks.slice(0,i).filter(v=>!v.deload&&!v.taper).at(-1);return prev?+((w.km/prev.km-1)*100).toFixed(2):null;})()}));
return {weeks,details,growth,failures};
}
const beforeDays=new Map(current.weeks.flatMap(w=>w.days).map(d=>[d.id,d]));
const afterDays='error'in adjustment?new Map():new Map(adjustment.result.weeks.flatMap(w=>w.days).map(d=>[d.id,d]));
const primaryChecks={exactlyTwoLowFullWeeks:analysis.lowerVolumeWeeks===2,allRunsExplicitlyLogged:analysis.unknown===0&&analysis.volumeCoverage===1,reductionOffered:recommendation.kind==='reduce',noPauseInferred:recommendation.kind!=='return',generated:!('error'in adjustment),inputsPure:hash({current,log})===originalHash,pastAndTodayStable:view.dated.filter(d=>d.date<=today).every(d=>hash(beforeDays.get(d.id))===hash(afterDays.get(d.id)))};
if(!('error'in adjustment)){
 const oldMatch=matchPlanRows(view.weeks,current.pred),newResolved=resolvePlan(adjustment.result.weeks,{alts:{},moves:{}}),newMatch=matchPlanRows(newResolved.weeks,adjustment.result.pred);
 primaryChecks.pastPredictionRowsStable=view.dated.filter(d=>d.date<=today&&oldMatch.has(d.id)).every(d=>hash(oldMatch.get(d.id))===hash(newMatch.get(d.id)));
 primaryChecks.uniqueDayIds=newResolved.byId.size===adjustment.result.weeks.reduce((n,w)=>n+w.days.length,0);
 primaryChecks.uniquePredictionIds=new Set(adjustment.result.pred.map(r=>r.id)).size===adjustment.result.pred.length;
 primaryChecks.raceDateStable=adjustment.result.meta.raceDate===profile.input.raceDate;primaryChecks.daysStable=adjustment.result.meta.runDays===profile.input.runDays;primaryChecks.noProjectedFitnessGain=adjustment.result.meta.vdotGoal===adjustment.result.meta.vdot0;}
// Separate preservation challenge; analysis above is the uncontaminated requested event.
const protectedPlan=clone(current),ctx={log:clone(log),alts:{},moves:{},pred:{},predLock:{}};
const futureDone=view.byId.get('g7d5');ctx.log[futureDone.id]={status:'done',km:futureDone.km,runDate:'2026-11-24',rpe:4};
const manual=protectedPlan.weeks.flatMap(w=>w.days).find(d=>d.id==='g9d3');manual.session.wuKm=3.7;manual.session.overrides.wuKm=true;manual.km=sessKm(manual.session);manual.desc=sessDesc(manual.session);
ctx.alts.g8d1={tag:'lako',km:4.2,desc:'U02 manual future 4.2 km easy'};
const matched=matchPlanRows(view.weeks,current.pred),measured=matched.get('g10d3');ctx.pred[measured.id]=273;ctx.predLock[measured.id]=true;
ctx.moves.g7d7='2026-11-24';ctx.moves.g7d2='2026-11-29';
const protectedBefore=hash({protectedPlan,ctx});
const preserved=buildExecutionAdjustment(protectedPlan,today,analysis,{},ctx);
const pd0=new Map(protectedPlan.weeks.flatMap(w=>w.days).map(d=>[d.id,d])),pd1='error'in preserved?new Map():new Map(preserved.result.weeks.flatMap(w=>w.days).map(d=>[d.id,d]));
const pview=resolvePlan(protectedPlan.weeks,ctx);
const protectionChecks={generated:!('error'in preserved),inputsPure:protectedBefore===hash({protectedPlan,ctx}),pastAndTodayStable:pview.dated.filter(d=>d.date<=today).every(d=>hash(pd0.get(d.id))===hash(pd1.get(d.id))),futureCompletedStable:hash(pd0.get(futureDone.id))===hash(pd1.get(futureDone.id)),manualSessionStable:hash(pd0.get(manual.id))===hash(pd1.get(manual.id)),manualAltUnderlyingDayStable:hash(pd0.get('g8d1'))===hash(pd1.get('g8d1')),measuredFutureDayStable:hash(pd0.get('g10d3'))===hash(pd1.get('g10d3')),movedEffectivePastStable:hash(pd0.get('g7d7'))===hash(pd1.get('g7d7'))};
if(!('error'in preserved)){
 const afterProtected=resolvePlan(preserved.result.weeks,ctx);
 protectionChecks.movedDayReallyInPast=pview.byId.get('g7d7').date==='2026-11-24'&&afterProtected.byId.get('g7d7').date==='2026-11-24';
 protectionChecks.manualAltEffectiveKm=afterProtected.byId.get('g8d1').km===4.2;
 protectionChecks.measuredRowStable=preserved.result.pred.some(r=>hash(r)===hash(measured));protectionChecks.manualWarning=preserved.result.meta.dayWarnings.some(w=>w.includes('2026-12-09'))&&preserved.result.meta.dayWarnings.some(w=>w.includes('2026-11-30'));}
const baselineAudits=Object.fromEntries(['old','new'].map(k=>[k,audit(adaptGeneratedPlan(clone(raw.versions[k].plan)))]));
const output={id:'U02',fixtureChecks,baselineAudits,resolvedInput:view.dated,protectedResolvedInput:pview.dated,scope:'Actual domain functions only; UI/browser results supplied by centralized U06 harness',today,fixtureSha256:{old:raw.versions.old.sha256,new:raw.versions.new.sha256},event:{lowFrom,lowTo,fraction:profile.event.fraction,priorRuns:'All eligible runs from start through today explicitly done with distance and date; earlier weeks at prescription.'},input:{profile,current,log,options:{}},analysis,recommendation,adjustment,audit:'error'in adjustment?null:audit(adjustment.result),checks:primaryChecks,protection:{input:{plan:protectedPlan,context:ctx,analysis},output:preserved,checks:protectionChecks},sources:['domain/training/generator/generatePlan.ts','domain/training/sessions/constraints.ts','domain/training/sessions/calc.ts','domain/plan/returnGrowth.ts','domain/plan/resolve.ts','domain/training/execution.ts','domain/plan/executionAdjustment.ts','domain/plan/future.ts'].map(p=>({path:'web/src/'+p,sha256:hash(readFileSync(resolve(root,'web/src/'+p),'utf8'))}))};
writeFileSync(new URL('U02-event.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({analysis,recommendation,primaryChecks,protectionChecks,auditFailures:output.audit?.failures,baselineAuditFailures:Object.fromEntries(Object.entries(baselineAudits).map(([k,a])=>[k,a.failures])),fixtureChecks,notes:adjustment.notes},null,2));
