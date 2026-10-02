import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/* parity: blok `uvodniEkran` na vrhu app.js. Skripta je KOPIJA — odluka „prikaži ili ne" ne sme da se razilazi od stare. */

const block = (src: string): string => {
  const start = src.indexOf('(function uvodniEkran(){');
  const end = src.indexOf('\n})();', start);
  return src.slice(start, end + 6).replace(/\s+/g, ' ');
};

describe('uvod.js naspram starog app.js', () => {
  it('telo funkcije je isto (do razmaka)', () => {
    const legacy = readFileSync(join(process.cwd(), '..', 'app.js'), 'utf8');
    const copy = readFileSync(join(process.cwd(), 'public/uvod.js'), 'utf8');
    expect(block(legacy).length).toBeGreaterThan(500);
    expect(block(copy)).toBe(block(legacy));
  });
});
