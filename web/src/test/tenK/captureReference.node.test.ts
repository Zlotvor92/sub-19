import { describe, expect, it } from 'vitest';
import { loadTenKReference } from './reference';

/* Referenca 10K je snimljena iz STAROG zajedničkog engine-a na `f745be0` (v. docs/generator-isolation/STATUS.md).
   Stari engine je obrisan posle segmenta 5/5, pa se snimanje više ne radi u ovom stablu. Ponovno snimanje: worktree na
   `f745be0`, kopirati src/test/{fiveK,tenK}/*, pa
       CAPTURE_TENK_REFERENCE=<SHA> npx vitest run --project node tenK/captureReference
   (u tom stablu ovaj fajl ima i deo za snimanje — v. istoriju fajla). Ovde se samo proverava da referenca postoji i nosi
   zabeleženi commit; poređenje rade testovi ekvivalencije generatora. */
describe('referenca 10K (stari engine)', () => {
  it('postoji i nosi polazni commit', () => {
    const ref = loadTenKReference();
    expect(ref).not.toBeNull();
    expect(ref?.baselineSha).toBe('f745be0e3f11d0382ee62879dcd24c57e9175683');
    expect(Object.keys(ref?.generation ?? {}).length).toBeGreaterThan(50);
    expect(Object.keys(ref?.adaptation ?? {}).length).toBeGreaterThan(50);
  });
});
