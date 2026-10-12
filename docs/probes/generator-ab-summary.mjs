// Validate locked reviewer scores and unmask only after all four initial reports exist.
// node docs/probes/generator-ab-summary.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const base = new URL('../qa/generator-ab/', import.meta.url);
const read = p => JSON.parse(readFileSync(new URL(p, base), 'utf8'));
const profiles = read('inputs.json');
const weights = read('manifest.json').rubric;
const coaches = ['5k','10k','hm','marathon'];
const scoreBase = { '5k': '5k', '10k': '10k', hm: 'hm', marathon: 'marathon-primary' };
const all = {};
const scoreFiles = [];
for (const coach of coaches) {
  const path = `coaches/${scoreBase[coach]}-scores.json`;
  const bytes = readFileSync(new URL(path,base));
  const document = JSON.parse(bytes);
  const entries = Array.isArray(document) ? document : document.scores;
  if (!Array.isArray(entries) || entries.length !== 20) throw Error(`${coach}: expected20 scored plans`);
  if (new Set(entries.map(e=>`${e.id}/${e.side}`)).size !==20) throw Error(`${coach}: duplicate score`);
  for(const profile of profiles) for(const side of ['A','B']) {
    const e=entries.find(x=>x.id===profile.id&&x.side===side);
    if(!e) throw Error(`${coach}: missing ${profile.id}/${side}`);
    const expected=Object.entries(weights).reduce((sum,[criterion,weight])=>{
      const value=e.criteria?.[criterion];
      if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>10)throw Error(`${coach}/${profile.id}/${side}: ${criterion}`);
      return sum+value*weight/10;
    },0);
    if(Math.abs(expected-e.total)>.011) throw Error(`${coach}/${profile.id}/${side}: weighted total ${expected} != ${e.total}`);
    if(e.reviewedWeekCount!==read(`blind/${profile.id}.json`).plans[side].plan.weeks.length)throw Error(`${coach}/${profile.id}/${side}: weekcount`);
  }
  all[coach]=entries;
  scoreFiles.push({path,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const r2=n=>Math.round(n*100)/100;
const mapping=profiles.map(p=>({id:p.id,A:Number(p.id.slice(1))%2?'new':'old',B:Number(p.id.slice(1))%2?'old':'new'}));
const rows=profiles.map(p=>{
  const map=mapping.find(x=>x.id===p.id);
  const primary={5000:'5k',10000:'10k',21097.5:'hm',42195:'marathon'}[p.input.raceDistM];
  const ratings={};
  for(const version of ['old','new']) {
    const side=map.A===version?'A':'B';
    const separate=Object.fromEntries(coaches.map(c=>[c,all[c].find(e=>e.id===p.id&&e.side===side)]));
    const totals=Object.fromEntries(coaches.map(c=>[c,separate[c].total]));
    ratings[version]={side,primary:totals[primary],fourCoachMean:r2(Object.values(totals).reduce((s,n)=>s+n,0)/4),range:[Math.min(...Object.values(totals)),Math.max(...Object.values(totals))],totals,verdict:separate[primary].verdict,criticalIssues:separate[primary].criticalIssues};
  }
  return {id:p.id,label:p.label,distance:p.input.raceDistM,primaryCoach:primary,ratings,change:r2(ratings.new.primary-ratings.old.primary)};
});
const mean=(group,version)=>r2(group.reduce((s,p)=>s+p.ratings[version].primary,0)/group.length);
const summary={scoreFiles,mapping,rows,overall:{old:mean(rows,'old'),new:mean(rows,'new'),method:'Equal mean of 10 profile scores from distance-specific reviewers; score0–100 is subjective rubric, not percent effectiveness.'},byDistance:Object.fromEntries(coaches.map(c=>{const group=rows.filter(p=>p.primaryCoach===c);return[c,{profiles:group.length,old:mean(group,'old'),new:mean(group,'new')}];})),initialReviewCount:80,reviewedWeekCount:coaches.reduce((s,c)=>s+all[c].reduce((n,e)=>n+e.reviewedWeekCount,0),0)};
writeFileSync(new URL('summary.json',base),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({overall:summary.overall,byDistance:summary.byDistance,rows:rows.map(p=>({id:p.id,old:p.ratings.old.primary,new:p.ratings.new.primary,change:p.change,oldRange:p.ratings.old.range,newRange:p.ratings.new.range})),scoreFiles},null,2));
