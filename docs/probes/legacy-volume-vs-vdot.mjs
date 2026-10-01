/* Probe starog (legacy) generatora — reproducibilan dokaz za docs/TRAINING_ENGINE_AUDIT.md.
   Pokretanje iz korena repozitorijuma:  node docs/probes/legacy-volume-vs-vdot.mjs
   Ne menja nijedan fajl; učitava app.js kroz test/harness.mjs (node:vm). */
import { loadApp } from '../../test/harness.mjs';
const app = loadApp({ now: '2026-01-05T09:00:00Z' });
const mk = (dist, pb, extra={}) => ({ startDate:'2026-01-05', raceDate: dist===5000?'2026-05-03':dist===10000?'2026-05-31':dist===21097.5?'2026-07-12':'2026-08-30', raceDistM:dist, pb, weeklyKm:40, runDays:5, quality:2, intensity:'std', trainedRecently:true, ...extra });
const kms = p => p.weeks.map(w=>Math.round(w.days.reduce((s,d)=>s+(d.km||0),0)*10)/10);
let diffs = 0, total = 0, maxd = 0;
for (const [dist, fast, slow] of [[5000,{distM:5000,sec:1100},{distM:5000,sec:1500}],[10000,{distM:10000,sec:2400},{distM:10000,sec:3300}],[21097.5,{distM:21097.5,sec:5000},{distM:21097.5,sec:7500}],[42195,{distM:42195,sec:10800},{distM:42195,sec:15600}]]) {
  const a = kms(app.call('generatePlan', mk(dist, fast))), b = kms(app.call('generatePlan', mk(dist, slow)));
  let d=0, m=0; a.forEach((x,i)=>{ if(x!==b[i]) d++; m=Math.max(m,Math.abs(x-b[i])); });
  console.log(`dist ${dist}: weeks=${a.length}, weeks with different km for fast vs slow PB: ${d}, max |diff|=${m.toFixed(1)} km`);
}
// intensity coupling
for (const dist of [5000,42195]) {
  const out = {};
  for (const it of ['kons','std','agr']) { const p = app.call('generatePlan', mk(dist, dist===5000?{distM:5000,sec:1237}:{distM:42195,sec:12600}, {intensity:it})); out[it] = { peakKm: Math.max(...kms(p)), vdotGoal: p.meta.vdotGoal, vdot0: p.meta.vdot0 }; }
  console.log(dist, JSON.stringify(out));
}
