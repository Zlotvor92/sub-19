/**
 * Broj iz nepouzdanog polja (uvezen backup, sinhronizovan JSON, senzor): `null` za sve što nije konačan broj.
 * Prazan string i boolean NISU nula (`+''` je 0, `+true` je 1) — bez ovoga bi prazno polje bilo „izmereno 0".
 * Ista granica poverenja kao `cistWellness`.
 */
export function looseNumber(v: unknown): number | null {
  if (v == null || v === '' || typeof v === 'boolean') return null;
  const n = +(v as number);
  return Number.isFinite(n) ? n : null;
}
