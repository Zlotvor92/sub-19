/* PREKIDAČ 5K v2 (segment 08a) — JEDINO mesto odluke. Domen ne čita skladište ni okruženje: aplikacija prosleđuje
   vrednost podešavanja korisnika (`ui.generatorV2FiveK`) i razvojni override (`VITE_FIVEK_V2`), a ovde se odlučuje.

   - podrazumevano isključeno: podešavanje mora biti tačno `true`;
   - override: `1`/`true` uključuje, `0`/`false` isključuje bez obzira na podešavanje; ostalo se ne računa;
   - uključeno znači samo da NOV 5K plan ide kroz v2 (`select.generatorForNewPlan`); postojeći planovi se biraju po
     svojoj oznaci politike i nikad se ne prebacuju. */

import type { GeneratorFlags } from './select';

/** Ključ podešavanja u `ui` delu stanja. */
export const FIVE_K_V2_SETTING = 'generatorV2FiveK';
/** Ime razvojnog override-a (Vite env). */
export const FIVE_K_V2_ENV = 'VITE_FIVEK_V2';

export function fiveKV2Enabled(sources: { setting: unknown; devOverride: unknown }): boolean {
  const o = typeof sources.devOverride === 'string' ? sources.devOverride.trim().toLowerCase() : '';
  if (o === '1' || o === 'true') return true;
  if (o === '0' || o === 'false') return false;
  return sources.setting === true;
}

export function generatorFlags(sources: {
  setting: unknown;
  devOverride: unknown;
}): GeneratorFlags {
  return { fiveKV2: fiveKV2Enabled(sources) };
}
