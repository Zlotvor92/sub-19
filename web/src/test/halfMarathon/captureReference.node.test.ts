import { describe, expect, it } from 'vitest';
import { loadHmReference } from './reference';

/* Referenca HM je snimljena iz STAROG zajedničkog engine-a na `90f2d0e` (v. docs/generator-isolation/STATUS.md).
   Stari engine je obrisan posle segmenta 5/5, pa se snimanje više ne radi u ovom stablu. Ponovno snimanje: worktree na
   `90f2d0e`, kopirati src/test/{fiveK,halfMarathon}/*, pa
       CAPTURE_HM_REFERENCE=<SHA> npx vitest run --project node halfMarathon/captureReference
   (u tom stablu ovaj fajl ima i deo za snimanje — v. istoriju fajla). Ovde se samo proverava da referenca postoji i nosi
   zabeleženi commit; poređenje rade testovi ekvivalencije generatora. */
describe('referenca HM (stari engine)', () => {
  it('postoji i nosi polazni commit', () => {
    const ref = loadHmReference();
    expect(ref).not.toBeNull();
    expect(ref?.baselineSha).toBe('90f2d0e5a21524ab408ba38060347f97e9843955');
    expect(Object.keys(ref?.generation ?? {}).length).toBeGreaterThan(50);
    expect(Object.keys(ref?.adaptation ?? {}).length).toBeGreaterThan(50);
    expect(Object.keys(ref?.decisions ?? {}).length).toBeGreaterThan(50);
  });
});
