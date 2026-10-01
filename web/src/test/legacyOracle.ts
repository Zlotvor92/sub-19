/* Most ka STAROJ aplikaciji (../../../test/harness.mjs → node:vm nad app.js).
   Služi isključivo za diferencijalne testove u fazi parity-ja (docs/REWRITE_PLAN.md
   odluka D). Ne uvozi se iz produkcijskog koda. */
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

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
  /* Putanja od korena paketa (`web/`), ne od `import.meta.url`: u jsdom okruženju `import.meta.url` nije `file:`, a ni `import()` kroz Vite ne
     razrešava `file:` adresu. Node ≥ 22.12 ume `require()` nad ESM modulom (v. `engines` u package.json). */
  const require = createRequire(resolve(process.cwd(), 'package.json'));
  harness ??= Promise.resolve(require('../test/harness.mjs') as Harness);
  return harness;
}

/** Nova instanca stare aplikacije (izolovan vm kontekst), sa fiksiranim satom. */
export async function loadLegacyApp(now = '2026-01-05T09:00:00Z'): Promise<LegacyApp> {
  const h = await loadHarness();
  return h.loadApp({ now });
}
