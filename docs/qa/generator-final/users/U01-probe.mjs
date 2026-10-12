// Reproduce: node docs/qa/generator-final/users/U01-probe.mjs
// Node 24 production APIs only. Locked historical QA is read-only.
import { registerHooks } from 'node:module';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
registerHooks({resolve(s,c,n){try{return n(s,c);}catch(e){if(s.startsWith('.'))for(const x of ['.ts','/index.ts'])try{return n(s+x,c);}catch{}throw e;}}});
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const roots = {old: resolve(repo,'../generator-a'),new:repo};
const rawPath=resolve(repo,'docs/qa/generator-final/raw/U01.json');
const eventPath=resolve(repo,'docs/qa/generator-ab/users/U01-event.json');
const originalProbePath=resolve(repo,'docs/qa/generator-ab/users/U01-probe.mjs');
const raw=JSON.parse(readFileSync(rawPath,'utf8'));
const original=JSON.parse(readFileSync(eventPath,'utf8'));
const clone=x=>structuredClone(x);
const hash=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex');
const originalFileHashes=Object.fromEntries([rawPath,eventPath,originalProbePath].map(p=>[p,hash(readFileSync(p))]));
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const checks=[];
const check=(name,pass,detail=null,candidate=true)=>{checks.push({name,pass:!!pass,candidate,detail});return !!pass;};
const output={id:'U01',command:'node docs/qa/generator-final/users/U01-probe.mjs',nodeVersion:process.version,scope:'All raw A/B weeks/days and independent real-version API historical event replay. No browser/device/cloud interaction.',roots,lockedFileHashes:originalFileHashes,profile:raw.profile,versions:{},historicalEvent:{today:original.today,event:clone(original.event),historySource:original.historySource,method:'Both frozen historical old/new log payloads are replayed unchanged through each version. Entries are never rebuilt from current prescriptions.'},supplemental:{label:'Added controls; not part of frozen historical single-miss event'},checks};
const mods={};
for(const key of ['old','new']){
 const base=roots[key];
 const imp=async p=>import(pathToFileURL(resolve(base,'web/src/domain',p)).href);
 const [gen,adapt,resolveMod,exec,adjust,calc]=await Promise.all([imp('training/generator/generatePlan.ts'),imp('plan/adapt.ts'),imp('plan/resolve.ts'),imp('training/execution.ts'),imp('plan/executionAdjustment.ts'),imp('training/sessions/calc.ts')]);
 mods[key]={...gen,...adapt,...resolveMod,...exec,...adjust,...calc};
 const files=[];
 const walk=dir=>{for(const ent of readdirSync(dir,{withFileTypes:true})){const p=resolve(dir,ent.name);if(ent.isDirectory())walk(p);else if(ent.name.endsWith('.ts')&&!/\.(test|spec)\./.test(ent.name)&&!ent.name.endsWith('.pruned'))files.push(p);}};
 walk(resolve(base,'web/src/domain'));
 const sourceHashes=Object.fromEntries(files.sort().map(p=>[p.slice(base.length+1),hash(readFileSync(p))]));
 const generated=gen.generatePlan(clone(raw.profile.input));
 check(`${key}: real generator reproduces raw hash`,hash(generated)===raw.versions[key].sha256,{generated:hash(generated),frozen:raw.versions[key].sha256});
 const current={...adapt.adaptGeneratedPlan(generated),ulaz:clone(raw.profile.input)};
 const resolvedPlan=resolveMod.resolvePlan(current.weeks,{alts:{},moves:{}});
 const weekInspection=generated.weeks.map(w=>{
  const sum=w.days.reduce((n,d)=>n+(d.km??0),0);
  check(`${key}: W${w.w} weekly sum`,Math.abs(sum-w.vol)<=.051,{sum,reported:w.vol});
  check(`${key}: W${w.w} seven days and 3 runs`,w.days.length===7&&w.days.filter(d=>!d.rest&&d.km>0).length===3);
  const days=w.days.map(d=>{
   check(`${key}: W${w.w}D${d.dow} finite distance`,d.km==null||(Number.isFinite(d.km)&&d.km>=0));
   if(d.session){check(`${key}: W${w.w}D${d.dow} session km`,Math.abs(calc.sessKm(d.session)-d.km)<=.051,{calculated:calc.sessKm(d.session),stored:d.km});check(`${key}: W${w.w}D${d.dow} formatter description`,calc.sessDesc(d.session)===d.desc);}
   if(d.runWalk){check(`${key}: W${w.w}D${d.dow} run/walk text`,d.desc.includes(`${d.km} km`)&&d.desc.includes(`${d.runWalk.runSec/60} min trčanje / ${d.runWalk.walkSec/60} min hod`));}
   return {...d,...(d.session?{calculatedKm:calc.sessKm(d.session),versionFormatterDesc:calc.sessDesc(d.session)}:{})};
  });
  return {...w,sum,days};
 });
 const replays={};
 for(const payloadKey of ['old','new']){
  const log=clone(original.versions[payloadKey].log);const before=hash({current,log});
  const analysis=exec.analyzeExecution({plan:resolvedPlan,log,today:original.today});
  const recommendation=exec.recommendExecution(analysis);
  const adjustment=adjust.buildExecutionAdjustment(current,original.today,analysis,{}, {log});
  const missed=resolvedPlan.byId.get(original.versions[payloadKey].missed.id);
  const sparseLog={[missed.id]:clone(log[missed.id])};
  const sparseAnalysis=exec.analyzeExecution({plan:resolvedPlan,log:sparseLog,today:original.today});
  const sparseRecommendation=exec.recommendExecution(sparseAnalysis);
  const sparseAdjustment=adjust.buildExecutionAdjustment(current,original.today,sparseAnalysis,{}, {log:sparseLog});
  const replayChecks={
   exactFrozenLog:hash(log)===hash(original.versions[payloadKey].log),
   exactEvent:missed.id==='g7d3'&&missed.date===original.today,
   oneMiss:analysis.missed===1&&analysis.explicitMisses14d===1,
   recentRun:analysis.lastRunDate==='2026-11-23'&&analysis.daysSinceLastRun===2,
   actualMileageFromFrozenPayload:Math.abs(analysis.actualKm-original.versions[payloadKey].analysis.actualKm)<1e-9,
   singleMiss:recommendation.kind==='single-miss'&&!recommendation.actionable&&!recommendation.requiresConfirmation,
   noRegeneration:'error'in adjustment&&!('result'in adjustment)&&adjustment.error===recommendation.reason,
   inputsUnchanged:before===hash({current,log}),
   unknownNotMissed:sparseAnalysis.completed===0&&sparseAnalysis.missed===1&&sparseAnalysis.unknown===resolvedPlan.dated.filter(d=>!d.rest&&d.km>0&&d.tag!=='snaga'&&d.date<=original.today&&d.date>=sparseAnalysis.windowStart).length-1,
   sparseNoMileage:sparseAnalysis.actualKm===0&&sparseAnalysis.recentWeeklyKm===null,
   sparseNoRegeneration:sparseRecommendation.kind==='single-miss'&&'error'in sparseAdjustment
  };
  for(const [name,pass]of Object.entries(replayChecks))check(`${key}/frozen-${payloadKey}: ${name}`,pass);
  replays[payloadKey]={payloadSha256:hash(log),log,missed,analysis,recommendation,adjustment,sparseLog,sparseAnalysis,sparseRecommendation,sparseAdjustment,checks:replayChecks};
 }
 output.versions[key]={sourceRoot:base,sourceTreeSha256:hash(sourceHashes),sourceHashes,generatedPlanSha256:hash(generated),current,replays,weekInspection,runWalkApiAvailability:{assessment:existsSync(resolve(base,'web/src/domain/training/runWalkProgress.ts')),adjustment:existsSync(resolve(base,'web/src/domain/plan/runWalkAdjustment.ts'))}};
}
const deltas=[];
for(let i=0;i<raw.versions.old.plan.weeks.length;i++){
 const a=raw.versions.old.plan.weeks[i],b=raw.versions.new.plan.weeks[i];
 for(let j=0;j<a.days.length;j++)for(const field of new Set([...Object.keys(a.days[j]),...Object.keys(b.days[j])]))if(!eq(a.days[j][field],b.days[j][field]))deltas.push({w:a.w,dow:a.days[j].dow,field,A:a.days[j][field]??null,B:b.days[j][field]??null});
}
output.comparison={weeks:12,daysPerVersion:84,dayFieldDeltas:deltas,metadataDeltas:Object.fromEntries([...new Set([...Object.keys(raw.versions.old.plan.meta),...Object.keys(raw.versions.new.plan.meta)])].filter(k=>!eq(raw.versions.old.plan.meta[k],raw.versions.new.plan.meta[k])).map(k=>[k,{A:raw.versions.old.plan.meta[k]??null,B:raw.versions.new.plan.meta[k]??null}]))};
check('candidate: all prescribed day distances match A',deltas.every(d=>d.field!=='km'));
check('candidate: trial week removes strides',!raw.versions.new.plan.weeks[4].days.some(d=>d.strides||d.session));
check('candidate: race-pace recovery is numeric and described',raw.versions.new.plan.weeks[10].days[2].session.restSec===90&&raw.versions.new.plan.weeks[10].days[2].desc.includes('1:30 min hoda'));
const {assessRunWalkProgress}=await import(pathToFileURL(resolve(repo,'web/src/domain/training/runWalkProgress.ts')).href);
const {buildRunWalkAdjustment,runWalkLadderFor}=await import(pathToFileURL(resolve(repo,'web/src/domain/plan/runWalkAdjustment.ts')).href);
const api=mods.new,current=clone(output.versions.new.current);
const rp=api.resolvePlan(current.weeks,{alts:{},moves:{}});
const finalRung=rp.dated.filter(d=>d.w===4&&d.tag==='rw');
const logFor=(rpe,knee)=>Object.fromEntries(finalRung.map(d=>[d.id,{status:'done',km:d.km,runDate:d.date,...(rpe===undefined?{}:{rpe}),...(knee===undefined?{}:{knee})}]));
const scenarios={empty:{},doneWithoutEffort:logFor(),tolerated:logFor(3,0),borderline:logFor(6,0),hard:logFor(8,0),pain:logFor(3,4),twoMisses:Object.fromEntries(finalRung.slice(0,2).map(d=>[d.id,{status:'skip',runDate:d.date}]))};
const expected={empty:'unknown',doneWithoutEffort:'unknown',tolerated:'advance',borderline:'hold',hard:'step-back',pain:'step-back',twoMisses:'hold'};
output.supplemental.baselineLimitation='A has no runWalkProgress or runWalkAdjustment API. No candidate consumer is substituted for A.';
output.supplemental.assessments={};
for(const [name,log]of Object.entries(scenarios)){
 const before=hash(log);const assessment=assessRunWalkProgress({plan:rp,log,today:'2026-11-08'});
 check(`supplemental assessment ${name}`,assessment.decision===expected[name],{expected:expected[name],assessment});
 check(`supplemental assessment ${name} leaves log unchanged`,hash(log)===before);
 output.supplemental.assessments[name]={log,today:'2026-11-08',assessment};
}
check('candidate: W5 continuous run is explicitly trial',raw.versions.new.plan.weeks[4].days.filter(d=>!d.rest&&d.km>0).every(d=>/Prelaz na neprekidno trčanje je probni/.test(d.desc)));
const today='2026-11-04';const assessment=assessRunWalkProgress({plan:rp,log:{},today});
output.supplemental.adjustments={};
for(const mode of ['hold','step-back','repeat-phase']){
 const before=hash(current);const built=buildRunWalkAdjustment(current,today,assessment,{mode});
 check(`supplemental ${mode}: adjustment succeeds`,'result'in built,built);
 if(!('result'in built)){output.supplemental.adjustments[mode]=built;continue;}
 const after=api.resolvePlan(built.result.weeks,{alts:{},moves:{}});const ladder=runWalkLadderFor(4,mode);
 const pattern=after.weeks.filter(w=>w.w>=4).map(w=>({w:w.w,runs:w.days.filter(d=>!d.rest&&d.km>0&&d.date>today).map(d=>({id:d.id,date:d.date,tag:d.tag,km:d.km,runWalk:d.runWalk??null,desc:d.desc}))}));
 check(`supplemental ${mode}: ladder preserved`,eq(built.result.meta.runWalk.ladder,ladder),{ladder,actual:built.result.meta.runWalk.ladder});
 const seconds=[60,120,180,300];
 for(let i=0;i<ladder.length;i++)check(`supplemental ${mode}: W${4+i} actual rung`,pattern[i].runs.length>0&&pattern[i].runs.every(d=>d.tag==='rw'&&d.runWalk.runSec===seconds[ladder[i]-1]),pattern[i]);
 check(`supplemental ${mode}: trial follows ladder`,pattern[ladder.length].runs.every(d=>d.tag!=='rw'&&/Prelaz na neprekidno trčanje je probni/.test(d.desc)),pattern[ladder.length]);
 check(`supplemental ${mode}: today/past unchanged`,rp.dated.filter(d=>d.date<=today).every(d=>eq(current.weeks.flatMap(w=>w.days).find(x=>x.id===d.id),built.result.weeks.flatMap(w=>w.days).find(x=>x.id===d.id))));
 check(`supplemental ${mode}: goal and race kept`,built.result.meta.goalSec===1800&&built.result.meta.raceDate==='2027-01-03'&&built.result.ulaz.goalSec===1800&&built.result.ulaz.raceDate==='2027-01-03');
 check(`supplemental ${mode}: source unchanged`,hash(current)===before);
 const arithmetic=[];for(const w of built.result.weeks)for(const d of w.days)if(d.session&&(Math.abs(api.sessKm(d.session)-d.km)>.051||api.sessDesc(d.session)!==d.desc))arithmetic.push(d.id);
 check(`supplemental ${mode}: session arithmetic/text`,arithmetic.length===0,arithmetic);
 output.supplemental.adjustments[mode]={options:{mode},today,assessment,summary:built.summary,meta:built.result.meta,pattern,resultSha256:hash(built.result)};
}
// Distinct explicit preservation controls (future actuals, manual overlay, effective-date move and locked measurement).
const row=current.pred.find(r=>r.w===7);const context={log:{g5d1:{status:'done',km:2.4,sec:1700,runDate:'2026-11-05',rpe:3}},alts:{g5d3:{tag:'lako',km:4.2,desc:'U01 manual 4.2 km',rw:null,pace:null,paceAuto:false}},moves:{g4d2:'2026-11-15',g5d7:'2026-11-03'},pred:{[row.id]:{sec:777,km:1}},predLock:{[row.id]:true}};
const stateBefore=hash({current,context});const preserved=buildRunWalkAdjustment(current,today,assessment,{mode:'hold'},context);
check('supplemental protected adjustment succeeds','result'in preserved);
if('result'in preserved){
 const all=preserved.result.weeks.flatMap(w=>w.days),old=current.weeks.flatMap(w=>w.days);
 for(const id of ['g5d1','g5d3','g5d7'])check(`supplemental protected ${id}`,eq(all.find(d=>d.id===id),old.find(d=>d.id===id)));
 check('supplemental locked measured prediction preserved',eq(preserved.result.pred.find(r=>r.id===row.id),row));
 check('supplemental measured day preserved',eq(all.find(d=>d.id==='g7d3'),old.find(d=>d.id==='g7d3')));
 check('supplemental measured day old session formatter still matches',api.sessDesc(all.find(d=>d.id==='g7d3').session)===all.find(d=>d.id==='g7d3').desc);
 const effective=api.resolvePlan(preserved.result.weeks,{alts:context.alts,moves:context.moves});
 check('supplemental effective move date preserved',effective.byId.get('g5d7').date==='2026-11-03');
 check('supplemental manual effective distance preserved',effective.byId.get('g5d3').km===4.2);
 check('supplemental manual conflict surfaced',preserved.result.meta.futureChanges.conflicts.some(s=>/Ručno izmenjen trening/.test(s)));
 output.supplemental.preservation={today,context,lockedRow:row,resultSha256:hash(preserved.result),futureChanges:preserved.result.meta.futureChanges};
}
check('supplemental preservation inputs unchanged',stateBefore===hash({current,context}));
for(const [name,value]of Object.entries({notStarted:buildRunWalkAdjustment(current,today,assessRunWalkProgress({plan:rp,log:{},today:'2026-10-11'}),{mode:'hold'}),missingInputs:buildRunWalkAdjustment({...current,ulaz:undefined},today,assessment,{mode:'hold'}),tooLate:buildRunWalkAdjustment(current,'2026-12-14',assessment,{mode:'hold'})})){
 check(`supplemental guard ${name}`,'error'in value,value);(output.supplemental.guards??={})[name]=value;
}
check('all locked input files unchanged',Object.entries(originalFileHashes).every(([p,h])=>hash(readFileSync(p))===h));
output.allChecksPass=checks.every(c=>c.pass);output.candidateInvariantsPass=checks.filter(c=>c.candidate).every(c=>c.pass);
writeFileSync(resolve(repo,'docs/qa/generator-final/users/U01-event.json'),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({id:'U01',checks:checks.length,allChecksPass:output.allChecksPass,failures:checks.filter(c=>!c.pass),dayDeltaCount:deltas.length,roots}));
process.exitCode=output.candidateInvariantsPass?0:1;
