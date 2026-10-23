import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { FULL } from '@/test/level';
import {
  FAST,
  MODULE_PATHS,
  PARTS,
  TODAY,
  fastPolicySubsets,
  orderCheck,
  policyCheck,
  referenceCheck,
  sharedObjectsCheck,
  standaloneCheck,
  type Distance,
  type Handoff,
  type Mod
} from '@/test/fiveK/runtimeIsolation';

/* IZOLACIJA U IZVRŠAVANJU (segment 5/5) — dopuna statičkih provera (`architecture.node.test.ts`).

   Na istim kontrolisanim ulazima (podskup zamrznutih referenci svake distance: generisanje + adaptacioni tokovi; „danas"
   je argument, sat i slučajnost se ne čitaju) proverava se:
   1. samostalno izvršavanje (svež modul, bez ostalih generatora u procesu) = referenca;
   2. izvršavanje u različitom redosledu i isprepletano = referenca;
   3. ponovljeno izvršavanje = isti rezultat;
   4. generatori nemaju zajednički promenljiv objekat (nijedan objekat dostižan iz izvoza jednog nije dostižan iz
      izvoza drugog), a izvršavanje ne menja izvezene konstante;
   5. kontrolisana LOKALNA promena politike jednog generatora (u memoriji, samo u ovom testu, vraća se u `finally`)
      menja samo njegov izlaz; ostala tri ostaju jednaka referenci.

   Granica garancije: ovo dokazuje nezavisnost TRENERSKIH implementacija u izvršavanju. Ne dokazuje da zajednički UI,
   store, runtime (JS motor, `Intl`) ili skladište ne mogu imati grešku koja pogađa sve distance.

   NIVOI (`src/test/fiveK/runtimeIsolation.ts`). BRZ: sve provere nad manjim podskupom (`FAST`). PUN: današnji podskup
   (`TODAY`: svaki 12. ulaz, prva dva bazna plana) i današnje tvrdnje; ovaj fajl radi proveru reference celu, a 1–5 nad
   generisanjem (deo G); adaptacija (deo B) je u `runtimeIsolation.*.full.node.test.ts`: `bases` (1 i 4),
   `order1`/`order2` (2–3, po baznom planu), `5K`/`10K`/`HM`/`maraton` (5, po cilju). */

/** Svež modul jednog generatora: `vi.resetModules()` + dinamički `import` (bez ostalih generatora u procesu). */
async function fresh(d: Distance): Promise<Mod> {
  vi.resetModules();
  return (await import(/* @vite-ignore */ MODULE_PATHS[d.name])) as Mod;
}

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

const LEVEL = FULL ? PARTS.G : FAST;

describe('izolacija generatora u izvršavanju', () => {
  it('svaka distanca ima referencu i neprazan kontrolisani podskup', { timeout: 600_000 }, () => {
    referenceCheck(FULL ? TODAY : FAST);
  });

  it(
    'samostalno izvršavanje: svež modul jednog generatora, bez ostalih u procesu',
    { timeout: 600_000 },
    async () => {
      await standaloneCheck(fresh, LEVEL);
    }
  );

  it(
    'različit redosled, isprepletano i ponovljeno izvršavanje daju isti rezultat',
    { timeout: 900_000 },
    () => {
      orderCheck(LEVEL);
    }
  );

  it(
    'nema zajedničkog promenljivog objekta i izvršavanje ne menja izvezene konstante',
    { timeout: 600_000 },
    () => {
      sharedObjectsCheck(LEVEL);
    }
  );

  it(
    'lokalna promena politike jednog generatora ne menja izlaze ostalih',
    { timeout: 1_800_000 },
    async () => {
      const viaHandoff = policyCheck(
        ['5K', '10K', 'HM', 'maraton'],
        await pristineHandoff(),
        FULL ? () => PARTS.G : fastPolicySubsets
      );
      /* Kanal predaje je stvaran (bar jedan tok nudi plan kraće distance) i jedini je kanal. Predaju koriste samo tokovi
         adaptacije: u punom nivou tvrdnja je u delu B (`runtimeIsolation.HM.full.node.test.ts`; ostali ciljevi i deo G
         daju 0 promena kroz predaju, pa je zbir isti kao danas). */
      if (!FULL) expect(viaHandoff).toBeGreaterThan(0);
    }
  );

  it('pun nivo: delovi adaptacije današnjeg podskupa postoje kao zasebni fajlovi', () => {
    const missing = ['bases', 'order1', 'order2', '5K', '10K', 'HM', 'maraton']
      .map((p) => `./runtimeIsolation.${p}.full.node.test.ts`)
      .filter((f) => !existsSync(fileURLToPath(new URL(f, import.meta.url))));
    expect(missing).toEqual([]);
  });
});
