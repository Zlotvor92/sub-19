/* ZAJEDNICA: lokalno podešavanje (`zajed` — `vidljiv:false` podrazumevano, nadimak) i spisak javnih profila (server-state,
   NE perzistira se). Plan i istorija su lični: u javni profil ide samo ono što je korisnik uključio. */

import { create } from 'zustand';
import type { MeasureKey, Profile } from '../domain/community';
import type { CommunityState, PersistedState } from '../domain/state';
import { pickKnown, requestPersist, COMMUNITY_KEYS } from './persistence';

export type CommunitySlice = Pick<PersistedState, (typeof COMMUNITY_KEYS)[number]>;

export interface CommunityActions {
  hydrate: (slice: CommunitySlice) => void;
  patchSettings: (patch: Partial<CommunityState>) => void;
}

export interface CommunityRemote {
  /** Profili ostalih (server-state; ne perzistira se). */
  profiles: Profile[] | null;
  /** Tekst izazova nedelje. */
  challenge: string | null;
  loading: boolean;
  /** Razlog neuspelog povlačenja (prevodi se u rečenicu). */
  error: string | null;
  /** Kad je spisak poslednji put uspešno povučen (ms). */
  loadedAt: number;
  /** Izbor na ekranu (ne perzistira se): filter po cilju, merilo, otvoren profil. */
  filter: string;
  measure: MeasureKey;
  opened: string | null;
}

export interface CommunityRemoteActions {
  setRemote: (patch: Partial<CommunityRemote>) => void;
}

export const useCommunityStore = create<
  CommunitySlice & CommunityActions & CommunityRemote & CommunityRemoteActions
>()((set, get) => ({
  zajed: { vidljiv: false, nadimak: '' },
  profiles: null,
  challenge: null,
  loading: false,
  error: null,
  loadedAt: 0,
  filter: 'sve',
  measure: 't3k',
  opened: null,
  setRemote(patch) {
    set(patch);
  },
  hydrate(slice) {
    set(slice);
  },
  patchSettings(patch) {
    set({ zajed: { ...get().zajed, ...patch } });
    requestPersist();
  }
}));

export const communitySliceFrom = (s: PersistedState): CommunitySlice =>
  pickKnown(s, COMMUNITY_KEYS);
