/* NAPOMENA (Phase 12): ova skripta učitava stari `app.js` kroz `test/harness.mjs`, koji su obrisani. Radi samo nad commit-om b7afc41:
   `git worktree add ../legacy b7afc41 && cd ../legacy && node docs/probes/legacy-nan-leak.mjs`. Ostaje kao dokaz nalaza iz docs/TRAINING_ENGINE_AUDIT.md §11. */
/* Probe starog (legacy) generatora — reproducibilan dokaz za docs/TRAINING_ENGINE_AUDIT.md.
   Pokretanje iz korena repozitorijuma:  node docs/probes/legacy-nan-leak.mjs
   Ne menja nijedan fajl; učitava app.js kroz test/harness.mjs (node:vm). */
import { loadApp } from '../../test/harness.mjs';
const app = loadApp({ now: '2026-01-05T09:00:00Z' });
const base = { startDate:'2026-01-05', raceDate:'2026-05-03', raceDistM:5000, pb:{distM:5000,sec:1237}, weeklyKm:40, runDays:4, quality:2, intensity:'std', trainedRecently:true };
const bad = s => (s.match(/NaN|Infinity|undefined|null:null/g)||[]).length;
const t = (name, over) => {
  let r; try { r = app.call('generatePlan', {...base, ...over}); } catch(e){ console.log(name.padEnd(30),'THROW', e.message); return; }
  if (r.error) { console.log(name.padEnd(30),'error:', r.error.slice(0,60)); return; }
  const j = JSON.stringify({weeks:r.weeks,pred:r.pred,meta:r.meta});
  const descBad = r.weeks.flatMap(w=>w.days).filter(d=>/NaN|Infinity|undefined/.test(String(d.desc))).length;
  const kmBad = r.weeks.flatMap(w=>w.days).filter(d=>d.km!=null && !Number.isFinite(d.km)).length;
  console.log(name.padEnd(30), `weeks=${r.weeks.length} nanTokensInJSON=${bad(j)} (JSON NaN serialises to null) descBad=${descBad} kmBad=${kmBad} vdotGoal=${r.meta.vdotGoal} racePace=${r.meta.racePace}`);
};
t('intensity bogus', { intensity:'xyz' });
t('intensity undefined', { intensity:undefined });
t('goalSec NaN', { goalSec:NaN });
t('goalSec 1', { goalSec:1 });
t('runDays NaN', { runDays:NaN });
t('weeklyKm Infinity', { weeklyKm:Infinity });
t('pb sec Infinity', { pb:{distM:5000,sec:Infinity} });
t('pb sec 1', { pb:{distM:5000,sec:1} });
t('raceDistM "5000"', { raceDistM:'5000' });
t('baseline', {});
