/* Kapija kruga 2 nad 12 profila i dva plana vlasnika: tabela brojeva (D-REPORT) i prekršaji.
   Pokretanje iz korena:  node docs/generators-v4/plans/gate.ts [--weeks]   (--weeks: km po nedeljama) */
import { registerHooks } from 'node:module';
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
const { PROFILES, factsOf } = await import(join(v4, 'distances/hm/testdata/profiles.ts'));
const { OWNER_PLANS } = await import(join(v4, 'distances/hm/testdata/owner.ts'));
const { gateStats } = await import(join(v4, 'distances/hm/testdata/gate.ts'));

const weeks = process.argv.includes('--weeks');
const f = (x: number, d = 0): string => x.toFixed(d).replace('.', ',');
const rows = [
  ...PROFILES.map((p: any) => ({ id: p.id, facts: factsOf(p), goal: p.goal })),
  ...OWNER_PLANS.map((o: any) => ({ id: o.id, facts: o.facts, goal: o.goal }))
];
console.log('| profil | polazno km | vrh km (×) | najveći skok | lagan/dugi | dugi/nedelja | treninga (dana) | najduži dugi | ned. trke lagan | ned. 1 | brz rad (vrh) | kapija |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
let bad = 0;
for (const r of rows) {
  const state = E.buildState(r.facts, r.goal, hm, estimateForm);
  const res = E.plan(state, r.goal, hm);
  if (!res.ok) { console.log(r.id, 'GREŠKA', res.errors); continue; }
  const s = gateStats(res.doc, r.facts);
  bad += s.violations.length;
  console.log(`| ${r.id} | ${f(s.baseKm)} | ${f(s.peakKm, 1)} (${f(s.peakRatio, 2)}) | ${f(s.maxJumpPct)} % | ${f(s.maxEasyOfLong * 100)} % | ${f(s.maxLongShare * 100)} % | ${s.minWorkouts}–${s.maxWorkouts} (${s.runDays}) | ${f(s.longestLongKm, 1)} | ${f(s.raceWeekEasyMin)} min | ${f(s.firstWeekPct * 100)} % | ${f(s.maxFastShare * 100)} % (${f(s.peakFastShare * 100)} %) | ${s.violations.length === 0 ? 'prolazi' : s.violations.length} |`);
  if (weeks) console.log('   ', s.weeks.map((g: any) => `${g.index}${g.kind[0]}:${f(g.km, 1)}/${f(g.longKm, 1)}/${f(g.easyKm, 1)}/${g.workouts}`).join(' '));
  for (const v of s.violations) console.log('    -', v);
}
console.log(`prekršaja: ${bad}`);
