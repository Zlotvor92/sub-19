/* ZAJEDNICA: lokalno podešavanje (`zajed` — `vidljiv:false` podrazumevano, nadimak) i spisak javnih profila (server-state,
   NE perzistira se). Plan i istorija su lični: u javni profil ide samo ono što je korisnik uključio. */

import { create } from 'zustand';
import type { CommunityState, PersistedState } from '../domain/state';
import { pickKnown, requestPersist, COMMUNITY_KEYS } from './persistence';

export type CommunitySlice = Pick<PersistedState, (typeof COMMUNITY_KEYS)[number]>;

export interface CommunityActions {
  hydrate: (slice: CommunitySlice) => void;
  patchSettings: (patch: Partial<CommunityState>) => void;
}

export interface CommunityRemote {
  /** Profili ostalih (server-state; ne perzistira se). */
  profiles: unknown[] | null;
  loading: boolean;
  error: string | null;
}

export const useCommunityStore = create<CommunitySlice & CommunityActions & CommunityRemote>()(
  (set, get) => ({
    zajed: { vidljiv: false, nadimak: '' },
    profiles: null,
    loading: false,
    error: null,
    hydrate(slice) {
      set(slice);
    },
    patchSettings(patch) {
      set({ zajed: { ...get().zajed, ...patch } });
      requestPersist();
    }
  })
);

export const communitySliceFrom = (s: PersistedState): CommunitySlice =>
  pickKnown(s, COMMUNITY_KEYS);
