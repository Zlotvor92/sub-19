import { describe, expect, it } from 'vitest';
import { missingZonesReason } from '../domain/zones';
import { currentPaths } from './copy';

describe('currentPaths', () => {
  it('stare puteve kroz Podešavanja menja putevima kroz tab Ti', () => {
    expect(currentPaths('(Podešavanja → Tvoje zone pulsa)')).toBe(
      '(Ti → Zone i postavke treninga)'
    );
    expect(currentPaths('zato mogu da se razlikuju od spiska u Podešavanjima')).toBe(
      'zato mogu da se razlikuju od spiska u Ti → Zone i postavke treninga'
    );
    expect(currentPaths('Podešavanja → intervals.icu → „Povuci sve" i raspodela')).toBe(
      'Ti → Povezani servisi → intervals.icu → „Povuci sve" i raspodela'
    );
  });

  it('tekst bez tih fraza ostaje isti', () => {
    expect(currentPaths('Nema podataka.')).toBe('Nema podataka.');
    expect(currentPaths('')).toBe('');
  });

  it('svaka poruka koju domen vraća za zone više ne pominje Podešavanja', () => {
    const ctx = {
      icuConnected: true,
      current: { zones: null, source: null },
      zoneError: null
    } as never;
    const texts = [
      missingZonesReason({ lock: true }, ctx),
      missingZonesReason({}, ctx),
      missingZonesReason({ icu: {} }, ctx)
    ].filter((t): t is string => typeof t === 'string');
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) expect(currentPaths(t)).not.toMatch(/Podešavanja →/);
  });
});
