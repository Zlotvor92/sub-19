import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/* Zamena za `test/bezbednost.test.mjs` :: „mejl adresa vlasnika nije u klijentskom kodu (skreperi za spam)" — sada nad izvorom novog frontenda (bez testova i
   zamrznutih snimaka). Prava adresa vlasnika ne sme da stoji u kodu koji stiže svakom korisniku; vlasnik se prepoznaje po ID-u naloga, a server proverava adresu. */

const SRC = join(process.cwd(), 'src');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const clientFiles = walk(SRC).filter(
  (f) =>
    /\.(ts|tsx)$/.test(f) &&
    !/\.(test|oracle\.test|node\.test)\.tsx?$/.test(f) &&
    !f.includes('/src/test/')
);

describe('izvor klijenta', () => {
  it('nema stvarnih mejl adresa (skreperi za spam); dozvoljeni su samo primeri i noreply', () => {
    expect(clientFiles.length).toBeGreaterThan(100);
    const found: string[] = [];
    for (const f of clientFiles) {
      const emails =
        readFileSync(f, 'utf8').match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? [];
      for (const m of emails)
        if (!/example|@t\.rs|@b\.c|noreply/i.test(m)) found.push(`${f}: ${m}`);
    }
    expect(found).toEqual([]);
  });

  it('vlasnik se prepoznaje po ID-u naloga (ADMIN_UID, oblik UUID), ne po mejlu', () => {
    const cfg = readFileSync(join(SRC, 'services/config.ts'), 'utf8');
    expect(cfg).toMatch(/ADMIN_UID\s*=\s*'[0-9a-f-]{36}'/);
  });
});
