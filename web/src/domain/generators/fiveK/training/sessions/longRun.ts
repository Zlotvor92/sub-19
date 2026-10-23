import type { DistanceHeuristic } from '../constants/distances';

/**
 * Uputstvo za gorivo na dugom trčanju: preko praga trajanja (`fuelFromMin`) telo troši
 * zalihe glikogena brže nego što ih nadoknađuje, a CREVO mora da nauči da prima ugljene
 * hidrate — adaptacija traži 4–6 nedelja vežbanja, a dugo trčanje je jedina prilika.
 * Jača preporuka (60–90 g/h) je maratonska odluka vezana za profil, ne za trajanje samo.
 */
export function fuelText(km: number, longRunPaceSecPerKm: number, h: DistanceHeuristic): string {
  const fromMin = h.fuelFromMin;
  if (!fromMin || !(longRunPaceSecPerKm > 0)) return '';
  const min = (km * longRunPaceSecPerKm) / 60;
  if (min < fromMin) return '';
  const strongFrom = h.fuelStrongFromMin;
  const strong = !!strongFrom && min >= strongFrom;
  return strong
    ? ` · ${Math.round(min)} min — uvežbaj gorivo: 60–90 g ugljenih hidrata na sat, prvi unos oko 40. minuta pa na svakih 20–25 min. Crevo se na to navikava nedeljama; ne improvizuj na dan trke.`
    : ` · ${Math.round(min)} min — uvežbaj gorivo: 30–60 g ugljenih hidrata na sat, prvi unos oko 40. minuta`;
}
