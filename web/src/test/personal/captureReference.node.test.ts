import { describe, expect, it } from 'vitest';
import { legacyApi } from '@/test/fiveK/legacyApi';
import { loadPersonalReference, personalRows, writePersonalReference } from './reference';

/* Snimanje reference ličnog plana je ručna, jednokratna radnja na stanju PRE segmenta 5 (stari mehanizam još postoji):
       CAPTURE_PERSONAL_REFERENCE=<polazni SHA> npx vitest run --project node personal/captureReference
   Bez promenljive test samo proverava da referenca postoji i da je uzeta na zabeleženom commitu. */
describe('referenca ličnog plana (stari mehanizam)', () => {
  it('postoji i nosi polazni commit', { timeout: 1_800_000 }, () => {
    const baseline = process.env['CAPTURE_PERSONAL_REFERENCE'];
    if (baseline)
      writePersonalReference({
        baselineSha: baseline,
        ...(process.env['CROSS_CHECK_SHA']
          ? { crossCheckedSha: process.env['CROSS_CHECK_SHA'] }
          : {}),
        capturedWith: 'legacyApi (domain/training + domain/plan), lični plan genPlan === null',
        tz: process.env['TZ'] ?? '',
        flows: personalRows(legacyApi)
      });
    const ref = loadPersonalReference();
    expect(ref).not.toBeNull();
    expect(ref?.baselineSha).toBe('348391c6f81f8ee62b73b06379c9b563cf75394e');
    expect(Object.keys(ref?.flows ?? {}).length).toBeGreaterThan(1000);
  });
});
