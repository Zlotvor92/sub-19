/* ============================================================
   DOKAZANO — objavljena matematika. Ništa ovde nije podešavanje.

   Mešati ovo sa trenerskom heuristikom (heuristics.ts) ili proizvodnom
   odlukom (product.ts) je tačno ona greška koju zadatak zabranjuje: broj iz
   ovog fajla sme da se menja samo ako se menja izvor, ne ukus.
   ============================================================ */

/** Daniels & Gilbert (1979): potrošnja kiseonika u funkciji brzine v [m/min]. */
export const VO2_INTERCEPT = -4.6;
export const VO2_LINEAR = 0.182258;
export const VO2_QUADRATIC = 0.000104;

/** Daniels & Gilbert (1979): udeo VO2max koji se može držati t minuta. */
export const PCT_VO2MAX_BASE = 0.8;
export const PCT_VO2MAX_SLOW = { amplitude: 0.1894393, rate: -0.012778 } as const;
export const PCT_VO2MAX_FAST = { amplitude: 0.2989558, rate: -0.1932605 } as const;

/** Riegel (1981): t₂ = t₁·(d₂/d₁)^k. */
export const RIEGEL_EXPONENT = 1.06;
