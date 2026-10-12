import { registerHooks } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
registerHooks({ resolve(s,c,n) { try { return n(s,c); } catch(e) { if(s.startsWith('.')) for(const x of ['.ts','/index.ts']) try { return n(s+x,c); } catch {} throw e; } } });
const root=process.cwd(), read=p=>JSON.parse(readFileSync(resolve(root,p),'utf8'));
const manifest=read('docs/qa/generator-final/manifest.json');
const raw=read('docs/qa/generator-final/raw/U07.json');
const event=read('docs/qa/generator-final/users/U07-event.json');
const original=readFileSync(resolve(root,'docs/qa/generator-ab/users/U07-event.json'));
const hash=v=>createHash('sha256').update(v).digest('hex');
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const out={id:'U07',sourceEvidenceSha256:hash(original),sourceUnchanged:hash(original)===event.sourceEvidenceSha256,raw:{},events:{},findings:[{id:'U07-F1',severity:'low',status:'open',topic:'Partial-week focus scope',evidence:'Both new event cases label W7 Lagano trčanje — bez kvaliteta i ubrzanja, although protected g7d1 contains strides and g7d3 contains 2×800 m. This is accurate only for the remaining future portion; the focus text does not state that scope.',impact:'Display ambiguity, not prescription or preservation failure.'}]};
for(const version of ['old','new']) {
 const dir=manifest.localRoots[version];
 const m=Object.assign({},...await Promise.all(['domain/training/sessions/calc.ts','domain/training/prediction/index.ts','domain/plan/resolve.ts','domain/training/adaptation/matching.ts'].map(p=>import(pathToFileURL(resolve(dir,'web/src',p))))));
 const p=raw.versions[version].plan;
 const failures=[]; let sessionCount=0;
 for(const w of p.weeks) {
  if(Math.abs(w.vol-w.days.reduce((n,d)=>n+(d.km??0),0))>.051) failures.push({type:'weekKm',w:w.w});
  for(const d of w.days) if(d.session){sessionCount++; if(Math.abs(m.sessKm(d.session)-d.km)>.051)failures.push({type:'sessionKm',w:w.w,dow:d.dow}); if(m.sessDesc(d.session)!==d.desc) failures.push({type:'description',w:w.w,dow:d.dow});}
 }
 const derivedPred=m.derivePred(p.weeks,p.meta.raceDistM,p.meta);
 const stripMeasurementFlag=rows=>rows.map(({nemeri,...r})=>r);
 if(!same(stripMeasurementFlag(derivedPred),stripMeasurementFlag(p.pred)))failures.push({type:'predNumericalFields'});
 const activationMeasurementDisabled=p.pred.at(-1)?.nemeri===true;
 if(!activationMeasurementDisabled)failures.push({type:'activationMeasurementFlag'});
 if(!same(m.deriveQS(p.weeks),p.qs))failures.push({type:'qs'});
 const afterLr=p.weeks.slice(0,-1).map((w,i)=>({fromW:w.w,lrKm:w.days.find(d=>d.tag==='lr')?.km,nextMonday:p.weeks[i+1].days[0]})).filter(x=>x.lrKm!=null);
 out.raw[version]={weeks:p.weeks.length,days:p.weeks.reduce((n,w)=>n+w.days.length,0),runningDays:p.weeks.flatMap(w=>w.days).filter(d=>d.km>0).length,sessionCount,predRows:p.pred.length,qsEntries:Object.keys(p.qs).length,activationMeasurementDisabled,failures,afterLongRunCount:afterLr.length,afterLongRunQuality:afterLr.filter(x=>x.nextMonday.session||x.nextMonday.finish).length,afterLongRunStrides:afterLr.filter(x=>x.nextMonday.strides).length};
 for(const [name,c] of Object.entries(event.cases)){
  const b=c.versions[version],p=b.adjustment.result,ctx=c.input.context,today=c.input.today;
  const view=m.resolvePlan(p.weeks,{alts:ctx.alts,moves:ctx.moves});
  const rows=m.matchPlanRows(view.weeks,p.pred); const protectedSet=new Set(b.audit.protectedIds);
  const failures=[];let editableSessions=0;
  for(const d of view.dated)if(d.date>today&&!protectedSet.has(d.id)&&d.session){
   editableSessions++;
   if(Math.abs(m.sessKm(d.session)-d.km)>.051)failures.push({type:'sessionKm',id:d.id});
   if(m.sessDesc(d.session)!==d.desc)failures.push({type:'description',id:d.id});
   const r=rows.get(d.id);if(!r||r.q!==m.sessQKm(d.session)||r.pt!==d.session.paceSec||r.zone!==d.session.zone)failures.push({type:'rowSession',id:d.id});
  }
  out.events[name]??={}; out.events[name][version]={weeks:p.weeks.length,days:view.dated.length,predRows:p.pred.length,qsEntries:Object.keys(p.qs).length,protectedDays:b.audit.protectedIds.length,editableDays:view.dated.filter(d=>d.date>today&&!protectedSet.has(d.id)).length,editableSessions,failures,inputPure:b.inputPure,analysisMatchesFrozen:b.analysisMatchesFrozen,preservationFailures:Object.fromEntries(['changedProtectedDays','changedProtectedRows','changedProtectedQs','measuredRowsChanged','changedDates'].map(k=>[k,b.audit[k]])),consistentWeeks:p.meta.athlete.consistentWeeks,breakWeeks:p.meta.athlete.breakWeeks};
 }
}
writeFileSync(resolve(root,'docs/qa/generator-final/users/U07-findings.json'),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out,null,2));
