/* V4 · ZASTAVICA `v4_pristup` — ZNAČENJE JE SAMO OVDE.
   PUŠTANJE SVIMA (odluka vlasnika 15. 11. 2026, varijanta (b) iz F9 etape 2d): nema reda = V4 UKLJUČEN; red =
   vrednost `ukljuceno` (red `false` gasi V4 tom korisniku — `v4_iskljuci()` ili SQL vlasnika). Vraćanje nazad svima:
   upis redova `ukljuceno = false`, ili ova konstanta nazad na `false`.
   Bez mreže ili sa greškom servera ovde važi ISKLJUČENO (`nepoznato`); učitavač tada prikazuje poslednje učitano V4
   stanje naloga iz lokalnog keša (app/integrations.ts, `v4Startup`). */
import { z } from 'zod';
import { eq, type V4Rest } from './rest';

/** Šta važi kad korisnik nema red u `v4_pristup` (puštanje svima: `true`). */
export const WITHOUT_ROW = true;

export type AccessState = 'ukljucen' | 'iskljucen' | 'nepoznato';

/** Red (ili njegovo odsustvo) → da li V4 radi. `nepoznato` (mreža) → ne radi. */
export function v4Enabled(row: { ukljuceno: boolean } | null | 'nepoznato'): boolean {
  if (row === 'nepoznato') return false;
  if (row === null) return WITHOUT_ROW;
  return row.ukljuceno;
}

const Rows = z.array(z.object({ ukljuceno: z.boolean() }).passthrough());

export async function readAccess(rest: V4Rest): Promise<{ enabled: boolean; state: AccessState }> {
  const uid = await rest.user();
  if (uid === null) return { enabled: false, state: 'nepoznato' };
  const r = await rest.call(`v4_pristup?select=ukljuceno&user_id=${eq(uid)}`, Rows);
  if (!r.ok) return { enabled: false, state: 'nepoznato' };
  const enabled = v4Enabled(r.data[0] ?? null);
  return { enabled, state: enabled ? 'ukljucen' : 'iskljucen' };
}
