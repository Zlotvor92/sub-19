/* 10K v2 → aplikacija: tempo po zoni i prag za sat — iz v2 modela (`../paces.ts`, Daniels–Gilbert), ne iz tenK v1. */

import { midEasy, pacesFromVdot, raceTimeForVdot } from '../paces.ts';

/** Zone formata razmene; LR (dugo) je u v2 lagano (E). */
export type AppZone = 'I' | 'T' | 'M' | 'E' | 'LR' | 'R';

/** Tempo [s/km] za zonu pri VDOT-u. E/LR = sredina v2 E opsega (osnova laganih delova v2 plana); M je maratonski tempo
 *  trke istog modela (definicija zone, v2 je ne propisuje). */
export function paceForZone(vdot: number, zone: AppZone): number {
  if (zone === 'M') return Math.round(raceTimeForVdot(vdot, 42195) / 42.195);
  const p = pacesFromVdot(vdot);
  if (zone === 'E' || zone === 'LR') return Math.round(midEasy(p));
  return p[zone];
}

/** Prag (T) za intervals.icu („M:SS"); `null` bez forme (plan po osećaju nema VDOT u `meta`). */
export function thresholdPace(vdot: number | null | undefined): string | null {
  if (vdot == null || !Number.isFinite(vdot) || vdot <= 0) return null;
  const s = paceForZone(vdot, 'T');
  if (!(s > 0)) return null;
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
}
