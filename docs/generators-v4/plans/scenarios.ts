/* 24 scenarija prilagođavanja za polumaraton (coach/SCENARIOS-V4.md § 2): plan PRE i POSLE događaja sa spiskom
   promena. Pokretanje iz korena repozitorijuma:  node docs/generators-v4/plans/scenarios.ts
   Piše docs/generators-v4/plans/HM/scenarios/s01.txt … s24.txt i pregled.txt.
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
const { hm } = await import(join(v4, 'distances/hm/index.ts'));

const { SCENARIOS, clock, profile } = await import(join(v4, 'distances/hm/testdata/scenarios.ts'));

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;
const out = join(here, 'HM/scenarios');
mkdirSync(out, { recursive: true });

const summary: string[] = ['# Scenariji prilagođavanja — polumaraton (pregled)', ''];
for (const s of SCENARIOS) {
  const r = s.run();
  const name = `s${String(s.no).padStart(2, '0')}`;
  const st = r.afterState;
  const f = st.form;
  const text = [
    `${name.toUpperCase()} — ${s.id}, ${s.title}`,
    '',
    `STANJE: danas ${st.today}; sadašnji obim ${String(profile(s.id).profile.weeklyKm)} km nedeljno, ` +
      `${String(st.availability.runDays.length)} dana; forma ${clock(f.current.raceTimeSec)} (pouzdanost ` +
      `${f.current.confidence}), očekivano na dan trke ${clock(f.raceDay.expectedSec)}.`,
    `DOGAĐAJ: ${r.note}`,
    `PROMENA: ${String(r.changes.length)}.`,
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
    `${name} ${s.id} ${s.title} — promena: ${String(r.changes.length)}; nalazi čuvara posle: ${findings.join(' ') || '0'}`
  );
}
writeFileSync(join(out, 'pregled.txt'), `${summary.join('\n')}\n`);
console.log(summary.join('\n'));
