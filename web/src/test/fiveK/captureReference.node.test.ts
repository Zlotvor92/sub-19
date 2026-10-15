import { describe, expect, it } from 'vitest';
import { legacyApi } from './legacyApi';
import { adaptationRows, generationRows, loadReference, writeReference } from './reference';

/* Snimanje reference je ručna, jednokratna radnja na polaznom commitu (pre izdvajanja):
       CAPTURE_FIVEK_REFERENCE=<polazni SHA> npx vitest run --project node captureReference
   Bez promenljive test samo proverava da referenca postoji i da je uzeta na zabeleženom commitu. */
describe('5K referenca (stari mehanizam)', () => {
  it('postoji i nosi polazni commit', () => {
    const baseline = process.env['CAPTURE_FIVEK_REFERENCE'];
    if (baseline) {
      writeReference({
        baselineSha: baseline,
        capturedWith: 'legacyApi (domain/training + domain/plan, pre izdvajanja 5K)',
        tz: process.env['TZ'] ?? '',
        generation: generationRows(legacyApi),
        adaptation: adaptationRows(legacyApi)
      });
    }
    const ref = loadReference();
    expect(ref).not.toBeNull();
    expect(ref?.baselineSha).toBe('05088e0440c50e866bb3bbf6246ff20fe5619f4c');
    expect(Object.keys(ref?.generation ?? {}).length).toBeGreaterThan(1000);
    expect(Object.keys(ref?.adaptation ?? {}).length).toBeGreaterThan(1000);
  });
});
