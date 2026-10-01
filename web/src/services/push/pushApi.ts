/* `/api/push` (backend se NE menja). GET je javan i vraća samo javni VAPID ključ; sve ostalo traži prijavu (JWT). Ključ NE stoji u kodu namerno: da
   stoji, promena ključeva na serveru bi ćutke razvalila sve pretplate (push servis vraća 403, a u Podešavanjima i dalje piše „uključeno"). */

import { z } from 'zod';
import type { AppApi } from '../api/appApi';
import { requestJson, type Fetcher } from '../http';

const Key = z
  .object({ podeseno: z.unknown().optional(), kljuc: z.unknown().optional() })
  .passthrough();
const Any = z.object({}).passthrough();

export type PushAction = 'prijava' | 'odjava' | 'najave' | 'proba';
export type PushResult = { ok: true; [k: string]: unknown } | { ok: false; error: string };

export interface PushApi {
  /** Javni ključ ili `null` (nije podešen / nema veze). Pamti se samo kad je dobijen. */
  vapid(): Promise<string | null>;
  /** `token` se prosleđuje SAMO pri odjavi: tada se sesija briše u istom potezu, pa je `session.token()` više ne bi imao odakle da uzme. */
  send(action: PushAction, extra?: Record<string, unknown>, token?: string): Promise<PushResult>;
}

export function createPushApi(deps: { api: AppApi; fetcher: Fetcher }): PushApi {
  let cached: string | null = null;
  return {
    async vapid() {
      if (cached) return cached;
      const r = await deps.api.get('/api/push', Key);
      if (!r.ok) return null;
      const key = r.data.kljuc;
      if (!r.data.podeseno || typeof key !== 'string' || !key) return null;
      cached = key;
      return cached;
    },
    async send(action, extra, token) {
      const body = { akcija: action, ...(extra ?? {}) };
      if (token) {
        const r = await requestJson(deps.fetcher, '/api/push', Any, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body
        });
        return r.ok ? { ok: true, ...r.data } : { ok: false, error: r.error };
      }
      const r = await deps.api.post('/api/push', body, Any);
      if (r.ok) return { ok: true, ...r.data };
      return {
        ok: false,
        error: r.status === 401 ? 'Prijava je istekla — prijavi se ponovo.' : r.error
      };
    }
  };
}
