/* Scenariji prilagođavanja (coach/SCENARIOS-V4.md § 2) za distancu `--dist hm|tenk`: plan PRE i POSLE događaja sa
   spiskom promena. Pokretanje iz korena repozitorijuma:  node docs/generators-v4/plans/scenarios.ts [--dist tenk|fivek]
   Piše docs/generators-v4/plans/HM/scenarios/s01.txt … i pregled.txt (10 km: plans/10K/scenarios/).
   Trkač do događaja radi tačno ono što piše u planu (trčanja vezana za dan plana); događaj se zadaje činjenicama
   (trka, pauza, propušteni dani, bol) i `deriveEvents` iz njih izvodi događaje — osim bola, koji se prijavljuje. */
import { registerHooks } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context);
    } catch (error) {
      if (specifier.startsWith('.')) return next(`${specifier}.ts`, context);
      throw error;
    }
  }
});

const here = dirname(fileURLToPath(import.meta.url));
const v4 = join(here, '../../../web/src/domain/v4');
const E = await import(join(v4, 'engine/index.ts'));
const { estimateForm } = await import(join(v4, 'fitness/index.ts'));
const { loadDist } = await import(join(here, 'dist.ts'));
const D = await loadDist(v4, process.argv);
const hm = D.data;

const { SCENARIOS, clock, profile } = await import(join(D.folder, 'testdata/scenarios.ts'));

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;
const out = join(here, D.outDir, 'scenarios');
mkdirSync(out, { recursive: true });

const summary: string[] = [`# Scenariji prilagođavanja — ${D.name} (pregled)`, ''];
const opis: string[] = [
  `# Scenariji prilagođavanja — ${D.name}: ulazi`,
  '',
  'Trkač do događaja radi tačno ono što piše u planu; ovde su samo ulazi (ko je trkač i šta se desilo). Plan PRE i',
  'POSLE događaja je u fajlu scenarija.',
  ''
];
for (const s of SCENARIOS) {
  const r = s.run();
  const name = `s${String(s.no).padStart(2, '0')}`;
  const st = r.afterState;
  const f = st.form;
  /* R20 B7: fajl scenarija nosi samo ulaze (bez broja promena, izvedenih događaja i prognoze — ona je u zaglavlju
     plana); broj promena je u pregledu */
  const event = String(r.note).replace(/\s*Događaji: .*$/, '');
  const stateLine =
    `STANJE: danas ${st.today}; sadašnji obim ${String(profile(s.id).profile.weeklyKm)} km nedeljno, ` +
    `${String(st.availability.runDays.length)} dana.`;
  const text = [
    `${name.toUpperCase()} — ${s.id}, ${s.title}`,
    '',
    stateLine,
    `DOGAĐAJ: ${event}`,
    '',
    '==================== PRE ====================',
    E.renderPlan(r.before, r.beforeState, hm),
    '',
    '==================== POSLE (sa spiskom promena) ====================',
    E.renderPlan(r.after, r.afterState, hm, { changes: r.changes })
  ].join('\n');
  writeFileSync(join(out, `${name}.txt`), `${text}\n`);
  const findings = E.guard(r.after, r.afterState, hm).map((f: Any) => `${f.check}@${String(f.weekIndex)}`);
  summary.push(
    `${name} ${s.id} ${s.title} — promena: ${String(r.changes.length)}; forma ${clock(f.current.raceTimeSec)} ` +
      `(${String(f.current.confidence)}); nalazi čuvara posle: ${findings.join(' ') || '0'}`
  );
  opis.push(`## ${name.toUpperCase()} — ${s.id}, ${s.title}`, '', `- ${stateLine.replace('STANJE: ', 'Stanje: ')}`, `- Događaj: ${event}`, '');
}
writeFileSync(join(out, 'pregled.txt'), `${summary.join('\n')}\n`);
writeFileSync(join(out, 'OPIS.md'), `${opis.join('\n')}\n`);
console.log(summary.join('\n'));
