// PROBA: posle planSaNovimCiljem ključevi `qs` za nove nedelje ispadnu `n…` (dow 0–6) umesto `g…` (dow 1–7).
// Pokretanje: node docs/probes/legacy-goal-change-qs.mjs   (ENGINE_CHANGES A3)
import { loadApp } from '../../test/harness.mjs';
const a = loadApp({ now: '2026-01-19T09:00:00Z' });
const plan = a.call('generatePlan', { startDate:'2026-01-05', raceDate:'2026-05-03', raceDistM:10000, pb:{distM:10000,sec:2700}, weeklyKm:35, runDays:5, quality:2, intensity:'std', trainedRecently:true });
a.evalIn(`S.genPlan=adaptGeneratedPlan(${JSON.stringify(plan)}); S.genPlan.ulaz=${JSON.stringify({startDate:'2026-01-05', raceDate:'2026-05-03', raceDistM:10000, pb:{distM:10000,sec:2700}, weeklyKm:35, runDays:5, quality:2, intensity:'std', trainedRecently:true})}; setActivePlan(); rebuildDateIndex(); 0`);
const r = a.call('planSaNovimCiljem', 2500, '2026-01-19');
console.log(Object.keys(r));
const keys = Object.keys(r.qs);
console.log('old-qs sample', keys.filter(k=>k.startsWith('g')).slice(0,5), keys.filter(k=>k.startsWith('n')).slice(0,5));
const idsWithSession = r.weeks.flatMap(w=>w.days.filter(d=>d.session).map(d=>d.id));
console.log('days with session that have qs:', idsWithSession.filter(id=>r.qs[id]).length, '/', idsWithSession.length);
console.log('weeks>=idx sample ids', idsWithSession.slice(-5), 'qs keys n-prefixed', keys.filter(k=>k.startsWith('n')).length);
