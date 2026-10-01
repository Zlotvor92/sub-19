/* ZAJEDNICA preko Supabase REST (RLS drži kapiju: spisak čita samo ko je i sam uključio profil). Ovaj modul zna SAMO za HTTP; šta se šalje je u
   `domain/community` (`communityPayload` je jedina tačka izlaska podataka). Ne baca: ishod je vrednost sa razlogom koji se prevodi u rečenicu. */

import { z } from 'zod';
import {
  cleanProfiles,
  reasonFromStatus,
  type CommunityRow,
  type FailReason,
  type Profile
} from '../../domain/community';
import { fetchWithTimeout, requestJson, type Fetcher } from '../http';
import type { SessionManager } from '../supabase/session';

export type CommunityFail = { ok: false; reason: FailReason };

export interface CommunityApi {
  /** Spisak vidljivih profila i tekst izazova nedelje. */
  load(): Promise<{ ok: true; profiles: Profile[]; challenge: string | null } | CommunityFail>;
  /** Upis (i osvežavanje) sopstvenog reda: `merge-duplicates` — prvi put pravi red, svaki sledeći ga menja. */
  upsert(row: CommunityRow): Promise<{ ok: true } | CommunityFail>;
  /** Isključivanje BRIŠE red (ne `vidljiv=false`): red sa `vidljiv=false` i dalje sadrži nadimak, sliku i trčanja, a politika privatnosti obećava brisanje. */
  remove(userId: string): Promise<{ ok: true } | CommunityFail>;
}

export interface CommunityApiDeps {
  fetcher: Fetcher;
  session: SessionManager;
  supabaseUrl: string;
  anonKey: string;
}

const Rows = z.array(z.unknown());
const Challenge = z.array(z.object({ tekst: z.unknown().optional() }).passthrough());

export function createCommunityApi(deps: CommunityApiDeps): CommunityApi {
  const headers = (extra: Record<string, string> = {}): Record<string, string> => ({
    apikey: deps.anonKey,
    Authorization: `Bearer ${deps.session.state.access ?? ''}`,
    'Content-Type': 'application/json',
    ...extra
  });
  const base = `${deps.supabaseUrl}/rest/v1`;

  async function write(url: string, init: RequestInit): Promise<{ ok: true } | CommunityFail> {
    if (!(await deps.session.ensure())) return { ok: false, reason: 'mreza' };
    try {
      const r = await fetchWithTimeout(deps.fetcher, url, init);
      return r.ok ? { ok: true } : { ok: false, reason: reasonFromStatus(r.status) };
    } catch {
      return { ok: false, reason: 'mreza' };
    }
  }

  return {
    async load() {
      if (!(await deps.session.ensure())) return { ok: false, reason: 'mreza' };
      const [rows, challenge] = await Promise.all([
        requestJson(deps.fetcher, `${base}/zajednica_profil?select=*&vidljiv=is.true`, Rows, {
          headers: headers()
        }),
        requestJson(deps.fetcher, `${base}/zajednica_izazov?select=tekst&id=eq.1`, Challenge, {
          headers: headers()
        })
      ]);
      if (!rows.ok) {
        if (rows.kind === 'network') return { ok: false, reason: 'mreza' };
        if (rows.kind === 'http') return { ok: false, reason: reasonFromStatus(rows.status ?? 0) };
        return { ok: false, reason: 'nepoznato' };
      }
      const text = challenge.ok ? challenge.data[0]?.tekst : null;
      return {
        ok: true,
        profiles: cleanProfiles(rows.data),
        challenge: typeof text === 'string' && text ? text : null
      };
    },
    upsert(row) {
      return write(`${base}/zajednica_profil`, {
        method: 'POST',
        headers: headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify(row)
      });
    },
    remove(userId) {
      return write(`${base}/zajednica_profil?user_id=eq.${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: headers()
      });
    }
  };
}
