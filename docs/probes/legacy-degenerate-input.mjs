/* NAPOMENA (Phase 12): ova skripta učitava stari `app.js` kroz `test/harness.mjs`, koji su obrisani. Radi samo nad commit-om b7afc41:
   `git worktree add ../legacy b7afc41 && cd ../legacy && node docs/probes/legacy-degenerate-input.mjs`. Ostaje kao dokaz nalaza iz docs/TRAINING_ENGINE_AUDIT.md §11. */
/* Probe starog (legacy) generatora — reproducibilan dokaz za docs/TRAINING_ENGINE_AUDIT.md.
   Pokretanje iz korena repozitorijuma:  node docs/probes/legacy-degenerate-input.mjs
   Ne menja nijedan fajl; učitava app.js kroz test/harness.mjs (node:vm). */
import { loadApp } from '../../test/harness.mjs';
const app = loadApp({ now: '2026-01-05T09:00:00Z' });
const base = { startDate:'2026-01-05', raceDate:'2026-05-03', raceDistM:5000, pb:{distM:5000,sec:1237}, weeklyKm:40, runDays:4, quality:2, intensity:'std', trainedRecently:true };
const t = (name, over) => {
  let r; try { r = app.call('generatePlan', {...base, ...over}); } catch(e){ console.log(name,'-> THROW', e.message); return; }
  console.log(name.padEnd(34), r.error ? 'ERROR: '+r.error.slice(0,70) : `weeks=${r.weeks.length} metaWeeks=${r.meta.weeks} vdot0=${r.meta.vdot0}`);
};
t('baseline', {});
t('raceDate abc', { raceDate:'abc' });
t('raceDate 2026-02-31', { raceDate:'2026-02-31' });
t('raceDate undefined', { raceDate:undefined });
t('startDate abc', { startDate:'abc' });
t('startDate undefined', { startDate:undefined });
t('race before start', { raceDate:'2025-12-01' });
t('weeklyKm NaN', { weeklyKm:NaN });
t('weeklyKm Infinity', { weeklyKm:Infinity });
t('weeklyKm 500', { weeklyKm:500 });
t('pb sec Infinity', { pb:{distM:5000,sec:Infinity} });
t('pb sec 1 (absurd)', { pb:{distM:5000,sec:1} });
t('pb dist 1m', { pb:{distM:1,sec:60} });
t('goalSec 1', { goalSec:1 });
t('goalSec NaN', { goalSec:NaN });
t('intensity bogus', { intensity:'xyz' });
t('runDays NaN', { runDays:NaN });
t('quality 0', { quality:0 });
t('lrDow 9', { lrDow:9 });
t('runDows [1,1,1]', { runDows:[1,1,1] });
t('raceDistM string "5000"', { raceDistM:'5000' });
t('raceDistM 21097.5 ok', { raceDistM:21097.5, raceDate:'2026-06-14', pb:{distM:21097.5,sec:5700} });
