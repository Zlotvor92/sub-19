import { describe, expect, it } from 'vitest';

/* Motor ne zna za distance (SPEC § 11.2, AGENTS t. 3): test čita izvor svih fajlova motora osim testova. */
const sources = import.meta.glob<string>(['./*.ts', './testdata/*.ts', '!./*.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true
});
const files = Object.entries(sources);
const engine = files.filter(([path]) => !path.includes('/testdata/'));

describe('izolacija motora', () => {
  it('čita izvor motora', () => {
    expect(engine.length).toBeGreaterThanOrEqual(15);
    expect(engine.map(([path]) => path)).toEqual(
      expect.arrayContaining(['./plan.ts', './replan.ts', './build.ts'])
    );
  });

  it('nema imena distance ni u jednom fajlu motora', () => {
    const names =
      /maraton|marathon|polumaraton|\bhalf\b|\bhm\b|\b5\s?k\b|\b10\s?k\b|\b21\s?k\b|\b42\s?k\b|fiveK|tenK/i;
    for (const [path, text] of files) {
      const hit = text.split('\n').find((line) => names.test(line));
      expect(hit, path).toBeUndefined();
    }
  });

  it('nema poređenja `distanceM` sa konstantom dužine trke', () => {
    const compare =
      /distanceM\s*(===|!==|==|!=|<=|>=|<|>)\s*\d{3,}|\d{3,}\s*(===|!==|==|!=|<=|>=|<|>)\s*\w+(\.\w+)*\.distanceM/;
    const race = /\b(42195|21097(\.5)?|10000|5000)\b/;
    for (const [path, text] of engine) {
      expect(compare.test(text), path).toBe(false);
      expect(race.test(text), path).toBe(false);
    }
  });

  it('nema grananja po `distanceId`, `policyId` ni `data.id` osim provere unosa i preuzimanja', () => {
    for (const [path, text] of engine) {
      const hits = text
        .split('\n')
        .filter((line) => /(distanceId|policyId|data\.id)\s*(===|!==)\s*['"`]/.test(line));
      expect(hits, path).toEqual([]);
    }
  });

  it('uvozi samo iz foldera motora', () => {
    for (const [path, text] of files) {
      for (const m of text.matchAll(/from\s+'([^']+)'/g)) {
        const target = m[1] ?? '';
        const inside = path.includes('/testdata/')
          ? /^\.\.?\/[\w./-]+$/.test(target)
          : /^\.\/[\w-]+$/.test(target);
        expect(inside, `${path} → ${target}`).toBe(true);
      }
    }
  });

  it('bez sata, nasumičnosti, `any` i globalnog stanja', () => {
    for (const [path, text] of engine) {
      expect(
        /Date\.now|new Date\(\)|Math\.random|\bfetch\(|globalThis|process\./.test(text),
        path
      ).toBe(false);
      expect(/:\s*any\b|as any\b|<any>/.test(text), path).toBe(false);
      expect(/^(let|var) /m.test(text), path).toBe(false);
    }
  });
});
