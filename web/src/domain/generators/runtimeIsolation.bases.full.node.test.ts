import { describe, it, vi } from 'vitest';
import {
  MODULE_PATHS,
  PARTS,
  sharedObjectsCheck,
  standaloneCheck,
  type Distance,
  type Mod
} from '@/test/fiveK/runtimeIsolation';

/* PUN NIVO, izolacija u izvršavanju (v. `runtimeIsolation.node.test.ts`): provere 1 (samostalno) i 4 (zajednički objekti)
   nad adaptacijom današnjeg podskupa (deo B: oba bazna plana svake distance). Glavni fajl iste provere radi nad
   generisanjem (deo G). */

/** Svež modul jednog generatora: `vi.resetModules()` + dinamički `import` (bez ostalih generatora u procesu). */
async function fresh(d: Distance): Promise<Mod> {
  vi.resetModules();
  return (await import(/* @vite-ignore */ MODULE_PATHS[d.name])) as Mod;
}

describe('izolacija generatora u izvršavanju', () => {
  it(
    'samostalno izvršavanje: svež modul jednog generatora, bez ostalih u procesu (adaptacija)',
    { timeout: 600_000 },
    async () => {
      await standaloneCheck(fresh, PARTS.B);
    }
  );

  it(
    'nema zajedničkog promenljivog objekta i izvršavanje ne menja izvezene konstante (adaptacija)',
    { timeout: 600_000 },
    () => {
      sharedObjectsCheck(PARTS.B);
    }
  );
});
