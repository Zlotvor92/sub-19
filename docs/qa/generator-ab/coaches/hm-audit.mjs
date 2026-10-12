// Independent blind HM evidence audit. Reads only the ten explicitly allowed blind files.
// Run from repository root: node docs/qa/generator-ab/coaches/hm-audit.mjs
import { readFileSync } from 'node:fs';
const one = x => Math.round(x * 10) / 10;
const paceInText = text => {
  const m = (text || '').match(/@ ~?(\d+):(\d+)\/km/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
function dose(s) {
  if (s.type === 'fartlek') return { km: s.reps * s.repSec / s.paceSec, min: s.reps * s.repSec / 60 };
  let km = s.qKm ?? (Array.isArray(s.reps) ? s.reps.reduce((a, b) => a + b, 0) / 1000 : s.reps * s.repM / 1000);
  if (s.type === 'prog') km /= 3; // Only the final third is at the quality pace.
  if (!Number.isFinite(km)) throw new Error('Unrecognized session format');
  return { km, min: km * s.paceSec / 60 };
}
let weekCount = 0, dayCount = 0;
for (let i = 1; i <= 10; i++) {
  const id = `U${String(i).padStart(2, '0')}`;
  const data = JSON.parse(readFileSync(`docs/qa/generator-ab/blind/${id}.json`, 'utf8'));
  for (const side of ['A', 'B']) {
    console.log(`\n### ${id} ${side} — dnevna i nedeljna provera\n`);
    console.log('| N | km | D1–D7: tip/km | Najduža sesija pre trke: km/min | Kvalitet: zona, rad, oporavak | Dani kvaliteta sa LR završetkom | Rasterećenje |');
    console.log('|---:|---:|---|---|---|---|---|');
    for (const w of data.plans[side].plan.weeks) {
      weekCount++; dayCount += w.days.length;
      if (w.days.length !== 7) throw new Error('Missing day');
      const sum = w.days.reduce((n, d) => n + (d.km || 0), 0);
      if (Math.abs(sum - w.vol) > .15) throw new Error('Weekly volume inconsistency');
      const beforeRace = w.days.filter(d => d.km && d.tag !== 'trka');
      const longest = [...beforeRace].sort((a, b) => b.km - a.km)[0];
      // A mixed quality session cannot be timed by multiplying all km by its fast pace.
      // Walk recoveries do not have a supplied walking pace: leave those durations unknown.
      let duration = longest && !longest.session && !longest.runWalk ? paceInText(longest.desc) : null;
      if (longest && duration) {
        duration = longest.finish
          ? ((longest.km - longest.finish.km) * duration + longest.finish.km * longest.finish.paceSec) / 60
          : longest.km * duration / 60;
      }
      const hard = [], sessions = [];
      for (const d of w.days) {
        if (d.session) {
          const q = dose(d.session);
          hard.push(d.dow);
          sessions.push(`D${d.dow} ${d.session.zone}: ${one(q.km)} km/${one(q.min)} min${d.session.restSec ? `; pauza ${d.session.restSec}s` : '; kontinuirano'}`);
        }
        if (d.finish) {
          hard.push(d.dow);
          sessions.push(`D${d.dow} LR-${d.finish.zone}: ${d.finish.km} km/${one(d.finish.km * d.finish.paceSec / 60)} min`);
        }
      }
      const dayLabels = w.days.map(d => `${d.dow}:${d.rest ? 'odmor' : d.tag}${d.km ? '/' + d.km : ''}${d.strides ? '+ubrz' : ''}${d.mlr ? '(MLR)' : ''}`).join('; ');
      console.log(`| ${w.w} | ${one(sum)} | ${dayLabels} | ${longest ? longest.km : 0}/${duration ? one(duration) : 'n/p'} | ${sessions.join(' · ') || 'bez kvaliteta'} | ${[...new Set(hard)].join(',') || '—'} | ${w.deload ? 'deload' : w.focus?.startsWith('Taper') ? 'taper' : w.focus === 'TRKA' ? 'trka' : '—'} |`);
    }
  }
}
console.log(`\nProvereno ${weekCount} nedelja i ${dayCount} dnevnih zapisa. Svi zbirni km odgovaraju zbiru prikazanih dana (tolerancija 0.15 km za zaokruživanje).`);
