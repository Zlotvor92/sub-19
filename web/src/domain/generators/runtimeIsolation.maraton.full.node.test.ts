import { describe, it, vi } from 'vitest';
import { PARTS, policyCheck, type Handoff } from '@/test/fiveK/runtimeIsolation';

/* PUN NIVO, izolacija u izvršavanju (v. `runtimeIsolation.node.test.ts`): provera 5 (lokalna promena politike) za cilj
   maraton nad adaptacijom današnjeg podskupa (deo B). Glavni fajl istu proveru za sva 4 cilja radi nad generisanjem
   (deo G); tvrdnja „kanal predaje je stvaran" je u `runtimeIsolation.HM.full.node.test.ts`. */

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
    'lokalna promena politike jednog generatora ne menja izlaze ostalih (cilj maraton, adaptacija)',
    { timeout: 1_800_000 },
    async () => {
      policyCheck(['maraton'], await pristineHandoff(), () => PARTS.B);
    }
  );
});
