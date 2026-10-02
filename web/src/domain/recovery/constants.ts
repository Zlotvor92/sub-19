/* PRAGOVI OPORAVKA. Svaki je odluka proizvoda ili trenerska heuristika — NIJEDAN nije izveden iz
   merenja, i nijedan ne sme da se predstavi korisniku kao nauka (zahtev §9).

   Bol: 0 = bez bola · 3–5 pazi · 6+ stani · 3+ dana ≥3 u 7 dana = fizijatar (pragovi vlasnika).
   ACWR: pojam i „bezbedan pojas" 0,8–1,3 su iz literature o odnosu akutnog i hroničnog opterećenja;
   KOLIKO se spušta posle bola (0,8 × hronično) i lestvica 50/70/85 % su heuristika. Dokaz da ACWR
   predviđa povredu je sporan — v. docs/TRAINING_ENGINE_AUDIT.md. */

/** Bol od koga se prati („pazi"). */
export const PAIN_WATCH = 3;
/** Bol od koga je status „stani". */
export const PAIN_STOP = 6;
/** Broj dana sa bolom ≥ PAIN_WATCH u 7 dana koji šalje na pregled. */
export const PAIN_DAYS_SEE_PHYSIO = 3;
/** Prozor za ocenu bola (dana, uključujući danas). */
export const PAIN_WINDOW_DAYS = 7;
/** Koliko unazad se traži ozbiljna epizoda da bi povratak uopšte postojao. */
export const RETURN_LOOKBACK_DAYS = 42;
/** Lestvica povratka: udeo planiranog obima po nedelji nakon završetka akutne faze. */
export const RETURN_LADDER = [0.5, 0.7, 0.85] as const;

/** Horizont predloga (dana). Uvek 7 = isti horizont kao nedeljni ACWR budžet. */
export const PROPOSAL_HORIZON_DAYS = 7;

/** Nedeljni obim posle bola: ispod hroničnog proseka. */
export const ACWR_RETURN = 0.8;
/** Gornja ivica bezbednog pojasa; preko 1,5 rizik naglo raste. */
export const ACWR_MAX = 1.3;

/** Koliko dana unazad se meri ostvarenost (isti horizont kao hronično opterećenje). */
export const BREAK_WINDOW_DAYS = 28;
/** Ispod ove ostvarenosti trailing prozor nije rast plana nego prekid. */
export const BREAK_THRESHOLD = 0.7;
/** Dana bez trčanja posle kojih prva nedelja povratka ide bez kvaliteta. */
export const BREAK_NO_QUALITY_DAYS = 10;

/** Run/walk ispod ovog bola se vraća neprekidno trčanje. */
export const RW_PAIN_MIN = 4;
/** Run/walk po jačini bola: što jači bol, kraće trčanje, duži hod i manji obim. */
export const RW_BY_PAIN = [
  { from: 9, runSec: 60, walkSec: 120, volume: 0.25 },
  { from: 7, runSec: 60, walkSec: 60, volume: 0.35 },
  { from: 6, runSec: 120, walkSec: 60, volume: 0.45 },
  { from: 5, runSec: 180, walkSec: 60, volume: 0.55 },
  { from: 4, runSec: 300, walkSec: 60, volume: 0.65 }
] as const;

/** Bez istorije se pada na ove udele (kvalitet / lagano). */
export const PAIN_VOLUME_FALLBACK = { quality: 0.6, easy: 0.75 } as const;
