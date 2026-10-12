import { registerHooks } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
registerHooks({ resolve(s,c,n) { try{return n(s,c);}catch(e){if(s.startsWith('.'))for(const x of ['.ts','/index.ts'])try{return n(s+x,c);}catch{}throw e;} } });
const root=resolve(import.meta.dirname,'../../../..');
const read=p=>JSON.parse(readFileSync(resolve(root,p),'utf8'));
const hash=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)??'undefined').digest('hex');
const originalPath='docs/qa/generator-ab/users/U06-event.json';
const originalHash=hash(readFileSync(resolve(root,originalPath),'utf8'));
const original=read(originalPath), raw=read('docs/qa/generator-final/raw/U06.json');
const replay=read('docs/qa/generator-final/users/U06-event.json'), frozen=replay.cases.primary;
const roots=read('docs/qa/generator-final/manifest.json').localRoots;
const gate=await import(pathToFileURL(resolve(root,'web/src/domain/training/qualityGate.ts')));
const initial={};
for(const [version, record] of Object.entries(raw.versions)) {
  const calc=await import(pathToFileURL(resolve(roots[version],'web/src/domain/training/sessions/calc.ts')));
  const failures=[];
  const weeks=record.plan.weeks.map(w=>{
    const sum=+(w.days.reduce((n,d)=>n+(d.km??0),0)).toFixed(3);
    if(Math.abs(sum-w.vol)>.051)failures.push({w:w.w,kind:'weekly-km',sum,vol:w.vol});
    for(const d of w.days)if(d.session){
      if(Math.abs(calc.sessKm(d.session)-d.km)>.051)failures.push({w:w.w,dow:d.dow,kind:'session-km'});
      if(calc.sessDesc(d.session)!==d.desc)failures.push({w:w.w,dow:d.dow,kind:'session-description'});
    }
    return {w:w.w,sum,focus:w.focus,deload:!!w.deload,taper:!!w.taper,days:w.days.map(d=>({dow:d.dow,tag:d.tag??'rest',km:d.km??null,rest:!!d.rest,desc:d.desc,session:d.session??null,strides:d.strides??null,finish:d.finish??null,runWalk:d.runWalk??null}))};
  });
  const preparationWeeks=weeks.filter(w=>!w.taper&&w.w<record.plan.meta.weeks);
  const peakWeeklyKm=Math.max(...preparationWeeks.map(w=>w.sum));
  const peakLongRunKm=Math.max(...record.plan.weeks.flatMap(w=>w.days).filter(d=>d.tag==='lr'&&!d.mlr).map(d=>d.km??0));
  initial[version]={coverage:{weeks:weeks.length,days:weeks.reduce((n,w)=>n+w.days.length,0)},failures,peakWeeklyKm,peakLongRunKm,metadataPeaksMatch:peakWeeklyKm===record.plan.meta.preparation.peakWeeklyKm&&peakLongRunKm===record.plan.meta.preparation.peakLongRunKm,weeks};
}
const event={};
for(const [version, record] of Object.entries(frozen.versions)){
  const plan=record.adjustment.result, audit=record.audit;
  const oldDays=frozen.input.current.weeks.flatMap(w=>w.days),newDays=new Map(plan.weeks.flatMap(w=>w.days).map(d=>[d.id,d]));
  const historicalRows=frozen.input.current.pred.filter(r=>r.w<=7);
  const resultRows=new Map(plan.pred.map(r=>[r.id,r]));
  const pastExact=audit.protectedIds.every(id=>hash(oldDays.find(d=>d.id===id))===hash(newDays.get(id)));
  const future=audit.weeks.flatMap(w=>w.days).filter(d=>d.date>frozen.input.today);
  const window=future.filter(d=>d.date>='2026-11-26'&&d.date<'2026-12-21');
  const demanding=d=>!!(d.session||d.strides||d.finish)||['tempo','int','trka','test'].includes(d.tag);
  const firstQuality=future.find(d=>d.session);
  event[version]={coverage:{weeks:plan.weeks.length,days:oldDays.length,protected:audit.protectedIds.length,future:future.length,returnWindowDays:window.length,returnWindowRunning:window.filter(d=>d.km>0).length},pastExact,historicalPredRows:historicalRows.length,historicalPredExact:historicalRows.every(r=>hash(r)===hash(resultRows.get(r.id))),nonemptyHistoricalQs:Object.keys(frozen.input.current.qs??{}).filter(id=>audit.protectedIds.includes(id)).length,semanticStaleFocus:audit.weeks.filter(w=>w.futureKm>0&&!w.days.filter(d=>d.date>frozen.input.today).some(demanding)&&/Fartlek|Tempo|Intervali|Progresivno|oštrina/i.test(w.focus)).map(w=>({w:w.w,focus:w.focus})),returnWindowDemanding:window.filter(demanding).map(d=>d.id),returnWindowStaleStrideText:window.filter(d=>/ubrzanja/.test(d.desc??'')).map(d=>d.id),firstQuality,allDatesUnchanged:audit.changedDates.length===0,inputPure:record.inputPure,analysisMatchesFrozen:record.analysisMatchesFrozen,metadataPeaksMatch:audit.peakFutureWeeklyKm===audit.preparation.peakWeeklyKm&&audit.peakFutureLongRunKm===audit.preparation.peakLongRunKm,weeks:audit.weeks.map(w=>({...w,days:w.days.map(d=>({...d,origin:undefined}))})),audit:{...audit,weeks:undefined,protectedIds:audit.protectedIds.length}};
}
const log=frozen.input.context.log;
const output={id:'U06',scope:'Independent U06 exhaustive static and literal domain replay QA; no browser, human, clinical, future execution or persistence claims.',originalHash,replaySourceHash:replay.sourceEvidenceSha256,sourceExact:originalHash===replay.sourceEvidenceSha256,normalizedCurrentExact:hash(original.input.current)===hash(frozen.input.current),optionsExact:hash(original.input.options)===hash(frozen.input.options),contextExact:hash(original.input.context)===hash(frozen.input.context),frozenInputHash:hash(frozen.input),initial,event,coverage:{initialWeekRecords:32,initialDayRecords:224,eventWeekRecords:32,eventDayRecords:224,totalWeekRecords:64,totalDayRecords:448},actuals:{totalLogEntries:Object.keys(log).length,done:Object.values(log).filter(x=>x.status==='done').length,skipped:Object.values(log).filter(x=>x.status==='skip').length,doneKm:Object.values(log).reduce((n,x)=>n+(x.status==='done'?x.km:0),0),measuredPredEntries:Object.keys(frozen.input.context.pred).length,predLockEntries:Object.keys(frozen.input.context.predLock).length,analysis:frozen.input.analysis},supplementalQualityGate:{input:'Exact frozen execution analysis, no recent measured form supplied; no edits to primary input.',recentMeasuredForm:gate.hasRecentMeasuredForm(frozen.input.today,{}),result:gate.qualityEntryGate({analysis:frozen.input.analysis,formConfirmed:false})},limits:['Measured PRED, locked future rows and nonempty historical QS are absent: preservation checks for those values are vacuous.','Quality gate is advisory; this case does not prove enforcement or successful reopening with actual measured form.','Initial B week 4 contains strides; the four early easy return weeks refer to the event window, not the initial plan.','Initial B race-week shakeouts retain reference numeric pace without an individual effort note.','A/B return output quality on January 20 is a planned reference, not evidence of completed future recovery.']};
if(originalHash!==hash(readFileSync(resolve(root,originalPath),'utf8')))throw Error('Original evidence changed');
writeFileSync(resolve(root,'docs/qa/generator-final/users/U06-findings.json'),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({coverage:output.coverage,sourceExact:output.sourceExact,initialFailures:Object.fromEntries(Object.entries(initial).map(([v,x])=>[v,x.failures])),event:Object.fromEntries(Object.entries(event).map(([v,x])=>[v,{coverage:x.coverage,pastExact:x.pastExact,historicalPredExact:x.historicalPredExact,returnWindowDemanding:x.returnWindowDemanding,staleStrideText:x.returnWindowStaleStrideText,metadataPeaksMatch:x.metadataPeaksMatch}])),supplementalQualityGate:output.supplementalQualityGate},null,2));
