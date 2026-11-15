/* 10 KM KAO PODATAK (SPEC § 11). Jedan izvoz: `tenk: DistanceData`. Motor ne zna za distance; sve što je posebno za
   10 km je ovde — šabloni, biblioteka, brojevi bezbednosti, adekvatna priprema, tekstovi. Ne uvozi drugu distancu. */
import type { DistanceData } from '../../engine/types';
import { LIBRARY } from './library';
import { ADEQUATE, LEVELS, SAFETY } from './safety';
import { TEMPLATES } from './templates';
import { NOTE_RULES, TEXTS } from './texts';

export const tenk: DistanceData = {
  id: 'tenk',
  version: '1',
  distanceM: 10000,
  label: '10 km',
  levels: LEVELS,
  templates: TEMPLATES,
  library: LIBRARY,
  safety: SAFETY,
  adequate: ADEQUATE,
  noteRules: NOTE_RULES,
  /* lagani i dugi trajanjem kad je lagan tempo sporiji od 6:45/km (isto merilo kao kod drugih distanci) */
  presentation: { byDurationAboveSecPerKm: 405 },
  texts: TEXTS
};
