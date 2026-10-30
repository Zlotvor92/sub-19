/* ODOBRENJE PRISTUPA ZA CLAUDE (Supabase OAuth 2.1 server, ekran na `/?authorization_id=…`).

   Claude (konektor `/api/mcp`) šalje korisnika na Supabase `/auth/v1/oauth/authorize`; Supabase ga vraća ovde sa
   `authorization_id`. Aplikacija pita Supabase ko traži pristup i, kad korisnik odluči, šalje odluku i dobija adresu na
   koju se vraća. Putanje su iste koje zove `supabase-js` (`auth.oauth.getAuthorizationDetails` / `approveAuthorization`
   / `denyAuthorization`); aplikacija ga nema u zavisnostima, pa se zovu direktno, tokenom sesije aplikacije.

   Pristup se dozvoljava SAMO Claude-u: zahtev koji se vraća bilo gde osim na Claude-ovu povratnu adresu se ne odobrava
   (v. `isClaudeRedirect`). */

import { z } from 'zod';
import { requestJson, type Fetcher, type Result } from '../http';
import type { SessionManager } from './session';

/** Povratna adresa Claude-ovih aplikacija (claude.ai, Desktop, mobilna, Cowork) za konektore. */
export const CLAUDE_CALLBACK = 'https://claude.ai/api/mcp/auth_callback';

/** Supabase vraća registrovanu adresu bez upita; poredi se cela, ne samo domen. */
export const isClaudeRedirect = (uri: string): boolean => uri.split('?')[0] === CLAUDE_CALLBACK;

/* Bez `passthrough` na vrhu: ostala polja nisu potrebna, a sa njim TypeScript ne razlikuje dva oblika po `redirect_url`. */
const Details = z.object({
  authorization_id: z.string(),
  redirect_uri: z.string(),
  client: z.object({ name: z.string() }),
  user: z.object({ email: z.string().nullish() }).nullish()
});
const Redirect = z.object({ redirect_url: z.string().url() });

export type AuthorizationRequest =
  | { kind: 'consent'; clientName: string; redirectUri: string; email: string | null }
  /** Korisnik je ovom klijentu već dozvolio pristup: Supabase odmah vraća adresu povratka. */
  | { kind: 'redirect'; url: string };

export interface OAuthServerApi {
  details(authorizationId: string): Promise<Result<AuthorizationRequest>>;
  /** Odluka; uspeh nosi adresu na koju pregledač ide dalje (Claude sa kodom ili sa `access_denied`). */
  decide(authorizationId: string, action: 'approve' | 'deny'): Promise<Result<string>>;
}

export interface OAuthServerDeps {
  fetcher: Fetcher;
  session: Pick<SessionManager, 'token'>;
  supabaseUrl: string;
  anonKey: string;
}

export function createOAuthServerApi(deps: OAuthServerDeps): OAuthServerApi {
  const url = (id: string, tail = ''): string =>
    `${deps.supabaseUrl}/auth/v1/oauth/authorizations/${encodeURIComponent(id)}${tail}`;
  const headers = async (): Promise<Record<string, string> | null> => {
    const token = await deps.session.token();
    return token ? { apikey: deps.anonKey, Authorization: `Bearer ${token}` } : null;
  };
  const noSession = {
    ok: false as const,
    kind: 'http' as const,
    status: 401,
    error: 'Nisi prijavljen — prijavi se ponovo.'
  };

  return {
    async details(id) {
      const h = await headers();
      if (!h) return noSession;
      const r = await requestJson(deps.fetcher, url(id), z.union([Details, Redirect]), {
        headers: h
      });
      if (!r.ok) return r;
      const d = r.data;
      if ('redirect_url' in d) return { ...r, data: { kind: 'redirect', url: d.redirect_url } };
      return {
        ...r,
        data: {
          kind: 'consent',
          clientName: d.client.name,
          redirectUri: d.redirect_uri,
          email: d.user?.email ?? null
        }
      };
    },
    async decide(id, action) {
      const h = await headers();
      if (!h) return noSession;
      const r = await requestJson(deps.fetcher, url(id, '/consent'), Redirect, {
        method: 'POST',
        headers: h,
        body: { action }
      });
      return r.ok ? { ...r, data: r.data.redirect_url } : r;
    }
  };
}
