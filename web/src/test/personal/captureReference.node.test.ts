import { describe, expect, it } from 'vitest';
import { loadPersonalReference } from './reference';

/* Referenca ličnog plana je snimljena iz STAROG zajedničkog engine-a na `348391c` (v. docs/generator-isolation/STATUS.md).
   Stari engine je obrisan posle segmenta 5/5, pa se snimanje više ne radi u ovom stablu. Ponovno snimanje: worktree na
   `348391c`, kopirati src/test/{fiveK,personal}/*, pa
       CAPTURE_PERSONAL_REFERENCE=<SHA> npx vitest run --project node personal/captureReference
   (u tom stablu ovaj fajl ima i deo za snimanje — v. istoriju fajla). Ovde se samo proverava da referenca postoji i nosi
   zabeleženi commit; poređenje rade testovi ekvivalencije generatora. */
describe('referenca ličnog plana (stari engine)', () => {
  it('postoji i nosi polazni commit', () => {
    const ref = loadPersonalReference();
    expect(ref).not.toBeNull();
    expect(ref?.baselineSha).toBe('348391c6f81f8ee62b73b06379c9b563cf75394e');
    expect(Object.keys(ref?.flows ?? {}).length).toBeGreaterThan(50);
  });
});
