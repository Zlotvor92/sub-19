/* Ispis planova kroz `renderPlan` (motor V4 + podaci distance, `--dist hm|tenk`, podrazumevano hm).
   Pokretanje iz korena repozitorijuma:  node docs/generators-v4/plans/render.ts [--dist tenk] [--load] [--stats]
   Piše docs/generators-v4/plans/HM/p01.txt … p12.txt i vlasnik-v1.txt, vlasnik-v2.txt (10 km: plans/10K/).
   Motor uvozi fajlove bez nastavka `.ts`; kuka ispod dodaje nastavak (samo za ovu skriptu). */
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
const engine = await import(join(v4, 'engine/index.ts'));
const { estimateForm } = await import(join(v4, 'fitness/index.ts'));
const { loadDist } = await import(join(here, 'dist.ts'));
const D = await loadDist(v4, process.argv);
const hm = D.data;
const { PROFILES, factsOf, OWNER_PLANS } = D;

const showLoad = process.argv.includes('--load');
const stats = process.argv.includes('--stats');
const out = join(here, D.outDir);
mkdirSync(out, { recursive: true });

const guardLines: string[] = [];

function one(id: string, title: string, facts: unknown, goal: unknown): void {
  const state = engine.buildState(facts, goal, hm, estimateForm);
  const result = engine.plan(state, goal, hm);
  if (!result.ok) {
    console.log(id, 'NEISPRAVAN UNOS', JSON.stringify(result.errors));
    return;
  }
  const findings = engine.guard(result.doc, state, hm);
  const text = engine.renderPlan(result.doc, state, hm, { showLoad });
  const head = `${id.toUpperCase()} — ${title}\n\n`;
  /* S11 (krug 4): nalazi čuvara se NE štampaju u planu koji vidi trkač — idu u poseban izveštaj (nalazi-cuvara.txt) */
  guardLines.push(
    `${id}: ${findings.length === 0 ? 'bez nalaza' : findings.map((f: { check: string; weekIndex: number | null; message: string }) => `${f.check}@${String(f.weekIndex)} (${f.message})`).join('; ')}`
  );
  writeFileSync(join(out, `${id}.txt`), `${head}${text}\n`);
  if (stats) console.log(id, 'nalazi:', findings.map((f: { check: string; weekIndex: number | null }) => `${f.check}@${String(f.weekIndex)}`).join(' ') || '0');
}

for (const p of PROFILES) one(p.id, p.title, factsOf(p), p.goal);
for (const o of OWNER_PLANS) one(o.id, o.title, o.facts, o.goal);
writeFileSync(join(out, 'nalazi-cuvara.txt'), `NALAZI ČUVARA (izveštaj za sudije, ne ide trkaču)\n${guardLines.join('\n')}\n`);
console.log(`ispisano u ${out}`);
