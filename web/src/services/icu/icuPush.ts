/* SLANJE PLANIRANIH TRENINGA NA SAT preko intervals.icu. Šta se šalje je odluka domena (`workoutsForWatch`); ovde je samo tok poziva:
   provera veze → sastavljanje dana → poziv servera → zapis vremena poslednjeg slanja u vezu. */

import { icuConnected } from '../../domain/icu';
import type { ResolvedPlan } from '../../domain/plan';
import { thresholdPace, workoutsForWatch, type WatchBatch } from '../../domain/watch';
import type { IcuApi } from '../api/icuApi';
import type { IcuLinkStore, IcuResult } from './icuSync';

export interface WatchPushDeps {
  api: IcuApi;
  link: IcuLinkStore;
  plan: () => ResolvedPlan | null;
  /** Tekuća forma, a kad je nema polazna (`null` kad plan nema ni jedno). */
  vdot: () => number | null;
  now: () => number;
  today: () => string;
}

export const WATCH_DAYS = 14;

export function createWatchPush(deps: WatchPushDeps) {
  /** Doslovno ono što bi otišlo — za pregled. */
  function preview(days: number = WATCH_DAYS): WatchBatch {
    const plan = deps.plan();
    if (!plan) return { events: [], skipped: 0 };
    return workoutsForWatch(plan, deps.today(), days, deps.vdot());
  }

  /** `replace`: server briše ranije poslato i pravi iznova („Iz početka"). Ne baca. */
  async function push(days: number, replace: boolean): Promise<IcuResult<{ n: number }>> {
    const cur = deps.link.get();
    if (!cur || !icuConnected(cur)) return { ok: false, error: 'intervals.icu nije povezan.' };
    const batch = preview(days);
    if (!batch.events.length) return { ok: false, error: 'Nema treninga u tom periodu.' };
    const r = await deps.api.pushWorkouts(cur, batch.events, replace);
    if (!r.ok) return { ok: false, error: r.error };
    const after = deps.link.get();
    if (after) deps.link.set({ ...after, lastPush: deps.now() });
    return { ok: true, n: r.data.sent || batch.events.length };
  }

  /** Prag tempa za intervals.icu (M:SS) ili null. */
  const threshold = (): string | null => thresholdPace(deps.vdot());

  return { preview, push, threshold };
}
