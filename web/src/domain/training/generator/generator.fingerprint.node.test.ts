import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  canonical,
  loadFingerprintFile,
  shaOf,
  writeFingerprintFile,
  type FingerprintRow
} from '@/test/fingerprint';
import { scenariji } from '@/test/generatorScenarios';
import type { PlanGenerationInput, TrainingPlan } from '../types';
import { generatePlan } from './generatePlan';

/* GOLDEN MASTER GENERATORA (2 304 scenarija). Fixture je uzet nad STARIM generatorom (APP_VERSION 282, commit b7afc41); novi generator mora dati isti
   SHA-256 po scenariju (kanonski zapis: sortirani ključevi, brojevi na 3 decimale; zastavica `taper` se ne računa — ENGINE_CHANGES D5).

   KAKO SE ČITA PAD: ne znači „pokvario si generator", nego „generator sada pravi drugačiji plan nego pre — je li to bila namera?". Refaktor: otisak MORA
   ostati isti. Namerna izmena kalibracije: proveri koje su se distance pomerile, unesi razliku u docs/ENGINE_CHANGES.md pa osveži otisak iz novog koda:
       UPDATE_FINGERPRINT=1 npx vitest run --project node generator.fingerprint
   (razlika fixture-a ide u isti commit, vidljiva u diffu). */

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

function preview(plan: unknown): unknown {
  const g = (plan as { greska?: string }).greska;
  if (g) return g;
  const p = plan as Pick<TrainingPlan, 'weeks' | 'meta'>;
  return {
    nedelja: p.weeks.length,
    km: p.weeks
      .map((w) => Math.round(w.days.reduce((a, d) => a + (d.km || 0), 0) * 10) / 10)
      .join(','),
    kvalitetnih: p.weeks.reduce(
      (n, w) => n + w.days.filter((d) => d.tag === 'int' || d.tag === 'tempo').length,
      0
    ),
    vdot0: p.meta.vdot0,
    vdotGoal: p.meta.vdotGoal
  };
}

describe('golden master generatora (2 304 scenarija)', () => {
  it('novi generator daje isti SHA-256 po scenariju kao upisani otisak', () => {
    const scenarios = scenariji();
    expect(scenarios.length).toBe(2304);
    const rows: Record<string, FingerprintRow> = {};
    for (const s of scenarios) {
      const plan = planFor(s.inp);
      rows[s.ime] = { sha: shaOf(plan), pregled: preview(plan) };
    }

    if (process.env['UPDATE_FINGERPRINT'] === '1') {
      const ukupno = createHash('sha256')
        .update(
          Object.keys(rows)
            .sort()
            .map((k) => k + ':' + (rows[k] as FingerprintRow).sha)
            .join('\n')
        )
        .digest('hex');
      writeFingerprintFile({
        sat: '2026-01-05T09:00:00Z',
        pocetak: '2026-01-05',
        scenarija: scenarios.length,
        ukupno,
        redovi: rows
      });
      return;
    }

    const fixture = loadFingerprintFile();
    expect(fixture, 'fixture postoji').not.toBeNull();
    expect(fixture?.scenarija).toBe(2304);
    const mismatches: string[] = [];
    for (const s of scenarios) {
      const sha = (rows[s.ime] as FingerprintRow).sha;
      const expected = fixture?.redovi[s.ime]?.sha;
      if (sha !== expected) mismatches.push(`${s.ime}: ${sha} ≠ ${expected}`);
    }
    for (const k of Object.keys(fixture?.redovi ?? {}))
      if (!rows[k]) mismatches.push(`NESTAO scenario: ${k}`);
    expect(mismatches.length, mismatches.slice(0, 15).join('\n')).toBe(0);
  });
});
