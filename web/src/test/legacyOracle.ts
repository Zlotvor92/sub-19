/* Most ka STAROJ aplikaciji (../../../test/harness.mjs → node:vm nad app.js).
   Služi isključivo za diferencijalne testove u fazi parity-ja (docs/REWRITE_PLAN.md
   odluka D). Ne uvozi se iz produkcijskog koda. */
import { fileURLToPath, pathToFileURL } from 'node:url';

export interface LegacyApp {
  call(fn: string, ...args: unknown[]): unknown;
  get(name: string): unknown;
  evalIn(expr: string): unknown;
}

interface Harness {
  loadApp(opts?: { now?: string }): LegacyApp;
}

let harness: Promise<Harness> | undefined;

function loadHarness(): Promise<Harness> {
  harness ??= import(
    /* @vite-ignore */ pathToFileURL(
      fileURLToPath(new URL('../../../test/harness.mjs', import.meta.url))
    ).href
  ) as Promise<Harness>;
  return harness;
}

/** Nova instanca stare aplikacije (izolovan vm kontekst), sa fiksiranim satom. */
export async function loadLegacyApp(now = '2026-01-05T09:00:00Z'): Promise<LegacyApp> {
  const h = await loadHarness();
  return h.loadApp({ now });
}
