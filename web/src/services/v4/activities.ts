/* V4 · čitanje svih trčanja korisnika iz `aktivnost` (za formu iz trčanja, AGENTS 9a). Nikad ne baca: bez mreže,
   odjavljen ili greška → `null` (forma tada radi sa onim što plan već zna). */
import { z } from 'zod';
import type { Run } from '../../domain/v4/engine';
import { eq, type V4Rest } from './rest';

const Rows = z.array(z.object({ id: z.string(), run: z.unknown() }).passthrough());

const isRun = (x: unknown): x is Run =>
  typeof x === 'object' &&
  x !== null &&
  typeof (x as { id?: unknown }).id === 'string' &&
  typeof (x as { date?: unknown }).date === 'string';

export async function loadRuns(rest: V4Rest): Promise<Run[] | null> {
  const uid = await rest.user();
  if (uid === null) return null;
  const r = await rest.call(`aktivnost?select=id,run&user_id=${eq(uid)}`, Rows).catch(() => null);
  if (r === null || !r.ok) return null;
  return r.data
    .map((x) => x.run)
    .filter(isRun)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1));
}
