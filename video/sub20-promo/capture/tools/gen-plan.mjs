/* Generiše plan PRAVIM generatorom aplikacije (web/src/domain) za ulaz izveden iz Strava best efforta 20:25. */
import { writeFileSync } from 'node:fs';
const { generatePlan } = await import('../../../../web/src/domain/training/generator/generatePlan.ts');
const { adaptGeneratedPlan } = await import('../../../../web/src/domain/plan/index.ts');
const input = {
  startDate: '2026-10-02', raceDate: '2026-12-20', raceDistM: 5000,
  pb: { distM: 5000, sec: 1225 }, weeklyKm: 35, runDays: 4, quality: 2, lrDow: 7,
  qDows: [], runDows: [], intensity: 'std', volIntensity: 'std', goalSec: 1199, trainedRecently: true
};
const gen = generatePlan(input);
if ('error' in gen) { console.error(gen.error); process.exit(1); }
const adapted = adaptGeneratedPlan(gen);
adapted.ulaz = JSON.parse(JSON.stringify(input));
writeFileSync(process.argv[2], JSON.stringify(adapted, null, 1));
console.log(JSON.stringify(adapted.meta));
console.log(adapted.weeks.length, 'nedelja;', adapted.weeks[5].focus);
for (const d of adapted.weeks[5].days) console.log(d.id, d.tag, d.km, (d.desc||'').slice(0,90));
