import { describe, expect, it, vi } from 'vitest';
import { PARTS, policyCheck, type Handoff } from '@/test/fiveK/runtimeIsolation';

/* PUN NIVO, izolacija u izvršavanju (v. `runtimeIsolation.node.test.ts`): provera 5 (lokalna promena politike) za cilj HM
   nad adaptacijom današnjeg podskupa (deo B). Glavni fajl istu proveru za sva 4 cilja radi nad generisanjem (deo G). */

/** Predaja usmerena na NETAKNUTU instancu 5K/10K/HM generatora (svež modul). */
async function pristineHandoff(): Promise<Handoff> {
  vi.resetModules();
  const pristine: Record<number, unknown> = {
    5000: (await import(/* @vite-ignore */ './fiveK')).handoffFuture,
    10000: (await import(/* @vite-ignore */ './tenK')).handoffFuture,
    21097.5: (await import(/* @vite-ignore */ './halfMarathon')).handoffFuture
  };
  return ((dist: number | undefined) => pristine[dist || 5000] ?? null) as unknown as Handoff;
}

describe('izolacija generatora u izvršavanju', () => {
  it(
    'lokalna promena politike jednog generatora ne menja izlaze ostalih (cilj HM, adaptacija)',
    { timeout: 1_800_000 },
    async () => {
      const viaHandoff = policyCheck(['HM'], await pristineHandoff(), () => PARTS.B);
      /* Kanal predaje je stvaran (bar jedan tok nudi plan kraće distance) i jedini je kanal. U današnjem podskupu to je
         upravo ovaj deo — maraton nudi HM plan (`qa · generator-final · U10 · 2026-12-27 · under · execution reduce`);
         ostali ciljevi i deo G daju 0 promena kroz predaju, pa je tvrdnja ista kao nad zbirom svih ciljeva. */
      expect(viaHandoff).toBeGreaterThan(0);
    }
  );
});
