/* NALOG I PODRŠKA: brisanje naloga (`/api/delete-account`) i prijava greške (`/api/report-bug`). */

import { z } from 'zod';
import type { AppApi } from './appApi';

/** Tekst potvrde koji server očekuje (v. POTVRDA u api/delete-account.js). Server poredi neosetljivo na veličinu slova i dijakritiku. */
export const DELETE_CONFIRMATION = 'OBRISI NALOG';
/** Isti tekst sa dijakritikom — ono što korisnik vidi. */
export const DELETE_CONFIRMATION_DISPLAY = 'OBRIŠI NALOG';

/** Unos se svodi na ono što server poredi: velika slova, Š→S, razmaci skupljeni. */
export const normalizeConfirmation = (v: string): string =>
  v.toUpperCase().replace(/Š/g, 'S').replace(/\s+/g, ' ').trim();

const OkResponse = z.object({ ok: z.boolean(), error: z.string().optional() }).passthrough();

export type AccountOutcome = { ok: true } | { ok: false; error: string };

export interface AccountApi {
  deleteAccount(confirmation: string): Promise<AccountOutcome>;
  reportBug(
    description: string,
    context: { version: string; tab: string; userAgent: string }
  ): Promise<AccountOutcome>;
}

const toOutcome = (r: Awaited<ReturnType<AppApi['post']>>): AccountOutcome => {
  if (!r.ok) return { ok: false, error: r.error };
  const parsed = OkResponse.safeParse(r.data);
  if (parsed.success && parsed.data.ok) return { ok: true };
  return { ok: false, error: (parsed.success && parsed.data.error) || 'Nepoznata greška' };
};

export function createAccountApi(api: AppApi): AccountApi {
  return {
    async deleteAccount(confirmation) {
      return toOutcome(
        await api.post('/api/delete-account', { potvrda: confirmation }, OkResponse)
      );
    },
    async reportBug(description, context) {
      return toOutcome(await api.post('/api/report-bug', { description, context }, OkResponse));
    }
  };
}
