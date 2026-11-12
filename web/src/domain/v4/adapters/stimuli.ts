/* V4 ADAPTERI — TABELA PRESLIKAVANJA starih oznaka dana u oznake podražaja distance (SPEC § 9.3). PODATAK, ne kod:
   nova distanca ili preimenovana oznaka u biblioteci = nov red ovde.

   Adapter iz starog dana izvodi jednu od opštih „namera" (`Cue`) — po `tag`-u, zoni rada iz `structure`/`session`
   i ubrzanjima — a tabela je prevodi u oznaku koju biblioteka TE distance poznaje. Namera bez reda u tabeli ne ulazi
   u `intent.stimuli` (motor bi na događaj iz nje napravio lagan dan, F2 izveštaj). Test proverava da je svaka oznaka
   iz tabele u biblioteci distance koja postoji u repozitorijumu. */
import type { StimulusTag } from '../engine/types';

/** Opšte namere starog dana. */
export type Cue =
  | 'prag'
  | 'intervali'
  | 'brzina'
  | 'tempo-trke'
  | 'ostrenje'
  | 'dugi'
  | 'dugi-rp'
  | 'dugi-progresivno'
  | 'ubrzanja'
  | 'kontrola';

/** Zona rada starog dana → namera kvaliteta. */
export const ZONE_CUE: Readonly<Record<string, Cue>> = {
  T: 'prag',
  I: 'intervali',
  R: 'brzina',
  RP: 'tempo-trke',
  M: 'tempo-trke',
  MP: 'tempo-trke',
  activation: 'ostrenje'
};

/** Stari `tag` bez zone rada → namera kvaliteta. */
export const TAG_CUE: Readonly<Record<string, Cue>> = {
  tempo: 'prag',
  int: 'intervali',
  test: 'kontrola'
};

/** Zone rada u dugom koje dugi čine „dugim sa blokom tempa trke". */
export const LONG_BLOCK_ZONES: readonly string[] = ['RP', 'M', 'MP'];

const SAME: Readonly<Record<Cue, StimulusTag>> = {
  prag: 'prag',
  intervali: 'intervali',
  brzina: 'brzina',
  'tempo-trke': 'tempo-trke',
  ostrenje: 'ostrenje',
  dugi: 'dugi',
  'dugi-rp': 'dugi-rp',
  'dugi-progresivno': 'dugi-progresivno',
  ubrzanja: 'ubrzanja',
  kontrola: 'kontrola'
};

/** Po distanci (`DistanceData.id`). `hm` je proveren nad bibliotekom `distances/hm`; ostale tri su privremeno iste
    oznake dok F7 ne isporuči biblioteke (folderi `fivek`, `tenk`, `marathon` po PLAN.md) — tada test proverava i njih. */
export const STIMULUS_TABLE: Readonly<Record<string, Readonly<Partial<Record<Cue, StimulusTag>>>>> =
  {
    hm: SAME,
    tenk: SAME,
    fivek: SAME,
    marathon: SAME
  };

/** Dužina trke iz starog `meta.raceDistM` → `DistanceData.id`. */
export const DISTANCE_BY_METERS: readonly { distanceM: number; id: string }[] = [
  { distanceM: 5000, id: 'fivek' },
  { distanceM: 10000, id: 'tenk' },
  { distanceM: 21097.5, id: 'hm' },
  { distanceM: 42195, id: 'marathon' }
];

export function stimulusFor(distanceId: string, cue: Cue | null): StimulusTag | null {
  if (cue === null) return null;
  return STIMULUS_TABLE[distanceId]?.[cue] ?? null;
}
