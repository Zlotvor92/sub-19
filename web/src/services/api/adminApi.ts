/* VLASNIČKE RADNJE preko `/api/broadcast` (backend se NE menja). Dugmad se prikazuju samo vlasniku (`ADMIN_UID`), ali PRAVU proveru radi server nad
   adresom iz Supabase tokena, ne nad onim što pregledač tvrdi. Razorne radnje traže i lozinku (`ADMIN_2FA` iz Vercel-a) koja se NE pamti. */

import { z } from 'zod';
import type { AppApi } from './appApi';

const Reply = z.object({ ok: z.boolean().optional(), error: z.string().optional() }).passthrough();

export interface BroadcastPage {
  /** Suvi poziv: spisak adresa. */
  primaoci?: string[];
  primalaca?: number;
  poslato?: number;
  palo?: number;
  ukupno?: number;
  /** Slanje ide u VIŠE poziva: jedan poziv staje u vremenski limit funkcije (~90 mejlova); odavde se nastavlja. */
  sledeciOd?: number | null;
  /** Nastavak PO ADRESI (poslednja obrađena). Server ga preferira jer se lista između poziva čita iznova, pa pozicija može da se pomeri. */
  sledeciPosle?: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  jaSam?: boolean;
  poslednjaPrijava?: string | null;
  imaPodatke?: boolean;
  zabranjen?: boolean;
}
export interface ScheduledDeletion {
  user_id: string;
  email?: string | null;
  izvrsi_posle: string;
}

export type AdminResult<T> = ({ ok: true } & T) | { ok: false; error: string };

export interface AdminApi {
  broadcast(opts: {
    posalji?: boolean;
    od?: number;
    posle?: string;
    samoNa?: string[];
  }): Promise<AdminResult<{ page: BroadcastPage }>>;
  setChallenge(text: string): Promise<AdminResult<{ text: string }>>;
  users(): Promise<AdminResult<{ users: AdminUser[] }>>;
  scheduled(): Promise<AdminResult<{ items: ScheduledDeletion[] }>>;
  restore(userId: string): Promise<AdminResult<object>>;
  ban(userId: string, lift: boolean, password: string): Promise<AdminResult<object>>;
  remove(userId: string, password: string): Promise<AdminResult<object>>;
}

export function createAdminApi(api: AppApi): AdminApi {
  /** Odgovor sa `ok:false` je greška iste vrste kao HTTP greška: poruka servera ima prednost. */
  async function call(
    body: Record<string, unknown>
  ): Promise<AdminResult<{ data: Record<string, unknown> }>> {
    const r = await api.post('/api/broadcast', body, Reply);
    if (!r.ok) return { ok: false, error: r.error };
    if (body['admin'] && !r.data.ok) return { ok: false, error: r.data.error || 'Nije uspelo.' };
    return { ok: true, data: r.data };
  }
  const fail = (r: { ok: false; error: string }): { ok: false; error: string } => ({
    ok: false,
    error: r.error
  });
  return {
    async broadcast(opts) {
      const r = await call(opts);
      return r.ok ? { ok: true, page: r.data } : fail(r);
    },
    async setChallenge(text) {
      const r = await call({ admin: 'izazov', tekst: text });
      return r.ok
        ? { ok: true, text: typeof r.data['tekst'] === 'string' ? r.data['tekst'] : '' }
        : fail(r);
    },
    async users() {
      const r = await call({ admin: 'lista' });
      return r.ok
        ? { ok: true, users: (r.data['korisnici'] as AdminUser[] | undefined) ?? [] }
        : fail(r);
    },
    async scheduled() {
      const r = await call({ admin: 'zakazano' });
      return r.ok
        ? { ok: true, items: (r.data['zakazano'] as ScheduledDeletion[] | undefined) ?? [] }
        : fail(r);
    },
    async restore(userId) {
      const r = await call({ admin: 'ponisti', obrisiId: userId });
      return r.ok ? { ok: true } : fail(r);
    },
    async ban(userId, lift, password) {
      const r = await call({ admin: 'ban', banId: userId, ukini: lift, lozinka: password });
      return r.ok ? { ok: true } : fail(r);
    },
    async remove(userId, password) {
      const r = await call({ admin: 'obrisi', obrisiId: userId, lozinka: password });
      return r.ok ? { ok: true } : fail(r);
    }
  };
}

export const MAX_BROADCAST_ROUNDS = 60;

export interface BroadcastProgress {
  sent: number;
  failed: number;
  rounds: number;
}
export type BroadcastResult =
  | { ok: true; sent: number; failed: number }
  /** `sent`: koliko je do prekida ipak poslato — ponovni poziv nastavlja odatle, bez duplikata. */
  | { ok: false; error: string; sent: number };

/** „Pošalji svima": slanje u krugovima dok server ne kaže da je gotovo; najviše 60 krugova.
    Nastavak ide PO ADRESI (`sledeciPosle`) — server to preporučuje jer se lista između krugova čita iznova, pa bi pozicija (`sledeciOd`, što koristi
    stari klijent) mogla tiho da preskoči jednu osobu. Pozicija ostaje samo kao rezerva ako server ne vrati adresu. */
export async function broadcastAll(
  api: Pick<AdminApi, 'broadcast'>,
  onProgress?: (p: BroadcastProgress) => void
): Promise<BroadcastResult> {
  let cursor: { od: number } | { posle: string } | null = { od: 0 };
  let sent = 0;
  let failed = 0;
  let rounds = 0;
  while (cursor && rounds < MAX_BROADCAST_ROUNDS) {
    rounds++;
    onProgress?.({ sent, failed, rounds });
    const r: Awaited<ReturnType<typeof api.broadcast>> = await api.broadcast({
      posalji: true,
      ...cursor
    });
    if (!r.ok) return { ok: false, error: r.error || 'Nije uspelo.', sent };
    const done = (r.page.poslato || 0) + (r.page.palo || 0);
    sent += r.page.poslato || 0;
    failed += r.page.palo || 0;
    const next: { od: number } | { posle: string } | null = r.page.sledeciPosle
      ? { posle: r.page.sledeciPosle }
      : r.page.sledeciOd == null
        ? null
        : { od: r.page.sledeciOd };
    /* krug bez ijedne obrađene adrese koji traži isti nastavak se nikad neće pomeriti — greška, ne 60 praznih krugova */
    if (next && !done && JSON.stringify(next) === JSON.stringify(cursor)) {
      return { ok: false, error: 'Server ne napreduje sa slanjem.', sent };
    }
    cursor = next;
  }
  return { ok: true, sent, failed };
}
