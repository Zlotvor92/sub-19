import { describe, expect, it } from 'vitest';
import { canonical, loadFingerprint, shaOf } from '@/test/fingerprint';
import type { PlanGenerationInput } from '../types';
import { generatePlan } from './generatePlan';

/* parity: test/generator-otisak.test.mjs :: generator pravi ISTE planove kao pri poslednjem otisku
   KORAK A — port bez promene ponašanja: svih 2 304 scenarija mora dati ISTI SHA-256 kao stari
   generator (kanonski zapis: sortirani ključevi, brojevi na 3 decimale). */

function planFor(inp: Record<string, unknown>): unknown {
  let p: ReturnType<typeof generatePlan>;
  try {
    p = generatePlan(inp as unknown as PlanGenerationInput);
  } catch (e) {
    return { greska: 'IZUZETAK: ' + (e instanceof Error ? e.message : String(e)) };
  }
  if ('error' in p) return { greska: p.error };
  return canonical(
    JSON.parse(JSON.stringify({ weeks: p.weeks, pred: p.pred, qs: p.qs, meta: p.meta }))
  );
}

describe('golden master generatora (2 304 scenarija)', () => {
  it('novi generator daje isti SHA-256 po scenariju kao upisani otisak', async () => {
    const fp = await loadFingerprint();
    const fixture = fp.ucitajOtisak();
    expect(fixture, 'fixture postoji').not.toBeNull();
    const scenarios = fp.scenariji();
    expect(scenarios.length).toBe(2304);

    const mismatches: string[] = [];
    for (const s of scenarios) {
      const sha = shaOf(planFor(s.inp));
      const expected = fixture?.redovi[s.ime]?.sha;
      if (sha !== expected) mismatches.push(`${s.ime}: ${sha} ≠ ${expected}`);
    }
    expect(mismatches.length, mismatches.slice(0, 15).join('\n')).toBe(0);
  });
});
