/* Golden-master otisak generatora — most ka ../../../test/otisak-generatora.mjs.
   Isti scenariji, isti kanonski zapis, isti SHA-256 → poređenje sa upisanim
   fixture-om (test/fixtures/otisak-generatora.json). Ne uvozi se iz produkcije. */
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

export interface Scenario {
  ime: string;
  inp: Record<string, unknown>;
}

interface FingerprintModule {
  scenariji(): Scenario[];
  ucitajOtisak(): {
    redovi: Record<string, { sha: string; pregled: unknown }>;
    ukupno: string;
  } | null;
}

let mod: Promise<FingerprintModule> | undefined;
export function loadFingerprint(): Promise<FingerprintModule> {
  mod ??= import(
    /* @vite-ignore */ pathToFileURL(
      fileURLToPath(new URL('../../../test/otisak-generatora.mjs', import.meta.url))
    ).href
  ) as Promise<FingerprintModule>;
  return mod;
}

/** Kanonski zapis: ključevi sortirani, brojevi na 3 decimale (isto kao stari `kanonski`). */
export function canonical(x: unknown): unknown {
  if (x === null || x === undefined) return null;
  if (typeof x === 'number') return Number.isFinite(x) ? Math.round(x * 1000) / 1000 : String(x);
  if (Array.isArray(x)) return x.map(canonical);
  if (typeof x === 'object') {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(x).sort()) o[k] = canonical((x as Record<string, unknown>)[k]);
    return o;
  }
  return x;
}

export function shaOf(plan: unknown): string {
  return createHash('sha256').update(JSON.stringify(plan)).digest('hex').slice(0, 16);
}
