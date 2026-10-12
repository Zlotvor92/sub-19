// Independent U08 QA. Writes only NEW supplemental evidence; locked inputs are read-only.
import { registerHooks } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
registerHooks({resolve(s,c,n){try{return n(s,c);}catch(e){if(s.startsWith('.'))for(const x of ['.ts','/index.ts'])try{return n(s+x,c);}catch{}throw e;}}});
const imp = p => import(new URL('../../../../web/src/'+p,import.meta.url));
const {executionBasis,buildExecutionAdjustment}=await imp('domain/plan/executionAdjustment.ts');
const {buildPreparationChoice,preparationCoverage}=await imp('domain/plan/preparationDecision.ts');
const {preparationSummary}=await imp('domain/plan/preparation.ts');
const {resolvePlan}=await imp('domain/plan/resolve.ts');
const {adaptGeneratedPlan}=await imp('domain/plan/adapt.ts');
const {matchPlanRows}=await imp('domain/training/adaptation/matching.ts');
const {sessKm,sessQKm,sessDesc}=await imp('domain/training/sessions/calc.ts');
const {deriveQSById}=await imp('domain/training/prediction/index.ts');
const {zoneBudgetKm}=await imp('domain/training/sessions/constraints.ts');
const {weeklyFastEnvelopeSec}=await imp('domain/training/generator/weeklyLoad.ts');
const {paceForZone}=await imp('domain/training/vdot/paceForZone.ts');
const {isDemanding}=await imp('domain/plan/finalize.ts');
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)??'undefined').digest('hex');
const clone=x=>JSON.parse(JSON.stringify(x));
const round=x=>+x.toFixed(3);
const source=new URL('../../generator-ab/users/U08-event.json',import.meta.url), bytes=readFileSync(source,'utf8');
const locked=JSON.parse(bytes), primary=locked.event;
const raw=JSON.parse(readFileSync(new URL('../raw/U08.json',import.meta.url)));
const generic=JSON.parse(readFileSync(new URL('U08-event.json',import.meta.url)));
const counts={assertions:0,baselineWeeks:0,baselineDays:0,baselineSessions:0,choiceWeeks:0,choiceDays:0,choiceSessions:0,protectionWeeks:0,protectionDays:0};
const checks=[];
function check(label, actual){counts.assertions++;checks.push({label,passed:!!actual});assert(actual,label);}
const view=(p,c={})=>resolvePlan(p.weeks,{alts:c.alts??{},moves:c.moves??{}});
const bodyMap=p=>new Map(p.weeks.flatMap(w=>w.days).map(d=>[d.id,d]));
function audit(plan,context={},today=null,original=null,kind='baseline'){
 const resolved=view(plan,context), matching=matchPlanRows(view(plan).weeks,plan.pred), failures=[];
 const originalBodies=original&&bodyMap(original), oldMatching=original&&matchPlanRows(view(original,{moves:context.moves}).weeks,original.pred);
 const protectedIds=original?view(original,context).dated.filter(d=>{
  const b=originalBodies.get(d.id),r=oldMatching.get(d.id),a=context.alts?.[d.id];
  return d.date<=today||context.log?.[d.id]?.status==='done'||r&&(context.pred?.[r.id]!=null||context.predLock?.[r.id])||Object.values(b.session?.overrides??{}).some(Boolean)||a&&(!a.paceAuto||a.tag!==b.tag||a.km!==b.km||a.desc!==b.desc||a.rw!=null||a.snaga);
 }).map(d=>d.id):[];
 const protectedSet=new Set(protectedIds), outBodies=bodyMap(plan), outRows=new Map(plan.pred.map(r=>[r.id,r]));
 const protectedChecks=original?{
  days:protectedIds.every(id=>hash(originalBodies.get(id))===hash(outBodies.get(id))),
  qs:protectedIds.every(id=>hash(original.qs?.[id])===hash(plan.qs?.[id])),
  pred:[...oldMatching].filter(([id])=>protectedSet.has(id)).every(([,r])=>hash(r)===hash(outRows.get(r.id))),
  measured:original.pred.filter(r=>context.pred?.[r.id]!=null||context.predLock?.[r.id]).every(r=>hash(r)===hash(outRows.get(r.id))),
  dates:view(original,context).dated.every(d=>resolved.byId.get(d.id)?.date===d.date)
 }:{};
 const weeks=plan.weeks.map(w=>{
  counts[kind+'Weeks']++; const days=w.days.map(d=>{
   counts[kind+'Days']++;const s=d.session,q=s?sessQKm(s):0,editable=!protectedSet.has(d.id),row=matching.get(d.id);
   if(s){if(kind==='baseline'||kind==='choice')counts[kind+'Sessions']++;
    if(editable){
     if(Math.abs(sessKm(s)-d.km)>.051)failures.push({id:d.id,reason:'session-km'});
     if(d.desc!==sessDesc(s))failures.push({id:d.id,reason:'session-description'});
     if(!row||Math.abs(row.q-q)>.051||row.pt!==s.paceSec||row.zone!==s.zone)failures.push({id:d.id,reason:'PRED-dose/pace/zone'});
     if(hash(deriveQSById([{...w,days:[d]}])[d.id])!==hash(plan.qs?.[d.id]))failures.push({id:d.id,reason:'QS'});
    }
   }
   const date=resolved.byId.get(d.id).date;
   if(editable&&(!today||date>today)&&!s&&!d.strides&&!d.finish&&/ubrzanja|poslednjih .*km @/.test(d.desc??''))failures.push({id:d.id,reason:'stale-description'});
   return {id:d.id,date,tag:d.tag??null,km:d.km??0,protected:protectedSet.has(d.id),qualityKm:round(q),workMinutes:round(s?(s.type==='fartlek'?s.reps*s.repSec:q*s.paceSec)/60:0),finishMinutes:round(d.finish?d.finish.km*d.finish.paceSec/60:0),strides:d.strides??null,finish:d.finish??null,session:s??null,desc:d.desc??null};
  });
  const future=days.filter(d=>!today||d.date>today), total=round(days.reduce((n,d)=>n+d.km,0));
  return {w:w.w,start:w.start,km:total,futureKm:round(future.reduce((n,d)=>n+d.km,0)),lrKm:Math.max(0,...future.filter(d=>d.tag==='lr'&&!outBodies.get(d.id).mlr).map(d=>d.km)),workMinutes:round(future.reduce((n,d)=>n+d.workMinutes+d.finishMinutes,0)),deload:!!w.deload,taper:!!w.taper,focus:w.focus,days};
 });
 return {weeks,failures,protectedIds,protectedChecks};
}
const baselines={};
for(const [v,x]of Object.entries(raw.versions)){
 check(v+' frozen plan hash',hash(x.plan)===x.sha256);
 const plan=adaptGeneratedPlan(clone(x.plan));
 const a=audit(plan);
 check(v+' all baseline arithmetic/description/QS/PRED',a.failures.length===0);
 check(v+' baseline week volume sums',x.plan.weeks.every(w=>Math.abs(w.vol-w.days.reduce((n,d)=>n+(d.km??0),0))<=.051));
 baselines[v]={sha256:x.sha256,audit:a};
}
const envelopeFailures=[],envelopes=[];
for(const w of raw.versions.new.plan.weeks){
 const vol=w.days.reduce((n,d)=>n+(d.km??0),0),lr=Math.max(0,...w.days.filter(d=>d.tag==='lr'&&!d.mlr).map(d=>d.km));
 const used=w.days.reduce((n,d)=>n+(d.session?sessQKm(d.session)*d.session.paceSec:0)+(d.finish?d.finish.km*d.finish.paceSec:0),0);
 const cap=weeklyFastEnvelopeSec({readiness:'experienced',volKm:vol,easyPaceSec:paceForZone(raw.versions.new.plan.meta.vdot0,'E'),longRunKm:lr,longRunPaceSec:paceForZone(raw.versions.new.plan.meta.vdot0,'LR'),share:0.14});
 const sessionChecks=w.days.filter(d=>d.session).map(d=>({dow:d.dow,q:sessQKm(d.session),ceiling:zoneBudgetKm(d.session,vol),tContinuousSec:d.session.type==='tempo'&&d.session.zone==='T'?sessQKm(d.session)*d.session.paceSec:null}));
 if(used>cap+1e-7)envelopeFailures.push({w:w.w,reason:'weekly-fast',used,cap});
 for(const s of sessionChecks)if(s.q>s.ceiling+1e-7||s.tContinuousSec>1800)envelopeFailures.push({w:w.w,reason:'session-ceiling',...s});
 envelopes.push({w:w.w,usedMin:round(used/60),capMin:round(cap/60),sessionChecks});
}
check('B HM per-session work ceilings',envelopeFailures.filter(x=>x.reason==='session-ceiling').length===0);
// Delivered-denominator weekly envelope violations are reported as findings, never hidden
// by treating the planned allocation as the delivered total or weakening its tolerance.
check('B early experienced HM threshold first dose doubled',raw.versions.new.summary.firstQuality.qKm===4&&raw.versions.old.summary.firstQuality.qKm===2);
check('B no R-purpose baseline quality',raw.versions.new.plan.weeks.flatMap(w=>w.days).filter(d=>d.session).every(d=>d.session.zone!=='R'));
check('B activation purpose accurate',raw.versions.new.plan.weeks.at(-1).days.find(d=>d.session)?.session.purpose==='activation');
check('B at most two session/finish baseline days',raw.versions.new.plan.weeks.every(w=>w.days.filter(d=>d.session||d.finish).length<=2));
const input=clone(primary.input),today=primary.today,frozen=hash({input,analysis:primary.analysis});
const adjustment=buildExecutionAdjustment(input.current,today,primary.analysis,input.options,input.context);
check('primary rejects full cycle with no plan result','error'in adjustment&&!('result'in adjustment));
check('primary inputs pure',hash({input,analysis:primary.analysis})===frozen);
check('primary 8 weeks below HM minimum10',primary.newCycleCalendarWeeks===8&&/10 nedelja/.test(adjustment.error));
check('B primary replay matches independently called API',hash(adjustment)===hash(generic.cases.primary.versions.new.adjustment));
const basis=executionBasis(input.current,today,primary.analysis,input.options);
check('valid locked primary execution basis',!('error'in basis)&&basis.weeklyKm===38.5&&basis.input.recentLongRunKm===11.2&&basis.input.consistentWeeks===24);
const choices={};
for(const option of adjustment.decision.options){
 const before=hash({input,basis});
 const actual=buildPreparationChoice(input.current,today,basis,clone(option.choice),input.context);
 check(option.id+' builds through real API',!('error'in actual));
 check(option.id+' input/context/basis purity',hash({input,basis})===before);
 const a=audit(actual.result,input.context,today,input.current,'choice');
 check(option.id+' editable arithmetic/descriptions/PRED/QS',a.failures.length===0);
 for(const [k,v]of Object.entries(a.protectedChecks))check(option.id+' protected '+k,v);
 const rw=actual.result.meta.finalization.returnWindow;
 const returnDays=a.weeks.flatMap(w=>w.days).filter(d=>d.date>today&&d.date<rw.end);
 check(option.id+' return window exact',rw.start==='2026-11-26'&&rw.end==='2026-12-14'&&rw.requiredWeeks===3);
 check(option.id+' return no session/finish/strides',returnDays.every(d=>!isDemanding(d)));
 check(option.id+' return old LR22 absent',Math.max(...returnDays.map(d=>d.km))<=16);
 check(option.id+' option numbers match delivered meta',option.peakLongRunKm===actual.result.meta.preparation.peakLongRunKm&&option.peakWeeklyKm===actual.result.meta.preparation.peakWeeklyKm);
 check(option.id+' explicit date/distance/goal',hash(actual.change.to)===hash({raceDate:option.raceDate,raceDistM:option.raceDistM,goalSec:option.goalSec}));
 const label=preparationSummary(actual.result.meta);
 if(option.id==='base'){
  check('base label never full even when endurance supported',label.fullPreparation===false&&label.mode.includes('nije puna priprema'));
  check('base clears meta and input time goal',actual.result.meta.goalSec===null&&actual.result.ulaz.goalSec===null);
  check('base future easy only excluding conditional race',a.weeks.flatMap(w=>w.days).filter(d=>d.date>today&&d.tag!=='trka').every(d=>!isDemanding(d)));
  check('base cap remains at prebreak55 and LR16',actual.result.meta.preparation.peakWeeklyKm<=55&&actual.result.meta.preparation.peakLongRunKm<=16);
  check('base race start conditional',a.weeks.flatMap(w=>w.days).find(d=>d.tag==='trka').desc.includes('Start odluči prema uslovima nastavka'));
 }
 choices[option.id]={option,actual,audit:a,returnDays,label,deliveredCoverage:preparationCoverage(actual.result.meta.preparation,actual.result.meta.raceDistM)};
}
check('all advertised extend/shorter/base choices checked',hash(Object.keys(choices))===hash(['extend','shorter-10000','base']));
// Separate protection controls, never substituted for the locked primary/context above.
const protectionContext=clone(input.context), protectionCurrent=clone(input.current);
const bodies=bodyMap(protectionCurrent),rows=matchPlanRows(view(protectionCurrent).weeks,protectionCurrent.pred);
const manualId='g7d5', doneId='g8d3', moveId='g8d1';
bodies.get(manualId).session.overrides={reps:true};
// Baseline W8 is easy, so use a real quality day in W9 within the return window.
const measuredActualId='g9d2', measuredRow=rows.get(measuredActualId);
protectionContext.pred[measuredRow.id]=277;protectionContext.predLock[measuredRow.id]=true;
protectionContext.log[doneId]={status:'done',km:9.1,runDate:'2026-12-02',ts:'2026-12-02T18:00:00Z'};
protectionContext.moves[moveId]='2026-12-02';
protectionContext.alts['g8d5']={tag:'lako',km:4,desc:'U08 manual easy overlay',paceAuto:false};
const protection={scope:'Separate cloned context with future manual session, manual overlay, measured+locked session, explicit completed run and move. These are supplemental synthetic sentinels, absent from the locked primary.',sentinels:{manualId,measuredId:measuredActualId,measuredRow:measuredRow.id,doneId,moveId,overlayId:'g8d5'},input:{current:protectionCurrent,context:protectionContext},choices:{}};
for(const option of adjustment.decision.options){
 const before=hash(protection.input);
 const actual=buildPreparationChoice(protectionCurrent,today,basis,clone(option.choice),protectionContext);
 check('protection '+option.id+' builds',!('error'in actual));
 const a=audit(actual.result,protectionContext,today,protectionCurrent,'protection');
 check('protection '+option.id+' editable consistency',a.failures.length===0);
 check('protection '+option.id+' input/log/measured/moves/overlay pure',hash(protection.input)===before);
 for(const [k,v]of Object.entries(a.protectedChecks))check('protection '+option.id+' preserved '+k,v);
 const conflicts=actual.result.meta.futureChanges?.conflicts??[];
 check('protection '+option.id+' manual and measured return conflicts named',conflicts.some(s=>s.includes(manualId))&&conflicts.some(s=>s.includes(measuredActualId)));
 protection.choices[option.id]={actual,audit:a,conflicts};
}
check('source bytes unchanged',hash(readFileSync(source,'utf8'))===hash(bytes));
const output={id:'U08',scope:'Independent full-day baseline audit plus primary locked-choice builds and separate protection sentinels. No UI/store/browser/race-outcome claims.',sourceEvidenceSha256:hash(bytes),counts,checks,baselines,envelopes,envelopeFailures,primary:{today,calendarWeeks:primary.newCycleCalendarWeeks,input,analysis:primary.analysis,basis,adjustment},choices,protection,earlierControlled:{scope:'Separate literal October28 replay; not substituted for primary November25.',old:generic.cases.earlierControlled.versions.old.audit,new:generic.cases.earlierControlled.versions.new.audit}};
writeFileSync(new URL('U08-controls.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({id:'U08',counts,envelopeFailures,choices:Object.fromEntries(Object.entries(choices).map(([id,x])=>[id,{protected:x.audit.protectedIds.length,returnMaxKm:Math.max(...x.returnDays.map(d=>d.km)),date:x.actual.change.to.raceDate,dist:x.actual.change.to.raceDistM,goal:x.actual.change.to.goalSec,preparation:x.actual.result.meta.preparation,weekly:x.audit.weeks.filter(w=>w.futureKm>0).map(({days,...w})=>w)}]))},null,2));
