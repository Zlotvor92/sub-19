// Reproduce: node docs/qa/generator-ab/users/U05-probe.mjs (Node 24).
// Domain-only public API exercise. U06 owns browser evidence.
import { registerHooks } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
registerHooks({resolve(s,c,n){try{return n(s,c)}catch(e){if(s.startsWith('.'))for(const x of ['.ts','/index.ts'])try{return n(s+x,c)}catch{}throw e}}});
const qa=new URL('../',import.meta.url),manifest=JSON.parse(readFileSync(new URL('manifest.json',qa),'utf8'));
const profile=JSON.parse(readFileSync(new URL('inputs.json',qa),'utf8')).find(p=>p.id==='U05');
const raw=JSON.parse(readFileSync(new URL('raw/U05.json',qa),'utf8'));
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)??'undefined').digest('hex');
const clone=x=>JSON.parse(JSON.stringify(x));
const today=profile.eventToday,out={id:'U05',scope:'Domain simulation of public planWithNewGoal API; no browser/store/watch claim',today,goal:{from:2520,to:2400},versions:{}};
for(const key of ['old','new']){
 const root=manifest.localRoots[key],imp=p=>import(pathToFileURL(resolve(root,'web/src/'+p)).href);
 const [{adaptGeneratedPlan},{resolvePlan},{planWithNewGoal},{matchPlanRows},{sessKm,sessQKm,sessDesc},{derivePred,deriveQSById}]=await Promise.all(['domain/plan/adapt.ts','domain/plan/resolve.ts','domain/plan/replan.ts','domain/training/adaptation/matching.ts','domain/training/sessions/calc.ts','domain/training/prediction/index.ts'].map(imp));
 const current={...adaptGeneratedPlan(clone(raw.versions[key].plan)),ulaz:clone(profile.input)},view=resolvePlan(current.weeks,{alts:{},moves:{}});
 const log=Object.fromEntries(view.dated.filter(d=>d.date<=today&&!d.rest&&d.km>0&&d.tag!=='snaga').map(d=>[d.id,{status:'done',km:d.km,sec:Math.round(d.km*(d.session?.paceSec??332)),runDate:d.date,rpe:d.session?6:4}]));
 const ctx={log,alts:{},moves:{},pred:{},predLock:{}};
 const map=p=>new Map(p.weeks.flatMap(w=>w.days).map(d=>[d.id,d]));
 const audit=p=>{
  const v=resolvePlan(p.weeks,ctx),matched=matchPlanRows(v.weeks,p.pred),failures=[];
  const weeks=p.weeks.map(w=>({w:w.w,start:w.start,km:+w.days.reduce((n,d)=>n+(d.km??0),0).toFixed(3),lrKm:Math.max(0,...w.days.filter(d=>d.tag==='lr'&&!d.mlr).map(d=>d.km)),deload:w.deload,taper:!!w.taper,sessions:w.days.filter(d=>d.session).map(d=>({id:d.id,date:v.byId.get(d.id).date,type:d.session.type,kind:d.session.kind,zone:d.session.zone,qKm:sessQKm(d.session),paceSec:d.session.paceSec,reps:d.session.reps,repM:d.session.repM,restSec:d.session.restSec,desc:d.desc}))}));
  for(const w of p.weeks)for(const d of w.days)if(d.session){if(Math.abs(d.km-sessKm(d.session))>.051)failures.push({id:d.id,reason:'session-km'});const r=matched.get(d.id);if(!r||Math.abs(r.q-sessQKm(d.session))>.051||r.pt!==d.session.paceSec)failures.push({id:d.id,reason:'prediction-session'});if(d.desc!==sessDesc(d.session))failures.push({id:d.id,reason:'description'});const q=deriveQSById([{...w,days:[d]}])[d.id];if(hash(q)!==hash(p.qs[d.id]))failures.push({id:d.id,reason:'qs'});}
  return {weeks,failures};
 };
 function checks(before,result,context){
  if('error'in result)return {generated:false,error:result.error};
  const b=map(before),a=map(result),v=resolvePlan(before.weeks,context),rows=new Map(result.pred.map(r=>[r.id,r]));
  const past=v.dated.filter(d=>d.date<=today),logged=Object.keys(context.log).filter(id=>context.log[id].status==='done');
  return {generated:true,goalChanged:result.ulaz.goalSec===2400&&result.meta.goalSec===2400,raceDateStable:result.meta.raceDate===profile.input.raceDate,runDaysStable:result.meta.runDays===5,pastDayCount:past.length,pastChanged:past.filter(d=>hash(b.get(d.id))!==hash(a.get(d.id))).map(d=>({id:d.id,date:d.date,before:b.get(d.id),after:a.get(d.id)})),completedChanged:logged.filter(id=>hash(b.get(id))!==hash(a.get(id))),pastPredictionChanged:before.pred.filter(r=>r.w<7||['g7d2'].some(id=>matchPlanRows(v.weeks,before.pred).get(id)?.id===r.id)).filter(r=>hash(r)!==hash(rows.get(r.id))).map(r=>({before:r,after:rows.get(r.id)??null})),fitness:{vdot0:result.meta.vdot0,vdotGoal:result.meta.vdotGoal,predictedSec:result.meta.predictedSec,racePace:result.meta.racePace},goalChange:result.goalChange};
 }
 const original=hash({current,ctx}),result=planWithNewGoal(current,2400,today,ctx),primary=checks(current,result,ctx);primary.inputsPure=original===hash({current,ctx});
 // Independent preservation stress: valid stored prescriptions have prior adjustments;
 // these are seeded domain snapshots, not inferred from actual UI or raw fixture history.
 const protectedPlan=clone(current),protectionContext=clone(ctx),pd=map(protectedPlan);
 function refresh(id){const d=pd.get(id);d.km=sessKm(d.session);d.desc=sessDesc(d.session);const w=protectedPlan.weeks.find(w=>w.days.includes(d));const oldRow=matchPlanRows(resolvePlan(protectedPlan.weeks,{alts:{},moves:{}}).weeks,protectedPlan.pred).get(id);if(oldRow){const generated=derivePred([{...w,days:[d]}],protectedPlan.meta.raceDistM,protectedPlan.meta)[0];Object.assign(oldRow,generated);}Object.assign(protectedPlan.qs,deriveQSById([{...w,days:[d]}]));}
 pd.get('g7d2').session.paceSec=251;refresh('g7d2'); // already completed current-week adjusted prescription
 pd.get('g7d5').session.paceSec=253;refresh('g7d5');
 protectionContext.log.g7d5={status:'done',km:pd.get('g7d5').km,sec:Math.round(pd.get('g7d5').km*253),runDate:'2026-11-24',rpe:6};
 pd.get('g9d5').session.wuKm=3.7;pd.get('g9d5').session.overrides.wuKm=true;refresh('g9d5');
 // Manual kind/type change makes merge-by-kind preservation insufficient.
 pd.get('g9d2').session={type:'int',kind:'Oštrina',zone:'R',wuKm:2,cdKm:1.5,paceSec:240,reps:5,repM:200,restSec:120,overrides:{reps:true,repM:true,kind:true}};refresh('g9d2');
 protectionContext.alts.g8d1={tag:'lako',km:4.2,desc:'U05 manual future 4.2 km easy'};
 pd.get('g10d2').session.paceSec=253;refresh('g10d2');
 const measured=matchPlanRows(resolvePlan(protectedPlan.weeks,{alts:{},moves:{}}).weeks,protectedPlan.pred).get('g10d2');protectionContext.pred[measured.id]=253;protectionContext.predLock[measured.id]=true;
 pd.get('g7d7').km+=0.4;pd.get('g7d7').desc+=' · prior stored adjustment';protectionContext.moves.g7d7='2026-11-24';protectionContext.moves.g7d2='2026-11-29';
 const protectedOriginal=hash({protectedPlan,protectionContext}),preserved=planWithNewGoal(protectedPlan,2400,today,protectionContext),protection=checks(protectedPlan,preserved,protectionContext);
 if(!('error'in preserved)){const pa=map(preserved);protection.dayChecks=Object.fromEntries(['g7d2','g7d5','g7d7','g9d2','g9d5','g8d1','g10d2'].map(id=>[id,{stable:hash(pd.get(id))===hash(pa.get(id)),before:pd.get(id),after:pa.get(id)}]));protection.measuredRowStable=preserved.pred.some(r=>hash(r)===hash(measured));protection.manualWarnings=preserved.meta.dayWarnings.filter(w=>w.includes('Ručno'));}
 protection.inputsPure=protectedOriginal===hash({protectedPlan,protectionContext});
 out.versions[key]={fixtureSha256:raw.versions[key].sha256,sourceRoot:root,input:{plan:current,context:ctx},result,checks:primary,audit:'error'in result?null:audit(result),protection:{seedExplanation:'Separate valid domain snapshots with past/early-completed adjusted paces, a moved adjusted LR, manual warmup and kind edits, manual alt, measured locked future pace. Primary event remains unmodified frozen fixture.',input:{plan:protectedPlan,context:protectionContext},result:preserved,checks:protection},sourceHashes:Object.fromEntries(['domain/plan/replan.ts','domain/plan/adapt.ts','domain/training/generator/generatePlan.ts'].map(p=>[p,hash(readFileSync(resolve(root,'web/src/'+p),'utf8'))]))};
}
writeFileSync(new URL('U05-event.json',import.meta.url),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(out.versions).map(([k,v])=>[k,{checks:v.checks,auditFailures:v.audit?.failures,protection:{...v.protection.checks,dayChecks:Object.fromEntries(Object.entries(v.protection.checks.dayChecks??{}).map(([id,x])=>[id,x.stable])),pastChanged:v.protection.checks.pastChanged?.map(d=>({id:d.id,date:d.date})),pastPredictionChanged:v.protection.checks.pastPredictionChanged}}])),null,2));
