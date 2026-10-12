// Independent U04 QA: reads frozen evidence and final replay, writes only own findings.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const originalPath = 'docs/qa/generator-ab/users/U04-event.json';
const digest = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const originalHash = digest(originalPath);
const original = read(originalPath);
const raw = read('docs/qa/generator-final/raw/U04.json');
const replay = read('docs/qa/generator-final/users/U04-event.json');
const equal = isDeepStrictEqual;
const r1 = x => Math.round(x*10)/10;
const plus = (date,n) => new Date(Date.parse(date+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
function arithmetic(s) {
  switch(s.type) {
    case 'int': return r1(s.wuKm+s.cdKm+s.reps*s.repM/1000+Math.max(s.reps-1,0)*(['Tempo isprekidan','Tempo trke','Kontrolna trka'].includes(s.kind)?s.restSec/(s.paceSec*1.35):0.15));
    case 'pyramid': return r1(s.wuKm+s.cdKm+s.reps.reduce((a,b)=>a+b,0)/1000+Math.max(s.reps.length-1,0)*0.15);
    case 'fartlek': return r1(s.wuKm+s.cdKm+s.reps*(s.repSec/s.paceSec+s.restSec/s.easyPaceSec));
    case 'prog': case 'tempo': return r1(s.wuKm+s.qKm+s.cdKm);
  }
}
const qs = s => s.type==='int'?[s.repM]:s.type==='pyramid'?s.reps:s.type==='tempo'?[Math.round(s.qKm*1000)]:undefined;
const qkm = s => s.type==='int'?r1(s.reps*s.repM/1000):s.type==='pyramid'?r1(s.reps.reduce((a,b)=>a+b,0)/1000):s.type==='fartlek'?r1(s.reps*s.repSec/s.paceSec):s.type==='prog'?r1(s.qKm/3):s.qKm;
function dates(plan,moves) {
 const occupied=new Set(),out={};
 for(const w of plan.weeks)for(const d of w.days){const orig=plus(w.start,d.dow),requested=moves[d.id]??orig;out[d.id]=occupied.has(requested)?orig:requested;occupied.add(out[d.id]);}
 return out;
}
function inspectPlan(plan, stored=false) {
  const failures=[],sessions=plan.weeks.flatMap(w=>w.days.filter(d=>d.session).map(d=>({w,d})));
  for(const {w,d} of sessions){
    if(arithmetic(d.session)!==d.km)failures.push({week:w.w,day:d.id??d.dow,reason:'arithmetic'});
    const spec=qs(d.session),key=stored?d.id:`n${w.w}d${d.dow}`;
    if(!equal(spec,plan.qs[key]))failures.push({week:w.w,day:key,reason:'QS'});
  }
  const rows=plan.pred;
  assert.equal(rows.length,sessions.length);
  for(let i=0;i<rows.length;i++){
    const {w,d}=sessions[i],row=rows[i];
    if(row.w!==w.w||row.l!==`N${w.w} · ${d.session.kind}`||row.q!==qkm(d.session)||row.pt!==d.session.paceSec||row.zone!==d.session.zone) failures.push({week:w.w,day:d.id??d.dow,reason:'PRED'});
  }
  return {weeks:plan.weeks.length,days:plan.weeks.reduce((n,w)=>n+w.days.length,0),runs:plan.weeks.flatMap(w=>w.days).filter(d=>d.km>0&&!d.rest).length,sessions:sessions.length,predRows:rows.length,qsEntries:Object.keys(plan.qs).length,failures};
}
const findings={id:'U04',scope:'Synthetic domain evidence only; no UI/store or actual elapsed-time proof.',originalSha256:originalHash,raw:{},cases:{}};
for(const v of ['old','new'])findings.raw[v]=inspectPlan(raw.versions[v].plan);
findings.raw.weekComparison=raw.versions.old.plan.weeks.map((a,i)=>{
 const b=raw.versions.new.plan.weeks[i];
 const changes=a.days.flatMap((d,j)=>{const e=b.days[j];const strip=x=>JSON.parse(JSON.stringify(x, (k,v)=>k==='purpose'?undefined:v));return equal(strip(d),strip(e))?[]:[{dow:d.dow,before:d,after:e}];});
 assert.equal(r1(a.days.reduce((n,d)=>n+(d.km??0),0)),a.vol);assert.equal(r1(b.days.reduce((n,d)=>n+(d.km??0),0)),b.vol);
 return {w:a.w,kmA:a.vol,kmB:b.vol,lrA:Math.max(0,...a.days.filter(d=>d.tag==='lr').map(d=>d.km)),lrB:Math.max(0,...b.days.filter(d=>d.tag==='lr').map(d=>d.km)),focusA:a.focus,focusB:b.focus,changes};
});
for(const [name,c]of Object.entries(replay.cases)){
 const locked=name==='primary'?original:original.protection;
 assert(equal(c.input.current,locked.input.current??locked.input.plan));assert(equal(c.input.context,locked.input.context??{log:locked.input.log??{}}));assert(equal(c.input.options,locked.input.options??{}));
 const ctx=c.input.context,current=c.input.current,all=current.weeks.flatMap(w=>w.days.map(d=>({w,d,date:plus(w.start,d.dow)})));
 const historical=all.filter(x=>x.date<=c.input.today),done=all.filter(x=>ctx.log[x.d.id]?.status==='done'),measurements=Object.keys(ctx.pred);
 const result={historicalCount:historical.length,currentDayCount:all.filter(x=>x.date===c.input.today).length,completedCount:done.length,logCount:Object.keys(ctx.log).length,loggedActualKm:r1(Object.values(ctx.log).reduce((n,d)=>n+(d.status==='done'?d.km??0:0),0)),actualDurationFields:Object.values(ctx.log).flatMap(d=>Object.keys(d).filter(k=>/sec|duration|elapsed/i.test(k))),measuredCount:measurements.length,versions:{}};
 for(const[v,x]of Object.entries(c.versions)){
  const p=x.adjustment.result,days=new Map(p.weeks.flatMap(w=>w.days.map(d=>[d.id,d]))),rows=new Map(p.pred.map(r=>[r.id,r]));
  const preserved=new Set([...historical,...done,...all.filter(x=>Object.values(x.d.session?.overrides??{}).some(Boolean)),...all.filter(x=>typeof ctx.moves[x.d.id]==='string'&&ctx.moves[x.d.id]<=c.input.today)].map(x=>x.d.id));
  const changed=[...preserved].filter(id=>!equal(all.find(x=>x.d.id===id).d,days.get(id)));
  const changedQs=[...preserved].filter(id=>!equal(current.qs[id],p.qs[id]));
  const changedMeasurements=measurements.filter(id=>!equal(current.pred.find(r=>r.id===id),rows.get(id)));
  const beforeDates=dates(current,ctx.moves),afterDates=dates(p,ctx.moves),changedDates=Object.keys(beforeDates).filter(id=>beforeDates[id]!==afterDates[id]);
  const initialFuture=all.filter(x=>x.date>c.input.today&&x.date<'2026-12-07').map(x=>days.get(x.d.id));
  const initialWork=initialFuture.filter(d=>d.session||d.strides||d.finish);
  const primaryFuture=all.filter(x=>x.date>c.input.today&&!preserved.has(x.d.id)).map(x=>days.get(x.d.id));
  const effortMissing=primaryFuture.filter(d=>d.km>0&&d.tag!=='trka'&&!/napor|Forma nije potvrđena/.test(d.desc??''));
  result.versions[v]={...inspectPlan(p,true),preservedCount:preserved.size,changed,changedQs,changedMeasurements,changedDates,dateCount:Object.keys(afterDates).length,requestedMove:ctx.moves.g7d7??null,effectiveMovedDate:afterDates.g7d7,initialFutureDays:initialFuture.length,initialWorkIds:initialWork.map(d=>d.id),futureEffortMissing:effortMissing.map(d=>d.id),analysisMatchesFrozen:x.analysisMatchesFrozen,analysisActualKm:x.recomputedAnalysis.actualKm,initialEasyWeeks:p.meta.finalization?.initialEasyWeeks??null,consistentWeeks:p.meta.athlete.consistentWeeks};
  assert.equal(changedDates.length,0);
  assert.equal(changed.length,0);assert.equal(changedQs.length,0);assert.equal(changedMeasurements.length,0);assert.equal(result.versions[v].failures.length,0);
  if(v==='new'){assert.equal(initialWork.length,0);assert.equal(effortMissing.length,0);assert.equal(p.meta.finalization.initialEasyWeeks,2);}
 }
 findings.cases[name]=result;
}
assert.equal(digest(originalPath),originalHash);
writeFileSync('docs/qa/generator-final/users/U04-findings.json',JSON.stringify(findings,null,2)+'\n');
console.log(JSON.stringify({...findings,raw:{...findings.raw,weekComparison:findings.raw.weekComparison.map(w=>({...w,changes:w.changes.map(d=>d.dow)}))}},null,2));
