import { describe, expect, it } from 'vitest';
import { loadMarathonReference } from './reference';

/* Referenca maraton je snimljena iz STAROG zajedničkog engine-a na `ad464c0` (v. docs/generator-isolation/STATUS.md).
   Stari engine je obrisan posle segmenta 5/5, pa se snimanje više ne radi u ovom stablu. Ponovno snimanje: worktree na
   `ad464c0`, kopirati src/test/{fiveK,halfMarathon,marathon}/*, pa
       CAPTURE_MARATHON_REFERENCE=<SHA> npx vitest run --project node marathon/captureReference
   (u tom stablu ovaj fajl ima i deo za snimanje — v. istoriju fajla). Ovde se samo proverava da referenca postoji i nosi
   zabeleženi commit; poređenje rade testovi ekvivalencije generatora. */
describe('referenca maraton (stari engine)', () => {
  it('postoji i nosi polazni commit', () => {
    const ref = loadMarathonReference();
    expect(ref).not.toBeNull();
    expect(ref?.baselineSha).toBe('ad464c01bb3fb3e146cd27939cbe17d8a8e442e8');
    expect(Object.keys(ref?.generation ?? {}).length).toBeGreaterThan(50);
    expect(Object.keys(ref?.adaptation ?? {}).length).toBeGreaterThan(50);
    expect(Object.keys(ref?.decisions ?? {}).length).toBeGreaterThan(50);
  });
});
