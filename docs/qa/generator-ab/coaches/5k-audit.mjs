import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'../blind');
const ids=process.argv.slice(2).length?process.argv.slice(2):Array.from({length:10},(_,i)=>`U${String(i+1).padStart(2,'0')}`);
for(const id of ids){
 const d=JSON.parse(fs.readFileSync(path.join(root,`${id}.json`),'utf8'));
 console.log(`\n${id} ${d.profile.label} ${JSON.stringify(d.profile.input)}`);
 for(const [side,v] of Object.entries(d.plans)){
  console.log(`SIDE ${side}`);
  for(const w of v.plan.weeks){
   const days=w.days.map(x=>{
    if(x.rest)return `${x.dow}:REST`;
    let s=`${x.dow}:${x.tag}(${x.km??'-'})`;
    if(x.runWalk)s+=` RW${x.runWalk.runSec}/${x.runWalk.walkSec}`;
    if(x.strides)s+=` STR${x.strides.reps}x${x.strides.runSec}/${x.strides.restSec}@${x.strides.paceSec}`;
    if(x.session){const q=x.session;s+=` ${q.kind} ${JSON.stringify(Object.fromEntries(Object.entries(q).filter(([k])=>!['kind','overrides','notes','type'].includes(k))))}`;if(q.type==='prog')s+=` FAST_WORK_KM≈${((q.qKm??x.km)/3).toFixed(2)}`;if(q.notes)s+=` NOTE:${q.notes}`;}
    if(x.tag==='lr'||x.tag==='trka')s+=` ${x.desc}`;
    return s;
   });
   console.log(`W${w.w} V${w.vol} ${w.deload?'DELOAD ':''}${w.taper?'TAPER ':''}${days.join(' | ')}`);
  }
 }
}
