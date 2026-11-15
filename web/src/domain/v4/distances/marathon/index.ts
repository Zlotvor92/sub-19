/* MARATON KAO PODATAK (SPEC § 11). Jedan izvoz: `hm: DistanceData`. Motor ne zna za distance; sve što je
   posebno za maraton je ovde — šabloni, biblioteka, brojevi bezbednosti, adekvatna priprema, tekstovi. */
import type { DistanceData } from '../../engine/types';
import { LIBRARY } from './library';
import { ADEQUATE, LEVELS, SAFETY } from './safety';
import { TEMPLATES } from './templates';
import { NOTE_RULES, TEXTS } from './texts';

export const marathon: DistanceData = {
  id: 'marathon',
  version: '1',
  distanceM: 42195,
  label: 'maraton',
  levels: LEVELS,
  templates: TEMPLATES,
  library: LIBRARY,
  safety: SAFETY,
  adequate: ADEQUATE,
  noteRules: NOTE_RULES,
  /* lagani i dugi trajanjem kad je lagan tempo sporiji od 6:45/km (sporim trkačima i hod-trku je vreme jasnije) */
  presentation: { byDurationAboveSecPerKm: 405 },
  texts: TEXTS
};
