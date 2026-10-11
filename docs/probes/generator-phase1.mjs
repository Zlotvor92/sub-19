// Node24: node docs/probes/generator-phase1.mjs [optional-output.json]
import { registerHooks } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); }
    catch (error) {
      if (specifier.startsWith('.')) for (const suffix of ['.ts', '/index.ts']) {
        try { return nextResolve(specifier + suffix, context); } catch {}
      }
      throw error;
    }
  }
});
const { generatePlan } = await import('../../web/src/domain/training/generator/generatePlan.ts');
const inputs = JSON.parse(readFileSync(new URL('../qa/generator-phase1/inputs.json', import.meta.url), 'utf8'));
const results = inputs.map(({ scenario, input }) => ({ scenario, input, result: generatePlan(input) }));
const summary = results.map(({ scenario, result }) => {
  if ('error' in result) return { scenario, error: result.error };
  const working = result.weeks.slice(0, -1);
  return {
    scenario, weeks: result.weeks.length,
    peakTrainingKm: Math.max(...working.map((w) => w.vol)),
    peakLR: Math.max(0, ...working.flatMap((w) => w.days.filter((d) => d.tag === 'lr' && !d.mlr).map((d) => d.km))),
    qualitySessions: working.reduce((n, w) => n + w.days.filter((d) => d.session).length, 0),
    referenceSec: result.meta.predictedSec,
    basis: result.meta.assessmentBasis
  };
});
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify({ scenarios: results.length, successful: results.filter((x) => !('error' in x.result)).length, summary }, null, 2));
