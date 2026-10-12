// Node 24. New outputs only; never rewrites the locked generator-ab evidence.
import { registerHooks } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
registerHooks({ resolve(s,c,n) { try { return n(s,c); } catch(e) { if(s.startsWith('.')) for(const x of ['.ts','/index.ts']) try { return n(s+x,c); } catch {} throw e; } } });
const { generatePlan } = await import('../../web/src/domain/training/generator/generatePlan.ts');
const { sessDesc, sessKm } = await import('../../web/src/domain/training/sessions/calc.ts');
const { sessInt } = await import('../../web/src/domain/training/sessions/build.ts');
const { applyQualityDose } = await import('../../web/src/domain/training/distances/qualityDose.ts');
const { constrainSession } = await import('../../web/src/domain/training/sessions/constraints.ts');
const out = new URL('../qa/session-purpose/', import.meta.url);
mkdirSync(out, {recursive:true});
const profiles=JSON.parse(readFileSync(new URL('../qa/generator-ab/inputs.json',import.meta.url)));
const summary=[];
for(const profile of profiles) {
  const plan=generatePlan(structuredClone(profile.input));
  assert.ok(!('error' in plan));
  let sessions=0;
  for(const week of plan.weeks) for(const day of week.days) if(day.session) {
    const s=day.session; sessions++;
    assert.equal(s.zone,s.purpose==='activation'?'RP':s.purpose);
    assert.equal(s.paceSource,['RP','M'].includes(s.zone)?'race-specific':'current-fitness');
    assert.equal(day.km,sessKm(s));
    assert.ok(day.desc.startsWith(sessDesc(s)));
    if(s.zone==='I') {
      const legs=s.type==='int'?[s.repM]:s.type==='pyramid'?s.reps:[];
      for(const m of legs) assert.ok(m*s.paceSec/1000>=60 && m*s.paceSec/1000<=300);
    }
  }
  writeFileSync(new URL(`${profile.id}.json`,out),JSON.stringify({input:profile.input,plan},null,2)+'\n');
  summary.push({id:profile.id,sessions,sha256:createHash('sha256').update(JSON.stringify(plan)).digest('hex')});
}
const req={qualW:10,qualWeeks:13,slotRole:'q1',effQ:2,vol:60,pI:250,pT:280,pE:360,pR:240,isTaper1:false,dow:2,racePace:270,readiness:'experienced',qualityIntensity:'std'};
const builder=sessInt(2,3,6,1200,270,60,2,'Trkački ritam');
const result=applyQualityDose(structuredClone(builder),req);
assert.equal(constrainSession(result.session,60,1800),true);
assert.equal(result.session.restSec,60);
writeFileSync(new URL('summary.json',out),JSON.stringify({baseline:'56269a6',lockedQA:'f8cb2081ed4ba223fe7efe14a621144beb9bce0d',scope:'Technical invariants and unchanged ten inputs; no new coach scoring',profiles:summary,builder,result},null,2)+'\n');
console.log(JSON.stringify({profiles:summary.length,sessions:summary.reduce((n,p)=>n+p.sessions,0),restSec:result.session.restSec}));
