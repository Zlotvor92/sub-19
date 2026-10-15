import { describe, expect, it } from 'vitest';
import { loadOtherReference } from './otherReference';

/* Referenca 10K/HM/maraton (polazni main) je snimljena iz STAROG zajedničkog engine-a na `05088e0` (v. docs/generator-isolation/STATUS.md).
   Stari engine je obrisan posle segmenta 5/5, pa se snimanje više ne radi u ovom stablu. Ponovno snimanje: worktree na
   `05088e0`, kopirati src/test/fiveK/*, pa
       CAPTURE_OTHER_REFERENCE=<SHA> npx vitest run --project node fiveK/captureOtherReference
   (u tom stablu ovaj fajl ima i deo za snimanje — v. istoriju fajla). Ovde se samo proverava da referenca postoji i nosi
   zabeleženi commit; poređenje rade testovi ekvivalencije generatora. */
describe('referenca 10K/HM/maraton (polazni main) (stari engine)', () => {
  it('postoji i nosi polazni commit', () => {
    const ref = loadOtherReference();
    expect(ref).not.toBeNull();
    expect(ref?.baselineSha).toBe('05088e0440c50e866bb3bbf6246ff20fe5619f4c');
    expect(Object.keys(ref?.generation ?? {}).length).toBeGreaterThan(50);
  });
});
