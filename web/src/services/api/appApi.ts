/* NAŠI /api ENDPOINTI sa prijavom. Svi (analiza, intervals.icu, obaveštenja, brisanje naloga, prijava greške…) traže
   `Authorization: Bearer <supabase access token>`; token drži `SessionManager` (osvežen pre poziva). Bez tokena poziv se NE šalje:
   server bi vratio 401, a čovek treba da dobije poruku šta da uradi. */

import type { z } from 'zod';
import { requestJson, type Fetcher, type Result } from '../http';
import type { SessionManager } from '../supabase/session';

export interface AppApiDeps {
  fetcher: Fetcher;
  session: Pick<SessionManager, 'token'>;
}

export interface AppApi {
  /** POST sa JWT-om i proverom oblika odgovora. Nikad ne baca. */
  post<T>(
    path: string,
    body: unknown,
    schema: z.ZodType<T>,
    opts?: { timeoutMs?: number }
  ): Promise<Result<T>>;
  /** GET bez prijave (npr. javni VAPID ključ). */
  get<T>(path: string, schema: z.ZodType<T>): Promise<Result<T>>;
  /** GET sa JWT-om. */
  getAuthed<T>(path: string, schema: z.ZodType<T>): Promise<Result<T>>;
}

export const NOT_SIGNED_IN = 'Moraš biti prijavljen.';

export function createAppApi(deps: AppApiDeps): AppApi {
  const authHeaders = async (): Promise<Record<string, string> | null> => {
    const token = await deps.session.token();
    return token ? { Authorization: `Bearer ${token}` } : null;
  };
  return {
    async post(path, body, schema, opts) {
      const headers = await authHeaders();
      if (!headers) return { ok: false, kind: 'http', status: 401, error: NOT_SIGNED_IN };
      return requestJson(deps.fetcher, path, schema, {
        method: 'POST',
        headers,
        body,
        ...(opts?.timeoutMs ? { timeoutMs: opts.timeoutMs } : {})
      });
    },
    get(path, schema) {
      return requestJson(deps.fetcher, path, schema, { method: 'GET' });
    },
    async getAuthed(path, schema) {
      const headers = await authHeaders();
      if (!headers) return { ok: false, kind: 'http', status: 401, error: NOT_SIGNED_IN };
      return requestJson(deps.fetcher, path, schema, { method: 'GET', headers });
    }
  };
}
