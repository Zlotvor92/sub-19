import { VDOT_TABLE_MAX, VDOT_TABLE_MIN } from '../constants/product';
import type { Zone } from '../types';
import { paceForZone } from './paceForZone';

/**
 * Da li tempo leži UNUTAR opsega tablice za tu zonu. Pretraga je ograničena na
 * opseg, pa 2:00/km u T zoni vrati tačno 85 — ZASIĆENJE nije merenje, i ko o
 * tome odlučuje mora da pita odvojeno. Brži tempo = manji broj sekundi.
 */
export function vdotPaceInRange(paceSecKm: number, zone: Zone): boolean {
  return (
    paceSecKm >= paceForZone(VDOT_TABLE_MAX, zone) && paceSecKm <= paceForZone(VDOT_TABLE_MIN, zone)
  );
}

/**
 * Inverz `paceForZone`: opservirani tempo na zoni → implicirani VDOT.
 * `paceForZone` je monotono opadajuća po VDOT-u (viša forma, brži tempo), pa se
 * traži binarnom pretragom. Vraća `hi`, ne sredinu: `paceForZone` zaokružuje na
 * celu sekundu (stepenasta je), a `hi` je najmanji VDOT čiji tempo već JESTE
 * tražen — round-trip tempo→VDOT→tempo pogađa uvek (0/1206 promašaja), dok je
 * sredina padala na pogrešnu stranu u 49% kombinacija.
 */
export function vdotFromPace(paceSecKm: number, zone: Zone): number {
  let lo = VDOT_TABLE_MIN;
  let hi = VDOT_TABLE_MAX;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (paceForZone(mid, zone) > paceSecKm) lo = mid;
    else hi = mid;
  }
  return hi;
}
