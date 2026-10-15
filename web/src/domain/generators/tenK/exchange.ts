/* JEDINA VEZA 10K GENERATORA SA APLIKACIJOM NA NIVOU TIPOVA: format razmene podataka (perzistirani plan, dnevnik, izmene,
   lanac forme) i kalendarski tip datuma. Samo `export type` — nijedna izvršna funkcija aplikacije ni drugog generatora ne ulazi
   ovuda. Provera: `isolation.node.test.ts` (dozvoljen je jedino ovaj fajl kao izlaz iz modula, i samo tipovima). */
export type {
  AltRecord,
  DayTag,
  GenPlanState,
  LogEntry,
  StoredWeek,
  T3kRecord,
  VdotRecord
} from '../../state';
export type { IsoDate } from '../../date';
