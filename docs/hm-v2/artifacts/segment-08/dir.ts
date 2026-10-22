import { readFileSync, readdirSync } from "node:fs";
const [a,b]=process.argv.slice(2);
const load=(d:string)=>Object.assign({},...readdirSync(d).filter(f=>f.startsWith('early.')).map(f=>JSON.parse(readFileSync(`${d}/${f}`,'utf8'))));
const A:any=load(a),B:any=load(b); let up=0,down=0,both=0,chain=0,peakDown=0,maxPeakDrop=0; const sc:Record<string,number>={};
for(const k in A){const x=A[k],y=B[k]; if(!y||x.rej||y.rej||x.c===y.c) continue; const mo=new Set(x.mo); if(!mo.size) continue;
 let u=0,d=0; x.t.forEach((t:number,i:number)=>{if(y.t[i]>t)u++; if(y.t[i]<t)d++;}); if(!u&&!d) continue;
 if(u&&d)both++; else if(u)up++; else down++; if(k.includes('chain/2'))chain++; const s=k.split('/')[2]; sc[s]=(sc[s]??0)+1;
 const pd=Math.max(...x.t)-Math.max(...y.t); if(pd>0.05){peakDown++; maxPeakDrop=Math.max(maxPeakDrop,pd);} }
console.log({up,down,both,chain,peakDown,maxPeakDrop:+maxPeakDrop.toFixed(1),sc});
