import { registerHooks } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
// Node 24; baseline must be a separate checkout of locked QA commit f8cb2081.
const root=fileURLToPath(new URL('../../', import.meta.url));
const base=process.env.SUB20_FINALIZATION_BASELINE;
assert(base, 'Set SUB20_FINALIZATION_BASELINE to the locked QA checkout');
registerHooks({ resolve(s,c,n) { try { return n(s,c); } catch(e) { if(s.startsWith('.')) for(const x of ['.ts','/index.ts']) try { return n(s+x,c); } catch {} throw e; } } });
const {generatePlan}=await import(root+'/web/src/test/legacyGenerator.ts');
const {adaptGeneratedPlan}=await import(root+'/web/src/domain/plan/adapt.ts');
const {planWithNewGoal:old}=await import(base+'/web/src/domain/plan/replan.ts');
const {planWithNewGoal:next}=await import(root+'/web/src/domain/plan/replan.ts');
const {addDays}=await import(root+'/web/src/domain/date/index.ts');
let checked=0;
const PB={5000:1237,10000:2570,21097.5:5700,42195:13500};
const snapshots=JSON.parse(readFileSync(base+'/web/src/test/fixtures/d6-replan.json','utf8'));
function canonical(x){if(x===null||x===undefined)return null;if(typeof x==='number')return Number.isFinite(x)?Math.round(x*1000)/1000:String(x);if(Array.isArray(x))return x.map(canonical);if(typeof x==='object'){const o={};for(const k of Object.keys(x).sort()){if(k==='taper'&&x[k]===true)continue;o[k]=canonical(x[k]);}return o;}return x;}
const hash=x=>createHash('sha256').update(JSON.stringify(canonical(x))).digest('hex').slice(0,16);
for(const dist of [5000,10000,21097.5,42195])for(const week of [1,3,8,15,20])for(const locks of [false,true]){
 const input={startDate:'2026-01-05',raceDate:addDays('2026-01-05',140),raceDistM:dist,pb:{distM:dist,sec:PB[dist]},weeklyKm:50,runDays:5,quality:2,intensity:'std',trainedRecently:true};
 const p={...adaptGeneratedPlan(generatePlan(input)),ulaz:input};
 if(locks){let n=0;for(const w of p.weeks)for(const d of w.days){const s=d.session;if(!s||n++%2)continue;s.paceSec+=7;s.overrides={...s.overrides,paceSec:true};if(s.type==='int'){s.reps+=1;s.overrides.reps=true;}}}
 const today=addDays('2026-01-05',(week-1)*7+2),goal=Math.round(PB[dist]*.97);
 const a=JSON.parse(JSON.stringify(old(p,goal,today))),b=JSON.parse(JSON.stringify(next(p,goal,today)));
 assert.equal(hash(a),snapshots[`goal ${dist} N${week} locks=${locks}`]);
 assert.deepEqual(a.weeks.map(w=>w.days.map(({desc,...d})=>d)), b.weeks.map(w=>w.days.map(({desc,...d})=>d)));
 assert.deepEqual(a.pred,b.pred);assert.deepEqual(a.qs,b.qs);assert.deepEqual(a.ulaz,b.ulaz);
 checked++;
}
const result={checked,prescriptionChanges:0,predictionChanges:0,qsChanges:0,inputChanges:0};
writeFileSync(new URL('../qa/plan-finalization/snapshot-audit.json', import.meta.url), JSON.stringify(result, null, 2)+'\n');
console.log(JSON.stringify(result));
