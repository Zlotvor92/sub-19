/* ŠTA IDE NA SERVER, i šta ostaje samo na uređaju.

   Stanje je JEDAN JSON blob (`user_state.data`). Ugovor privatnosti (privacy.html) kaže da se tokeni i
   koordinate NE upisuju u bazu — ovo je jedino mesto gde se taj ugovor sprovodi, zato je čista funkcija sa
   testom koji proverava sve što ne sme da pređe granicu.

   - Strava tokeni (access/refresh) se NAMERNO izostavljaju: nisu potrebni drugom uređaju (tamo se Strava
     poveže ponovo, jedan klik), a čuvanje OAuth tokena u bazi bez pravog proksija je rizik bez koristi.
     Ime i vreme sinhronizacije su bezopasni — već se prikazuju u Podešavanjima.
   - intervals.icu API ključ i OAuth token su isto što i Strava token: pristupni podatak, ostaje na uređaju.
     Sami PODACI o oporavku (`wellness`) idu, jer su to merenja kao i svako drugo.
   - KOORDINATE NE IDU (`ui.geo`) i ne ide `vreme` (keš tuđeg servisa; nosi lat/lon i vezan je za mesto —
     kopija sa drugog uređaja bi davala temperaturu pogrešnog mesta, označenu kao pouzdanu prognozu). Cela
     odbrana zbog koje se Open-Meteo zove DIREKTNO iz pregledača nema smisla ako iste koordinate završe u
     našoj bazi drugim putem — a ovaj isti red ih je do ispravke puštao. */

import type { PersistedState } from '../state';

/** Stanje kako izgleda na serveru. */
export type ServerState = Omit<PersistedState, 'strava' | 'icu' | 'vreme'> & {
  strava: { lastSync: unknown; athlete: unknown; scope: unknown } | null;
  icu: { lastSync: unknown } | null;
};

export function toServerPayload(state: PersistedState): ServerState {
  const copy = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
  const strava = state.strava as { lastSync?: unknown; athlete?: unknown; scope?: unknown } | null;
  copy['strava'] = strava
    ? {
        lastSync: strava.lastSync || null,
        athlete: strava.athlete || null,
        scope: strava.scope || null
      }
    : null;
  const icu = state.icu as { lastSync?: unknown } | null;
  copy['icu'] = icu ? { lastSync: icu.lastSync || null } : null;
  const ui = copy['ui'];
  if (ui && typeof ui === 'object') delete (ui as Record<string, unknown>)['geo'];
  delete copy['vreme'];
  return copy as unknown as ServerState;
}

/**
 * Usvajanje stanja koje je stiglo sa servera (`sbPull`, vraćanje ranije verzije): VEZE I LOKACIJA SE
 * ZADRŽAVAJU sa uređaja. Na serveru `strava`/`icu` stoje BEZ tokena — da se preuzmu odande, vraćanje verzije
 * bi te otkačilo sa Strave i intervals.icu-a. Koordinate i keš prognoze su po uređaju: bez ovoga bi povlačenje
 * ugasilo vreme na uređaju koji ga ima (sa servera stiže `geo: null`).
 */
export function adoptServerState(server: PersistedState, device: PersistedState): PersistedState {
  const next: PersistedState = {
    ...server,
    strava: device.strava ?? null,
    icu: device.icu ?? null
  };
  const geo = device.ui?.geo;
  if (geo) next.ui = { ...(next.ui ?? {}), geo };
  if (device.vreme) next.vreme = device.vreme;
  return next;
}
