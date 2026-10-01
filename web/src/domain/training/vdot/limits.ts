import {
  T3K_DIST_M,
  T3K_ID_PREFIX,
  T3K_SEC_MIN,
  VDOT_TABLE_MAX,
  VDOT_TABLE_MIN
} from '../constants/product';
import { r1 } from '../../format';
import { idToString } from '../../state/ids';
import { vdotFromRace } from './calculateVDOT';

/**
 * Šta uopšte može da bude merenje forme. Zapis koji dolazi iz uvezenog backupa ili sa servera ne
 * sme da ima VDOT van opsega tablice: prigušenje deli razliku sa prethodnim, pa i besmislica
 * (izmereno 89 sa α=0,60) pomeri formu sa 48,6 na 73,5 i tu je ostavi zauvek.
 */
export function vdotPossible(v: number | null | undefined): v is number {
  return v != null && Number.isFinite(v) && v >= VDOT_TABLE_MIN && v <= VDOT_TABLE_MAX;
}

export const isT3kId = (id: unknown): boolean => idToString(id).startsWith(T3K_ID_PREFIX);

/** Test na 3 km: najmanje 7:20 (T3K_SEC_MIN) i VDOT iz opsega tablice. */
export function t3kPossible(sec: number): boolean {
  return sec >= T3K_SEC_MIN && vdotPossible(r1(vdotFromRace(T3K_DIST_M, sec)));
}

/** Najsporije verodostojno vreme testa na 3 km (s). */
export function t3kSlowest(): number {
  let s = T3K_SEC_MIN;
  while (s < 5400 && t3kPossible(s + 1)) s++;
  return s;
}
