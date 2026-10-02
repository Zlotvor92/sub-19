import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/* parity: ../sw.js. Telo izvora service workera je BAJT-ZA-BAJT ponašanje starog fajla; razlikuju se samo zaglavlje (tri vrednosti koje se upisuju
   pri izgradnji). Test živi dok postoji ../sw.js; posle Phase 12 ga zamenjuje snimak (hash) tela. */

const body = (src: string): string => src.slice(src.indexOf("self.addEventListener('message'"));

describe('service worker naspram starog', () => {
  it('telo je isto (message, install, activate, fetch, IndexedDB, push, sync, periodicsync, putSafe)', () => {
    const legacy = readFileSync(new URL('../../../sw.js', import.meta.url), 'utf8');
    const next = readFileSync(new URL('../../sw/sw.js', import.meta.url), 'utf8');
    expect(body(next)).toBe(body(legacy));
    expect(body(next).length).toBeGreaterThan(10_000);
  });

  it('sw-reg.js je isti kao stari', () => {
    expect(readFileSync(new URL('../../public/sw-reg.js', import.meta.url), 'utf8')).toBe(
      readFileSync(new URL('../../../sw-reg.js', import.meta.url), 'utf8')
    );
  });
});
