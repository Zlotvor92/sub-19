import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/* Verzija aplikacije postoji na dva mesta: `vite.config.ts` (upisuje se u sw.js — verzija offline kopije) i `services/config.ts` (verzija u paketu, sa
   kojom „Osveži aplikaciju“ poredi service worker). Kad se razlikuju, telefon pokazuje „offline kopija 289, učitan kod 288“, a osvežavanje javlja
   „Nova verzija još nije stigla“ iako je stigla. Podizanje verzije mora da promeni oba. */
const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), 'utf8');
const fallback = (src: string): string | undefined =>
  /VITE_APP_VERSION'\]\s*\|\|\s*'(\d+)'/.exec(src)?.[1];

describe('verzija aplikacije', () => {
  it('ista je u vite.config.ts (service worker) i u services/config.ts (paket)', () => {
    const sw = fallback(read('../../vite.config.ts'));
    const bundle = fallback(read('../services/config.ts'));
    expect(sw).toMatch(/^\d+$/);
    expect(bundle).toBe(sw);
  });
});
