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

/** Nedeljni obim posle bola: ispod hroničnog proseka. */
export const ACWR_RETURN = 0.8;
/** Gornja ivica bezbednog pojasa; preko 1,5 rizik naglo raste. */
export const ACWR_MAX = 1.3;

/** Koliko dana unazad se meri ostvarenost (isti horizont kao hronično opterećenje). */
export const BREAK_WINDOW_DAYS = 28;
/** Ispod ove ostvarenosti trailing prozor nije rast plana nego prekid. */
export const BREAK_THRESHOLD = 0.7;

/* Pragovi PREDLOGA izmene plana (horizont, run/walk po bolu, udeli obima, nedelja bez kvaliteta posle pauze) su od prenosa
   u generatore u `domain/generators/<distanca>/recovery/constants.ts` — svaki generator ima svoje. Ovde ostaju pragovi
   PRIKAZA stanja (bol, opterećenje, prekid). */
