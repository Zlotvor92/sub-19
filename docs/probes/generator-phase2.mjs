// Node24: node docs/probes/generator-phase2.mjs [output.json] [generator-repository-root]
import { registerHooks } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
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
const moduleUrl = process.argv[3]
  ? pathToFileURL(resolve(process.argv[3], 'web/src/domain/training/generator/generatePlan.ts'))
  : new URL('../../web/src/domain/training/generator/generatePlan.ts', import.meta.url);
const { generatePlan } = await import(moduleUrl.href);
const inputs = JSON.parse(readFileSync(new URL('../qa/generator-phase2/inputs.json', import.meta.url), 'utf8'));
const plans = inputs.map(({scenario,input}) => ({scenario,input,plan:generatePlan(input)}));
const summary = plans.map(({scenario,plan}) => {
  if ('error' in plan) return {scenario,error:plan.error};
  const working = plan.weeks.filter(w => w.w < plan.meta.weeks && !w.taper);
  const sessions = working.flatMap(w => w.days.filter(d=>d.session));
  return {
    scenario,
    peakWeeklyKm: Math.max(...working.map(w=>w.vol)),
    firstWeeklyKm: working[0].vol,
    lrSeries: working.map(w=>({w:w.w,km:w.days.find(d=>d.tag==='lr'&&!d.mlr || d.tag==='rw'&&d.dow===7)?.km??0,deload:w.deload})),
    firstQuality: sessions[0]?.desc ?? null,
    qualityCount: sessions.length,
    qualityFamilies: [...new Set(sessions.map(d=>d.session.kind))],
    referenceSec:plan.meta.predictedSec,
    athlete:plan.meta.athlete??null,
    preparation:plan.meta.preparation??null,
    demandingMax:Math.max(...working.map(w=>w.days.filter(d=>d.session||d.finish).length)),
    arithmeticFailures:plan.weeks.filter(w=>Math.abs(w.vol-w.days.reduce((n,d)=>n+(d.km??0),0))>.051).length,
    warnings:plan.meta.dayWarnings
  };
});
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify({summary,plans},null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
