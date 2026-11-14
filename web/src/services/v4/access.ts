/* V4 · ZASTAVICA `v4_pristup` — ZNAČENJE JE SAMO OVDE.
   Danas (supabase/v4.sql): nema reda = V4 ISKLJUČEN; red = vrednost `ukljuceno`.
   Odluka vlasnika „pušta se svima" se izražava jednim od dva načina (F9 etapa 2d, izveštaj):
     (a) bez izmene baze i koda: pri ulasku jedan SQL upis reda `ukljuceno = true` za svakog korisnika — ali nov
         korisnik posle toga nema red, pa nema V4 dok mu se red ne doda;
     (b) predlog: promeniti značenje na „nema reda = UKLJUČEN" (`WITHOUT_ROW = true` ispod) — tada red služi samo
         za gašenje (`ukljuceno = false`), nov korisnik dobija V4 sam, a vraćanje nazad svima je jedan upis redova.
   Bez mreže ili sa greškom servera uvek važi ISKLJUČENO (ostaje stari prikaz; ništa se ne gubi). */
import { z } from 'zod';
import { eq, type V4Rest } from './rest';

/** Šta važi kad korisnik nema red u `v4_pristup`. Jedina konstanta koju (b) menja. */
export const WITHOUT_ROW = false;

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
