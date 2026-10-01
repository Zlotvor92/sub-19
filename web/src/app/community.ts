/* ZAJEDNICA: spona između stanja i servisa. Šta izlazi iz naloga odlučuje domen (`communityPayload`); ovde se samo čita stanje, zove servis i
   vodi ishod u store. Prekidač koji klikne a ništa ne upiše je gore od prekidača koji kaže da nije uspeo — zato `setVisible` vraća staro stanje
   kad server ne primi promenu. */

import { parseIsoDate } from '../domain/date';
import { effectiveRaceDate } from '../domain/day';
import {
  REFRESH_AFTER_MS,
  communityPayload,
  type CommunityRow,
  type FailReason
} from '../domain/community';
import { currentVdot } from '../domain/training/adaptation';
import type { CommunityApi } from '../services/community/communityApi';
import type { SessionManager } from '../services/supabase/session';
import { useCommunityStore } from '../stores/communityStore';
import { currentPlan, useTrainingStore } from '../stores/trainingStore';

export interface CommunityDeps {
  api: CommunityApi;
  session: SessionManager;
  now: () => number;
  today: () => string;
  online: () => boolean;
}

export type CommunityResult = { ok: true } | { ok: false; reason: FailReason };

export function createCommunity(deps: CommunityDeps) {
  const store = useCommunityStore;
  const visible = (): boolean => store.getState().zajed.vidljiv;
  const active = (): boolean => deps.session.isAuthed() && visible();

  /** Red za upis iz trenutnog stanja; `null` kad nema plana ili datuma. */
  function currentRow(): CommunityRow | null {
    const plan = currentPlan();
    const today = parseIsoDate(deps.today());
    if (!plan || !today) return null;
    const t = useTrainingStore.getState();
    const meta = t.genPlan?.meta as Record<string, unknown> | undefined;
    const st = deps.session.state;
    return communityPayload({
      userId: st.userId,
      googleName: st.ime,
      picture: st.slika,
      nickname: store.getState().zajed.nadimak,
      plan,
      log: t.log,
      today,
      vdotLog: t.vdotLog,
      t3k: t.t3k,
      currentVdot: currentVdot(t.vdotLog),
      raceDistM: (meta?.['raceDistM'] as number | undefined) || 5000,
      raceDate: effectiveRaceDate(plan, meta?.['raceDate'])
    });
  }

  let lastReason: FailReason | null = null;

  /** Upis (i osvežavanje) sopstvenog reda. */
  async function publish(): Promise<CommunityResult> {
    lastReason = null;
    if (!active()) return { ok: false, reason: 'nepoznato' };
    const row = currentRow();
    if (!row) return { ok: false, reason: 'nepoznato' };
    const r = await deps.api.upsert(row);
    if (!r.ok) lastReason = r.reason;
    return r;
  }

  async function unpublish(): Promise<CommunityResult> {
    lastReason = null;
    const id = deps.session.state.userId;
    if (!deps.session.isAuthed() || !id) return { ok: false, reason: 'nepoznato' };
    const r = await deps.api.remove(id);
    if (!r.ok) lastReason = r.reason;
    return r;
  }

  /** Uključivanje/isključivanje: stanje se menja SAMO ako je server stvarno primio promenu. */
  async function setVisible(next: boolean): Promise<CommunityResult> {
    const before = visible();
    store.getState().patchSettings({ vidljiv: next });
    const r = next ? await publish() : await unpublish();
    if (!r.ok) {
      store.getState().patchSettings({ vidljiv: before });
      return { ok: false, reason: deps.online() ? (lastReason ?? r.reason) : 'mreza' };
    }
    if (!next) store.getState().setRemote({ profiles: null, opened: null });
    return r;
  }

  /** Nov nadimak se šalje SAMO ako je profil već vidljiv — inače bi promena teksta napravila red u bazi za nekoga ko Zajednicu nije uključio. */
  function setNickname(value: string): void {
    store.getState().patchSettings({ nadimak: value.trim().slice(0, 24) });
    if (visible()) void publish();
  }

  async function load(): Promise<void> {
    if (!active()) return;
    store.getState().setRemote({ loading: true, error: null });
    const r = await deps.api.load();
    if (!r.ok) {
      store.getState().setRemote({ loading: false, error: r.reason });
      return;
    }
    store.getState().setRemote({
      loading: false,
      profiles: r.profiles,
      challenge: r.challenge,
      loadedAt: deps.now()
    });
  }

  /** Spisak se osvežava PRI ULASKU u tab, ali ne češće od pet minuta i nikad pražnjenjem ekrana (stari spisak ostaje dok novi ne stigne). */
  function refreshIfDue(): void {
    const s = store.getState();
    if (!active() || s.loading) return;
    if (s.profiles != null && deps.now() - s.loadedAt < REFRESH_AFTER_MS) return;
    void load();
  }

  return {
    publish,
    unpublish,
    setVisible,
    setNickname,
    load,
    refreshIfDue,
    /** Jedan upis po pokretanju, bezuslovno: ko je Zajednicu uključio pre nego što je aplikacija znala njegovu sliku, inače bi imao prazan avatar doveka. */
    publishOnStart(): void {
      if (active()) void publish();
    },
    reason: (): FailReason | null => lastReason
  };
}

export type Community = ReturnType<typeof createCommunity>;
