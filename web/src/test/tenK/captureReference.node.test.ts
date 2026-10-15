import { describe, expect, it } from 'vitest';
import { legacyApi } from '@/test/fiveK/legacyApi';
import {
  loadTenKReference,
  tenKAdaptationRows,
  tenKGenerationRows,
  writeTenKReference
} from './reference';

/* Snimanje 10K reference je ručna, jednokratna radnja na polaznom stanju (pre izdvajanja 10K):
       CAPTURE_TENK_REFERENCE=<polazni SHA> npx vitest run --project node tenK/captureReference
   Bez promenljive test samo proverava da referenca postoji i da je uzeta na zabeleženom commitu. */
describe('10K referenca (stari mehanizam)', () => {
  it('postoji i nosi polazni commit', { timeout: 900_000 }, () => {
    const baseline = process.env['CAPTURE_TENK_REFERENCE'];
    if (baseline)
      writeTenKReference({
        baselineSha: baseline,
        ...(process.env['CROSS_CHECK_SHA']
          ? { crossCheckedSha: process.env['CROSS_CHECK_SHA'] }
          : {}),
        capturedWith: 'legacyApi (domain/training + domain/plan, pre izdvajanja 10K)',
        tz: process.env['TZ'] ?? '',
        generation: tenKGenerationRows(legacyApi),
        adaptation: tenKAdaptationRows(legacyApi)
      });
    const ref = loadTenKReference();
    expect(ref).not.toBeNull();
    expect(ref?.baselineSha).toBe('f745be0e3f11d0382ee62879dcd24c57e9175683');
    expect(Object.keys(ref?.generation ?? {}).length).toBeGreaterThan(1000);
    expect(Object.keys(ref?.adaptation ?? {}).length).toBeGreaterThan(1000);
  });
});
