// Node 24: node docs/probes/generator-ab-qa.mjs [profile-id]
// Frozen version roots are recorded in docs/qa/generator-ab/manifest.json.
import { registerHooks } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
registerHooks({ resolve(s,c,n) { try { return n(s,c); } catch(e) { if(s.startsWith('.')) for(const x of ['.ts','/index.ts']) try { return n(s+x,c); } catch {} throw e; } } });
const dir = new URL('../qa/generator-ab/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json',dir),'utf8'));
const profiles = JSON.parse(readFileSync(new URL('inputs.json',dir),'utf8'));
const hash = x => createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const clone = x => JSON.parse(JSON.stringify(x));
const modules = {};
const roots = { old: process.env.SUB20_QA_OLD_ROOT ?? manifest.localRoots.old, new: process.env.SUB20_QA_NEW_ROOT ?? manifest.localRoots.new };
for(const [key,root] of Object.entries(roots)) modules[key] = await import(pathToFileURL(resolve(root,'web/src/domain/training/generator/generatePlan.ts')).href);
const { sessKm, sessQKm, sessDesc } = await import('../../web/src/domain/training/sessions/calc.ts');
export function summarize(plan) {
  if('error' in plan) return {error:plan.error};
  const failures=[];
  const weeks=plan.weeks.map(w=>{
    let work=0; const zones={}; const sessions=[];
    for(const d of w.days) {
      const s=d.session;
      if(s) {
        const q=sessQKm(s); const zone=s.zone??(s.kind==='Oštrina'?'R':s.kind==='Tempo trke'?'RP':s.type==='tempo'?'T':s.type==='prog'?'T':'I');
        const min=(s.type==='fartlek'?s.reps*s.repSec:q*s.paceSec)/60;
        work+=min; zones[zone]=(zones[zone]??0)+min;
        if(Math.abs(sessKm(s)-d.km)>.051) failures.push({w:w.w,dow:d.dow,reason:'session-km',actual:d.km,calculated:sessKm(s)});
        // Legacy descriptions use their version's formatter; description changes are reviewed, not auto-failed.
        sessions.push({dow:d.dow,type:s.type,kind:s.kind,zone,qKm:q,workMinutes:+min.toFixed(2),paceSec:s.paceSec,reps:s.reps,repM:s.repM,repSec:s.repSec,restSec:s.restSec,wuKm:s.wuKm,cdKm:s.cdKm,desc:d.desc});
      }
      if(d.finish) {const min=d.finish.km*d.finish.paceSec/60;work+=min;zones[d.finish.zone]=(zones[d.finish.zone]??0)+min;}
    }
    const km=w.days.reduce((n,d)=>n+(d.km??0),0);
    if(Math.abs(km-w.vol)>.051)failures.push({w:w.w,reason:'week-sum',reported:w.vol,sum:km});
    return {w:w.w,km:w.vol,deload:w.deload,taper:!!w.taper,focus:w.focus,runDays:w.days.filter(d=>d.km>0&&!d.rest).length,lrKm:Math.max(0,...w.days.filter(d=>d.tag==='lr'&&!d.mlr).map(d=>d.km)),hardDows:w.days.filter(d=>d.session||d.finish).map(d=>d.dow),workMinutes:+work.toFixed(2),zones:Object.fromEntries(Object.entries(zones).map(([z,n])=>[z,+n.toFixed(2)])),sessions,days:w.days};
  });
  const working=weeks.filter(w=>w.w<plan.meta.weeks&&!w.taper);
  return {weeks,failures,peakWeeklyKm:Math.max(...working.map(w=>w.km)),peakLongRunKm:Math.max(...working.map(w=>w.lrKm)),firstQuality:weeks.flatMap(w=>w.sessions.map(s=>({w:w.w,...s})))[0]??null,sessionKinds:[...new Set(weeks.flatMap(w=>w.sessions.map(s=>s.kind)))],referenceSec:plan.meta.predictedSec,vdot0:plan.meta.vdot0,vdotGoal:plan.meta.vdotGoal};
}
export async function generatePair(profile) {
  const output={id:profile.id,profile:clone(profile),versions:{}};
  for(const key of ['old','new']) {const plan=modules[key].generatePlan(clone(profile.input));output.versions[key]={plan,summary:summarize(plan),sha256:hash(plan)};}
  return output;
}
if(process.argv[1]===new URL(import.meta.url).pathname) {
  mkdirSync(new URL('raw/',dir),{recursive:true});mkdirSync(new URL('blind/',dir),{recursive:true});
  for(const profile of profiles.filter(p=>!process.argv[2]||p.id===process.argv[2])) {
    const pair=await generatePair(profile);
    writeFileSync(new URL(`raw/${profile.id}.json`,dir),JSON.stringify(pair,null,2)+'\n');
    const order=Number(profile.id.slice(1))%2?['new','old']:['old','new'];
    const blind={id:profile.id,profile:clone(profile),plans:{}};
    for(const [i,key] of order.entries()) {const p=clone(pair.versions[key].plan);const m=p.meta;const presentation=m?{referenceTimeSec:m.predictedSec,initialVdot:m.vdot0,lastVdot:m.vdotGoal,warnings:m.dayWarnings??[],preparation:m.preparation??null}:null;if(!('error' in p)) {p.meta={raceDistM:m.raceDistM,raceDate:m.raceDate,start:m.start,weeks:m.weeks,runDays:m.runDays,quality:m.quality};for(const row of p.pred) {delete row.p5k;delete row.zone;} }blind.plans[['A','B'][i]]={plan:p,presentation,summary:{...pair.versions[key].summary,referenceSec:undefined,vdot0:undefined,vdotGoal:undefined}};}
    writeFileSync(new URL(`blind/${profile.id}.json`,dir),JSON.stringify(blind,null,2)+'\n');
    console.log(JSON.stringify({id:profile.id,old:pair.versions.old.sha256,new:pair.versions.new.sha256,oldFailures:pair.versions.old.summary.failures,newFailures:pair.versions.new.summary.failures}));
  }
}
