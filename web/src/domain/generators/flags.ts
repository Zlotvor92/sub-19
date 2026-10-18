/* PREKIDAČI v2 GENERATORA (5K: segment 08a; 10K: segment 05) — JEDINO mesto odluke. Domen ne čita skladište ni
   okruženje: aplikacija prosleđuje vrednost podešavanja korisnika (`ui.generatorV2FiveK`, `ui.generatorV2TenK`) i razvojni
   override (`VITE_FIVEK_V2`, `VITE_TENK_V2`), a ovde se odlučuje. Isto pravilo za oba prekidača:

   - podrazumevano isključeno: podešavanje mora biti tačno `true`;
   - override: `1`/`true` uključuje, `0`/`false` isključuje bez obzira na podešavanje; ostalo se ne računa;
   - uključeno znači samo da NOV plan te distance ide kroz v2 (`select.generatorForNewPlan`); postojeći planovi se biraju
     po svojoj oznaci politike i nikad se ne prebacuju. */

import type { GeneratorFlags } from './select';

/** Ključ podešavanja u `ui` delu stanja. */
export const FIVE_K_V2_SETTING = 'generatorV2FiveK';
/** Ime razvojnog override-a (Vite env). */
export const FIVE_K_V2_ENV = 'VITE_FIVEK_V2';
/** 10K v2 (segment 05): ključ podešavanja i razvojni override. */
export const TEN_K_V2_SETTING = 'generatorV2TenK';
export const TEN_K_V2_ENV = 'VITE_TENK_V2';

type Sources = { setting: unknown; devOverride: unknown };

function switchOn(sources: Sources): boolean {
  const o = typeof sources.devOverride === 'string' ? sources.devOverride.trim().toLowerCase() : '';
  if (o === '1' || o === 'true') return true;
  if (o === '0' || o === 'false') return false;
  return sources.setting === true;
}

/** Prekidač se nudi u podešavanjima samo razvoju (postavljen override, bilo koja vrednost) ili administratoru (vlasnik
 *  naloga — postojeći mehanizam aplikacije). Ponašanje podešavanja se ne menja; sakriven prekidač samo nije ponuđen
 *  (sačuvano `true` i dalje važi). */
function toggleVisible(sources: { devOverride: unknown; isAdmin: boolean }): boolean {
  const o = typeof sources.devOverride === 'string' ? sources.devOverride.trim() : '';
  return o !== '' || sources.isAdmin === true;
}

export const fiveKV2Enabled = (sources: Sources): boolean => switchOn(sources);
export const tenKV2Enabled = (sources: Sources): boolean => switchOn(sources);

/** Prekidači za nov plan. Bez izvora 10K prekidača (`tenK` izostavljen) 10K v2 je isključen (polje izostaje). */
export function generatorFlags(fiveK: Sources, tenK?: Sources): GeneratorFlags {
  return { fiveKV2: fiveKV2Enabled(fiveK), ...(tenK ? { tenKV2: tenKV2Enabled(tenK) } : {}) };
}

/** 08b: vidljivost prekidača 5K v2 (razvoj ili administrator). */
export const fiveKV2ToggleVisible = (sources: {
  devOverride: unknown;
  isAdmin: boolean;
}): boolean => toggleVisible(sources);
/** 10K v2 (segment 05): vidljivost prekidača 10K v2 — isto pravilo kao 5K posle 08b. */
export const tenKV2ToggleVisible = (sources: { devOverride: unknown; isAdmin: boolean }): boolean =>
  toggleVisible(sources);
