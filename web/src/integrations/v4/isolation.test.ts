import { describe, expect, it } from 'vitest';

/* Sloj uvozi V4 SAMO kroz javne ulaze (INTEGRACIJA.md § 2): motor, adapteri, forma, `distances/<d>` (index).
   Ne uvozi stare generatore (v2, zamrznut HM v1) ni store/servise/ekrane: sloj je čist. */
const sources = import.meta.glob<string>(['./*.ts', '!./*.test.ts', '!./*.test-data.ts'], {
  query: '?raw',
  import: 'default',
  eager: true
});
const files = Object.entries(sources);

const importsOf = (text: string): string[] =>
  [...text.matchAll(/(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/g)].map((m) => m[1] ?? '');

const PUBLIC_V4 =
  /^\.\.\/\.\.\/domain\/v4\/(engine|adapters|fitness|distances\/(fivek|tenk|hm|marathon))$/;
const ALLOWED_APP = /^\.\.\/\.\.\/domain\/(date|plan|state)$/;

describe('izolacija sloja', () => {
  it('čita izvor sloja', () => {
    expect(files.map(([p]) => p)).toEqual(
      expect.arrayContaining(['./facts.ts', './view.ts', './adopt.ts', './index.ts'])
    );
  });

  it('V4 samo kroz javne ulaze; od aplikacije samo datum, prikaz plana i tipovi stanja', () => {
    for (const [path, text] of files) {
      for (const spec of importsOf(text)) {
        if (spec.startsWith('./')) continue;
        expect(PUBLIC_V4.test(spec) || ALLOWED_APP.test(spec), `${path}: ${spec}`).toBe(true);
      }
    }
  });

  it('nema čitanja ni pisanja stanja, mreže ni vremena uređaja', () => {
    const banned =
      /\b(useTrainingStore|getState|setState|localStorage|fetch\(|Date\.now|new Date\(\))/;
    for (const [path, text] of files) expect(banned.test(text), path).toBe(false);
  });
});
