/* PODACI GENERISANOG PLANA: šta pripada njemu (ID-jevi na „g") i kako se briše.

   Novi generisan plan dobija ISTE ID-jeve kao prethodni (`g3d5`), pa stari unosi moraju da odu — inače bi se zalepili
   za nepovezane dane novog plana. */

import type { PersistedState } from '../state';

export const isGenId = (k: unknown): boolean => typeof k === 'string' && k.charAt(0) === 'g';

type Collections = Pick<
  PersistedState,
  'log' | 'pred' | 'predLock' | 'alts' | 'moves' | 'vdotLog' | 'knee' | 'kg'
>;

export function hasGenPlanData(
  s: Pick<PersistedState, 'log' | 'pred' | 'alts' | 'moves' | 'vdotLog'>
): boolean {
  const keys = (o: object | null | undefined): string[] => Object.keys(o ?? {});
  return (
    keys(s.log).some(isGenId) ||
    keys(s.pred).some(isGenId) ||
    keys(s.alts).some(isGenId) ||
    keys(s.moves).some(isGenId) ||
    (s.vdotLog ?? []).some((e) => !!e && isGenId(e.id))
  );
}

const withoutGenKeys = <T>(o: Record<string, T> | null | undefined): Record<string, T> =>
  Object.fromEntries(Object.entries(o ?? {}).filter(([k]) => !isGenId(k)));

/**
 * Briše SAMO podatke generisanog plana. Bol i težina: odlaze samo redovi IZVEDENI iz treninga generisanog plana
 * (`src` = ID dana). Ručni unosi (`src` null) su korisnikovi sopstveni zapisi o telu, ne o planu — oni ostaju.
 * Lanac forme se posle preračunava iz onoga što je ostalo (to radi pozivalac: baza lanca zavisi od novog plana).
 */
export function purgeGenPlanData(s: Collections): Collections {
  return {
    log: withoutGenKeys(s.log),
    pred: withoutGenKeys(s.pred),
    predLock: withoutGenKeys(s.predLock),
    alts: withoutGenKeys(s.alts),
    moves: withoutGenKeys(s.moves),
    vdotLog: (s.vdotLog ?? []).filter((e) => !(e && isGenId(e.id))),
    knee: (s.knee ?? []).filter((k) => !(k && isGenId(k.src))),
    kg: (s.kg ?? []).filter((x) => !(x && isGenId(x.src)))
  };
}
