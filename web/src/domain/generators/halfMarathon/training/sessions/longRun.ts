import type { DistanceHeuristic } from '../constants/distances';

/**
 * Uputstvo za gorivo na dugom trčanju: preko praga trajanja (`fuelFromMin`) telo troši
 * zalihe glikogena brže nego što ih nadoknađuje, a CREVO mora da nauči da prima ugljene
 * hidrate — adaptacija traži 4–6 nedelja vežbanja, a dugo trčanje je jedina prilika.
 * Jača maratonska preporuka (60–90 g/h, `fuelStrongFromMin`) ne postoji u HM profilu i ovde je uklonjena.
 */
export function fuelText(km: number, longRunPaceSecPerKm: number, h: DistanceHeuristic): string {
  const fromMin = h.fuelFromMin;
  if (!fromMin || !(longRunPaceSecPerKm > 0)) return '';
  const min = (km * longRunPaceSecPerKm) / 60;
  if (min < fromMin) return '';
  return ` · ${Math.round(min)} min — uvežbaj gorivo: 30–60 g ugljenih hidrata na sat, prvi unos oko 40. minuta`;
}
