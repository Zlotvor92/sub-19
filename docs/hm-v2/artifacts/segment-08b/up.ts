const root='/home/user/sub-19';
import { readFileSync, readdirSync } from 'node:fs';
const S=process.argv[2];
const load=(d:string)=>Object.assign({},...readdirSync(d).filter(f=>f.startsWith('early.')).map(f=>JSON.parse(readFileSync(d+'/'+f,'utf8'))));
const A:any=load(S+'/pre37'),B:any=load(S+'/r8pre'),C:any=load(S+'/r8post');
const keys=Object.keys(C).filter(k=>B[k]&&C[k].c!==B[k].c&&!(A[k]?.wk&&A[k].wk.every((h:string,i:number)=>h===C[k].wk[i])));
const libs=await Promise.all([S+'/base',S+'/base2',root].map(r=>import(r+'/docs/generators-v2/final-check/lib.ts')));
const T:Record<string,number>={};
for(const k of keys){const [id,tag,s,two]=k.split('/');
 const res=libs.map((lib:any)=>{const d=lib.distOf('HM');const {bases}=lib.sampleBases(d,{R:193,F:97,B:29});const b=bases.find((x:any)=>x.id===id);const p=d.generate(b.input).plan;
  const wi=Number(tag.slice(1,-3));const at=tag.endsWith('wed')?lib.wedOf(p.weeks[wi-1].startDate):p.weeks[wi-1].endDate;
  const r1=d.adapt(p,d.facts(p,'chain',at),at);const at2=lib.addDays(at,7);const r2=d.adapt(r1.plan,d.chain2(p,at2),at2);return r2.plan.weeks.map((w:any)=>w.plannedKm);});
 const [e,pre,post]=res; let up=0,down=0,over=0;
 post.forEach((v:number,i:number)=>{if(v>pre[i]+1e-9)up++;if(v<pre[i]-1e-9)down++;if(v>e[i]+1e-9)over++;});
 const c=`up${up?1:0}down${down?1:0}overE${over?1:0}`;T[c]=(T[c]??0)+1;}
console.log(keys.length,T);
