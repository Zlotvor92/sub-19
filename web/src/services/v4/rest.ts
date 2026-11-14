/* V4 · zajednički sloj za Supabase REST (PostgREST) nad V4 tabelama (supabase/v4.sql).
   Ovde je samo HTTP: ko je prijavljen, zaglavlja, ishod. Nikad ne baca. Odjavljen korisnik → nijedan zahtev. */
import type { z } from 'zod';
import { requestJson, type Fetcher, type Result } from '../http';
import type { SessionManager } from '../supabase/session';

export interface V4RestDeps {
  fetcher: Fetcher;
  session: Pick<SessionManager, 'state' | 'ensure'>;
  supabaseUrl: string;
  anonKey: string;
}

export type V4Failure = {
  ok: false;
  reason: 'odjavljen' | 'network' | 'http';
  status?: number;
  retryable: boolean;
};

export const failureOf = (r: Exclude<Result<unknown>, { ok: true }>): V4Failure => ({
  ok: false,
  reason: r.kind === 'network' ? 'network' : 'http',
  ...(r.status !== undefined ? { status: r.status } : {}),
  retryable: r.kind === 'network' || (r.status ?? 0) >= 500
});

export const ODJAVLJEN: V4Failure = { ok: false, reason: 'odjavljen', retryable: false };

export interface V4Rest {
  /** Prijavljen korisnik sa svežim tokenom, ili `null` (tada se ništa ne šalje). */
  user(): Promise<string | null>;
  call<T>(
    path: string,
    schema: z.ZodType<T>,
    opts?: { method?: string; prefer?: string; body?: unknown }
  ): Promise<Result<T>>;
}

export function createV4Rest(deps: V4RestDeps): V4Rest {
  return {
    async user() {
      const before = deps.session.state.userId;
      if (!before) return null;
      if (!(await deps.session.ensure())) return null;
      return deps.session.state.userId === before ? before : null;
    },
    call(path, schema, opts = {}) {
      return requestJson(deps.fetcher, `${deps.supabaseUrl}/rest/v1/${path}`, schema, {
        ...(opts.method !== undefined ? { method: opts.method } : {}),
        headers: {
          apikey: deps.anonKey,
          Authorization: `Bearer ${deps.session.state.access ?? ''}`,
          'Content-Type': 'application/json',
          ...(opts.prefer !== undefined ? { Prefer: opts.prefer } : {})
        },
        ...(opts.body !== undefined ? { body: opts.body } : {})
      });
    }
  };
}

export const eq = (v: string | number): string => `eq.${encodeURIComponent(String(v))}`;
