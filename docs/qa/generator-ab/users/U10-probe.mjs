// Node 24: node docs/qa/generator-ab/users/U10-probe.mjs
// Synthetic domain QA only. No browser, clinical or athlete-outcome claims.
import { registerHooks } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
registerHooks({resolve(s,c,n){try{return n(s,c);}catch(e){if(s.startsWith('.'))for(const x of ['.ts','/index.ts'])try{return n(s+x,c);}catch{}throw e;}}});
const qa=new URL('../',import.meta.url),manifest=JSON.parse(readFileSync(new URL('manifest.json',qa),'utf8'));
const profile=JSON.parse(readFileSync(new URL('inputs.json',qa),'utf8')).find(p=>p.id==='U10');
const raw=JSON.parse(readFileSync(new URL('raw/U10.json',qa),'utf8'));
const clone=x=>JSON.parse(JSON.stringify(x)),hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)??'undefined').digest('hex'),round=x=>Math.round(x*100)/100;
const root=manifest.localRoots.new,imp=(r,p)=>import(pathToFileURL(resolve(r,'web/src/'+p)).href);
const {adaptGeneratedPlan}=await imp(root,'domain/plan/adapt.ts');
const {resolvePlan}=await imp(root,'domain/plan/resolve.ts');
const {analyzeExecution,recommendExecution}=await imp(root,'domain/training/execution.ts');
const {buildExecutionAdjustment}=await imp(root,'domain/plan/executionAdjustment.ts');
const {sessKm,sessQKm,sessDesc}=await imp(root,'domain/training/sessions/calc.ts');
const {derivePred,deriveQSById}=await imp(root,'domain/training/prediction/index.ts');
const {matchPlanRows}=await imp(root,'domain/training/adaptation/matching.ts');
const reproduction={};
for(const version of ['old','new']){
 const {generatePlan}=await imp(manifest.localRoots[version],'domain/training/generator/generatePlan.ts');
 const p=generatePlan(clone(profile.input));reproduction[version]={lockedSha256:raw.versions[version].sha256,reproducedSha256:hash(p),exact:hash(p)===raw.versions[version].sha256};assert(reproduction[version].exact);
}
const today=profile.eventToday,options={breakDays:28,weeklyKm:60,recentLongRunKm:24};
const current={...adaptGeneratedPlan(clone(raw.versions.new.plan)),ulaz:clone(profile.input)};
const context={log:{},alts:{},moves:{},pred:{},predLock:{}};
const view=resolvePlan(current.weeks,context),pastRows=matchPlanRows(view.weeks,current.pred);
for(const d of view.dated.filter(d=>d.date<=today&&d.km>0&&!d.rest&&d.tag!=='snaga')){
 context.log[d.id]=d.date>='2026-10-29'?{status:'skip',ts:d.date}:{status:'done',km:d.km,sec:Math.round(d.km*360),rpe:4,runDate:d.date,ts:d.date};
 const row=pastRows.get(d.id);if(row&&context.log[d.id].status==='done'){context.pred[row.id]=d.session.paceSec;context.predLock[row.id]=true;}
}
function summarize(plan,ctx={},stored=false){
 const v=stored?resolvePlan(plan.weeks,{alts:ctx.alts??{},moves:ctx.moves??{}}):null;
 let longestRunStreak=0,streak=0,previousRunDate=null;const auditFailures=[];
 const rows=stored?matchPlanRows(v.weeks,plan.pred):null;
 const weeks=plan.weeks.map(w=>{
  const days=w.days.map(d=>({...d,dow:stored?d.dow+1:d.dow,date:stored?v.byId.get(d.id).date:undefined}));
  let totalWork=0;const sessions=[],finishes=[];
  for(const d of days){
   if(d.session){const s=d.session,q=sessQKm(s),work=s.type==='fartlek'?s.reps*s.repSec/60:q*s.paceSec/60;totalWork+=work;sessions.push({dow:d.dow,date:d.date,id:d.id,kind:s.kind,type:s.type,zone:s.zone,qKm:round(q),workMinutes:round(work),paceSec:s.paceSec,reps:s.reps,repM:s.repM,restSec:s.restSec,wuKm:s.wuKm,cdKm:s.cdKm});
    if(Math.abs(sessKm(s)-d.km)>.051)auditFailures.push({w:w.w,dow:d.dow,reason:'session-km',actual:d.km,expected:sessKm(s)});
    if(stored){const row=rows.get(d.id);if(!row||Math.abs(row.q-q)>.051||row.pt!==s.paceSec)auditFailures.push({w:w.w,dow:d.dow,reason:'prediction'});if(d.desc!==sessDesc(s))auditFailures.push({w:w.w,dow:d.dow,reason:'description'});if(hash(plan.qs[d.id])!==hash(deriveQSById([{...w,days:[w.days.find(x=>x.id===d.id)]}])[d.id]))auditFailures.push({w:w.w,dow:d.dow,reason:'qs'});}
   }
   if(d.finish){const work=d.finish.km*d.finish.paceSec/60;totalWork+=work;finishes.push({dow:d.dow,date:d.date,...d.finish,workMinutes:round(work)});}
  }
  const km=round(days.reduce((s,d)=>s+(d.km??0),0));if(!stored&&Math.abs(km-w.vol)>.051)auditFailures.push({w:w.w,reason:'week-sum',actual:km,expected:w.vol});
  return {w:w.w,start:w.start,km,futureKm:stored?round(days.filter(d=>d.date>today).reduce((s,d)=>s+(d.km??0),0)):undefined,runDays:days.filter(d=>d.km>0&&!d.rest).length,deload:!!w.deload,taper:!!w.taper,focus:w.focus,lrKm:Math.max(0,...days.filter(d=>d.tag==='lr'&&!d.mlr).map(d=>d.km)),qualityDows:days.filter(d=>d.session||d.finish).map(d=>d.dow),longRunDows:days.filter(d=>d.tag==='lr'&&!d.mlr).map(d=>d.dow),workMinutes:round(totalWork),sessions,finishes,strideDows:days.filter(d=>d.strides).map(d=>d.dow),days};
 });
 const chronological=stored?v.dated:plan.weeks.flatMap(w=>w.days.map(d=>({...d,date:new Date(Date.UTC(2026,9,12)+(7*(w.w-1)+d.dow-1)*86400000).toISOString().slice(0,10)})));
 for(const d of chronological){if(d.km>0&&!d.rest&&d.tag!=='snaga'){streak=previousRunDate&&new Date(d.date)-new Date(previousRunDate)===86400000?streak+1:1;previousRunDate=d.date;longestRunStreak=Math.max(longestRunStreak,streak);}}
 return {weeks,auditFailures,longestRunStreak,peakWeeklyKm:Math.max(...weeks.filter(w=>w.focus!=='TRKA').map(w=>w.km)),peakLongRunKm:Math.max(...weeks.map(w=>w.lrKm)),meta:plan.meta};
}
function execute(c,ctx){
 const resolved=resolvePlan(c.weeks,ctx),analysis=analyzeExecution({plan:resolved,today,log:ctx.log}),recommendation=recommendExecution(analysis),beforeHash=hash({c,ctx,options,analysis});
 const adjustment=buildExecutionAdjustment(c,today,analysis,options,ctx);assert(!('error'in adjustment));const result=adjustment.result,out=resolvePlan(result.weeks,ctx);
 const checks={pureInputs:hash({c,ctx,options,analysis})===beforeHash,pastAndTodayDaysUnchanged:resolved.dated.filter(d=>d.date<=today).every(d=>hash(c.weeks.flatMap(w=>w.days).find(x=>x.id===d.id))===hash(result.weeks.flatMap(w=>w.days).find(x=>x.id===d.id))),pastRowsUnchanged:c.pred.filter(row=>Object.hasOwn(ctx.pred,row.id)).every(row=>hash(row)===hash(result.pred.find(x=>x.id===row.id))),calendarIdsStable:resolved.dated.every(d=>out.byId.get(d.id)?.date===d.date),raceDateStable:result.meta.raceDate===profile.input.raceDate&&out.dated.find(d=>d.tag==='trka').date===profile.input.raceDate,goalUnchanged:result.meta.goalSec===12600,startingKm33:result.meta.executionAdjustment.startingKm===33,lastRunOct28:analysis.lastRunDate==='2026-10-28',exact28Days:analysis.daysSinceLastRun===28,allStatusKnown:analysis.unknown===0,recommendationNeedsConfirmation:recommendation.kind==='return'&&recommendation.requiresConfirmation};
 for(const [k,b]of Object.entries(checks))assert(b,k);
 return {input:{current:c,context:ctx,options},analysis,recommendation,adjustment,review:summarize(result,ctx,true),checks};
}
const primary=execute(current,context);assert.equal(primary.review.auditFailures.length,0);
primary.checks.fourInitialCalendarWeeksEasy=resolvePlan(primary.adjustment.result.weeks,context).dated.filter(d=>d.date>today&&d.date<='2026-12-20'&&d.tag!=='trka').every(d=>!d.session&&!d.finish&&!d.strides);assert(primary.checks.fourInitialCalendarWeeksEasy);
primary.descriptionAudit={initialEasyWindowThrough:'2026-12-20',staleStrideInstructions:resolvePlan(primary.adjustment.result.weeks,context).dated.filter(d=>d.date>today&&d.date<='2026-12-20'&&!d.strides&&/ubrzanja|ubrzani koraci/.test(d.desc??'')).map(d=>({id:d.id,w:d.w,dow:d.dow+1,date:d.date,desc:d.desc})),staleQualityFocus:primary.review.weeks.filter(w=>w.start>'2026-11-25'&&w.start<='2026-12-14'&&w.qualityDows.length===0&&/Fartlek/.test(w.focus)).map(({w,start,focus,qualityDows})=>({w,start,focus,qualityDows}))};
let established=33;
primary.growthAudit=primary.review.weeks.filter(w=>w.start>today&&w.focus!=='TRKA').map(w=>{const limit=round(established*1.08),pass=w.km<=limit+0.1,entry={w:w.w,start:w.start,km:w.km,priorEstablishedKm:established,limit,deload:w.deload,taper:w.taper,pass};if(!w.deload&&!w.taper)established=w.km;return entry;});
primary.checks.futureVolumeGuard=primary.growthAudit.every(w=>w.pass);assert(primary.checks.futureVolumeGuard);
primary.checks.futureQualityAtMostTwo=primary.review.weeks.filter(w=>w.start>today).every(w=>w.qualityDows.length<=2);assert(primary.checks.futureQualityAtMostTwo);
// Separate seeded future state: actual measured/locked row plus explicit manual session edit.
const protectedCurrent=clone(current),protectedContext=clone(context),matched=matchPlanRows(resolvePlan(protectedCurrent.weeks,protectedContext).weeks,protectedCurrent.pred);
const measuredId='g8d2',measuredRow=matched.get(measuredId);protectedContext.pred[measuredRow.id]=302;protectedContext.predLock[measuredRow.id]=true;
const manualId='g9d5',manualWeek=protectedCurrent.weeks.find(w=>w.w===9),manual=manualWeek.days.find(d=>d.id===manualId),manualRow=matched.get(manualId);
manual.session.wuKm=3.7;manual.session.overrides.wuKm=true;manual.km=sessKm(manual.session);manual.desc=sessDesc(manual.session);protectedCurrent.qs[manual.id]=deriveQSById([{...manualWeek,days:[manual]}])[manual.id];
const regenerated=derivePred([{...manualWeek,days:[manual]}],protectedCurrent.meta.raceDistM,protectedCurrent.meta)[0];Object.assign(manualRow,regenerated);
const protection=execute(protectedCurrent,protectedContext),protectedResult=protection.adjustment.result;
protection.checks.measuredDayUnchanged=hash(protectedCurrent.weeks.flatMap(w=>w.days).find(d=>d.id===measuredId))===hash(protectedResult.weeks.flatMap(w=>w.days).find(d=>d.id===measuredId));
protection.checks.measuredRowUnchanged=hash(measuredRow)===hash(protectedResult.pred.find(r=>r.id===measuredRow.id));
protection.checks.manualDayUnchanged=hash(manual)===hash(protectedResult.weeks.flatMap(w=>w.days).find(d=>d.id===manualId));
protection.checks.manualRowAndQsUnchanged=hash(manualRow)===hash(protectedResult.pred.find(r=>r.id===manualRow.id))&&hash(protectedCurrent.qs[manualId])===hash(protectedResult.qs[manualId]);
protection.checks.measuredQsUnchanged=hash(protectedCurrent.qs[measuredId])===hash(protectedResult.qs[measuredId]);
protection.checks.manualDateWarning=protectedResult.meta.dayWarnings.some(s=>s.includes('2026-12-11'));
for(const [k,b]of Object.entries(protection.checks))assert(b,k);assert.equal(protection.review.auditFailures.length,0);
const output={id:'U10',scope:'Synthetic experienced marathon runner; local production domain APIs, not browser evidence or measured human outcomes.',profile,reproduction,review:{old:summarize(raw.versions.old.plan),new:summarize(raw.versions.new.plan)},actualHistory:{description:'Every eligible slot through Oct28 explicitly done with synthetic actual km/sec/date/RPE; every eligible Oct29-Nov25 slot explicitly skipped. Prebreak repeatable 60 km/24 km LR is explicit scenario input, not inferred from prescription.',confirmedBreakFrom:'2026-10-29',confirmedBreakThrough:today,lastActualRun:'2026-10-28',log:context.log},event:primary,protection:{seed:{measuredId,measuredRowId:measuredRow.id,measuredActualPaceSec:302,manualId,manualEdit:'warmup3.5→3.7 km with explicit override; recalculated session km/description/pred/QS'},...protection},sources:['domain/plan/executionAdjustment.ts','domain/plan/future.ts','domain/plan/returnGrowth.ts','domain/training/execution.ts'].map(p=>({path:'web/src/'+p,sha256:hash(readFileSync(resolve(root,'web/src/'+p),'utf8'))}))};
writeFileSync(new URL('U10-event.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({id:'U10',reproduction,primaryChecks:primary.checks,protectionChecks:protection.checks,analysis:primary.analysis,returnMeta:primary.adjustment.result.meta,returnWeeks:primary.review.weeks.map(({days,...w})=>w)},null,2));
