/* „Otvorio je aplikaciju" — jedini trag korišćenja koji se ne vidi iz upisa stanja (sinhronizaciju, nov plan, treninge
   beleži okidač na `user_state`). Server pamti najviše jedan zapis na 30 minuta, pa se sme zvati na svaki povratak.

   Nikad ne baca i ništa ne vraća: praćenje je sporedno i ne sme da zaustavi pokretanje. */

import type { Fetcher } from '../http';
import type { SessionManager } from '../supabase/session';

export interface ActivityApiDeps {
  fetcher: Fetcher;
  session: Pick<SessionManager, 'token' | 'state'>;
  supabaseUrl: string;
  anonKey: string;
  appVersion: string;
  platform?: () => string | null;
}

export function createActivityApi(deps: ActivityApiDeps): { opened(): Promise<void> } {
  return {
    async opened() {
      try {
        const token = await deps.session.token();
        if (!token) return;
        await deps.fetcher(`${deps.supabaseUrl}/rest/v1/rpc/zabelezi_otvaranje`, {
          method: 'POST',
          headers: {
            apikey: deps.anonKey,
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            p_app_version: deps.appVersion,
            p_device_id: deps.session.state.deviceId ?? null,
            p_platforma: deps.platform?.() ?? null
          })
        });
      } catch {
        /* bez mreže ili servera — sledeće otvaranje će biti zabeleženo */
      }
    }
  };
}
