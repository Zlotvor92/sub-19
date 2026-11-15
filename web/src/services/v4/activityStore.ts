/* V4 · `aktivnost` kao pravo skladište iza sučelja `ActivityStore` (services/strava/activityImport.ts).
   - upis: „ubaci ili zameni" po (user_id, id) — `resolution=merge-duplicates`; ponovljena strana ne pravi duplikat;
   - čitanje: sva trčanja korisnika JEDNOM (≈ 19 KB, F8 § 6.1), pa se `get` služi iz keša (uvoz cele istorije bi inače
     slao jedan zahtev po trčanju);
   - napredak uvoza je stanje UREĐAJA (lokalno, `KeyValueStore`): upis je idempotentan, pa dva uređaja koja uvoze
     isto daju iste redove.
   Greška servera se baca kao izuzetak; uvoz je hvata i vraća „greska" (nastavlja se sledeći put). */
import { z } from 'zod';
import type { Run } from '../../domain/v4/engine';
import type { KeyValueStore } from '../storage/kv';
import type { ActivityStore, ImportProgress } from '../strava/activityImport';
import { eq, type V4Rest } from './rest';

const Rows = z.array(z.object({ id: z.string(), run: z.unknown() }).passthrough());

export class ActivityStoreError extends Error {}

export function createSupabaseActivityStore(deps: {
  rest: V4Rest;
  kv: KeyValueStore;
  deviceId: string;
  /** Ključ napretka po nalogu (napredak drugog naloga na istom uređaju se ne meša). */
  progressKey: (uid: string) => string;
}): ActivityStore {
  let cache: Map<string, Run> | null = null;
  let cachedFor: string | null = null;

  const uid = async (): Promise<string> => {
    const u = await deps.rest.user();
    if (u === null) throw new ActivityStoreError('odjavljen');
    if (cachedFor !== u) {
      cache = null;
      cachedFor = u;
    }
    return u;
  };

  const all = async (u: string): Promise<Map<string, Run>> => {
    if (cache !== null) return cache;
    const r = await deps.rest.call(`aktivnost?select=id,run&user_id=${eq(u)}`, Rows);
    if (!r.ok) throw new ActivityStoreError(r.error);
    cache = new Map(r.data.map((x) => [x.id, x.run as Run]));
    return cache;
  };

  return {
    async load() {
      const u = await uid();
      const raw = deps.kv.get(deps.progressKey(u));
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as ImportProgress;
      } catch {
        return null;
      }
    },
    async save(p) {
      const u = await uid();
      deps.kv.set(deps.progressKey(u), JSON.stringify(p));
    },
    async upsert(runs) {
      if (runs.length === 0) return;
      const u = await uid();
      const r = await deps.rest.call('aktivnost?on_conflict=user_id,id', z.unknown(), {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: runs.map((run) => ({
          user_id: u,
          id: run.id,
          datum: run.date,
          run,
          izvor: run.source ?? 'strava',
          device_id: deps.deviceId
        }))
      });
      if (!r.ok) throw new ActivityStoreError(r.error);
      const c = await all(u);
      for (const run of runs) c.set(run.id, run);
    },
    async get(id) {
      const u = await uid();
      return (await all(u)).get(id);
    }
  };
}
