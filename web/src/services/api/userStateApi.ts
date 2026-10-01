/* `user_state` — jedan red po korisniku: ceo `PersistedState` kao JSON blob (RLS: samo svoj red).

   Ništa u bazi se ne menja rewrite-om. Ovaj modul zna SAMO za HTTP: odluke (sukob, prazno stanje, debounce) su u
   `domain/sync` i `services/sync/engine.ts`. */

import { toServerPayload } from '../../domain/sync';
import type { PersistedState } from '../../domain/state';
import { requestJson, type Fetcher } from '../http';
import type { SessionManager } from '../supabase/session';
import { HistoryData, HistoryList, PullRowList, PushResultList, RemoteRowList } from './schemas';
import type { HistoryEntry } from './schemas';

export type RemoteRow =
  /** Red ne postoji — server nema ništa. */
  | { kind: 'none' }
  | { kind: 'row'; at: string; device: string | null }
  /** NEMA SIGNALA ili greška: ne zna se ništa. Pozivalac radi lokalno; razlika od `none` je nosiva. */
  | { kind: 'unknown' };

export type PullOutcome =
  | { ok: true; data: unknown; updatedAt: string }
  | { ok: false; reason: 'network' | 'http' | 'empty' | 'parse' };

export type PushOutcome =
  | { ok: true; updatedAt: string | null }
  /** 5xx je privremen — takav upis ide u pozadinski red. 4xx se ponavljanjem ne popravlja. */
  | { ok: false; retryable: boolean; status?: number };

export interface UserStateApi {
  remoteRow(): Promise<RemoteRow>;
  pull(): Promise<PullOutcome>;
  push(state: PersistedState, deviceId: string, appVersion: string): Promise<PushOutcome>;
  historyList(): Promise<
    | { ok: true; list: HistoryEntry[] }
    | { ok: false; reason: 'network' | 'forbidden' | 'http'; status?: number }
  >;
  historyData(
    id: string | number
  ): Promise<{ ok: true; data: unknown } | { ok: false; error: string }>;
}

export interface UserStateApiDeps {
  fetcher: Fetcher;
  session: SessionManager;
  supabaseUrl: string;
  anonKey: string;
}

export function createUserStateApi(deps: UserStateApiDeps): UserStateApi {
  const { session, supabaseUrl } = deps;
  const headers = (extra: Record<string, string> = {}): Record<string, string> => ({
    apikey: deps.anonKey,
    Authorization: `Bearer ${session.state.access ?? ''}`,
    'Content-Type': 'application/json',
    ...extra
  });
  const uid = (): string => encodeURIComponent(session.state.userId ?? '');

  return {
    async remoteRow() {
      if (!(await session.ensure())) return { kind: 'unknown' };
      const r = await requestJson(
        deps.fetcher,
        `${supabaseUrl}/rest/v1/user_state?select=updated_at,device_id&user_id=eq.${uid()}`,
        RemoteRowList,
        { headers: headers() }
      );
      if (!r.ok) return { kind: 'unknown' };
      const row = r.data[0];
      if (!row) return { kind: 'none' };
      return { kind: 'row', at: row.updated_at, device: row.device_id ?? null };
    },

    async pull() {
      if (!(await session.ensure())) return { ok: false, reason: 'network' };
      const r = await requestJson(
        deps.fetcher,
        `${supabaseUrl}/rest/v1/user_state?select=data,updated_at&user_id=eq.${uid()}`,
        PullRowList,
        { headers: headers() }
      );
      if (!r.ok)
        return {
          ok: false,
          reason: r.kind === 'network' ? 'network' : r.kind === 'http' ? 'http' : 'parse'
        };
      const row = r.data[0];
      if (!row || row.data == null) return { ok: false, reason: 'empty' };
      return { ok: true, data: row.data, updatedAt: row.updated_at };
    },

    async push(state, deviceId, appVersion) {
      if (!(await session.ensure())) return { ok: false, retryable: true };
      const r = await requestJson(
        deps.fetcher,
        `${supabaseUrl}/rest/v1/user_state`,
        PushResultList,
        {
          method: 'POST',
          headers: headers({ Prefer: 'resolution=merge-duplicates,return=representation' }),
          body: {
            user_id: session.state.userId,
            data: toServerPayload(state),
            device_id: deviceId,
            app_version: appVersion
          }
        }
      );
      if (r.ok) return { ok: true, updatedAt: r.data[0]?.updated_at ?? null };
      /* mreža i 5xx su privremeni; 4xx se ponavljanjem ne popravlja */
      return {
        ok: false,
        retryable: r.kind === 'network' || (r.status ?? 0) >= 500,
        ...(r.status ? { status: r.status } : {})
      };
    },

    async historyList() {
      if (!(await session.ensure())) return { ok: false, reason: 'network' };
      const r = await requestJson(
        deps.fetcher,
        `${supabaseUrl}/rest/v1/user_state_istorija?select=id,napravljeno,app_version,device_id&user_id=eq.${uid()}&order=napravljeno.desc&limit=40`,
        HistoryList,
        { headers: headers() }
      );
      if (r.ok) return { ok: true, list: r.data };
      if (r.kind === 'network') return { ok: false, reason: 'network' };
      if (r.status === 401 || r.status === 403)
        return { ok: false, reason: 'forbidden', status: r.status };
      return { ok: false, reason: 'http', ...(r.status ? { status: r.status } : {}) };
    },

    async historyData(id) {
      if (!(await session.ensure())) return { ok: false, error: 'Nema veze sa internetom.' };
      const r = await requestJson(
        deps.fetcher,
        `${supabaseUrl}/rest/v1/user_state_istorija?select=data&id=eq.${encodeURIComponent(String(id))}&user_id=eq.${uid()}`,
        HistoryData,
        { headers: headers() }
      );
      if (!r.ok)
        return {
          ok: false,
          error:
            r.kind === 'network'
              ? 'Nema veze sa internetom.'
              : `Server nije dao tu verziju (${r.status ?? '—'}).`
        };
      const row = r.data[0];
      if (!row || row.data == null) return { ok: false, error: 'Ta verzija više ne postoji.' };
      return { ok: true, data: row.data };
    }
  };
}
