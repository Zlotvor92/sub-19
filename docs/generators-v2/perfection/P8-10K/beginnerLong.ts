/* P8-10K (10K b) — dugi početnika: koliko planova mreže B ima najduži dugi < 10 km i koja granica ga drži (udeo D17 /
   vreme 90 min). Opcija B1 (udeo dugog početnika veći) meri se privremenim zahvatom u policy.planRule (env BEG_SHARE,
   npr. {"3":0.52,"4":0.43}; zahvat NIJE u kodu). Iz web/: node ../docs/generators-v2/perfection/P8-10K/beginnerLong.ts */
import { generateTenKV2 } from "../../../../web/src/domain/generators/tenK/v2/generate.ts";
import { beginnerGridInputs } from "../../../../web/src/domain/generators/tenK/v2/testInputs.ts";
import { longShareCap10, longTimeCap10 } from "../../../../web/src/domain/generators/tenK/v2/lengths.ts";
import { planRule } from "../../../../web/src/domain/generators/tenK/v2/policy.ts";
const h: Record<string, number> = {};
for (const c of ([3,4] as const).flatMap((d)=>beginnerGridInputs(d))) {
  const r: any = generateTenKV2(c.input); if (!r.ok) continue;
  const rule = planRule(r.plan.input.runDays.length, 'beginner')!;
  const W=r.plan.weeks.filter((w:any)=>w.phase!=='race'); let best:any=null;
  for (const w of W) { const l=w.days.find((d:any)=>d.role==='long'); if (l && (!best || l.workout.km>best.km)) best={km:l.workout.km,t:w.targetKm}; }
  if (best.km>=10) continue;
  const s=longShareCap10(Math.round(best.t*10), rule.longMaxShare), t=longTimeCap10(r.plan.paces, rule.longMaxSec);
  const k=`${rule.easy+2}d ${Math.round(best.km*10)===s?'udeo':Math.round(best.km*10)===t?'vreme':'drugo'} vreme≥10km:${t>=100}`; h[k]=(h[k]||0)+1;
}
console.log(h);

// Zbir (kao za B1): odbijanja, dugi < 10 km, nedelje sa laganim danom kao odmor, najveći udeo dugog.
{ let n=0, rej=0, lt10=0, fitted=0, easyRest=0, maxShare=0; const codes: Record<string,number>={};
for (const c of ([3,4] as const).flatMap((d)=>beginnerGridInputs(d))) {
  n++; const r: any = generateTenKV2(c.input);
  if (!r.ok) { rej++; for (const x of r.reasons) codes[x.message.split(':')[0]]=(codes[x.message.split(':')[0]]||0)+1; continue; }
  const W=r.plan.weeks; const L=Math.max(...W.filter((w:any)=>w.phase!=='race').map((w:any)=>w.days.find((d:any)=>d.role==='long')?.workout.km??0));
  if (L<10) lt10++; fitted+=W.filter((w:any)=>w.fitted).length;
  easyRest+=W.filter((w:any)=>w.notes.some((x:string)=>x.includes('odmor —'))).length;
  for (const w of W) { const l=w.days.find((d:any)=>d.role==='long'); if (l) maxShare=Math.max(maxShare,l.workout.km/w.plannedKm); }
}
console.log(JSON.stringify({n,rej,lt10,fitted,easyRest,maxShare:+maxShare.toFixed(2),codes})); }
