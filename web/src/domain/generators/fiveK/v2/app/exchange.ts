/* JEDINA VEZA 5K v2 SA APLIKACIJOM NA NIVOU TIPOVA (V1b: preseljeno iz `fiveK/exchange.ts` pri brisanju 5K v1): format
   razmene podataka (perzistirani plan, dnevnik, izmene, lanac forme) i kalendarski tip datuma. Samo `export type` —
   nijedna izvršna funkcija aplikacije ni drugog generatora ne ulazi ovuda (uslov 7: type-only neutralni tipovi).
   Provera: `../isolation.node.test.ts` (dozvoljen je jedino ovaj fajl kao izlaz iz v2/, i samo tipovima). */
export type {
  AltRecord,
  DayTag,
  GenPlanState,
  LogEntry,
  OffPlanRun,
  PainRecord,
  StoredWeek,
  StructuredDay,
  SyncIssue,
  T3kRecord,
  VdotRecord,
  WellnessRecord
} from '../../../../state';
export type { IsoDate } from '../../../../date';
