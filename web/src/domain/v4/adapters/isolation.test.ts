import { describe, expect, it } from 'vitest';

/* Kod adaptera ne uvozi ništa van `domain/v4/` (brief F5): stari oblik je opisan sopstvenim uskim tipovima.
   Testovi smeju da uvezu proročište aplikacije (`domain/plan/resolve`). */
const sources = import.meta.glob<string>(['./*.ts', '!./*.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true
});

describe('izolacija adaptera', () => {
  it('čita izvor adaptera', () => {
    expect(Object.keys(sources)).toEqual(
      expect.arrayContaining(['./detect.ts', './shared.ts', './fingerprintLegacy.ts'])
    );
  });

  it('uvozi samo iz svog foldera i iz motora V4', () => {
    for (const [path, text] of Object.entries(sources)) {
      for (const m of text.matchAll(/from\s+'([^']+)'/g)) {
        const target = m[1] ?? '';
        expect(/^\.\/[\w-]+$|^\.\.\/engine\/[\w-]+$/.test(target), `${path} → ${target}`).toBe(
          true
        );
      }
    }
  });

  it('bez sata, nasumičnosti i `any`', () => {
    for (const [path, text] of Object.entries(sources)) {
      expect(/Date\.now|new Date\(|Math\.random|globalThis|process\./.test(text), path).toBe(false);
      expect(/:\s*any\b|as any\b|<any>/.test(text), path).toBe(false);
    }
  });
});
