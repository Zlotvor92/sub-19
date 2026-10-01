/* PREVLAČENJE IZMEĐU TABOVA — odluke (čisto, bez DOM-a). Kretanje i slušaoci dodira su u `app/useSwipeNav`; ovde je samo ono što se računa.
   Svaka konstanta ima razlog u starom `app.js` (blok „PREVLAČENJE"), pa se ne podešava bez njega. */

/** Prag je DEO ŠIRINE EKRANA (kad se pomera ceo ekran, pitanje je „je li pređena trećina puta"), ne fiksan broj piksela. */
export const SWIPE_FRACTION = 0.28;
/** Brz pokret prolazi i pre praga: namera je u brzini. 0,45 px/ms ≈ 450 px/s. */
export const SWIPE_FLING_PX_MS = 0.45;
/** Vodoravno mora biti toliko puta duže od uspravnog; pri neodlučnosti pobeđuje uspravno (skrolovanje se radi stotinu puta po ekranu). */
export const SWIPE_AXIS_RATIO = 1.3;
/** Na kraju niza: koliko ekran popusti i dokle. */
export const SWIPE_EDGE_RESIST = 0.34;
export const SWIPE_EDGE_MAX_PX = 70;
/** Granice trajanja dovršetka. */
export const SWIPE_MS_MIN = 240;
export const SWIPE_MS_MAX = 560;
/** Ispod ovoga se pokret još ne čita (ni kao skrol ni kao prevlačenje). */
export const SWIPE_DEAD_ZONE_PX = 10;
/** Od ovoga se zna smer, pa se susedni ekran priprema. */
export const SWIPE_DIRECTION_PX = 6;
/** Flik se priznaje samo ako je poslednji potez bio blizu puštanja. */
export const SWIPE_FLING_FRESH_MS = 120;
/** Povratak ekrana kad pokret ne uspe (kraj niza, drugi prst). */
export const SWIPE_RETURN_MS = 240;

export type Axis = 'wait' | 'vertical' | 'horizontal';

/** Koji pokret je ovo: tek počinje, uspravan (pripada skrolu) ili vodoravan (pripada nama). */
export function axisOf(dx: number, dy: number): Axis {
  if (Math.abs(dx) < SWIPE_DEAD_ZONE_PX && Math.abs(dy) < SWIPE_DEAD_ZONE_PX) return 'wait';
  return Math.abs(dx) <= Math.abs(dy) * SWIPE_AXIS_RATIO ? 'vertical' : 'horizontal';
}

/** Susedni tab u smeru pokreta (`step` 1 = sledeći, -1 = prethodni) ili `null` na kraju niza. */
export function neighborTab<T extends string>(
  order: readonly T[],
  active: T,
  step: 1 | -1
): T | null {
  const i = order.indexOf(active);
  if (i < 0) return null;
  return order[i + step] ?? null;
}

/** Smer iz pomaka prsta: prst ulevo = sledeći tab (dolazi zdesna). */
export const stepOf = (dx: number): 1 | -1 => (dx < 0 ? 1 : -1);

/** Pomak ekrana na kraju niza: popusti, ali ne dalje od ruba. */
export function edgeOffset(dx: number): number {
  return Math.max(-SWIPE_EDGE_MAX_PX, Math.min(SWIPE_EDGE_MAX_PX, dx * SWIPE_EDGE_RESIST));
}

export interface Release {
  dx: number;
  /** Širina ekrana. */
  width: number;
  /** Brzina poslednjeg poteza (px/ms, sa predznakom). */
  velocity: number;
  /** Koliko je prošlo od poslednjeg poteza do puštanja. */
  sinceLastMoveMs: number;
  /** Postoji li susedni ekran u tom smeru. */
  hasTarget: boolean;
}

/** Da li je ovo flik: dovoljno brz, U SMERU pokreta i skoro u trenutku puštanja (prst koji je usporio pa stao nije bacio ekran). */
export function isFling(r: Release): boolean {
  return (
    Math.abs(r.velocity) >= SWIPE_FLING_PX_MS &&
    r.velocity < 0 === r.dx < 0 &&
    r.sinceLastMoveMs < SWIPE_FLING_FRESH_MS
  );
}

/** Prelazi li se na susedni tab: mora da ga ima, a pokret mora biti dovoljno dug ili brz. */
export function commits(r: Release): boolean {
  return r.hasTarget && (Math.abs(r.dx) >= r.width * SWIPE_FRACTION || isFling(r));
}

/** Trajanje dovršetka iz PREOSTALOG puta i brzine prsta: prelazak se nastavlja tamo gde je prst stao. Donja granica brzine je izvedena iz najdužeg trajanja. */
export function settleMs(remainingPx: number, velocity: number): number {
  const v = Math.max(Math.abs(velocity), remainingPx / SWIPE_MS_MAX);
  const ms = v > 0 ? remainingPx / v : SWIPE_MS_MAX;
  return Math.round(Math.max(SWIPE_MS_MIN, Math.min(SWIPE_MS_MAX, ms)));
}
